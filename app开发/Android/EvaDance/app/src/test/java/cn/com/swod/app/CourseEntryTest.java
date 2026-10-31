package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class CourseEntryTest {
 @Test public void newLearnerStartsAtFirstLesson(){assertEquals(11,CoursePolicy.startingLesson(new int[]{11,22},new int[]{},new String[]{}));}
 @Test public void latestServerHistoryWinsRegardlessOfCatalogOrder(){assertEquals(22,CoursePolicy.startingLesson(new int[]{11,22},new int[]{22,11},new String[]{"2026-10-30 09:30:00","2026-10-29 10:00:00"}));}
 @Test public void foreignAndUnwatchedRowsCannotSelectALesson(){assertEquals(11,CoursePolicy.startingLesson(new int[]{11,22},new int[]{999,22},new String[]{"2026-10-31 09:30:00",null}));assertEquals(0,CoursePolicy.startingLesson(new int[]{},new int[]{999},new String[]{"2026-10-31"}));}
}
