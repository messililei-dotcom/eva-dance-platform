package cn.com.swod.app;
import java.util.Locale;
public final class ProductPresentation {
    private static Double valid(Object value) {
        if (!(value instanceof Number)) return null;
        double number=((Number)value).doubleValue();
        return Double.isFinite(number) && number>=0 && number<=9007199254740991d && number==Math.floor(number) ? number : null;
    }
    public static String price(Object value) { Double amount=valid(value); return amount==null?"价格待确认":String.format(Locale.ROOT,"¥%.2f",amount/100); }
    public static String stock(Object value) { Double stock=valid(value); return stock==null?"库存待确认":stock==0?"暂时售罄":String.format(Locale.ROOT,"库存 %.0f",stock); }
    private ProductPresentation() {}
}
