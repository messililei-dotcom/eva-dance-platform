package cn.com.swod.app;

import android.app.Activity;
import android.os.Handler;
import android.os.Looper;
import com.mobile.auth.gatewayauth.AuthUIConfig;
import com.mobile.auth.gatewayauth.PhoneNumberAuthHelper;
import com.mobile.auth.gatewayauth.TokenResultListener;
import org.json.JSONObject;

/** Initializes the operator SDK only after the learner explicitly requests login. */
final class CarrierLogin {
    interface Result { void complete(String token, String error); }
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PhoneNumberAuthHelper helper;
    private Result pending;
    private long generation;
    private final Runnable timeout = () -> finish(null, "本机号码登录超时，请使用短信登录");

    void start(Activity activity, Result result) {
        if (pending != null) return;
        pending = result;
        final long attempt = ++generation;
        try {
            JSONObject config;
            try (java.io.InputStream input = activity.getAssets().open("number-auth.json")) {
                java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream();
                byte[] buffer = new byte[2048]; int count;
                while ((count = input.read(buffer)) != -1) bytes.write(buffer, 0, count);
                config = new JSONObject(bytes.toString("UTF-8"));
            }
            if (!activity.getPackageName().equals(config.optString("packageName")) || config.optString("sdkSecret").isEmpty()) {
                finish(null, "本机号码登录配置未就绪，请使用短信登录"); return;
            }
            helper = PhoneNumberAuthHelper.getInstance(activity, new TokenResultListener() {
                public void onTokenSuccess(String value) { handler.post(() -> { if (generation == attempt) receive(value, true); }); }
                public void onTokenFailed(String value) { handler.post(() -> { if (generation == attempt) receive(value, false); }); }
            });
            helper.getReporter().setLoggerEnable(false);
            helper.setAuthSDKInfo(config.getString("sdkSecret"));
            helper.setAuthUIConfig(new AuthUIConfig.Builder()
                    .setNavText("本机号码登录").setLogBtnText("本机号码一键登录")
                    .setPrivacyState(false)
                    .setAppPrivacyOne("隐私政策", "https://www.swod.com.cn/privacy")
                    .setAppPrivacyTwo("服务条款", "https://www.swod.com.cn/terms").create());
            handler.postDelayed(timeout, 20_000);
            helper.getLoginToken(activity, 8_000);
        } catch (Exception | LinkageError error) {
            finish(null, "暂时无法使用本机号码登录，请使用短信登录");
        }
    }
    private void receive(String value, boolean success) {
        if (pending == null) return;
        try {
            JSONObject response = new JSONObject(value);
            String code = response.optString("code");
            if (success && code.equals("600000") && !response.optString("token").isEmpty()) finish(response.getString("token"), null);
            else if (code.equals("700000") || code.equals("700001")) finish(null, null);
            else if (!success) finish(null, "本机号码登录暂不可用，请使用短信登录");
            // Authorization-page presentation and checkbox events do not sign anyone in.
        } catch (Exception error) { finish(null, "号码认证响应异常，请使用短信登录"); }
    }
    void cancel() { finish(null, null); }
    private void finish(String token, String error) {
        generation++;
        handler.removeCallbacks(timeout);
        Result result = pending; pending = null;
        if (helper != null) { helper.setAuthListener(null); helper.quitLoginPage(); helper = null; }
        if (result != null) result.complete(token, error);
    }
}
