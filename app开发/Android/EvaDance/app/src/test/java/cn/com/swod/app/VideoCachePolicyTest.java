package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class VideoCachePolicyTest {
    private boolean grant(long owner,String sid,String device,int lesson,long now){return VideoCachePolicy.permits(1,"session","a".repeat(64),10,30,1000,86401000,"aliyun-secure",owner,sid,device,lesson,now);}
    @Test public void accountSessionDeviceAndLessonAreAllRequired(){assertTrue(grant(1,"session","a".repeat(64),10,1001));assertFalse(grant(2,"session","a".repeat(64),10,1001));assertFalse(grant(1,"other","a".repeat(64),10,1001));assertFalse(grant(1,"session","b".repeat(64),10,1001));assertFalse(grant(1,"session","a".repeat(64),11,1001));}
    @Test public void expiryCannotBeExtendedOrRolledBack(){assertFalse(grant(1,"session","a".repeat(64),10,999));assertFalse(grant(1,"session","a".repeat(64),10,86401000));assertFalse(VideoCachePolicy.permits(1,"s","a".repeat(64),10,30,1,86400002,"aliyun-secure",1,"s","a".repeat(64),10,2));}
    @Test public void automaticRenewalIsOnlineAndThrottled(){assertTrue(VideoCachePolicy.shouldRenew(86401000,301000,1000,true));assertFalse(VideoCachePolicy.shouldRenew(86401000,30000,1000,true));assertFalse(VideoCachePolicy.shouldRenew(86401000,301000,1000,false));for(int code:new int[]{401,403,404,409,410})assertTrue(VideoCachePolicy.invalidates(code));assertFalse(VideoCachePolicy.invalidates(503));}
}
