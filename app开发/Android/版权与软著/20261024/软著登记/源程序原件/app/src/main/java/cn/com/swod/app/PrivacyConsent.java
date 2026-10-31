package cn.com.swod.app;

import android.app.Activity;
import android.content.Context;
import android.widget.*;

/** Offline first-use notice. No Api/TokenVault or remote content is initialized before acceptance. */
final class PrivacyConsent {
    static boolean accepted(Context c) {
        return ReleaseInfo.data(c).optString("privacyVersion").equals(c.getSharedPreferences("privacy-consent", Context.MODE_PRIVATE).getString("version", ""));
    }
    static boolean revoke(Context c) { return c.getSharedPreferences("privacy-consent", Context.MODE_PRIVATE).edit().clear().commit(); }
    static void welcome(Activity activity, Runnable start) {
        LinearLayout root = new LinearLayout(activity); root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(32, 32, 32, 32); root.setBackgroundColor(SwodUi.canvas(activity));
        root.setOnApplyWindowInsetsListener((v, i) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets safe = i.getInsets(android.view.WindowInsets.Type.systemBars());
                root.setPadding(safe.left + 32, safe.top + 32, safe.right + 32, safe.bottom + 32);
            } else root.setPadding(32, i.getSystemWindowInsetTop() + 32, 32, i.getSystemWindowInsetBottom() + 32);
            return i;
        });
        TextView heading = new TextView(activity); heading.setText("欢迎使用 SWOD"); heading.setTextSize(24); heading.setTextColor(SwodUi.ink(activity)); root.addView(heading);
        TextView body = new TextView(activity);
        body.setText("请先阅读隐私政策和服务条款。\n\n同意前不加载业务接口或远程图片。登录时由您主动填写手机号与验证码；App 不读取短信、SIM 或通讯录。学习和个人信息按服务端验证的账号隔离。\n\n您可查看本机内置文件，或选择暂不使用并退出。之后可在“关于 SWOD”撤回授权，账号注销另行申请。");
        body.setTextSize(16); body.setTextColor(SwodUi.ink(activity)); root.addView(body);
        add(root, "阅读隐私政策", () -> document(activity, "app-privacy.txt", () -> welcome(activity, start)));
        add(root, "阅读服务条款", () -> document(activity, "app-terms.txt", () -> welcome(activity, start)));
        add(root, "服务商与数据清单", () -> document(activity, "app-processors.txt", () -> welcome(activity, start)));
        add(root, "同意并继续", () -> {
            boolean saved = activity.getSharedPreferences("privacy-consent", Context.MODE_PRIVATE).edit().putString("version", ReleaseInfo.data(activity).optString("privacyVersion")).commit();
            if (saved) start.run(); else Toast.makeText(activity, "保存失败，请重试", Toast.LENGTH_LONG).show();
        });
        add(root, "暂不同意，退出 App", activity::finish);
        // Keep every choice reachable on small screens, landscape and large system fonts.
        ScrollView page = new ScrollView(activity); page.setFillViewport(true); page.addView(root);
        activity.setContentView(page);
    }
    private static void document(Activity activity, String asset, Runnable back) {
        LinearLayout root = new LinearLayout(activity); root.setOrientation(LinearLayout.VERTICAL); root.setPadding(24, 64, 24, 48);
        root.setBackgroundColor(SwodUi.canvas(activity));
        ScrollView scroll = new ScrollView(activity); TextView text = new TextView(activity);
        try { text.setText(ReleaseInfo.read(activity, asset)); } catch (Exception error) { text.setText("文件读取失败，请返回重试"); }
        text.setTextSize(16); text.setTextColor(SwodUi.ink(activity)); scroll.addView(text); root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        add(root, "返回隐私提示", back); activity.setContentView(root);
    }
    private static void add(LinearLayout root, String name, Runnable action) {
        Button button = new Button(root.getContext()); button.setText(name); button.setAllCaps(false); button.setMinHeight(Math.round(48 * root.getResources().getDisplayMetrics().density));
        button.setOnClickListener(v -> action.run()); root.addView(button, new LinearLayout.LayoutParams(-1, -2));
    }
    private PrivacyConsent() {}
}
