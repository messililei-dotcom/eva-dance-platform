package cn.com.swod.app;

import android.app.*;
import android.content.*;
import android.os.Build;
import android.provider.Settings;
import com.alibaba.sdk.android.push.CloudPushService;
import com.alibaba.sdk.android.push.CommonCallback;
import com.alibaba.sdk.android.push.noonesdk.PushServiceFactory;
import org.json.JSONObject;
import java.util.UUID;

/** Registration is opt-in, after privacy consent and a live server capability check. */
public final class AppPush {
    public static final String CHANNEL = "swod_learning";
    private static boolean initialized, registering;
    private static String registeredSession = "";
    private AppPush() {}
    static String installation(Context c) {
        android.content.SharedPreferences p=c.getSharedPreferences("push-settings",Context.MODE_PRIVATE);
        String id=p.getString("installation","");
        if(id.length()!=64){id=(UUID.randomUUID().toString()+UUID.randomUUID()).replace("-","").toLowerCase(java.util.Locale.ROOT);p.edit().putString("installation",id).apply();}
        return id;
    }
    public static void initialize(Application app) {
        if(initialized)return;
        try {
            JSONObject config=configuration(app);
            if(config.optString("appKey").isEmpty()||config.optString("appSecret").isEmpty())return;
            // No network registration before explicit notification opt-in.
            com.alibaba.sdk.android.push.noonesdk.PushInitConfig init=new com.alibaba.sdk.android.push.noonesdk.PushInitConfig.Builder().application(app).appKey(config.getString("appKey")).appSecret(config.getString("appSecret")).build();
            PushServiceFactory.init(init);PushServiceFactory.getCloudPushService().setLogLevel(CloudPushService.LOG_OFF);initialized=true;
            NotificationChannel channel=new NotificationChannel(CHANNEL,"学习服务通知",NotificationManager.IMPORTANCE_DEFAULT);
            channel.setDescription("课程、赛事和账号服务消息");channel.setLockscreenVisibility(Notification.VISIBILITY_PRIVATE);
            app.getSystemService(NotificationManager.class).createNotificationChannel(channel);
        }catch(Exception ignored){}
    }
    private static JSONObject configuration(Context c)throws Exception{
        try(java.io.InputStream in=c.getAssets().open("push.local.json")){return new JSONObject(new String(readConfig(in),java.nio.charset.StandardCharsets.UTF_8));}
    }
    private static byte[] readConfig(java.io.InputStream in)throws Exception{java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] block=new byte[2048];int n;while((n=in.read(block))!=-1){out.write(block,0,n);if(out.size()>16384)throw new java.io.IOException();}return out.toByteArray();}
    public static boolean allowed(Context c){return c.getSystemService(NotificationManager.class).areNotificationsEnabled();}
    public static void settings(Activity activity){activity.startActivity(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE,activity.getPackageName()));}
    public static void enable(Activity activity,Runnable refresh){
        if(Build.VERSION.SDK_INT>=33&&activity.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED){activity.requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},701);return;}
        if(!allowed(activity)){settings(activity);return;}
        activity.getSharedPreferences("push-settings",Context.MODE_PRIVATE).edit().putBoolean("enabled",true).apply();
        register(activity.getApplication(),refresh);
    }
    public static void register(Application app,Runnable refresh){
        Api api=Api.get(app);if(!allowed(app)&&!registeredSession.isEmpty()){revoke(app,registeredSession);clear(app);}if(registering||!api.loggedIn()||!allowed(app)||!app.getSharedPreferences("push-settings",Context.MODE_PRIVATE).getBoolean("enabled",false))return;
        String binding=api.sessionID();if(binding.equals(registeredSession))return;
        registering=true;
        new Thread(()->{try{
            JSONObject config=(JSONObject)api.request("/config","GET",null,false);
            if(!config.optJSONObject("push").optBoolean("enabled")){registering=false;return;}
            api.request("/push/permits","POST",new JSONObject().put("installationId",installation(app)),true);
            new android.os.Handler(app.getMainLooper()).post(()->{
                if(!binding.equals(api.sessionID())){registering=false;return;}
                initialize(app);
                if(!initialized){registering=false;return;}
                CloudPushService service=PushServiceFactory.getCloudPushService();
                try { JSONObject vendor=configuration(app);
                    if(vendor.optBoolean("huaweiEnabled"))com.alibaba.sdk.android.push.huawei.HuaWeiRegister.register(app);
                    if(!vendor.optString("xiaomiAppId").isEmpty()&&!vendor.optString("xiaomiAppKey").isEmpty())com.alibaba.sdk.android.push.register.MiPushRegister.register(app,vendor.getString("xiaomiAppId"),vendor.getString("xiaomiAppKey"));
                    if(!vendor.optString("oppoAppKey").isEmpty()&&!vendor.optString("oppoAppSecret").isEmpty())com.alibaba.sdk.android.push.register.OppoRegister.register(app,vendor.getString("oppoAppKey"),vendor.getString("oppoAppSecret"));
                    if(vendor.optBoolean("vivoEnabled"))com.alibaba.sdk.android.push.register.VivoRegister.register(app);
                }catch(Exception ignored){}
                service.register(app,new CommonCallback(){public void onSuccess(String result){new Thread(()->{try{if(!binding.equals(api.sessionID()))return;api.request("/push/devices","PUT",new JSONObject().put("installationId",installation(app)).put("deviceId",service.getDeviceId()).put("enabled",true),true);if(binding.equals(api.sessionID()))registeredSession=binding;}catch(Exception ignored){}finally{registering=false;if(refresh!=null)new android.os.Handler(app.getMainLooper()).post(refresh);}}).start();}public void onFailed(String code,String message){registering=false;}});
            });
        }catch(Exception ignored){registering=false;}}).start();
    }
    public static void revoke(Context c,String session){
        if(session==null||session.isEmpty())return;
        android.content.SharedPreferences p=c.getSharedPreferences("push-settings",Context.MODE_PRIVATE);
        java.util.Set<String> pending=new java.util.HashSet<>(p.getStringSet("revocations",java.util.Collections.emptySet()));pending.add(session);p.edit().putStringSet("revocations",pending).apply();flushRevocations(c);
    }
    public static void flushRevocations(Context c){
        android.content.SharedPreferences p=c.getSharedPreferences("push-settings",Context.MODE_PRIVATE);
        java.util.Set<String> pending=new java.util.HashSet<>(p.getStringSet("revocations",java.util.Collections.emptySet()));if(pending.isEmpty())return;
        new Thread(()->{for(String old:pending)try{Api.get(c).request("/push/unbind","POST",new JSONObject().put("installationId",installation(c)).put("pushSessionId",old),false);synchronized(AppPush.class){java.util.Set<String> next=new java.util.HashSet<>(p.getStringSet("revocations",java.util.Collections.emptySet()));next.remove(old);p.edit().putStringSet("revocations",next).apply();}}catch(Exception ignored){return;}}).start();
    }
    public static void clear(Context c){registeredSession="";c.getSystemService(NotificationManager.class).cancelAll();}
}
