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
    private MediaController mediaControls;
    private boolean controlsNeedPinning(){
        android.view.accessibility.AccessibilityManager manager=(android.view.accessibility.AccessibilityManager)getSystemService(ACCESSIBILITY_SERVICE);
        return !video.isPlaying() || (manager!=null&&manager.isTouchExplorationEnabled());
    }
    private LinearLayout playerRoot;
    private FrameLayout videoStage;
    private boolean fullscreen;
    private boolean notesEnabled=true;
    private JSONArray noteRows=new JSONArray();
    private TextView noteNotice;
    private boolean notesLoaded,manualControls;
    private FrameLayout overlayControls;
    private void togglePlaybackControls(){if(mediaControls==null)return;if(mediaControls.isShowing())mediaControls.hide();else{manualControls=true;mediaControls.show();}}
    private void renderNotes(){
        if(noteNotice==null||!notesLoaded)return;
        noteNotice.setVisibility(notesEnabled?android.view.View.VISIBLE:android.view.View.GONE);
        if(!notesEnabled)return;
        if(destroyed||api.accountGeneration()!=playbackAccount){noteNotice.setText("");return;}
        double position=ready?video.getCurrentPosition()/1000.0:0;StringBuilder active=new StringBuilder();int count=0;
        for(int i=0;i<noteRows.length()&&count<3;i++){JSONObject note=noteRows.optJSONObject(i);if(note==null)continue;double stamp=note.optDouble("timestamp_seconds",Double.NaN);String text=note.optString("content").trim();if(!Double.isFinite(stamp)||stamp<0||position<stamp||position>=stamp+8||text.isEmpty())continue;if(active.length()>0)active.append("\n\n");active.append(clock(stamp)).append(" · ").append(text);count++;}
        noteNotice.setText(active.length()>0?active.toString():"当前播放位置暂无笔记");
    }
    private void loadNotes(){
        long account=api.accountGeneration();
        io.execute(()->{try{
            Object result=api.request("/notes?video_id="+lesson,"GET",null,true);
            JSONArray rows=result instanceof JSONArray?(JSONArray)result:new JSONArray();
            runOnUiThread(()->{if(!destroyed&&account==playbackAccount&&account==api.accountGeneration()){noteRows=rows;notesLoaded=true;renderNotes();}});
        }catch(Exception error){runOnUiThread(()->{if(!destroyed&&account==api.accountGeneration()){noteRows=new JSONArray();notesLoaded=false;if(noteNotice!=null)noteNotice.setText("课程笔记暂未加载，请点击重新加载");}});}});
    }
    private int inlineOrientation;
    private Button fullscreenButton;
    private int inlineVideoHeight;
    private int[] playlistIds;
    private String[] playlistNames;
    private int playlistIndex = -1;
    private TextView status, learningProgress, currentProgress;
    private final Runnable progressDisplay=new Runnable(){public void run(){if(destroyed||!resumed)return;if(ready){String percent=CoursePolicy.percent(video.getCurrentPosition()/1000.0,video.getDuration()/1000.0,false)+"%";learningProgress.setText("学习进度 "+percent+" · 已看到 "+clock(video.getCurrentPosition()/1000.0));if(currentProgress!=null)currentProgress.setText(percent);renderNotes();}timer.postDelayed(this,1000);}};
    private LinearLayout directoryPanel,notesPanel,introPanel;
    private JSONArray playlistMetadata=new JSONArray();
    private int directoryPage=1;
    private String directoryQuery="";
    private final java.util.ArrayList<Button> tabs=new java.util.ArrayList<>();
    private String currentURL = "";
    private MediaPlayer media;
    private float selectedRate=1,holdX,holdY;
    private boolean adjustingLevel,adjustingBrightness;
    private float gestureStartLevel;
    private Float originalWindowBrightness;
    private TextView adjustmentNotice;
    private final Runnable hideAdjustment=()->{if(adjustmentNotice!=null)adjustmentNotice.setVisibility(android.view.View.GONE);};
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
    @android.annotation.SuppressLint("ClickableViewAccessibility")
    private void installHoldSpeed(){
        video.setOnTouchListener((view,event)->{
            int action=event.getActionMasked();
            if(action==MotionEvent.ACTION_DOWN){
                endHoldSpeed();adjustingLevel=false;
                holdX=event.getX();holdY=event.getY();
                adjustingBrightness=holdX<video.getWidth()/2f;
                if(adjustingBrightness){
                    float current=getWindow().getAttributes().screenBrightness;
                    if(originalWindowBrightness==null)originalWindowBrightness=current;
                    gestureStartLevel=current>=0?current:android.provider.Settings.System.getInt(getContentResolver(),android.provider.Settings.System.SCREEN_BRIGHTNESS,128)/255f;
                }else{
                    android.media.AudioManager audio=(android.media.AudioManager)getSystemService(AUDIO_SERVICE);
                    gestureStartLevel=audio.getStreamVolume(android.media.AudioManager.STREAM_MUSIC)/(float)Math.max(1,audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC));
                }
                if(ready&&video.isPlaying()){holdPending=true;timer.postDelayed(holdBoost,400);}
                return true;
            }
            if(event.getPointerCount()>1||action==MotionEvent.ACTION_CANCEL){endHoldSpeed();adjustingLevel=false;timer.postDelayed(hideAdjustment,900);return true;}
            if(action==MotionEvent.ACTION_MOVE){
                float dx=event.getX()-holdX,dy=event.getY()-holdY;
                if(Math.max(Math.abs(dx),Math.abs(dy))>dp(12))endHoldSpeed();
                if(adjustingLevel||(Math.abs(dy)>dp(12)&&Math.abs(dy)>Math.abs(dx)*1.2f)){
                    adjustingLevel=true;endHoldSpeed();if(video.isPlaying())mediaControls.hide();
                    float value=Math.min(1,Math.max(adjustingBrightness ? .05f : 0,gestureStartLevel-dy/Math.max(video.getHeight(),dp(160))));
                    if(adjustingBrightness){android.view.WindowManager.LayoutParams attrs=getWindow().getAttributes();attrs.screenBrightness=value;getWindow().setAttributes(attrs);}
                    else{android.media.AudioManager audio=(android.media.AudioManager)getSystemService(AUDIO_SERVICE);audio.setStreamVolume(android.media.AudioManager.STREAM_MUSIC,Math.round(value*audio.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC)),0);}
                    adjustmentNotice.setText((adjustingBrightness?"亮度 ":"音量 ")+Math.round(value*100)+"%");adjustmentNotice.setVisibility(android.view.View.VISIBLE);timer.removeCallbacks(hideAdjustment);
                }
                return true;
            }
            if(action==MotionEvent.ACTION_UP){
                boolean held=holdingSpeed;endHoldSpeed();
                if(adjustingLevel){adjustingLevel=false;timer.postDelayed(hideAdjustment,900);}
                else if(!held&&Math.max(Math.abs(event.getX()-holdX),Math.abs(event.getY()-holdY))<dp(12)){view.performClick();}
                return true;
            }
            return true;
        });
    }
    private void showPlayerSettings(LinearLayout settings){
        if(settings.getParent() instanceof android.view.ViewGroup)((android.view.ViewGroup)settings.getParent()).removeView(settings);
        android.app.Dialog dialog=new android.app.Dialog(this);
        ScrollView scroll=new ScrollView(this);settings.setVisibility(android.view.View.VISIBLE);scroll.addView(settings);dialog.setContentView(scroll);
        android.view.Window window=dialog.getWindow();
        if(window!=null){window.addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);window.setBackgroundDrawable(SwodUi.shape(this,SwodUi.canvas(this),18));window.setGravity(android.view.Gravity.BOTTOM);window.setLayout(-1,Math.min(dp(440),getResources().getDisplayMetrics().heightPixels*2/3));}
        dialog.setOnDismissListener(value->{scroll.removeView(settings);settings.setVisibility(android.view.View.GONE);});dialog.show();
        if(window!=null)window.setLayout(-1,Math.min(dp(440),getResources().getDisplayMetrics().heightPixels*2/3));
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
        super.onCreate(saved);getWindow().addFlags(android.view.WindowManager.LayoutParams.FLAG_SECURE);getOnBackPressedDispatcher().addCallback(this,new androidx.activity.OnBackPressedCallback(true){@Override public void handleOnBackPressed(){if(fullscreen)setFullscreen(false);else finish();}});inlineOrientation=getRequestedOrientation();api=Api.get(this);playbackAccount=api.accountGeneration();lesson=getIntent().getIntExtra("lesson",0);
        LinearLayout root=new LinearLayout(this);playerRoot=root;inlineVideoHeight=Math.round(getResources().getDisplayMetrics().widthPixels*9f/16f);root.setOrientation(LinearLayout.VERTICAL);
        root.setOnApplyWindowInsetsListener((v,insets)->{if(android.os.Build.VERSION.SDK_INT>=30){android.graphics.Insets p=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.ime()|WindowInsets.Type.displayCutout());root.setPadding(p.left,p.top,p.right,p.bottom);}else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets;});
        root.setBackgroundColor(SwodUi.canvas(this));
        videoStage=new FrameLayout(this);videoStage.setBackgroundColor(android.graphics.Color.BLACK);root.addView(videoStage,new LinearLayout.LayoutParams(-1,inlineVideoHeight));video=new VideoView(this){@Override public void start(){super.start();if(mediaControls!=null)mediaControls.hide();}};videoStage.addView(video,new FrameLayout.LayoutParams(-1,-1));
        overlayControls=new FrameLayout(this);overlayControls.setVisibility(android.view.View.GONE);videoStage.addView(overlayControls,new FrameLayout.LayoutParams(-1,-1));
        fullscreenButton=new Button(this);fullscreenButton.setText("全屏");fullscreenButton.setContentDescription("选择横屏或竖屏全屏");
        fullscreenButton.setOnClickListener(v->chooseFullscreen());
        FrameLayout.LayoutParams fullButtonLayout=new FrameLayout.LayoutParams(-2,dp(48),android.view.Gravity.TOP|android.view.Gravity.START);
        fullButtonLayout.gravity=android.view.Gravity.BOTTOM|android.view.Gravity.END;
        overlayControls.addView(fullscreenButton,fullButtonLayout);
        adjustmentNotice=label("",16,false);adjustmentNotice.setTextColor(android.graphics.Color.WHITE);adjustmentNotice.setGravity(android.view.Gravity.CENTER);adjustmentNotice.setPadding(dp(18),dp(12),dp(18),dp(12));adjustmentNotice.setBackground(SwodUi.shape(this,0xBB000000,12));adjustmentNotice.setVisibility(android.view.View.GONE);
        root.addView(adjustmentNotice,new LinearLayout.LayoutParams(-1,-2));
        mediaControls=new MediaController(this){
            @Override public void show(){show(controlsNeedPinning()?0:3000);}
            @Override public void show(int timeout){if(video.isPlaying()&&!manualControls)return;super.show(controlsNeedPinning()?0:timeout);if(overlayControls!=null)overlayControls.setVisibility(android.view.View.VISIBLE);}
            @Override public void hide(){super.hide();manualControls=false;if(overlayControls!=null)overlayControls.setVisibility(android.view.View.GONE);}
        };
        mediaControls.setAnchorView(video);video.setMediaController(mediaControls);video.setContentDescription("课程视频，点击显示播放控制");video.setOnClickListener(v->togglePlaybackControls());
        ScrollView scroll=new ScrollView(this);root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout content=new LinearLayout(this);content.setOrientation(LinearLayout.VERTICAL);int gap=Math.round(12*getResources().getDisplayMetrics().density);content.setPadding(gap,gap,gap,gap);scroll.addView(content);
        TextView title=label(getIntent().getStringExtra("title"),18,false);title.setTypeface(null,android.graphics.Typeface.BOLD);content.addView(title);
        learningProgress=label("进度待同步",12,true);content.addView(learningProgress);
        status=new TextView(this);status.setText("正在验证课程权限…");status.setTextSize(12);status.setTextColor(SwodUi.muted(this));content.addView(status);
        try{playlistMetadata=new JSONArray(getIntent().getStringExtra("playlistMetadata"));}catch(Exception ignored){}
        LinearLayout settings=panel();settings.setVisibility(android.view.View.GONE);
        playlistIds=getIntent().getIntArrayExtra("playlistIds");playlistNames=getIntent().getStringArrayExtra("playlistNames");
        if(playlistIds!=null&&playlistNames!=null&&playlistIds.length==playlistNames.length){
            for(int i=0;i<playlistIds.length;i++)if(playlistIds[i]==lesson)playlistIndex=i;
        }
        mediaControls.setPrevNextListeners(v->selectLesson(playlistIndex+1),v->selectLesson(playlistIndex-1));
        Button settingsButton=new Button(this);settingsButton.setText("⋯");settingsButton.setTextSize(24);settingsButton.setContentDescription("播放设置");settingsButton.setTextColor(android.graphics.Color.WHITE);settingsButton.setBackgroundColor(android.graphics.Color.TRANSPARENT);settingsButton.setOnClickListener(v->showPlayerSettings(settings));
        overlayControls.addView(settingsButton,new FrameLayout.LayoutParams(dp(48),dp(48),android.view.Gravity.TOP|android.view.Gravity.END));
        if(CoursePolicy.isAudio(getIntent().getStringExtra("title"))){TextView audio=new TextView(this);audio.setText("SWOD · 音频课程，播放时没有视频画面");audio.setTextSize(18);content.addView(audio,0);}
        LinearLayout actions=new LinearLayout(this);CheckBox mirror=new CheckBox(this);mirror.setText("镜像翻转");mirror.setOnCheckedChangeListener((b,on)->video.setScaleX(on?-1:1));actions.addView(mirror);
        CheckBox loop=new CheckBox(this);loop.setText("单集循环");actions.addView(loop);
        Spinner speed=new Spinner(this);speed.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"0.75×","1.0×","1.25×","1.5×","2.0×"}));speed.setSelection(1);actions.addView(speed);settings.addView(label("播放设置",18,false));settings.addView(actions);
        Spinner quality=new Spinner(this);quality.setContentDescription("视频清晰度");settings.addView(quality);
        if(Policy.SUPPORTS_OFFLINE_DOWNLOAD){
        settings.addView(label("课程缓存联网时自动续期，可连续离线观看最长 24 小时；学习权益到期或撤销后停止使用。",14,true));
        Button downloadCache=new Button(this);downloadCache.setText("缓存当前课节");downloadCache.setOnClickListener(v->{CourseCacheManager cache=CourseCacheManager.get(this);cache.download(lesson,getIntent().getStringExtra("title"),getIntent().getStringExtra("seriesTitle"));android.widget.Toast.makeText(this,cache.message,android.widget.Toast.LENGTH_LONG).show();});settings.addView(downloadCache);
        Button manageCache=new Button(this);manageCache.setText("管理课程缓存");manageCache.setOnClickListener(v->startActivity(new Intent(this,CourseCacheActivity.class)));settings.addView(manageCache);
        }
        LinearLayout tabBar=new LinearLayout(this);tabBar.setBackgroundColor(android.graphics.Color.TRANSPARENT);content.addView(tabBar);
        String[] labels={"目录("+(playlistIds==null?0:playlistIds.length)+"节)","笔记","简介"};
        for(int i=0;i<labels.length;i++){final int at=i;Button button=new Button(this);button.setText(labels[i]);button.setTextSize(15);button.setAllCaps(false);button.setMinHeight(dp(48));button.setOnClickListener(v->selectTab(at));tabs.add(button);tabBar.addView(button,new LinearLayout.LayoutParams(0,-2,1));}
        directoryPanel=panel();notesPanel=panel();introPanel=panel();content.addView(directoryPanel);content.addView(notesPanel);content.addView(introPanel);
        CheckBox notesToggle=new CheckBox(this);notesToggle.setText("显示同步笔记");notesToggle.setChecked(true);notesToggle.setOnCheckedChangeListener((button,on)->{notesEnabled=on;renderNotes();});notesPanel.addView(notesToggle);notesPanel.addView(label("笔记显示在此处，不遮挡视频画面。",14,true));noteNotice=label("正在加载课程笔记…",14,true);notesPanel.addView(noteNotice);Button reloadNotes=new Button(this);reloadNotes.setText("重新加载笔记");reloadNotes.setOnClickListener(v->loadNotes());notesPanel.addView(reloadNotes);loadNotes();
        if(playlistIndex>=0)directoryPage=playlistIndex/50+1;renderDirectory();selectTab(0);
        introPanel.addView(label(getIntent().getStringExtra("seriesTitle"),18,false));TextView description=label("暂无课程简介",16,true);introPanel.addView(description);
        int seriesId=getIntent().getIntExtra("seriesId",0);if(seriesId>0)io.execute(()->{try{JSONObject detail=(JSONObject)api.request("/public/series/"+seriesId+"/detail","GET",null,false);String text=detail.optString("rich_description",detail.optString("description"));runOnUiThread(()->{if(!destroyed)description.setText(text.isEmpty()?"暂无课程简介":android.text.Html.fromHtml(text,android.text.Html.FROM_HTML_MODE_LEGACY));});}catch(Exception ignored){}});
        EditText note=new EditText(this);note.setHint("记录本节练习笔记");note.setMinLines(4);notesPanel.addView(note);Button add=new Button(this);add.setText("保存本节笔记");notesPanel.addView(add);
        add.setOnClickListener(v->{String text=note.getText().toString().trim();if(text.isEmpty()||text.length()>5000||!ready)return;int at=video.getCurrentPosition()/1000;add.setEnabled(false);io.execute(()->{try{api.request("/notes","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("content",text),true);runOnUiThread(()->{if(!destroyed){note.setText("");status.setText("笔记已保存");loadNotes();}});}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)add.setEnabled(true);});}});});
        Button bookmark=new Button(this);bookmark.setText("在当前位置添加书签");notesPanel.addView(bookmark);
        bookmark.setOnClickListener(v->{if(!ready)return;int at=video.getCurrentPosition()/1000;bookmark.setEnabled(false);io.execute(()->{try{api.request("/bookmarks","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("label","练习位置 "+at+" 秒"),true);message("书签已保存，可在个人中心打开");}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)bookmark.setEnabled(true);});}});});
        Button expand=new Button(this);expand.setText("横屏 / 竖屏全屏");expand.setOnClickListener(v->chooseFullscreen());settings.addView(expand);
        setContentView(root);
        installHoldSpeed();
        if(lesson<=0){status.setText("课节无效，请返回课程目录");return;}
        video.setOnCompletionListener(p->{endHoldSpeed();if(!destroyed&&resumed)mediaControls.show(0);saveProgress();});
        video.setOnErrorListener((p,what,extra)->{endHoldSpeed();ready=false;status.setText("视频播放失败，请返回后重试");return true;});
        video.setOnPreparedListener(p->{if(destroyed)return;endHoldSpeed();media=p;ready=true;quality.setEnabled(quality.getCount()>1);p.setLooping(loop.isChecked());video.seekTo((int)Math.min(seek,Math.max(0,video.getDuration()-1000)));if(resumed&&resumePlayback)video.start();status.setText("已验证学习权限");loop.setOnCheckedChangeListener((b,on)->p.setLooping(on));speed.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> v){}public void onItemSelected(android.widget.AdapterView<?> v,android.view.View x,int at,long id){endHoldSpeed();selectedRate=new float[]{.75f,1f,1.25f,1.5f,2f}[at];applyPlaybackRate(selectedRate);}});renderDirectory();if(resumed)timer.postDelayed(checkpoint,15000);});
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
    private void chooseFullscreen(){
        String[] choices=fullscreen?new String[]{"横屏全屏","竖屏全屏","退出全屏"}:new String[]{"横屏全屏","竖屏全屏"};
        new android.app.AlertDialog.Builder(this).setTitle("播放方向").setItems(choices,(dialog,which)->{
            if(which==2){setFullscreen(false);return;}
            setFullscreen(true);
            setRequestedOrientation(which==0?android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE:android.content.pm.ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT);
        }).show();
    }
    @Override public void onConfigurationChanged(android.content.res.Configuration configuration){
        super.onConfigurationChanged(configuration);
        inlineVideoHeight=Math.round(getResources().getDisplayMetrics().widthPixels*9f/16f);
        if(!fullscreen)videoStage.setLayoutParams(new LinearLayout.LayoutParams(-1,inlineVideoHeight));
        // Keep the current VideoView, media position, rate and play/pause state.
    }
    private void setFullscreen(boolean enabled){
        fullscreen=enabled;endHoldSpeed();
        playerRoot.setBackgroundColor(enabled?android.graphics.Color.BLACK:SwodUi.canvas(this));
        fullscreenButton.setText(enabled?"方向 / 退出":"全屏");
        fullscreenButton.setContentDescription(enabled?"切换横竖屏或退出全屏":"选择横屏或竖屏全屏");
        if(!enabled)setRequestedOrientation(inlineOrientation);
        for(int i=0;i<playerRoot.getChildCount();i++){android.view.View child=playerRoot.getChildAt(i);if(child!=videoStage)child.setVisibility(enabled?android.view.View.GONE:android.view.View.VISIBLE);}
        videoStage.setLayoutParams(new LinearLayout.LayoutParams(-1,enabled?-1:inlineVideoHeight));
        if(android.os.Build.VERSION.SDK_INT>=30&&getWindow().getInsetsController()!=null){
            if(enabled){getWindow().getInsetsController().setSystemBarsBehavior(android.view.WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);getWindow().getInsetsController().hide(WindowInsets.Type.systemBars());}
            else getWindow().getInsetsController().show(WindowInsets.Type.systemBars());
        }else{
            videoStage.setSystemUiVisibility(enabled?android.view.View.SYSTEM_UI_FLAG_FULLSCREEN|android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:android.view.View.SYSTEM_UI_FLAG_VISIBLE);
        }
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView label(String value,int size,boolean muted){TextView text=new TextView(this);text.setText(value);text.setTextSize(size);text.setTextColor(muted?SwodUi.muted(this):SwodUi.ink(this));text.setPadding(0,dp(4),0,dp(4));return text;}
    private LinearLayout panel(){LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(0,dp(6),0,dp(6));panel.setBackgroundColor(android.graphics.Color.TRANSPARENT);LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(8);panel.setLayoutParams(lp);return panel;}
    private void selectTab(int at){if(directoryPanel==null)return;directoryPanel.setVisibility(at==0?android.view.View.VISIBLE:android.view.View.GONE);notesPanel.setVisibility(at==1?android.view.View.VISIBLE:android.view.View.GONE);introPanel.setVisibility(at==2?android.view.View.VISIBLE:android.view.View.GONE);for(int i=0;i<tabs.size();i++){Button button=tabs.get(i);button.setSelected(i==at);button.setTextColor(i==at?SwodUi.primary(this):SwodUi.muted(this));button.setBackground(SwodUi.shape(this,i==at?SwodUi.tonal(this):SwodUi.surface(this),8));}}
    private String clock(double seconds){int value=(int)Math.max(0,Double.isFinite(seconds)?seconds:0);return String.format(java.util.Locale.ROOT,"%d:%02d",value/60,value%60);}
    private JSONObject metadata(int index){JSONObject row=playlistMetadata.optJSONObject(index);return row==null?new JSONObject():row;}
    private void renderDirectory(){
        directoryPanel.removeAllViews();EditText search=new EditText(this);search.setHint("搜索课节");search.setSingleLine(true);search.setTextSize(14);search.setText(directoryQuery);search.setPadding(dp(12),0,dp(12),0);search.setBackground(SwodUi.shape(this,SwodUi.field(this),8));directoryPanel.addView(search,new LinearLayout.LayoutParams(-1,dp(44)));
        LinearLayout results=new LinearLayout(this);results.setOrientation(LinearLayout.VERTICAL);directoryPanel.addView(results);
        Runnable render=()->{
            results.removeAllViews();java.util.ArrayList<Integer> indices=new java.util.ArrayList<>();if(playlistNames!=null)for(int i=0;i<playlistNames.length;i++)if((playlistNames[i]+" "+metadata(i).optString("subtitle")).toLowerCase(java.util.Locale.ROOT).contains(directoryQuery.trim().toLowerCase(java.util.Locale.ROOT)))indices.add(i);
            int pages=Math.max(1,(indices.size()+49)/50);directoryPage=Math.max(1,Math.min(pages,directoryPage));int start=(directoryPage-1)*50,end=Math.min(directoryPage*50,indices.size());
            LinearLayout paging=new LinearLayout(this);paging.setGravity(android.view.Gravity.CENTER_VERTICAL);Button previous=new Button(this);previous.setText("‹");previous.setContentDescription("上一页课节");previous.setEnabled(directoryPage>1);Button next=new Button(this);next.setText("›");next.setContentDescription("下一页课节");next.setEnabled(directoryPage<pages);
            previous.setOnClickListener(v->{directoryPage--;renderDirectory();});next.setOnClickListener(v->{directoryPage++;renderDirectory();});TextView range=label((indices.isEmpty()?"0":String.valueOf(start+1))+"–"+end+" / "+indices.size()+" · "+directoryPage+"/"+pages+"页",13,true);range.setGravity(android.view.Gravity.CENTER);paging.addView(previous,new LinearLayout.LayoutParams(dp(48),dp(48)));paging.addView(range,new LinearLayout.LayoutParams(0,-2,1));paging.addView(next,new LinearLayout.LayoutParams(dp(48),dp(48)));results.addView(paging);
            for(int n=start;n<end;n++){int index=indices.get(n);boolean current=index==playlistIndex;JSONObject meta=metadata(index);LinearLayout row=new LinearLayout(this);row.setGravity(android.view.Gravity.CENTER_VERTICAL);row.setPadding(0,dp(10),0,dp(10));row.setMinimumHeight(dp(68));row.setBackground(SwodUi.shape(this,current?SwodUi.tonal(this):SwodUi.surface(this),8));
                TextView ordinal=label(String.valueOf(index+1),14,false);ordinal.setGravity(android.view.Gravity.CENTER);ordinal.setTextColor(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE);ordinal.setBackground(SwodUi.shape(this,SwodUi.primary(this),18));row.addView(ordinal,new LinearLayout.LayoutParams(dp(32),dp(32)));
                LinearLayout copy=new LinearLayout(this);copy.setOrientation(LinearLayout.VERTICAL);copy.setPadding(dp(12),0,dp(8),0);copy.addView(label(playlistNames[index],16,false));copy.addView(label(meta.optDouble("duration")>0?clock(meta.optDouble("duration")):"时长待更新",12,true));row.addView(copy,new LinearLayout.LayoutParams(0,-2,1));TextView progress=label(current&&ready?CoursePolicy.percent(video.getCurrentPosition()/1000.0,video.getDuration()/1000.0,false)+"%":meta.has("percent")?meta.optInt("percent")+"%":"待同步",12,true);row.addView(progress);if(current)currentProgress=progress;row.setSelected(current);row.setContentDescription("第"+(index+1)+"节，"+playlistNames[index]+(current?"，当前课节":""));if(!current){row.setFocusable(true);row.setOnClickListener(v->selectLesson(index));}results.addView(row);
            }
            if(indices.isEmpty())results.addView(label(playlistNames==null?"请从课程目录打开课节以查看完整列表":"未找到匹配课节",14,true));
        };render.run();search.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence s,int start,int count,int after){}public void onTextChanged(CharSequence s,int start,int before,int count){directoryQuery=s.toString();directoryPage=1;render.run();}public void afterTextChanged(android.text.Editable value){}});
    }
    private void selectLesson(int index){
        if(playlistIds==null||playlistNames==null||index<0||index>=playlistIds.length||index==playlistIndex||playlistIds[index]<=0)return;
        endHoldSpeed();
        if(ready&&playlistIndex>=0){try{JSONObject current=metadata(playlistIndex);current.put("percent",CoursePolicy.percent(video.getCurrentPosition()/1000.0,video.getDuration()/1000.0,false));playlistMetadata.put(playlistIndex,current);}catch(org.json.JSONException ignored){}}
        Intent next=new Intent(getIntent());next.putExtra("playlistMetadata",playlistMetadata.toString());next.setClass(this,PlayerActivity.class);next.removeExtra("positionSeconds");next.putExtra("lesson",playlistIds[index]).putExtra("title",playlistNames[index]);startActivity(next);
        finish();
    }
    private void saveProgress(){if(ready&&learningProgress!=null){learningProgress.setText("学习进度 "+CoursePolicy.percent(video.getCurrentPosition()/1000.0,video.getDuration()/1000.0,false)+"% · 已看到 "+clock(video.getCurrentPosition()/1000.0));}if(!ready||destroyed||api.accountGeneration()!=playbackAccount)return;double position=video.getCurrentPosition()/1000.0,duration=video.getDuration()/1000.0;if(duration<=0||position<0)return;
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
    @Override protected void onPause(){endHoldSpeed();if(mediaControls!=null)mediaControls.hide();if(ready)resumePlayback=video.isPlaying();resumed=false;saveProgress();video.pause();timer.removeCallbacks(checkpoint);timer.removeCallbacks(progressDisplay);super.onPause();}
    @Override protected void onResume(){super.onResume();resumed=true;timer.removeCallbacks(progressDisplay);timer.post(progressDisplay);verifyAccess();if(ready){if(resumePlayback)video.start();timer.removeCallbacks(checkpoint);timer.postDelayed(checkpoint,15000);}}
    @Override protected void onDestroy(){if(originalWindowBrightness!=null){android.view.WindowManager.LayoutParams attrs=getWindow().getAttributes();attrs.screenBrightness=originalWindowBrightness;getWindow().setAttributes(attrs);}endHoldSpeed();if(mediaControls!=null)mediaControls.hide();media=null;timer.removeCallbacksAndMessages(null);destroyed=true;video.stopPlayback();io.shutdown();super.onDestroy();}
}
