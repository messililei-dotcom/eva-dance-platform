package cn.com.swod.app;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import org.json.*;
import java.io.File;
import java.util.*;
import java.util.concurrent.*;

/** Device-keystore protected inventory and progress outbox. Media bytes remain SDK encrypted. */
final class CourseCacheManager {
    private static volatile CourseCacheManager instance;
    static synchronized CourseCacheManager get(Context c){if(instance==null)instance=new CourseCacheManager(c);return instance;}
    static void clearExisting(){new Handler(Looper.getMainLooper()).post(()->{CourseCacheManager current=instance;if(current!=null)current.purge();});}
    private final Context context;
    private final TokenVault vault;
    private final AliyunSecureCacheDriver driver;
    private final Handler main=new Handler(Looper.getMainLooper());
    private final ScheduledExecutorService io=Executors.newSingleThreadScheduledExecutor();
    private final List<Runnable> listeners=new CopyOnWriteArrayList<>();
    private JSONObject inventory;
    private final Map<Integer,AutomaticVideoCacheRenewal> renewals=new HashMap<>();
    private long generation;
    private int downloading;
    volatile String message="";
    final File root;
    private CourseCacheManager(Context c){
        context=c.getApplicationContext();vault=new TokenVault(context,"course-cache");driver=new AliyunSecureCacheDriver(context);root=new File(context.getNoBackupFilesDir(),"course-cache");
        try{String saved=vault.read();inventory=saved==null?new JSONObject():new JSONObject(saved);if(!inventory.has("device"))inventory.put("device",UUID.randomUUID().toString().replace("-","")+UUID.randomUUID().toString().replace("-",""));
            if(!inventory.has("items"))inventory.put("items",new JSONArray());for(JSONObject row:all())if(!"ready".equals(row.optString("state"))){row.put("state","paused");row.put("file","");}persist();
        }catch(Exception e){inventory=new JSONObject();message="安全离线内容索引不可用，请联网后重试";}
        io.scheduleWithFixedDelay(this::refreshNow,0,60,TimeUnit.SECONDS);
    }
    void listen(Runnable r){listeners.add(r);}void unlisten(Runnable r){listeners.remove(r);}
    private void changed(){for(Runnable r:listeners)main.post(r);}
    synchronized int downloading(){return downloading;}
    private Api api(){return Api.get(context);}
    private boolean online(){try{ConnectivityManager cm=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);NetworkCapabilities n=cm.getNetworkCapabilities(cm.getActiveNetwork());return n!=null&&n.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);}catch(Exception e){return false;}}
    private String boot(){try{return "boot:"+Settings.Global.getInt(context.getContentResolver(),Settings.Global.BOOT_COUNT);}catch(Exception e){return "";}}
    private synchronized String device(){return inventory.optString("device");}
    private synchronized List<JSONObject> all(){List<JSONObject> out=new ArrayList<>();JSONArray rows=inventory.optJSONArray("items");if(rows!=null)for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null)out.add(row);}return out;}
    synchronized List<JSONObject> visible(){List<JSONObject> out=new ArrayList<>();for(JSONObject r:all())if(current(r))try{out.add(new JSONObject(r.toString()));}catch(Exception ignored){}return out;}
    private boolean current(JSONObject r){JSONObject l=r.optJSONObject("lease");return l!=null&&l.optLong("member_id")==api().memberID()&&l.optString("session_id").equals(api().sessionID())&&!api().sessionID().isEmpty();}
    private synchronized JSONObject row(int id){for(JSONObject r:all())if(r.optInt("id")==id)return r;return null;}
    private synchronized void persist()throws Exception{vault.save(inventory.toString());}
    private long now(JSONObject r){return CacheClock.trusted(r.optLong("server"),r.optLong("elapsed",-1),r.optString("boot"),SystemClock.elapsedRealtime(),boot());}
    synchronized File file(JSONObject r){try{String name=r.optString("file");if(name.isEmpty()||name.startsWith("/")||Arrays.asList(name.split("/")).contains(".."))return null;File f=new File(root,name).getCanonicalFile();return f.getPath().startsWith(root.getCanonicalPath()+File.separator)&&f.isFile()?f:null;}catch(Exception e){return null;}}
    private AutomaticVideoCacheRenewal.Lease lease(JSONObject l)throws JSONException{return new AutomaticVideoCacheRenewal.Lease(l.getLong("member_id"),l.getString("session_id"),l.getString("device_id"),l.getInt("lesson_id"),l.getInt("series_id"),l.getString("vod_video_id"),l.getString("material_version"),l.getLong("issued_at"),l.getLong("expires_at"),l.getString("mode"));}
    synchronized boolean usable(JSONObject r){try{return Policy.SUPPORTS_OFFLINE_DOWNLOAD&&current(r)&&"ready".equals(r.optString("state"))&&file(r)!=null&&device().equals(r.getJSONObject("lease").getString("device_id"))&&lease(r.getJSONObject("lease")).permits(now(r));}catch(Exception e){return false;}}
    synchronized JSONObject get(int id){for(JSONObject r:visible())if(r.optInt("id")==id)return r;return null;}
    synchronized void purge(){generation++;downloading=0;main.post(driver::stop);renewals.values().forEach(AutomaticVideoCacheRenewal::close);renewals.clear();try{inventory.put("items",new JSONArray());persist();}catch(Exception e){vault.clear();}deleteTree(root);changed();}
    synchronized void remove(int id){if(downloading==id){generation++;downloading=0;main.post(driver::stop);}AutomaticVideoCacheRenewal old=renewals.remove(id);if(old!=null)old.close();JSONArray next=new JSONArray();for(JSONObject r:all())if(r.optInt("id")!=id)next.put(r);try{inventory.put("items",next);persist();}catch(Exception e){message="离线索引保存失败";}deleteTree(new File(root,String.valueOf(id)));changed();}
    private void deleteTree(File f){try{if(!f.getCanonicalPath().startsWith(context.getNoBackupFilesDir().getCanonicalPath()+File.separator))return;File[] children=f.listFiles();if(children!=null)for(File child:children)deleteTree(child);if(f.exists()&&!f.delete())message="部分离线内容待下次清理";}catch(Exception ignored){}}
    void refresh(){io.execute(this::refreshNow);}
    synchronized void pause(int id){if(downloading!=id)return;generation++;downloading=0;main.post(driver::stop);try{JSONObject live=row(id);if(live!=null)live.put("state","paused");persist();}catch(Exception e){message="离线索引保存失败";}changed();}
    private void refreshNow(){
        if(!api().loggedIn())return;
        for(JSONObject stale:all())if(!current(stale))remove(stale.optInt("id"));
        for(JSONObject snapshot:visible()){
            int id=snapshot.optInt("id");if(!"ready".equals(snapshot.optString("state")))continue;
            AutomaticVideoCacheRenewal renewal;
            synchronized(this){renewal=renewals.get(id);if(renewal==null)try{
                String nonce=snapshot.getString("nonce");final long[] stamp={0};final JSONObject[] nextGrant={null};
                renewal=new AutomaticVideoCacheRenewal(lease(snapshot.getJSONObject("lease")),()->{synchronized(this){JSONObject live=row(id);return live==null?Long.MIN_VALUE:now(live);}},SystemClock::elapsedRealtime,this::online,
                    ()->{synchronized(this){JSONObject live=row(id);return live!=null&&nonce.equals(live.optString("nonce"))&&current(live);}},
                    old->{stamp[0]=SystemClock.elapsedRealtime();nextGrant[0]=authorize(id,"renew",old.material);return lease(nextGrant[0]);},
                    next->{synchronized(this){try{JSONObject live=row(id);if(live==null||!nonce.equals(live.optString("nonce"))||!current(live))throw new IllegalStateException();String backup=live.toString();try{live.put("lease",nextGrant[0]);live.put("server",next.issued);live.put("elapsed",stamp[0]);live.put("boot",boot());persist();}catch(Exception failure){JSONArray a=inventory.getJSONArray("items");for(int i=0;i<a.length();i++)if(a.getJSONObject(i).optInt("id")==id)a.put(i,new JSONObject(backup));throw failure;}}catch(Exception failure){throw new IllegalStateException("保存授权失败");}}},
                    ()->{synchronized(this){JSONObject live=row(id);if(live!=null&&nonce.equals(live.optString("nonce")))remove(id);}});renewals.put(id,renewal);
                }catch(Exception ignored){} }
            if(renewal!=null)renewal.refresh();if(online())syncProgress(id);
        }changed();
    }
    private JSONObject authorize(int id,String action,String material)throws Exception{return (JSONObject)api().request("/video/"+id+"/cache-authorization","POST",new JSONObject().put("action",action).put("device_id",device()).put("material_version",material),true);}
    void download(int id,String title,String course){
        if(!Policy.SUPPORTS_OFFLINE_DOWNLOAD){message="安全离线观看尚未开放，请先在线观看";changed();return;}
        final long active;
        synchronized(this){if(downloading!=0){message="请等待当前课节下载完成，或先取消任务";changed();return;}if(!driver.configured()){message="安全下载授权尚未配置完成，请先在线观看";changed();return;}if(all().size()>=12&&row(id)==null){message="最多下载12节，请先删除不需要的离线内容";changed();return;}downloading=id;active=generation;}
        message="正在验证离线观看权限";changed();io.execute(()->{long stamp=SystemClock.elapsedRealtime();try{
            JSONObject grant=authorize(id,"download","");String auth=grant.getJSONObject("credential").getString("play_auth");JSONObject clean=new JSONObject(grant.toString());clean.remove("credential");
            final JSONObject entry=new JSONObject().put("id",id).put("nonce",UUID.randomUUID().toString()).put("title",title).put("course",course).put("lease",clean).put("server",grant.getLong("issued_at")).put("elapsed",stamp).put("boot",boot()).put("state","downloading").put("percent",0);
            try{JSONObject progress=(JSONObject)api().request("/video/"+id+"/progress","GET",null,true);entry.put("position",progress.optDouble("progress")).put("revision",progress.optInt("revision"));}catch(Exception ignored){}
            final long limit;
            synchronized(this){if(active!=generation||!current(entry))return;downloading=0;remove(id);downloading=id;long used=AliyunSecureCacheDriver.directoryBytes(root);limit=Math.min(grant.getLong("max_bytes"),Math.min(2147483648L-used,context.getNoBackupFilesDir().getUsableSpace()-104857600));inventory.getJSONArray("items").put(entry);persist();}changed();
            main.post(()->{synchronized(this){if(active!=generation||!current(entry))return;}try{driver.start(grant.getString("vod_video_id"),auth,new File(root,String.valueOf(id)),limit,
                ()->{synchronized(this){JSONObject live=row(id);try{return active==generation&&live!=null&&entry.getString("nonce").equals(live.optString("nonce"))&&current(live)&&lease(live.getJSONObject("lease")).permits(now(live));}catch(Exception e){return false;}}},
                new AliyunSecureCacheDriver.Listener(){public void progress(int percent){synchronized(CourseCacheManager.this){JSONObject live=row(id);if(live!=null&&active==generation)try{live.put("percent",Math.max(0,Math.min(99,percent)));}catch(Exception ignored){}}changed();}
                    public void complete(File f){synchronized(CourseCacheManager.this){if(active!=generation||!current(entry))return;try{entry.put("file",f.getCanonicalPath().substring(root.getCanonicalPath().length()+1)).put("bytes",AliyunSecureCacheDriver.directoryBytes(new File(root,String.valueOf(id)))).put("percent",100).put("state","ready");persist();downloading=0;message="下载完成";}catch(Exception e){remove(id);message="下载内容无法安全保存，请重试";}}changed();refresh();}
                    public void failure(String text){synchronized(CourseCacheManager.this){if(active!=generation)return;remove(id);message=text;}changed();}});
            }catch(Exception e){synchronized(this){if(active==generation){remove(id);message="安全下载失败，请联网重试";}}changed();}});
        }catch(Exception e){synchronized(this){if(active==generation){downloading=0;message=e.getMessage();}}changed();}});
    }
    synchronized void checkpoint(int id,double position,double duration){JSONObject r=row(id);if(r==null||!usable(r)||!Double.isFinite(position)||!Double.isFinite(duration)||duration<=0||position<0||position>duration+1)return;try{r.put("position",Math.min(position,duration)).put("duration",duration).put("pending",true);persist();}catch(Exception e){message="本机学习进度保存失败";}}
    private void syncProgress(int id){JSONObject snap=get(id);if(snap==null||!snap.optBoolean("pending")||!usable(snap))return;try{
        JSONObject result=(JSONObject)api().request("/video/"+id+"/progress","POST",new JSONObject().put("progress",snap.optDouble("position")).put("duration",snap.optDouble("duration")).put("revision",snap.optInt("revision")),true);
        synchronized(this){JSONObject live=row(id);if(live==null||!current(live)||!live.optString("nonce").equals(snap.optString("nonce"))||live.optDouble("position")!=snap.optDouble("position"))return;live.put("revision",result.optInt("revision")).put("pending",false);persist();}
    }catch(Api.Failure failure){
        if(failure.status==409)try{JSONObject newer=(JSONObject)api().request("/video/"+id+"/progress","GET",null,true);synchronized(this){JSONObject live=row(id);if(live==null||!current(live)||!live.optString("nonce").equals(snap.optString("nonce"))||live.optDouble("position")!=snap.optDouble("position"))return;live.put("position",newer.optDouble("progress")).put("duration",newer.optDouble("duration",live.optDouble("duration"))).put("revision",newer.optInt("revision")).put("pending",false);persist();}}catch(Exception ignored){}
    }catch(Exception ignored){/* Keep protected outbox; no replay over another device's newer revision. */}}
}
