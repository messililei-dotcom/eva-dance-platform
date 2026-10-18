package cn.com.swod.app;

import java.net.URI;
import java.util.Locale;

/** Shared service owns authorization; public reads never carry account credentials. */
public final class Policy {
    public static final String API = "https://admin.swod.com.cn/api/app/v1";
    public static final String PUBLIC_API = "https://admin.swod.com.cn/api/mini";
    public static boolean publicRead(String path, String method) {
        if (path == null || method == null) return false;
        String route = path.split("\\?", 2)[0];
        return method.equals("GET") && route.matches("^/(public/(series(/[1-9][0-9]*(/(courses|detail))?)?|offline-courses|calendar|home-stats)|events(/[1-9][0-9]*)?)$");
    }
    public static boolean safePath(String path) {
        return path != null && path.startsWith("/") && !path.startsWith("//") && !path.contains("..") && !path.contains("://") && !path.contains("\\") && !path.matches(".*[\\r\\n\\t].*") && !path.toLowerCase(Locale.ROOT).matches(".*%(2f|2e|5c|25).*?");
    }
    public static boolean secureURL(String text) {
        if (text == null) return false;
        try { URI u = URI.create(text); return "https".equals(u.getScheme()) && u.getHost() != null && u.getUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443); }
        catch (IllegalArgumentException e) { return false; }
    }
    public static boolean sessionTokens(String access, String refresh) {
        return access != null && refresh != null && access.matches("eva_a_[A-Za-z0-9_-]{43}") && refresh.matches("eva_r_[A-Za-z0-9_-]{64}");
    }
    public static boolean certificateURL(String text) {
        if (!secureURL(text)) return false;
        URI u = URI.create(text);
        return (u.getHost().equals("www.swod.com.cn") || u.getHost().equals("admin.swod.com.cn") || u.getHost().equals("swod.com.cn")) &&
            (u.getPath().equals("/certification") || u.getPath().startsWith("/api/public/certificates/") || u.getPath().matches("/api/certificates/[1-9][0-9]*/render\\.svg"));
    }
    private Policy() {}
}
