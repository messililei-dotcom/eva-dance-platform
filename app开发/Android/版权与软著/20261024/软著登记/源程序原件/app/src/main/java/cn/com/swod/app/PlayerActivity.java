package cn.com.swod.app;

import android.app.Activity;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.media.MediaPlayer;
import android.view.MotionEvent;
import android.view.WindowInsets;
import android.widget.*;
import org.json.JSONObject;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Authorization precedes playback; a conflicting checkpoint never overwrites another device. */
public final class PlayerActivity extends Activity {
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler timer=new Handler(Looper.getMainLooper());
    private VideoView video;
    private TextView status;
    private MediaPlayer media;
    private float selectedRate=1,holdX,holdY;
    private boolean holdingSpeed,holdPending;
    private final Runnable holdBoost=()->{
        holdPending=false;
        if(media==null||!this.ready||!this.resumed||!video.isPlaying())return;
        try { media.setPlaybackParams(media.getPlaybackParams().setSpeed(2));holdingSpeed=true;status.setText("2 倍播放 · 松手恢复"); }
        catch(Exception ignored){endHoldSpeed();}
    };
    private void endHoldSpeed(){
        timer.removeCallbacks(holdBoost);holdPending=false;
        if(holdingSpeed){holdingSpeed=false;applyPlaybackRate(selectedRate);status.setText("已验证学习权限");}
    }
    private void applyPlaybackRate(float rate){
        if(media==null)return;
        try{boolean wasPlaying=video.isPlaying();media.setPlaybackParams(media.getPlaybackParams().setSpeed(rate));if(!wasPlaying)media.pause();}
        catch(Exception e){status.setText("本设备暂不支持此播放速度");}
    }
    @android.annotation.SuppressLint("ClickableViewAccessibility") // Short taps still reach VideoView's native accessible transport controls.
    private void installHoldSpeed(){
        video.setOnTouchListener((v,event)->{
            int action=event.getActionMasked();boolean consumed=holdingSpeed;
            if(action==MotionEvent.ACTION_DOWN){endHoldSpeed();if(ready&&video.isPlaying()){holdX=event.getX();holdY=event.getY();holdPending=true;timer.postDelayed(holdBoost,400);}}
            else if(action==MotionEvent.ACTION_MOVE){if(Math.max(Math.abs(event.getX()-holdX),Math.abs(event.getY()-holdY))>12*getResources().getDisplayMetrics().density)endHoldSpeed();}
            else if(action==MotionEvent.ACTION_UP||action==MotionEvent.ACTION_CANCEL||action==MotionEvent.ACTION_POINTER_DOWN){endHoldSpeed();}
            return consumed;
        });
    }
    private Api api;
    private int lesson,revision;
    private boolean ready,resumed,resumePlayback=true;
    private volatile boolean destroyed;
    private long seek;
    private final Runnable checkpoint=new Runnable(){public void run(){saveProgress();if(!destroyed&&resumed)timer.postDelayed(this,15000);}};
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);api=Api.get(this);lesson=getIntent().getIntExtra("lesson",0);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets p=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());root.setPadding(p.left,p.top,p.right,p.bottom);}else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        TextView title=new TextView(this);title.setText(getIntent().getStringExtra("title"));title.setTextSize(18);root.addView(title);
        video=new VideoView(this);root.addView(video,new LinearLayout.LayoutParams(-1,0,1));MediaController controls=new MediaController(this);controls.setAnchorView(video);video.setMediaController(controls);
        status=new TextView(this);status.setText("正在验证课程权限…");root.addView(status);
        LinearLayout actions=new LinearLayout(this);CheckBox mirror=new CheckBox(this);mirror.setText("镜像");mirror.setOnCheckedChangeListener((b,on)->video.setScaleX(on?-1:1));actions.addView(mirror);
        CheckBox loop=new CheckBox(this);loop.setText("循环播放");actions.addView(loop);
        Spinner speed=new Spinner(this);speed.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"0.75×","1.0×","1.25×","1.5×"}));speed.setSelection(1);actions.addView(speed);root.addView(actions);
        EditText note=new EditText(this);note.setHint("记录练习笔记");root.addView(note);Button add=new Button(this);add.setText("保存本节笔记");root.addView(add);
        add.setOnClickListener(v->{String text=note.getText().toString().trim();if(text.isEmpty()||text.length()>5000||!ready)return;int at=video.getCurrentPosition()/1000;add.setEnabled(false);io.execute(()->{try{api.request("/notes","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("content",text),true);runOnUiThread(()->{if(!destroyed){note.setText("");status.setText("笔记已保存");}});}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)add.setEnabled(true);});}});});
        Button bookmark=new Button(this);bookmark.setText("在当前位置添加书签");root.addView(bookmark);
        bookmark.setOnClickListener(v->{if(!ready)return;int at=video.getCurrentPosition()/1000;bookmark.setEnabled(false);io.execute(()->{try{api.request("/bookmarks","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("label","练习位置 "+at+" 秒"),true);message("书签已保存，可在个人中心打开");}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)bookmark.setEnabled(true);});}});});
        setContentView(root);
        installHoldSpeed();
        if(lesson<=0){status.setText("课节无效，请返回课程目录");return;}
        video.setOnCompletionListener(p->{endHoldSpeed();saveProgress();});
        video.setOnErrorListener((p,what,extra)->{endHoldSpeed();ready=false;status.setText("视频播放失败，请返回后重试");return true;});
        video.setOnPreparedListener(p->{if(destroyed)return;endHoldSpeed();media=p;ready=true;p.setLooping(loop.isChecked());video.seekTo((int)Math.min(seek,Math.max(0,video.getDuration()-1000)));if(resumed&&resumePlayback)video.start();status.setText("已验证学习权限");loop.setOnCheckedChangeListener((b,on)->p.setLooping(on));speed.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> v){}public void onItemSelected(android.widget.AdapterView<?> v,android.view.View x,int at,long id){endHoldSpeed();selectedRate=new float[]{.75f,1f,1.25f,1.5f}[at];applyPlaybackRate(selectedRate);}});if(resumed)timer.postDelayed(checkpoint,15000);});
        io.execute(()->{try{
            Object checkpoint=api.request("/video/"+lesson+"/progress","GET",null,true);
            if(checkpoint instanceof JSONObject){JSONObject c=(JSONObject)checkpoint;revision=c.optInt("revision");seek=c.optDouble("duration",0)>0&&c.optDouble("progress",0)>=c.optDouble("duration",0)?0:Math.round(c.optDouble("progress")*1000);}
            int explicitPosition=getIntent().getIntExtra("positionSeconds",-1);if(explicitPosition>=0)seek=explicitPosition*1000L;
            JSONObject play=(JSONObject)api.request("/video/"+lesson+"/play","GET",null,true);
            String url=play.optString("play_url");if(!play.optBoolean("authorized")||!Policy.secureURL(url))throw new Exception("当前没有此课节的有效学习权限");
            runOnUiThread(()->{if(!destroyed)video.setVideoURI(Uri.parse(url));});
        }catch(Exception e){message(e.getMessage());}});
    }
    private void saveProgress(){if(!ready||destroyed)return;double position=video.getCurrentPosition()/1000.0,duration=video.getDuration()/1000.0;if(duration<=0||position<0)return;
        io.execute(()->{try{JSONObject result=(JSONObject)api.request("/video/"+lesson+"/progress","POST",new JSONObject().put("progress",Math.min(position,duration)).put("duration",duration).put("revision",revision),true);revision=result.optInt("revision",revision);}
            catch(Api.Failure e){if(e.status==409){try{JSONObject c=(JSONObject)api.request("/video/"+lesson+"/progress","GET",null,true);revision=c.optInt("revision");message("另一设备已更新进度，本次没有覆盖。后续学习将继续同步。");}catch(Exception failure){message(failure.getMessage());}}else message(e.getMessage());}
            catch(Exception e){message("学习进度未同步，请检查网络");}});
    }
    private void message(String text){runOnUiThread(()->{if(!destroyed)status.setText(text);});}
    @Override protected void onPause(){endHoldSpeed();if(ready)resumePlayback=video.isPlaying();resumed=false;saveProgress();video.pause();timer.removeCallbacks(checkpoint);super.onPause();}
    @Override protected void onResume(){super.onResume();resumed=true;if(ready){if(resumePlayback)video.start();timer.removeCallbacks(checkpoint);timer.postDelayed(checkpoint,15000);}}
    @Override protected void onDestroy(){endHoldSpeed();media=null;timer.removeCallbacksAndMessages(null);destroyed=true;video.stopPlayback();io.shutdown();super.onDestroy();}
}
