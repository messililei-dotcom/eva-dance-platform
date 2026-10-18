package cn.com.swod.app;

import java.math.BigDecimal;

/** Shop amounts are integer fen, distinct from the course catalog's yuan. */
public final class Commerce {
    public static String money(long fen) { return BigDecimal.valueOf(fen, 2).toPlainString(); }
    public static String status(String status, String kind) {
        switch (status) {
            case "pending": return "待付款";
            case "paid": return "goods".equals(kind) ? "待发货" : "已支付";
            case "shipped": return "待收货";
            case "completed": return "已完成";
            case "cancelled": return "已取消";
            case "refund_requested": return "退款审核中";
            case "refunding": return "退款处理中";
            case "refunded": return "已退款";
            default: return status;
        }
    }
    public static boolean refundable(String status) {
        return "paid".equals(status) || "shipped".equals(status) || "completed".equals(status);
    }
    private Commerce() {}
}
