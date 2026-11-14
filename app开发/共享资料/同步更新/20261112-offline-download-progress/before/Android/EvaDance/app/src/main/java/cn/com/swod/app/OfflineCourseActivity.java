package cn.com.swod.app;

import android.app.Activity;
import android.os.*;
import android.view.*;
import android.widget.*;
import com.aliyun.player.*;
import com.aliyun.player.source.UrlSource;
import org.json.JSONObject;
import java.io.*;

/** Only accepts a lesson identifier. No intent-supplied file path or local authorization flag. */
public final class OfflineCourseActivity extends Activity {
    private CourseCacheManager cache;private AliPlayer player;private int lesson;private boolean playing,ready,active;
    private final Handler main=new Handler(Looper.getMainLooper());private TextView status;private Button play;private SeekBar seek;
    private int ticks;private String recordNonce="";
    private final Runnable tick=new Runnable(){public void run(){if(!active||player==null)return;JSONObject record=cache.get(lesson);if(record==null||!recordNonce.equals(record.optString("nonce"))||!cache.usable(record)){stopPlayback();status.setText("缓存授权待联网自动验证");main.postDelayed(this,1000);return;}if(ready)play.setEnabled(true);long position=player.getCurrentPosition(),duration=player.getDuration();seek.setMax((int)Math.max(1,duration/1000));seek.setProgress((int)(position/1000));if(++ticks%15==0)cache.checkpoint(lesson,position/1000d,duration/1000d);main.postDelayed(this,1000);}};
    public void onCreate(Bundle state){super.onCreate(state);getWindow().addFlags(WindowManager.LayoutParams.FLAG_SECURE);cache=CourseCacheManager.get(this);lesson=getIntent().getIntExtra("lesson",0);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setPadding(16,16,16,16);root.setBackgroundColor(SwodUi.canvas(this));root.setOnApplyWindowInsetsListener((v,i)->{if(Build.VERSION.SDK_INT>=30){android.graphics.Insets s=i.getInsets(WindowInsets.Type.systemBars());root.setPadding(s.left+16,s.top+16,s.right+16,s.bottom+16);}return i;});setContentView(root);
        Button back=new Button(this);back.setText("返回缓存列表");back.setOnClickListener(v->finish());root.addView(back);
        FrameLayout stage=new FrameLayout(this);SurfaceView surface=new SurfaceView(this);stage.addView(surface,new FrameLayout.LayoutParams(-1,-1));root.addView(stage,new LinearLayout.LayoutParams(-1,(int)(getResources().getDisplayMetrics().widthPixels*9f/16f)));
        status=new TextView(this);status.setTextColor(SwodUi.ink(this));status.setTextSize(17);root.addView(status);play=new Button(this);play.setText("播放");play.setEnabled(false);root.addView(play);seek=new SeekBar(this);seek.setContentDescription("离线播放进度");root.addView(seek);
        JSONObject record=cache.get(lesson);if(record==null||!cache.usable(record)||!new AliyunSecureCacheDriver(this).configured()){status.setText("缓存授权待联网自动验证");return;}
        recordNonce=record.optString("nonce");
        try{
            File key=new File(getNoBackupFilesDir(),"vod-encryptedApp.dat");try(InputStream in=getAssets().open("encryptedApp.dat");FileOutputStream out=new FileOutputStream(key)){byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);}
            com.aliyun.private_service.PrivateService.initService(this,key.getAbsolutePath());com.cicada.player.utils.Logger.getInstance(this).enableConsoleLog(false);
            player=AliPlayerFactory.createAliPlayer(this);status.setText(record.optString("title"));
            player.setOnPreparedListener(()->{JSONObject live=cache.get(lesson);if(live==null||!recordNonce.equals(live.optString("nonce"))||!cache.usable(live)){stopPlayback();return;}ready=true;play.setEnabled(true);player.seekTo((long)(record.optDouble("position")*1000));});
            player.setOnCompletionListener(()->{playing=false;play.setText("播放");checkpoint();});player.setOnErrorListener(e->{stopPlayback();status.setText("安全缓存无法解密，请联网重新缓存");});
            surface.getHolder().addCallback(new SurfaceHolder.Callback(){public void surfaceCreated(SurfaceHolder h){if(player!=null)player.setDisplay(h);}public void surfaceChanged(SurfaceHolder h,int f,int w,int v){}public void surfaceDestroyed(SurfaceHolder h){if(player!=null){player.pause();playing=false;player.setDisplay(null);}}});
            UrlSource source=new UrlSource();source.setUri(cache.file(record).getAbsolutePath());player.setDataSource(source);player.prepare();
            play.setOnClickListener(v->{JSONObject live=cache.get(lesson);if(!ready||live==null||!recordNonce.equals(live.optString("nonce"))||!cache.usable(live)){stopPlayback();return;}if(playing)player.pause();else player.start();playing=!playing;play.setText(playing?"暂停":"播放");});
            seek.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener(){public void onProgressChanged(SeekBar s,int p,boolean u){}public void onStartTrackingTouch(SeekBar s){}public void onStopTrackingTouch(SeekBar s){JSONObject live=cache.get(lesson);if(player!=null&&live!=null&&recordNonce.equals(live.optString("nonce"))&&cache.usable(live))player.seekTo(s.getProgress()*1000L);}});
        }catch(Exception e){stopPlayback();status.setText("安全离线播放器尚未就绪");}
    }
    private void checkpoint(){JSONObject live=cache.get(lesson);if(player!=null&&live!=null&&recordNonce.equals(live.optString("nonce")))cache.checkpoint(lesson,player.getCurrentPosition()/1000d,player.getDuration()/1000d);}
    private void stopPlayback(){if(player!=null)player.pause();playing=false;if(play!=null){play.setText("播放");play.setEnabled(false);}}
    protected void onResume(){super.onResume();active=true;cache.refresh();main.post(tick);}
    protected void onPause(){active=false;main.removeCallbacks(tick);checkpoint();stopPlayback();super.onPause();}
    protected void onDestroy(){if(player!=null){player.stop();player.release();player=null;}super.onDestroy();}
}
