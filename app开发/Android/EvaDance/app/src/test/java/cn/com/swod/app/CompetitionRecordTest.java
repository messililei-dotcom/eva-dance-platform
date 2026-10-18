package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class CompetitionRecordTest {
    @Test public void unpublishedOrMalformedFlagsNeverRevealScores() {
        for(Object flag:new Object[]{null,false,"true","false",1})assertEquals("成绩待公示",CompetitionRecord.result(flag,"99",1,"冠军"));
    }
    @Test public void publishedZeroAndMissingScoresStayDistinct() {
        assertEquals("第2名 · 0分",CompetitionRecord.result(true,"0",2,""));
        assertEquals("冠军 · 95.5分",CompetitionRecord.result(true,"95.5",1,"冠军"));
        assertEquals("成绩已公示",CompetitionRecord.result(true,"",0,""));
    }
    @Test public void auditAndPaymentAreSeparateStatuses() {
        assertEquals("待审核",CompetitionRecord.audit("pending"));assertEquals("待确认",CompetitionRecord.paid("pending"));
        assertEquals("已退款",CompetitionRecord.paid("refunded"));
    }
}
