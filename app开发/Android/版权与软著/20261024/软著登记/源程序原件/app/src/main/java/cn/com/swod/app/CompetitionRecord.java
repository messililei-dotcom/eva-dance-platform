package cn.com.swod.app;

public final class CompetitionRecord {
    private CompetitionRecord() {}
    public static String result(Object published, String score, int rank, String award) {
        if (!Boolean.TRUE.equals(published)) return "成绩待公示";
        String label = award != null && !award.isEmpty() ? award : rank > 0 ? "第"+rank+"名" : "成绩已公示";
        return label + (score == null || score.isEmpty() ? "" : " · "+score+"分");
    }
    public static String audit(String value) {
        switch(value) { case "pending":return "待审核";case "approved":return "审核通过";case "rejected":return "未通过";default:return value.isEmpty()?"待审核":value; }
    }
    public static String paid(String value) {
        switch(value) { case "unpaid":return "待缴费";case "pending":return "待确认";case "paid":return "已缴费";case "refunded":return "已退款";default:return value; }
    }
}
