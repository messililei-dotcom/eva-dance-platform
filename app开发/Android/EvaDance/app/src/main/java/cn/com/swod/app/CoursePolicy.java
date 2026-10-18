package cn.com.swod.app;
import java.time.*;
import java.util.Locale;
public final class CoursePolicy {
 public static double amount(double price,double promo){return Double.isFinite(promo)&&promo>0?promo:price;}
 public static String price(double price,double promo,boolean free){double value=amount(price,promo);return free?"免费":Double.isFinite(value)&&value>0?String.format(Locale.ROOT,"¥%.2f",value):"咨询价格";}
 public static boolean discount(double price,double promo,boolean free){return !free&&Double.isFinite(price)&&Double.isFinite(promo)&&promo>0&&price>promo;}
 public static boolean canBuy(String status,String end,double price,double capacity,double remaining,int id,long now){String today=Instant.ofEpochMilli(now).atZone(ZoneId.of("Asia/Shanghai")).toLocalDate().toString();return ("active".equals(status)||"planned".equals(status))&&price>0&&id>0&&(end.isEmpty()||end.substring(0,Math.min(10,end.length())).compareTo(today)>=0)&&(capacity<=0||remaining>0);}
 public static int percent(double position,double duration,boolean completed){return completed?100:duration>0?(int)Math.min(100,Math.max(0,position/duration*100)):0;}
 public static boolean paymentURL(String url){if(!Policy.secureURL(url))return false;try{return java.util.Arrays.asList("openapi.alipay.com","mapi.alipay.com","wx.tenpay.com").contains(java.net.URI.create(url).getHost());}catch(Exception error){return false;}}
 private CoursePolicy(){}
}
