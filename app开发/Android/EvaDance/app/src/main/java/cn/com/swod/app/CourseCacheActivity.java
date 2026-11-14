package cn.com.swod.app;

import android.app.*;
import android.os.Bundle;
import android.content.Intent;
import android.view.WindowInsets;
import android.widget.*;
import org.json.JSONObject;

public final class CourseCacheActivity extends Activity {
    private CourseCacheManager cache;
    private LinearLayout list;
    private final Runnable renderTask=this::render;
    public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);cache=CourseCacheManager.get(this);
        ScrollView scroll=new ScrollView(this);list=new LinearLayout(this);list.setOrientation(LinearLayout.VERTICAL);list.setPadding(24,12,24,24);scroll.addView(list);scroll.setBackgroundColor(SwodUi.canvas(this));
        scroll.setOnApplyWindowInsetsListener((v,i)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars());scroll.setPadding(s.left,s.top,s.right,s.bottom);}else scroll.setPadding(i.getSystemWindowInsetLeft(),i.getSystemWindowInsetTop(),i.getSystemWindowInsetRight(),i.getSystemWindowInsetBottom());return i;});setContentView(scroll);render();
        if(state==null){int lesson=getIntent().getIntExtra("downloadLesson",0);if(lesson>0)cache.download(lesson,getIntent().getStringExtra("title"),getIntent().getStringExtra("course"));}}
    private void text(String value,int size){TextView t=new TextView(this);t.setText(value);t.setTextSize(size);t.setTextColor(SwodUi.ink(this));t.setPadding(0,12,0,12);list.addView(t);}
    private void button(String title,Runnable r){Button b=new Button(this);b.setText(title);b.setAllCaps(false);b.setMinHeight(48);b.setOnClickListener(v->r.run());list.addView(b);}
    private void render(){if(list==null||isFinishing())return;list.removeAllViews();button("返回",this::finish);text("离线观看",22);text("联网时自动续期，授权有效期内可离线观看，最长24小时。设备重启后需联网验证；退出账号会删除本机离线内容。",14);if(!cache.message.isEmpty())text(cache.message,14);
        java.util.List<JSONObject> records=cache.visible();int active=cache.downloading();
        if(active>0&&cache.get(active)==null){ProgressBar waiting=new ProgressBar(this);waiting.setContentDescription("正在验证离线观看权限");list.addView(waiting);}
        if(records.isEmpty()&&active==0)text("暂无离线内容，请从课程播放设置中下载课节。",16);
        for(JSONObject r:records){int id=r.optInt("id");text(r.optString("course")+"\n"+r.optString("title"),17);String status=r.optString("state");
            if(status.equals("downloading")){ProgressBar p=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);p.setMax(100);p.setProgress(r.optInt("percent"));p.setContentDescription("课节下载进度 "+r.optInt("percent")+"%");list.addView(p);text("正在下载 "+r.optInt("percent")+"%",14);button("暂停下载",()->cache.pause(id));}
            else if(cache.usable(r)){text(android.text.format.Formatter.formatFileSize(this,r.optLong("bytes"))+" · 下载完成 100%"+(r.optBoolean("pending")?" · 学习进度待自动同步":""),13);button("离线观看",()->startActivity(new Intent(this,OfflineCourseActivity.class).putExtra("lesson",id)));}
            else {text(status.equals("ready")?"待联网自动验证":"下载已暂停，可重新下载",14);if(status.equals("paused"))button("重新下载",()->cache.download(id,r.optString("title"),r.optString("course")));}
            button("删除下载",()->new AlertDialog.Builder(this).setMessage("删除这节课的本机离线内容？").setNegativeButton("取消",null).setPositiveButton("删除",(d,w)->cache.remove(id)).show());
        }
    }
    protected void onResume(){super.onResume();cache.listen(renderTask);cache.refresh();render();}
    protected void onPause(){cache.unlisten(renderTask);super.onPause();}
}
