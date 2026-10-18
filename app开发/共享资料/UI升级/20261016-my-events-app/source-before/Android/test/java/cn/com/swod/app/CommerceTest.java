package cn.com.swod.app;
import org.junit.Test;
import static org.junit.Assert.*;

public class CommerceTest {
    @Test public void shopMoneyUsesFenWithoutFloatingPointRounding() {
        assertEquals("0.00", Commerce.money(0));
        assertEquals("0.01", Commerce.money(1));
        assertEquals("199.00", Commerce.money(19900));
        assertEquals("9999999999999.99", Commerce.money(999999999999999L));
    }
    @Test public void paidCoursesHaveNoShipmentAndRefundIsNotDuplicate() {
        assertEquals("待发货", Commerce.status("paid", "goods"));
        assertEquals("已支付", Commerce.status("paid", "offline"));
        assertTrue(Commerce.refundable("paid"));
        assertFalse(Commerce.refundable("refund_requested"));
        assertFalse(Commerce.refundable("refunding"));
        assertFalse(Commerce.refundable("cancelled"));
    }
}
