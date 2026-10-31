package cn.com.swod.app;
import android.content.Context;
import android.content.Intent;
import com.alibaba.sdk.android.push.MessageReceiver;
import com.alibaba.sdk.android.push.notification.CPushMessage;
import org.json.JSONObject;
import java.util.Map;
public final class SwodPushReceiver extends MessageReceiver {
    @Override protected void onNotificationOpened(Context c,String title,String summary,String extra){
        if(!Api.get(c).loggedIn())return;
        try{String id=new JSONObject(extra).optString("recipientId");if(!id.matches("[1-9][0-9]{0,15}"))return;c.startActivity(new Intent(c,MainActivity.class).putExtra("pushRecipientId",id).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP));}catch(Exception ignored){}
    }
    @Override protected void onMessage(Context c,CPushMessage message) { /* Foreground unread refresh uses canonical server data. */ }
    @Override protected void onNotification(Context c,String title,String summary,Map<String,String> extras) {}
    @Override protected void onNotificationClickedWithNoAction(Context c,String title,String summary,String extra) { onNotificationOpened(c,title,summary,extra); }
    @Override protected void onNotificationReceivedInApp(Context c,String title,String summary,Map<String,String> map,int openType,String activity,String url) {}
    @Override protected void onNotificationRemoved(Context c,String messageId) {}
}
