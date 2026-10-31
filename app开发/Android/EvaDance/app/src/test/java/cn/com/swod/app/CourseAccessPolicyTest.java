package cn.com.swod.app;
import org.junit.Test;
import java.util.Set;
import static org.junit.Assert.*;
public class CourseAccessPolicyTest {
    @Test public void guestAndUnknownCannotInheritCachedOrOtherAccountRights() {
        assertEquals(CourseAccessPolicy.State.GUEST, CourseAccessPolicy.evaluate(false,true,7,Set.of(7)));
        assertEquals(CourseAccessPolicy.State.UNKNOWN, CourseAccessPolicy.evaluate(true,false,7,Set.of(7)));
        assertEquals(CourseAccessPolicy.State.LOCKED, CourseAccessPolicy.evaluate(true,true,7,Set.of(8)));
    }
    @Test public void validExpiredRevokedAndOtherSeriesAreDifferent() {
        assertEquals(CourseAccessPolicy.State.UNLOCKED, CourseAccessPolicy.evaluate(true,true,7,Set.of(7)));
        assertEquals(CourseAccessPolicy.State.LOCKED, CourseAccessPolicy.evaluate(true,true,7,Set.of()));
        assertEquals(CourseAccessPolicy.State.UNKNOWN, CourseAccessPolicy.evaluate(true,true,0,Set.of(7)));
    }
    @Test public void onlyPositiveIntegralBackendSeriesIdsAreAccepted() {
        assertEquals(7,CourseAccessPolicy.canonicalId("7"));
        assertEquals(7,CourseAccessPolicy.canonicalId(7L));
        for(Object invalid:new Object[]{0,-1,1.5,Double.NaN,2147483648L,"legacy-7","7.0",true}) {
            try { CourseAccessPolicy.canonicalId(invalid); fail("accepted invalid series ID"); }
            catch(IllegalArgumentException expected) {}
        }
    }
}
