package cn.com.swod.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.net.Uri;
import android.media.MediaPlayer;
import android.view.MotionEvent;
import android.view.WindowInsets;
import android.widget.*;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Authorization precedes playback; a conflicting checkpoint never overwrites another device. */
public final class PlayerActivity extends androidx.activity.ComponentActivity {
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private final Handler timer=new Handler(Looper.getMainLooper());
    private VideoView video;
    private LinearLayout playerRoot;
    private boolean fullscreen;
    private int inlineVideoHeight;
    private int[] playlistIds;
    private String[] playlistNames;
    private int playlistIndex = -1;
    private TextView status;
    private String currentURL = "";
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
    private long playbackAccount, lastAuthorization;
    private boolean authorizationPending;
    private boolean ready,resumed,resumePlayback=true;
    private volatile boolean destroyed;
    private long seek;
    private final Runnable checkpoint=new Runnable(){public void run(){saveProgress();verifyAccess();if(!destroyed&&resumed)timer.postDelayed(this,15000);}};
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(fullscreen)setFullscreen(false);else finish();}});api=Api.get(this);playbackAccount=api.accountGeneration();lesson=getIntent().getIntExtra("lesson",0);
        LinearLayout root=new LinearLayout(this);playerRoot=root;inlineVideoHeight=Math.round(getResources().getDisplayMetrics().widthPixels*9f/16f);root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets p=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime());root.setPadding(p.left,p.top,p.right,p.bottom);}else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        TextView title=new TextView(this);title.setText(getIntent().getStringExtra("title"));title.setTextSize(18);root.addView(title);
        video=new VideoView(this);root.addView(video,new LinearLayout.LayoutParams(-1,inlineVideoHeight));MediaController controls=new MediaController(this);controls.setAnchorView(video);video.setMediaController(controls);
        ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);int gap=Math.round(12*getResources().getDisplayMetrics().density);content.setPadding(gap,0,gap,gap);scroll.addView(content);
        status=new TextView(this);status.setText("正在验证课程权限…");content.addView(status);
        playlistIds=getIntent().getIntArrayExtra("playlistIds");playlistNames=getIntent().getStringArrayExtra("playlistNames");
        if(playlistIds!=null&&playlistNames!=null&&playlistIds.length==playlistNames.length){
            for(int i=0;i<playlistIds.length;i++)if(playlistIds[i]==lesson)playlistIndex=i;
            if(playlistIndex>=0){
                LinearLayout navigation=new LinearLayout(this);
                Button previous=new Button(this);previous.setText("上一节");previous.setEnabled(playlistIndex>0);previous.setOnClickListener(v->selectLesson(playlistIndex-1));
                Button catalog=new Button(this);catalog.setText("目录 · "+playlistIds.length+" 节");catalog.setOnClickListener(v->{showDirectory();});
                Button next=new Button(this);next.setText("下一节");next.setEnabled(playlistIndex+1<playlistIds.length);next.setOnClickListener(v->selectLesson(playlistIndex+1));
                for(Button item:new Button[]{previous,catalog,next}){item.setAllCaps(false);item.setMinimumHeight(Math.round(48*getResources().getDisplayMetrics().density));navigation.addView(item,new LinearLayout.LayoutParams(0,-2,1));}content.addView(navigation);
            }
        }
        if(CoursePolicy.isAudio(getIntent().getStringExtra("title"))){TextView audio=new TextView(this);audio.setText("SWOD · 音频课程，播放时没有视频画面");audio.setTextSize(18);content.addView(audio,0);}
        LinearLayout actions=new LinearLayout(this);CheckBox mirror=new CheckBox(this);mirror.setText("镜像");mirror.setOnCheckedChangeListener((b,on)->video.setScaleX(on?-1:1));actions.addView(mirror);
        CheckBox loop=new CheckBox(this);loop.setText("循环播放");actions.addView(loop);
        Spinner speed=new Spinner(this);speed.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"0.75×","1.0×","1.25×","1.5×"}));speed.setSelection(1);actions.addView(speed);content.addView(actions);
        Spinner quality=new Spinner(this);quality.setContentDescription("视频清晰度");content.addView(quality);
        EditText note=new EditText(this);note.setHint("记录练习笔记");content.addView(note);Button add=new Button(this);add.setText("保存本节笔记");content.addView(add);
        add.setOnClickListener(v->{String text=note.getText().toString().trim();if(text.isEmpty()||text.length()>5000||!ready)return;int at=video.getCurrentPosition()/1000;add.setEnabled(false);io.execute(()->{try{api.request("/notes","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("content",text),true);runOnUiThread(()->{if(!destroyed){note.setText("");status.setText("笔记已保存");}});}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)add.setEnabled(true);});}});});
        Button bookmark=new Button(this);bookmark.setText("在当前位置添加书签");content.addView(bookmark);
        bookmark.setOnClickListener(v->{if(!ready)return;int at=video.getCurrentPosition()/1000;bookmark.setEnabled(false);io.execute(()->{try{api.request("/bookmarks","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("label","练习位置 "+at+" 秒"),true);message("书签已保存，可在个人中心打开");}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)bookmark.setEnabled(true);});}});});
        Button expand=new Button(this);expand.setText("全屏播放");expand.setOnClickListener(v->setFullscreen(true));content.addView(expand,0);
        setContentView(root);
        installHoldSpeed();
        if(lesson<=0){status.setText("课节无效，请返回课程目录");return;}
        video.setOnCompletionListener(p->{endHoldSpeed();saveProgress();});
        video.setOnErrorListener((p,what,extra)->{endHoldSpeed();ready=false;status.setText("视频播放失败，请返回后重试");return true;});
        video.setOnPreparedListener(p->{if(destroyed)return;endHoldSpeed();media=p;ready=true;quality.setEnabled(quality.getCount()>1);p.setLooping(loop.isChecked());video.seekTo((int)Math.min(seek,Math.max(0,video.getDuration()-1000)));if(resumed&&resumePlayback)video.start();status.setText("已验证学习权限");loop.setOnCheckedChangeListener((b,on)->p.setLooping(on));speed.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> v){}public void onItemSelected(android.widget.AdapterView<?> v,android.view.View x,int at,long id){endHoldSpeed();selectedRate=new float[]{.75f,1f,1.25f,1.5f}[at];applyPlaybackRate(selectedRate);}});if(resumed)timer.postDelayed(checkpoint,15000);});
        io.execute(()->{try{
            Object checkpoint=api.request("/video/"+lesson+"/progress","GET",null,true);
            if(checkpoint instanceof JSONObject){JSONObject c=(JSONObject)checkpoint;revision=c.optInt("revision");seek=c.optDouble("duration",0)>0&&c.optDouble("progress",0)>=c.optDouble("duration",0)?0:Math.round(c.optDouble("progress")*1000);}
            int explicitPosition=getIntent().getIntExtra("positionSeconds",-1);if(explicitPosition>=0)seek=explicitPosition*1000L;
            JSONObject play=(JSONObject)api.request("/video/"+lesson+"/play","GET",null,true);
            String url=play.optString("play_url");if(!play.optBoolean("authorized")||!Policy.secureURL(url))throw new Exception("当前没有此课节的有效学习权限");
            JSONArray options=play.optJSONArray("quality_options");
            java.util.ArrayList<String> qualityNames=new java.util.ArrayList<>(),qualityURLs=new java.util.ArrayList<>();
            qualityNames.add("自动");qualityURLs.add(url);
            if(options!=null)for(int i=0;i<options.length();i++){
                JSONObject option=options.optJSONObject(i);if(option==null)continue;String source=option.optString("url");
                if(source.equals(url))qualityNames.set(0,option.optString("label","自动"));
                if(Policy.secureURL(source)&&!qualityURLs.contains(source)){qualityNames.add(option.optString("label","清晰度 "+(i+1)));qualityURLs.add(source);}
            }
            runOnUiThread(()->{if(!destroyed&&api.accountGeneration()==playbackAccount){
                lastAuthorization=android.os.SystemClock.elapsedRealtime();currentURL=url;video.setVideoURI(Uri.parse(url));
                quality.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,qualityNames));
                quality.setEnabled(ready&&qualityURLs.size()>1);
                quality.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){
                    public void onNothingSelected(android.widget.AdapterView<?> view){}
                    public void onItemSelected(android.widget.AdapterView<?> view,android.view.View child,int at,long id){
                        String source=qualityURLs.get(at);if(source.equals(currentURL))return;
                        endHoldSpeed();seek=video.getCurrentPosition();resumePlayback=video.isPlaying();video.pause();quality.setEnabled(false);ready=false;media=null;currentURL=source;video.setVideoURI(Uri.parse(source));
                    }
                });
            }});
        }catch(Exception e){message(e.getMessage());}});
    }
    private void setFullscreen(boolean enabled){
        fullscreen=enabled;endHoldSpeed();
        for(int i=0;i<playerRoot.getChildCount();i++){android.view.View child=playerRoot.getChildAt(i);if(child!=video)child.setVisibility(enabled?android.view.View.GONE:android.view.View.VISIBLE);}
        video.setLayoutParams(new LinearLayout.LayoutParams(-1,enabled?-1:inlineVideoHeight));
        if(android.os.Build.VERSION.SDK_INT>=30&&getWindow().getInsetsController()!=null){
            if(enabled){getWindow().getInsetsController().setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());}
            else getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
        }
    }
    private void showDirectory(){
        endHoldSpeed();
        LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);
        EditText search=new EditText(this);search.setSingleLine(true);search.setHint("搜索课节");panel.addView(search);
        ListView list=new ListView(this);panel.addView(list,new LinearLayout.LayoutParams(-1,Math.round(320*getResources().getDisplayMetrics().density)));
        java.util.ArrayList<Integer> indices=new java.util.ArrayList<>();
        java.util.ArrayList<String> labels=new java.util.ArrayList<>();
        ArrayAdapter<String> adapter=new ArrayAdapter<>(this,android.R.layout.simple_list_item_1,labels);list.setAdapter(adapter);
        java.util.function.Consumer<String> filter=query->{indices.clear();labels.clear();for(int i=0;i<playlistNames.length;i++){String name=playlistNames[i]==null?"":playlistNames[i];if(name.toLowerCase(java.util.Locale.ROOT).contains(query.toLowerCase(java.util.Locale.ROOT))){indices.add(i);labels.add((i==playlistIndex?"正在播放 · ":"")+name);}}adapter.notifyDataSetChanged();};
        filter.accept("");
        search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){filter.accept(s.toString());}public void afterTextChanged(android.text.Editable value){}});
        AlertDialog dialog=new AlertDialog.Builder(this).setTitle("课节目录").setView(panel).setNegativeButton("关闭",null).create();
        list.setOnItemClickListener((parent,view,at,id)->{int index=indices.get(at);dialog.dismiss();selectLesson(index);});dialog.show();
    }
    private void selectLesson(int index){
        if(playlistIds==null||playlistNames==null||index<0||index>=playlistIds.length||index==playlistIndex||playlistIds[index]<=0)return;
        endHoldSpeed();
        startActivity(new Intent(this,PlayerActivity.class).putExtra("lesson",playlistIds[index]).putExtra("title",playlistNames[index]).putExtra("playlistIds",playlistIds).putExtra("playlistNames",playlistNames));
        finish();
    }
    private void saveProgress(){if(!ready||destroyed||api.accountGeneration()!=playbackAccount)return;double position=video.getCurrentPosition()/1000.0,duration=video.getDuration()/1000.0;if(duration<=0||position<0)return;
        io.execute(()->{try{if(api.accountGeneration()!=playbackAccount)return;JSONObject result=(JSONObject)api.request("/video/"+lesson+"/progress","POST",new JSONObject().put("progress",Math.min(position,duration)).put("duration",duration).put("revision",revision),true);revision=result.optInt("revision",revision);}
            catch(Api.Failure e){if(e.status==409){try{JSONObject c=(JSONObject)api.request("/video/"+lesson+"/progress","GET",null,true);revision=c.optInt("revision");message("另一设备已更新进度，本次没有覆盖。后续学习将继续同步。");}catch(Exception failure){message(failure.getMessage());}}else message(e.getMessage());}
            catch(Exception e){message("学习进度未同步，请检查网络");}});
    }
    private void verifyAccess(){
        if(destroyed||!ready||authorizationPending)return;
        if(api.accountGeneration()!=playbackAccount){video.pause();ready=false;status.setText("账号已切换，请重新打开课程");return;}
        if(android.os.SystemClock.elapsedRealtime()-lastAuthorization<60000)return;
        authorizationPending=true;
        io.execute(()->{try{
            JSONObject result=(JSONObject)api.request("/video/"+lesson+"/play","GET",null,true);
            if(!result.optBoolean("authorized")||api.accountGeneration()!=playbackAccount)throw new Exception("学习权限已变化，请返回课程重新加载");
            runOnUiThread(()->{if(!destroyed){authorizationPending=false;lastAuthorization=android.os.SystemClock.elapsedRealtime();}});
        }catch(Exception e){runOnUiThread(()->{if(!destroyed){authorizationPending=false;endHoldSpeed();video.pause();ready=false;status.setText("权限验证失败，请返回后重试："+e.getMessage());}});}});
    }
    private void message(String text){runOnUiThread(()->{if(!destroyed)status.setText(text);});}
    @Override protected void onPause(){endHoldSpeed();if(ready)resumePlayback=video.isPlaying();resumed=false;saveProgress();video.pause();timer.removeCallbacks(checkpoint);super.onPause();}
    @Override protected void onResume(){super.onResume();resumed=true;verifyAccess();if(ready){if(resumePlayback)video.start();timer.removeCallbacks(checkpoint);timer.postDelayed(checkpoint,15000);}}
    @Override protected void onDestroy(){endHoldSpeed();media=null;timer.removeCallbacksAndMessages(null);destroyed=true;video.stopPlayback();io.shutdown();super.onDestroy();}
}
