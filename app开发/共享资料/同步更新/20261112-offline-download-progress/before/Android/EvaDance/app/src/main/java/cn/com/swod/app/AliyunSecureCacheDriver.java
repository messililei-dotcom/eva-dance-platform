package cn.com.swod.app;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import com.aliyun.downloader.AliDownloaderFactory;
import com.aliyun.downloader.AliMediaDownloader;
import com.aliyun.player.source.VidAuth;
import com.aliyun.player.nativeclass.TrackInfo;
import com.aliyun.private_service.PrivateService;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.function.BooleanSupplier;

/** SDK encrypted download only. No raw URL downloader or external/shared-storage fallback. */
final class AliyunSecureCacheDriver {
    interface Listener { void progress(int percent); void complete(File file); void failure(String message); }
    private final Context context;
    private final Handler main=new Handler(Looper.getMainLooper());
    private AliMediaDownloader worker;
    private BooleanSupplier allowed=()->false;
    private Listener listener;
    private long maximumBytes;
    private File directory;
    static long directoryBytes(File folder){try{return countCanonical(folder.getCanonicalFile());}catch(Exception e){return Long.MAX_VALUE;}}
    private static long countCanonical(File folder)throws Exception{if(!folder.exists())return 0;if(!folder.getAbsolutePath().equals(folder.getCanonicalPath()))return Long.MAX_VALUE;if(folder.isFile())return folder.length();long sum=0;File[] children=folder.listFiles();if(children==null)return Long.MAX_VALUE;for(File child:children)sum=Math.addExact(sum,countCanonical(child));return sum;}
    private final Runnable guard=new Runnable(){public void run(){if(worker==null)return;if(!allowed.getAsBoolean()){fail("缓存授权待联网更新");return;}if(directoryBytes(directory)>maximumBytes){fail("缓存超出容量限制，请删除不需要的缓存");return;}main.postDelayed(this,1000);}};
    AliyunSecureCacheDriver(Context context){this.context=context.getApplicationContext();}
    boolean configured(){
        try { android.os.Bundle meta=context.getPackageManager().getApplicationInfo(context.getPackageName(),android.content.pm.PackageManager.GET_META_DATA).metaData;
            if(meta==null||meta.getString("com.aliyun.alivc_license.licensekey","").isEmpty())return false;
            String cert=meta.getString("com.aliyun.alivc_license.licensefile","").replaceFirst("^assets/","");
            try(InputStream a=context.getAssets().open("encryptedApp.dat");InputStream b=context.getAssets().open(cert)){return a.read()!=-1&&b.read()!=-1;}
        }catch(Exception e){return false;}
    }
    void start(String vod,String playAuth,File directory,long maxBytes,BooleanSupplier allowed,Listener listener)throws Exception{
        if(Looper.myLooper()!=Looper.getMainLooper()||!configured()||!allowed.getAsBoolean()||playAuth.isEmpty()||maxBytes<=0)throw new Exception("课程安全缓存尚未开放");
        stop();String root=context.getNoBackupFilesDir().getCanonicalPath()+File.separator;
        if(!directory.getCanonicalPath().startsWith(root))throw new Exception("缓存目录无效");
        if(!directory.isDirectory()&&!directory.mkdirs())throw new Exception("无法创建缓存目录");
        File key=new File(context.getNoBackupFilesDir(),"vod-encryptedApp.dat");try(InputStream in=context.getAssets().open("encryptedApp.dat");FileOutputStream out=new FileOutputStream(key)){byte[] bytes=new byte[4096];int size;while((size=in.read(bytes))!=-1)out.write(bytes,0,size);}
        com.cicada.player.utils.Logger.getInstance(context).enableConsoleLog(false);
        PrivateService.initService(context,key.getAbsolutePath());this.allowed=allowed;this.listener=listener;maximumBytes=maxBytes;this.directory=directory;
        AliMediaDownloader active=AliDownloaderFactory.create(context);worker=active;active.setSaveDir(directory.getAbsolutePath());
        active.setOnPreparedListener(info->main.post(()->{if(worker!=active)return;if(!this.allowed.getAsBoolean()){fail("缓存授权已变化");return;}TrackInfo selected=null;for(TrackInfo track:info.getTrackInfos())if(track.getVodFileSize()>0&&track.getVodFileSize()<=maximumBytes&&("m3u8".equals(track.getVodFormat())||"mp4".equals(track.getVodFormat())))if(selected==null||track.getVodFileSize()<selected.getVodFileSize())selected=track;if(selected==null){fail("没有可安全缓存的清晰度或空间不足");return;}active.selectItem(selected.getIndex());active.start();}));
        active.setOnProgressListener(new AliMediaDownloader.OnProgressListener(){public void onDownloadingProgress(int percent){main.post(()->{if(worker!=active)return;if(AliyunSecureCacheDriver.this.allowed.getAsBoolean())listener.progress(percent);else fail("缓存授权待联网更新");});}public void onProcessingProgress(int percent){}});
        active.setOnErrorListener(error->main.post(()->{if(worker==active)fail("安全缓存失败，请联网重试");}));
        active.setOnCompletionListener(()->main.post(()->{if(worker!=active)return;try{File file=new File(active.getFilePath()).getCanonicalFile();if(!this.allowed.getAsBoolean()||!file.getPath().startsWith(directory.getCanonicalPath()+File.separator)||file.length()<=0||directoryBytes(directory)>maximumBytes){fail("缓存文件或授权无效");return;}Listener callback=this.listener;stop();callback.complete(file);}catch(Exception e){fail("无法安全保存缓存");}}));
        VidAuth source=new VidAuth();source.setVid(vod);source.setPlayAuth(playAuth);active.prepare(source);main.post(guard);
    }
    void stop(){main.removeCallbacks(guard);if(worker!=null){worker.stop();worker.release();worker=null;}allowed=()->false;listener=null;}
    private void fail(String message){Listener callback=listener;if(worker!=null)worker.deleteFile();stop();if(callback!=null)callback.failure(message);}
}
