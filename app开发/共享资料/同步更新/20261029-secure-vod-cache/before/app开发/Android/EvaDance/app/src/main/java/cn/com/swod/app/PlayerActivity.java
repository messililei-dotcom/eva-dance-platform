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
    private TextView status, learningProgress, currentProgress;
    private final Runnable progressDisplay=new Runnable(){public void run(){if(destroyed||!resumed)return;if(ready){String percent=CoursePolicy.percent(video.getCurrentPosition()/1000.0,video.getDuration()/1000.0,false)+"%";learningProgress.setText("学习进度 "+percent+" · 已看到 "+clock(video.getCurrentPosition()/1000.0));if(currentProgress!=null)currentProgress.setText(percent);}timer.postDelayed(this,1000);}};
    private LinearLayout directoryPanel,notesPanel,introPanel;
    private JSONArray playlistMetadata=new JSONArray();
    private int directoryPage=1;
    private String directoryQuery="";
    private final java.util.ArrayList<Button> tabs=new java.util.ArrayList<>();
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
        root.setBackgroundColor(SwodUi.canvas(this));
        video=new VideoView(this);root.addView(video,new LinearLayout.LayoutParams(-1,inlineVideoHeight));MediaController controls=new MediaController(this);controls.setAnchorView(video);video.setMediaController(controls);
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
                LinearLayout navigation=new LinearLayout(this);
                Button previous=new Button(this);previous.setText("上一节");previous.setEnabled(playlistIndex>0);previous.setOnClickListener(v->selectLesson(playlistIndex-1));
                Button catalog=new Button(this);catalog.setText("播放设置");catalog.setOnClickListener(v->settings.setVisibility(settings.getVisibility()==android.view.View.VISIBLE?android.view.View.GONE:android.view.View.VISIBLE));
                Button next=new Button(this);next.setText("下一节");next.setEnabled(playlistIndex>=0&&playlistIds!=null&&playlistIndex+1<playlistIds.length);next.setOnClickListener(v->selectLesson(playlistIndex+1));
                for(Button item:new Button[]{previous,catalog,next}){item.setAllCaps(false);item.setMinimumHeight(Math.round(48*getResources().getDisplayMetrics().density));navigation.addView(item,new LinearLayout.LayoutParams(0,-2,1));}content.addView(navigation);
        if(CoursePolicy.isAudio(getIntent().getStringExtra("title"))){TextView audio=new TextView(this);audio.setText("SWOD · 音频课程，播放时没有视频画面");audio.setTextSize(18);content.addView(audio,0);}
        LinearLayout actions=new LinearLayout(this);CheckBox mirror=new CheckBox(this);mirror.setText("镜像");mirror.setOnCheckedChangeListener((b,on)->video.setScaleX(on?-1:1));actions.addView(mirror);
        CheckBox loop=new CheckBox(this);loop.setText("循环播放");actions.addView(loop);
        Spinner speed=new Spinner(this);speed.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"0.75×","1.0×","1.25×","1.5×"}));speed.setSelection(1);actions.addView(speed);settings.addView(actions);content.addView(settings);
        Spinner quality=new Spinner(this);quality.setContentDescription("视频清晰度");settings.addView(quality);
        LinearLayout tabBar=new LinearLayout(this);tabBar.setBackground(SwodUi.shape(this,SwodUi.surface(this),12));content.addView(tabBar);
        String[] labels={"目录("+(playlistIds==null?0:playlistIds.length)+"节)","笔记","简介"};
        for(int i=0;i<labels.length;i++){final int at=i;Button button=new Button(this);button.setText(labels[i]);button.setTextSize(15);button.setAllCaps(false);button.setMinHeight(dp(48));button.setOnClickListener(v->selectTab(at));tabs.add(button);tabBar.addView(button,new LinearLayout.LayoutParams(0,-2,1));}
        directoryPanel=panel();notesPanel=panel();introPanel=panel();content.addView(directoryPanel);content.addView(notesPanel);content.addView(introPanel);
        if(playlistIndex>=0)directoryPage=playlistIndex/50+1;renderDirectory();selectTab(0);
        introPanel.addView(label(getIntent().getStringExtra("seriesTitle"),18,false));TextView description=label("暂无课程简介",16,true);introPanel.addView(description);
        int seriesId=getIntent().getIntExtra("seriesId",0);if(seriesId>0)io.execute(()->{try{JSONObject detail=(JSONObject)api.request("/public/series/"+seriesId+"/detail","GET",null,false);String text=detail.optString("rich_description",detail.optString("description"));runOnUiThread(()->{if(!destroyed)description.setText(text.isEmpty()?"暂无课程简介":android.text.Html.fromHtml(text,android.text.Html.FROM_HTML_MODE_LEGACY));});}catch(Exception ignored){}});
        EditText note=new EditText(this);note.setHint("记录本节练习笔记");note.setMinLines(4);notesPanel.addView(note);Button add=new Button(this);add.setText("保存本节笔记");notesPanel.addView(add);
        add.setOnClickListener(v->{String text=note.getText().toString().trim();if(text.isEmpty()||text.length()>5000||!ready)return;int at=video.getCurrentPosition()/1000;add.setEnabled(false);io.execute(()->{try{api.request("/notes","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("content",text),true);runOnUiThread(()->{if(!destroyed){note.setText("");status.setText("笔记已保存");}});}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)add.setEnabled(true);});}});});
        Button bookmark=new Button(this);bookmark.setText("在当前位置添加书签");notesPanel.addView(bookmark);
        bookmark.setOnClickListener(v->{if(!ready)return;int at=video.getCurrentPosition()/1000;bookmark.setEnabled(false);io.execute(()->{try{api.request("/bookmarks","POST",new JSONObject().put("video_id",lesson).put("timestamp_seconds",at).put("label","练习位置 "+at+" 秒"),true);message("书签已保存，可在个人中心打开");}catch(Exception e){message(e.getMessage());}finally{runOnUiThread(()->{if(!destroyed)bookmark.setEnabled(true);});}});});
        Button expand=new Button(this);expand.setText("全屏播放");expand.setOnClickListener(v->setFullscreen(true));settings.addView(expand);
        setContentView(root);
        installHoldSpeed();
        if(lesson<=0){status.setText("课节无效，请返回课程目录");return;}
        video.setOnCompletionListener(p->{endHoldSpeed();saveProgress();});
        video.setOnErrorListener((p,what,extra)->{endHoldSpeed();ready=false;status.setText("视频播放失败，请返回后重试");return true;});
        video.setOnPreparedListener(p->{if(destroyed)return;endHoldSpeed();media=p;ready=true;quality.setEnabled(quality.getCount()>1);p.setLooping(loop.isChecked());video.seekTo((int)Math.min(seek,Math.max(0,video.getDuration()-1000)));if(resumed&&resumePlayback)video.start();status.setText("已验证学习权限");loop.setOnCheckedChangeListener((b,on)->p.setLooping(on));speed.setOnItemSelectedListener(new android.widget.AdapterView.OnItemSelectedListener(){public void onNothingSelected(android.widget.AdapterView<?> v){}public void onItemSelected(android.widget.AdapterView<?> v,android.view.View x,int at,long id){endHoldSpeed();selectedRate=new float[]{.75f,1f,1.25f,1.5f}[at];applyPlaybackRate(selectedRate);}});renderDirectory();if(resumed)timer.postDelayed(checkpoint,15000);});
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
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private TextView label(String value,int size,boolean muted){TextView text=new TextView(this);text.setText(value);text.setTextSize(size);text.setTextColor(muted?SwodUi.muted(this):SwodUi.ink(this));text.setPadding(0,dp(4),0,dp(4));return text;}
    private LinearLayout panel(){LinearLayout panel=new LinearLayout(this);panel.setOrientation(LinearLayout.VERTICAL);panel.setPadding(dp(12),dp(12),dp(12),dp(12));panel.setBackground(SwodUi.shape(this,SwodUi.surface(this),14));LinearLayout.LayoutParams lp=new LinearLayout.LayoutParams(-1,-2);lp.topMargin=dp(12);panel.setLayoutParams(lp);return panel;}
    private void selectTab(int at){if(directoryPanel==null)return;directoryPanel.setVisibility(at==0?android.view.View.VISIBLE:android.view.View.GONE);notesPanel.setVisibility(at==1?android.view.View.VISIBLE:android.view.View.GONE);introPanel.setVisibility(at==2?android.view.View.VISIBLE:android.view.View.GONE);for(int i=0;i<tabs.size();i++){Button button=tabs.get(i);button.setSelected(i==at);button.setTextColor(i==at?SwodUi.primary(this):SwodUi.muted(this));button.setBackground(SwodUi.shape(this,i==at?SwodUi.tonal(this):SwodUi.surface(this),8));}}
    private String clock(double seconds){int value=(int)Math.max(0,Double.isFinite(seconds)?seconds:0);return String.format(java.util.Locale.ROOT,"%d:%02d",value/60,value%60);}
    private JSONObject metadata(int index){JSONObject row=playlistMetadata.optJSONObject(index);return row==null?new JSONObject():row;}
    private void renderDirectory(){
        directoryPanel.removeAllViews();EditText search=new EditText(this);search.setHint("搜索课节");search.setSingleLine(true);search.setTextSize(14);search.setText(directoryQuery);search.setPadding(dp(12),0,dp(12),0);search.setBackground(SwodUi.shape(this,SwodUi.canvas(this),22));directoryPanel.addView(search,new LinearLayout.LayoutParams(-1,dp(44)));
        LinearLayout results=new LinearLayout(this);results.setOrientation(LinearLayout.VERTICAL);directoryPanel.addView(results);
        Runnable render=()->{
            results.removeAllViews();java.util.ArrayList<Integer> indices=new java.util.ArrayList<>();if(playlistNames!=null)for(int i=0;i<playlistNames.length;i++)if((playlistNames[i]+" "+metadata(i).optString("subtitle")).toLowerCase(java.util.Locale.ROOT).contains(directoryQuery.trim().toLowerCase(java.util.Locale.ROOT)))indices.add(i);
            int pages=Math.max(1,(indices.size()+49)/50);directoryPage=Math.max(1,Math.min(pages,directoryPage));int start=(directoryPage-1)*50,end=Math.min(directoryPage*50,indices.size());
            LinearLayout paging=new LinearLayout(this);paging.setGravity(android.view.Gravity.CENTER_VERTICAL);Button previous=new Button(this);previous.setText("‹");previous.setContentDescription("上一页课节");previous.setEnabled(directoryPage>1);Button next=new Button(this);next.setText("›");next.setContentDescription("下一页课节");next.setEnabled(directoryPage<pages);
            previous.setOnClickListener(v->{directoryPage--;renderDirectory();});next.setOnClickListener(v->{directoryPage++;renderDirectory();});TextView range=label((indices.isEmpty()?"0":String.valueOf(start+1))+"–"+end+" / "+indices.size()+" · "+directoryPage+"/"+pages+"页",13,true);range.setGravity(android.view.Gravity.CENTER);paging.addView(previous,new LinearLayout.LayoutParams(dp(48),dp(48)));paging.addView(range,new LinearLayout.LayoutParams(0,-2,1));paging.addView(next,new LinearLayout.LayoutParams(dp(48),dp(48)));results.addView(paging);
            for(int n=start;n<end;n++){int index=indices.get(n);boolean current=index==playlistIndex;JSONObject meta=metadata(index);LinearLayout row=new LinearLayout(this);row.setGravity(android.view.Gravity.CENTER_VERTICAL);row.setPadding(dp(8),dp(16),dp(8),dp(16));row.setMinimumHeight(dp(84));row.setBackground(SwodUi.shape(this,current?SwodUi.tonal(this):SwodUi.surface(this),8));
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
    @Override protected void onPause(){endHoldSpeed();if(ready)resumePlayback=video.isPlaying();resumed=false;saveProgress();video.pause();timer.removeCallbacks(checkpoint);timer.removeCallbacks(progressDisplay);super.onPause();}
    @Override protected void onResume(){super.onResume();resumed=true;timer.removeCallbacks(progressDisplay);timer.post(progressDisplay);verifyAccess();if(ready){if(resumePlayback)video.start();timer.removeCallbacks(checkpoint);timer.postDelayed(checkpoint,15000);}}
    @Override protected void onDestroy(){endHoldSpeed();media=null;timer.removeCallbacksAndMessages(null);destroyed=true;video.stopPlayback();io.shutdown();super.onDestroy();}
}
