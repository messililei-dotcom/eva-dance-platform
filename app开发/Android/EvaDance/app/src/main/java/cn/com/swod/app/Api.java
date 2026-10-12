package cn.com.swod.app;

import android.content.Context;
import org.json.JSONObject;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.util.UUID;
import java.nio.charset.StandardCharsets;

public final class Api {
    public static final class Failure extends Exception {
        public final int status;
        Failure(int status, String message) { super(message); this.status = status; }
    }
    private static Api instance;
    public static synchronized Api get(Context context) { if (instance == null) instance = new Api(context); return instance; }
    private final TokenVault vault;
    private JSONObject session;
    private long generation;
    private Api(Context context) { vault = new TokenVault(context); try { String saved = vault.read(); if (saved != null) session = new JSONObject(saved); } catch (Exception e) { vault.clear(); } }
    public synchronized boolean loggedIn() { return session != null; }
    public synchronized void accept(JSONObject credentials) throws Exception { vault.save(credentials.toString()); session = credentials; generation++; }
    public synchronized void clear() { generation++; session = null; vault.clear(); }
    public void logout() throws Exception { String old; synchronized(this) { old = session == null ? null : session.optString("token"); clear(); } if (old != null) exchange("/auth/logout", "POST", new JSONObject(), old, false); }
    public Object request(String path, String method, JSONObject body, boolean auth) throws Exception {
        if (!Policy.safePath(path)) throw new Failure(400, "接口地址无效");
        String token; long version;
        synchronized(this) { token = auth && session != null ? session.optString("token") : null; version = generation; }
        if (auth && token == null) throw new Failure(401, "请先登录");
        try { return exchange(path, method, body, token, !auth && Policy.publicRead(path, method)); }
        catch (Failure failure) {
            if (failure.status != 401 || token == null) throw failure;
            String renewed;
            synchronized(this) {
                if (version != generation || session == null) throw new Failure(401, "账号已切换，请重新打开此页面");
                // Requests queued behind a refresh reuse the rotated token instead of replaying the refresh token.
                if (token.equals(session.optString("token"))) {
                    try {
                        JSONObject next = (JSONObject) exchange("/auth/refresh", "POST", new JSONObject().put("refreshToken", session.getString("refreshToken")), null, false);
                        vault.save(next.toString()); session = next;
                    } catch (Failure e) { if (e.status == 401) clear(); throw e; }
                }
                renewed = session.getString("token");
            }
            return exchange(path, method, body, renewed, false);
        }
    }
    private Object exchange(String path, String method, JSONObject body, String token, boolean publicRead) throws Exception {
        JSONObject envelope = transport((publicRead ? Policy.PUBLIC_API : Policy.API), path, method, body, token, false);
        return envelope.opt("data");
    }
    public JSONObject staffLogin(String username, String password) throws Exception {
        JSONObject credentials = transport("https://admin.swod.com.cn/api", "/login", "POST", new JSONObject().put("username", username).put("password", password), null, true);
        String role = credentials.getJSONObject("user").optString("role");
        if (!role.equals("admin") && !role.equals("event_admin")) throw new Failure(403, "当前账号没有赛事管理权限");
        if (credentials.optString("token").isEmpty()) throw new Failure(502, "管理登录返回异常");
        return credentials;
    }
    public Object staffRequest(String path, String method, JSONObject body, String token) throws Exception {
        if (!Policy.safePath(path) || !path.startsWith("/event/") || token == null || token.isEmpty()) throw new Failure(401, "请使用工作人员账号登录");
        return transport("https://admin.swod.com.cn/api", path, method, body, token, false).opt("data");
    }
    private JSONObject transport(String base, String path, String method, JSONObject body, String token, boolean raw) throws Exception {
        return transportBytes(base, path, method, (body == null ? "{}" : body.toString()).getBytes(StandardCharsets.UTF_8), "application/json", token, raw);
    }
    private JSONObject transportBytes(String base, String path, String method, byte[] bytes, String contentType, String token, boolean raw) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(base + path).openConnection();
        c.setInstanceFollowRedirects(false); c.setConnectTimeout(20000); c.setReadTimeout(20000); c.setUseCaches(false);
        c.setRequestMethod(method); c.setRequestProperty("Content-Type", contentType); c.setRequestProperty("x-client-platform", "android");
        if (token != null) c.setRequestProperty("Authorization", "Bearer " + token);
        try {
            if (!method.equals("GET")) { c.setDoOutput(true); try (var out = c.getOutputStream()) { out.write(bytes); } }
            int status = c.getResponseCode();
            if (status >= 300 && status < 400) throw new Failure(status, "服务地址发生变化，请稍后重试");
            InputStream stream = status >= 400 ? c.getErrorStream() : c.getInputStream();
            String text = "{}";
            if (stream != null) try (stream) { ByteArrayOutputStream bytes = new ByteArrayOutputStream(); byte[] chunk = new byte[8192]; int n; while ((n = stream.read(chunk)) != -1) { bytes.write(chunk, 0, n); if (bytes.size() > 2_000_000) throw new Failure(502, "响应内容过大"); } text = bytes.toString("UTF-8"); }
            JSONObject envelope;
            try { envelope = new JSONObject(text); } catch (Exception e) { throw new Failure(status, "服务暂不可用，请重试"); }
            if (status < 200 || status >= 300 || (!raw && !envelope.optBoolean("success"))) throw new Failure(status, envelope.optString("message", envelope.optString("error", "请求失败，请重试")));
            return envelope;
        } finally { c.disconnect(); }
    }
    public Object registerWithMusic(int event, JSONObject fields, String filename, byte[] music) throws Exception {
        if (event <= 0 || music == null || music.length == 0 || music.length > 10 * 1024 * 1024) throw new Failure(400, "请选择10MB以内的音乐文件");
        String boundary = "EvaMusic-" + UUID.randomUUID();
        ByteArrayOutputStream data = new ByteArrayOutputStream();
        for (String key : new String[]{"groupId","name","phone","organization","teacher","performanceTitle","remark"}) {
            String value = fields.optString(key, ""); if (value.length() > 1000) throw new Failure(400, "报名内容过长");
            data.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"" + key + "\"\r\n\r\n" + value + "\r\n").getBytes(StandardCharsets.UTF_8));
        }
        String safeName = filename.replaceAll("[\\r\\n\"\\\\/]", "_");
        data.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"musicFile\"; filename=\"" + safeName + "\"\r\nContent-Type: application/octet-stream\r\n\r\n").getBytes(StandardCharsets.UTF_8));
        data.write(music); data.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
        String token; long version; synchronized(this) { if(session == null) throw new Failure(401, "请先登录"); token = session.getString("token"); version = generation; }
        String path = "/events/" + event + "/register";
        try { return transportBytes(Policy.API, path, "POST", data.toByteArray(), "multipart/form-data; boundary="+boundary, token, false).opt("data"); }
        catch(Failure error) {
            if(error.status != 401) throw error;
            request("/member/profile", "GET", null, true);
            synchronized(this) { if(session == null || version != generation) throw new Failure(401, "账号已切换，请重新打开报名页面"); token = session.getString("token"); }
            return transportBytes(Policy.API, path, "POST", data.toByteArray(), "multipart/form-data; boundary="+boundary, token, false).opt("data");
        }
    }

}
