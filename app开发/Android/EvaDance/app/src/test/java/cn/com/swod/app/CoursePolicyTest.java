package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;
public class CoursePolicyTest {
 @Test public void pricesMatchServerPromoAndFreeRules(){assertEquals("¥499.00",CoursePolicy.price(2980,499,false));assertTrue(CoursePolicy.discount(2980,499,false));assertFalse(CoursePolicy.discount(99,199,false));assertEquals("免费",CoursePolicy.price(2980,499,true));assertEquals("咨询价格",CoursePolicy.price(0,0,false));}
 @Test public void periodStateAndChinaDateBoundaries(){long now=java.time.Instant.parse("2026-10-17T12:00:00Z").toEpochMilli();assertTrue(CoursePolicy.canBuy("planned","2099-01-01",99,0,0,1,now));assertFalse(CoursePolicy.canBuy("active","2026-10-16",99,0,0,1,now));assertFalse(CoursePolicy.canBuy("active","2099-01-01",99,1,0,1,now));assertFalse(CoursePolicy.canBuy("completed","2099-01-01",99,0,0,1,now));}
 @Test public void progressAndOfficialPaymentOrigins(){assertEquals(100,CoursePolicy.percent(100,100,false));assertEquals(42,CoursePolicy.percent(42,100,false));assertTrue(CoursePolicy.paymentURL("https://openapi.alipay.com/gateway.do"));assertFalse(CoursePolicy.paymentURL("https://openapi.alipay.com.evil.test/gateway.do"));assertFalse(CoursePolicy.paymentURL("http://wx.tenpay.com/pay"));}
}
