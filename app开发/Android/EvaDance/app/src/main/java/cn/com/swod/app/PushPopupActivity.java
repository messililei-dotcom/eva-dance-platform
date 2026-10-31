package cn.com.swod.app;
import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import com.alibaba.sdk.android.push.popup.PopupNotifyClick;
import com.alibaba.sdk.android.push.popup.PopupNotifyClickListener;
import java.util.Map;
/** OEM cold-start entry. Every destination is reloaded with the current verified session. */
public final class PushPopupActivity extends Activity implements PopupNotifyClickListener {
    private final PopupNotifyClick parser=new PopupNotifyClick(this);
    @Override public void onCreate(Bundle state){super.onCreate(state);parser.onCreate(this,getIntent());}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);parser.onNewIntent(intent);}
    @Override public void onSysNoticeOpened(String title,String summary,Map<String,String> extras){
        Intent target=new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
        if(Api.get(this).loggedIn()&&extras!=null){String id=extras.get("recipientId");if(id!=null&&id.matches("[1-9][0-9]{0,15}"))target.putExtra("pushRecipientId",id);}
        startActivity(target);finish();
    }
}
