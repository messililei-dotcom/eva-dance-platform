package cn.com.swod.app;

/** Offline grants are scoped to authenticated account, app session, installation and lesson. */
final class VideoCachePolicy {
    static final long MAX_LEASE_MS=86400000L;
    static boolean permits(long owner,String session,String device,int lesson,int series,long issued,long expires,String mode,
                           long currentOwner,String currentSession,String currentDevice,int currentLesson,long serverNow){
        return "aliyun-secure".equals(mode)&&owner>0&&owner==currentOwner&&session!=null&&!session.isEmpty()&&session.equals(currentSession)
            &&device!=null&&device.matches("[a-f0-9]{64}")&&device.equals(currentDevice)&&lesson>0&&lesson==currentLesson&&series>0
            &&issued>0&&expires>issued&&expires-issued<=MAX_LEASE_MS&&serverNow>=issued&&serverNow<expires;
    }
    static boolean shouldRenew(long expires,long serverNow,long lastAttempt,boolean online){
        return online&&serverNow-lastAttempt>=60000&&(serverNow>=expires-21600000||serverNow-lastAttempt>=300000);
    }
    /** A definitive server denial never falls back to an old offline grant. Transport errors may, until expiry. */
    static boolean invalidates(int status){return status==401||status==403||status==404||status==409||status==410;}
}
