package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class CacheClockTest {
    @Test public void editableWallClockIsNotAnInput(){assertEquals(86401000L,CacheClock.trusted(1000,2000,"boot:1",86402000,"boot:1"));}
    @Test public void rebootOrUnknownBootRequiresNetwork(){assertEquals(Long.MIN_VALUE,CacheClock.trusted(1000,2000,"boot:1",3000,"boot:2"));assertEquals(Long.MIN_VALUE,CacheClock.trusted(1000,2000,"",3000,""));assertEquals(Long.MIN_VALUE,CacheClock.trusted(1000,2000,"boot:1",1000,"boot:1"));}
    @Test public void overflowingAnchorNeverGrantsTime(){assertEquals(Long.MIN_VALUE,CacheClock.trusted(Long.MAX_VALUE,1,"boot:1",10,"boot:1"));}
}
