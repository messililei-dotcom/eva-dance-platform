package cn.com.swod.app;

import android.content.Context;
import org.json.JSONObject;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

final class ReleaseInfo {
    static String read(Context context, String asset) throws Exception {
        try (var in = context.getAssets().open(asset)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buffer = new byte[4096]; int length;
            while ((length = in.read(buffer)) != -1) out.write(buffer, 0, length);
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
    static JSONObject data(Context context) {
        try { return new JSONObject(read(context, "release-info.json")); }
        catch (Exception error) { throw new IllegalStateException("Missing release metadata", error); }
    }
    static String version(Context context) {
        try {
            android.content.pm.PackageInfo info = context.getPackageManager().getPackageInfo(context.getPackageName(), 0);
            return info.versionName + " (" + info.versionCode + ")";
        } catch (Exception error) { return ""; }
    }
    private ReleaseInfo() {}
}
