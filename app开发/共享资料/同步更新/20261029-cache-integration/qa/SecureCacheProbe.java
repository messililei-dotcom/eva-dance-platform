package cn.com.swod.app;
import android.app.Instrumentation;
import android.content.Context;
import android.os.*;
import android.graphics.SurfaceTexture;
import android.view.Surface;
import android.net.*;
import android.media.MediaMetadataRetriever;
import com.aliyun.player.*;
import com.aliyun.player.source.UrlSource;
import com.aliyun.private_service.PrivateService;
import org.json.JSONObject;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
/** Isolated synthetic media probe; never invokes production member APIs or relaxes their entitlement gates. */
public final class SecureCacheProbe extends Instrumentation {
 private Bundle args;
 private final Bundle result=new Bundle();
 private AliPlayer player;private Surface surface;private SurfaceTexture texture;
 @Override public void onCreate(Bundle values){super.onCreate(values);args=values;start();}
 @Override public void onStart(){try{
  if("cleanup".equals(args.getString("mode"))){deleteTestTree(root());new File(getTargetContext().getNoBackupFilesDir(),"qa-vod-key.dat").delete();result.putBoolean("testDataRemoved",!root().exists());}
  else if("download".equals(args.getString("mode")))download();else offline();
  finish(-1,result);
 }catch(Exception error){result.putString("failure",error.getMessage());finish(0,result);}}
 private void deleteTestTree(File file)throws Exception{String base=root().getCanonicalPath();String value=file.getCanonicalPath();if(!value.equals(base)&&!value.startsWith(base+File.separator))throw new Exception("cleanup_path_outside_test");if(file.isDirectory()){File[] children=file.listFiles();if(children!=null)for(File child:children)deleteTestTree(child);}if(file.exists()&&!file.delete())throw new Exception("test_cleanup_failed");}
 private File root(){return new File(getTargetContext().getNoBackupFilesDir(),"qa-cache-integration-disposable");}
 private JSONObject read(File file)throws Exception{try(InputStream in=new FileInputStream(file)){return new JSONObject(new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));}}
 private void download()throws Exception{
  Context context=getTargetContext();JSONObject credential;try(InputStream in=getContext().getAssets().open("vod-qa.json")){credential=new JSONObject(new String(in.readAllBytes(),java.nio.charset.StandardCharsets.UTF_8));}
  CountDownLatch done=new CountDownLatch(1);AtomicReference<File> output=new AtomicReference<>();AtomicReference<String> failure=new AtomicReference<>();
  AliyunSecureCacheDriver driver=new AliyunSecureCacheDriver(context);result.putBoolean("driverConfigured",driver.configured());
  runOnMainSync(()->{try{driver.start(credential.optString("vid"),credential.optString("playAuth"),root(),8*1024*1024,()->true,new AliyunSecureCacheDriver.Listener(){public void progress(int p){}public void complete(File file){output.set(file);done.countDown();}public void failure(String message){failure.set(message);done.countDown();}});}catch(Exception error){failure.set(error.getMessage());done.countDown();}});
  if(!done.await(100,TimeUnit.SECONDS)){runOnMainSync(driver::stop);throw new Exception("download_timeout");}
  if(output.get()==null)throw new Exception("download_failed: "+failure.get());
  File file=output.get();JSONObject receipt=new JSONObject().put("path",file.getAbsolutePath()).put("bytes",file.length());
  try(FileOutputStream out=new FileOutputStream(new File(root(),"receipt.json"))){out.write(receipt.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
  result.putBoolean("secureDownloadCompleted",true);result.putLong("fileBytes",file.length());
  MediaMetadataRetriever plain=new MediaMetadataRetriever();boolean rejected=false;
  try{plain.setDataSource(file.getAbsolutePath());android.graphics.Bitmap frame=plain.getFrameAtTime(1000000);rejected=frame==null;if(frame!=null)frame.recycle();}catch(Exception expected){rejected=true;}finally{plain.release();}
  result.putBoolean("systemDecoderRejected",rejected);
 }
 private void offline()throws Exception{
  Context context=getTargetContext();ConnectivityManager net=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);
  boolean connected=false;for(Network network:net.getAllNetworks()){NetworkCapabilities caps=net.getNetworkCapabilities(network);if(caps!=null&&caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET))connected=true;}
  result.putBoolean("networkUnavailable",!connected);if(connected)throw new Exception("offline_test_requires_disconnected_emulator");
  result.putLong("cacheDirectoryBytes",AliyunSecureCacheDriver.directoryBytes(root()));
  JSONObject receipt=read(new File(root(),"receipt.json"));File file=new File(receipt.getString("path"));
  if(!file.getCanonicalPath().startsWith(root().getCanonicalPath()+File.separator))throw new Exception("invalid_test_path");
  File key=new File(context.getNoBackupFilesDir(),"qa-vod-key.dat");try(InputStream in="wrong-key".equals(args.getString("mode"))?getContext().getAssets().open("wrong-app-key.dat"):context.getAssets().open("encryptedApp.dat");FileOutputStream out=new FileOutputStream(key)){out.write(in.readAllBytes());}
  CountDownLatch rendered=new CountDownLatch(1);AtomicBoolean decoded=new AtomicBoolean(false);AtomicInteger errorCode=new AtomicInteger();
  runOnMainSync(()->{
   PrivateService.initService(context,key.getAbsolutePath());player=AliPlayerFactory.createAliPlayer(context);texture=new SurfaceTexture(false);surface=new Surface(texture);player.setSurface(surface);
   player.setOnPreparedListener(()->{result.putLong("durationMS",player.getDuration());player.start();});
   player.setOnRenderingStartListener(()->{decoded.set(true);rendered.countDown();});
   player.setOnErrorListener(error->{errorCode.set(error.getCode().getValue());rendered.countDown();});
   UrlSource source=new UrlSource();source.setUri(file.getAbsolutePath());player.setDataSource(source);player.prepare();
  });
  boolean completed=rendered.await(30,TimeUnit.SECONDS);result.putBoolean("offlineFrameRendered",decoded.get());result.putInt("sdkErrorCode",errorCode.get());
  runOnMainSync(()->{player.stop();player.release();surface.release();texture.release();});
  if("wrong-key".equals(args.getString("mode"))){boolean rejected=completed&&!decoded.get()&&errorCode.get()!=0;result.putBoolean("wrongBindingRejected",rejected);if(!rejected)throw new Exception("wrong_binding_not_rejected");}
  else if(!completed||!decoded.get())throw new Exception("offline_decode_failed");
 }
}
