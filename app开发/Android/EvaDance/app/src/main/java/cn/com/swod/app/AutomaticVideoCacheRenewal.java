package cn.com.swod.app;
import java.util.concurrent.*;
import java.util.function.*;

/** The inventory supplies protected persistence, authenticated renewal and a continuous-clock anchor. */
final class AutomaticVideoCacheRenewal implements AutoCloseable {
    static final class Lease {
        final long member,issued,expires; final int lesson,series; final String session,device,vod,material,mode;
        Lease(long member,String session,String device,int lesson,int series,String vod,String material,long issued,long expires,String mode){this.member=member;this.session=session;this.device=device;this.lesson=lesson;this.series=series;this.vod=vod;this.material=material;this.issued=issued;this.expires=expires;this.mode=mode;}
        boolean sameFile(Lease old){return member==old.member&&lesson==old.lesson&&series==old.series&&session.equals(old.session)&&device.equals(old.device)&&vod.equals(old.vod)&&material.equals(old.material);}
        boolean permits(long now){return vod!=null&&vod.matches("[a-f0-9]{32}")&&material!=null&&material.matches("[a-f0-9]{64}")&&VideoCachePolicy.permits(member,session,device,lesson,series,issued,expires,mode,member,session,device,lesson,now);}
    }
    interface Renew { Lease request(Lease old)throws Exception; }
    private volatile Lease lease;
    private volatile boolean revoked;
    private final java.util.concurrent.atomic.AtomicBoolean busy=new java.util.concurrent.atomic.AtomicBoolean();
    private long lastAttempt=Long.MIN_VALUE/2;
    private final LongSupplier now,retryNow;private final BooleanSupplier online,current;private final Renew renew;private final Consumer<Lease> persist;private final Runnable discard;
    private volatile ScheduledExecutorService timer;
    AutomaticVideoCacheRenewal(Lease initial,LongSupplier now,LongSupplier retryNow,BooleanSupplier online,BooleanSupplier current,Renew renew,Consumer<Lease> persist,Runnable discard){lease=initial;this.now=now;this.retryNow=retryNow;this.online=online;this.current=current;this.renew=renew;this.persist=persist;this.discard=discard;}
    boolean canPlay(){return !revoked&&current.getAsBoolean()&&lease.permits(now.getAsLong());}
    void refresh(){
        if(revoked||!busy.compareAndSet(false,true))return;
        try {
            if(!current.getAsBoolean()){invalidate();return;}long time=now.getAsLong(),stamp=retryNow.getAsLong(),since=stamp-lastAttempt;
            if(!online.getAsBoolean()||since<60000||(time>=lease.issued&&time<lease.expires-21600000&&since<300000))return;lastAttempt=stamp;
            Lease next=renew.request(lease);if(revoked||!current.getAsBoolean()||next==null||!next.permits(next.issued)||!next.sameFile(lease)){invalidate();return;}
            persist.accept(next);if(revoked||!current.getAsBoolean()){invalidate();return;}lease=next;
        }catch(Api.Failure error){if(VideoCachePolicy.invalidates(error.status))invalidate();}
         catch(Exception error){/* No local extension or user prompt on transport/storage failure. */}
         finally{busy.set(false);}
    }
    synchronized void start(){close();if(revoked)return;timer=Executors.newSingleThreadScheduledExecutor(r->{Thread thread=new Thread(r,"SWOD-cache-renewal");thread.setDaemon(true);return thread;});timer.scheduleWithFixedDelay(this::refresh,0,60,TimeUnit.SECONDS);}
    void onForegroundOrNetworkAvailable(){ScheduledExecutorService active=timer;if(active!=null&&!active.isShutdown())try{active.execute(this::refresh);}catch(RejectedExecutionException ignored){}}
    private void invalidate(){revoked=true;close();discard.run();}
    public synchronized void close(){if(timer!=null){timer.shutdownNow();timer=null;}}
}
