package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
import java.time.Instant;
public class EventPresentationTest {
    @Test public void unavailableCountsNeverBecomeZero(){
        assertNull(EventPresentation.number(null));assertNull(EventPresentation.number(-1));
        assertNull(EventPresentation.number(Double.NaN));assertNull(EventPresentation.number(1.5));
        assertEquals(Long.valueOf(0),EventPresentation.number(0));
        assertEquals(Long.valueOf(402),EventPresentation.number(402));
    }
    @Test public void eventEndIncludesTheWholeShanghaiDay(){
        Instant now=Instant.parse("2026-11-29T12:00:00Z");
        assertEquals("报名中",EventPresentation.state("published","open","2026-11-29","","",now));
        assertEquals("已结束",EventPresentation.state("published","open","2026-11-29","","",now.plusSeconds(14401)));
    }
    @Test public void cancellationAndRegistrationWindowsOverrideOpenSwitch(){
        Instant now=Instant.parse("2026-11-29T12:00:00Z");
        assertEquals("已取消",EventPresentation.state("cancelled","open","","","",now));
        assertEquals("报名未开始",EventPresentation.state("published","open","","2026-12-01","",now));
        assertEquals("报名已截止",EventPresentation.state("published","open","","","2026-11-28",now));
        assertEquals("报名未开放",EventPresentation.state("published","closed","","","",now));
    }
    @Test public void databaseLocalTimesUseShanghaiInsteadOfTheDeviceZone(){
        Instant now=Instant.parse("2026-11-29T12:00:00Z");
        assertEquals("报名未开始",EventPresentation.state("published","open","","2026-11-29 21:00:00","",now));
        assertEquals("报名已截止",EventPresentation.state("published","open","","","2026-11-29 19:59:59",now));
    }
}
