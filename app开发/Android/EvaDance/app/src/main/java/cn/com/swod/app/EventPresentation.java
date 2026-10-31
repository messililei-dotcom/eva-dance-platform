package cn.com.swod.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.time.*;

final class EventPresentation {
    static Long number(Object raw){
        if(raw==null)return null;
        try{double value=Double.parseDouble(String.valueOf(raw));if(Double.isFinite(value)&&value>=0&&value==Math.rint(value)&&value<Long.MAX_VALUE)return (long)value;}catch(NumberFormatException ignored){}
        return null;
    }
    static Long count(JSONObject row,String... keys){
        for(String key:keys){Object raw=row.opt(key);if(raw==null||raw==JSONObject.NULL)continue;Long value=number(raw);if(value!=null)return value;}return null;
    }
    static String aggregate(JSONArray rows,boolean people){
        long sum=0;for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row==null)return people?"未公开":"—";
            Long value=people?count(row,"approvedPlayerCount","playerCount"):count(row,"rankingCount","scoreCount");
            if(value==null||value>Long.MAX_VALUE-sum)return people?"未公开":"—";sum+=value;
        }return Long.toString(sum);
    }
    static String value(JSONObject row,String... keys){for(String key:keys){String v=row.optString(key,"");if(!v.isEmpty()&&!v.equals("null"))return v;}return "";}
    static String dates(JSONObject row){String start=value(row,"startDate","start_date"),end=value(row,"endDate","end_date");if(start.length()>10)start=start.substring(0,10);if(end.length()>10)end=end.substring(0,10);return start.isEmpty()?"时间待定":end.isEmpty()||start.equals(end)?start:start+" 至 "+end;}
    private static Instant instant(String raw,boolean end){
        if(raw.isEmpty())return null;try{
            if(raw.length()==10){LocalDate date=LocalDate.parse(raw);return (end?date.plusDays(1).atStartOfDay(ZoneId.of("Asia/Shanghai")).toInstant().minusMillis(1):date.atStartOfDay(ZoneId.of("Asia/Shanghai")).toInstant());}
            return Instant.parse(raw);
        }catch(Exception ignored){
            try{return LocalDateTime.parse(raw.replace(' ','T')).atZone(ZoneId.of("Asia/Shanghai")).toInstant();}catch(Exception invalid){return null;}
        }
    }
    static String state(JSONObject row){return state(row,Instant.now());}
    static String state(JSONObject row,Instant now){
        return state(value(row,"status"),value(row,"registrationStatus"),value(row,"endDate","end_date"),value(row,"registrationStart"),value(row,"registrationEnd"),now);
    }
    static String state(String status,String registration,String endDate,String registrationStart,String registrationEnd,Instant now){
        if(status.equals("cancelled"))return "已取消";
        Instant ended=instant(endDate,true);
        if(status.equals("finished")||(ended!=null&&ended.isBefore(now)))return "已结束";
        Instant start=instant(registrationStart,false),end=instant(registrationEnd,true);
        if(start!=null&&start.isAfter(now))return "报名未开始";if(end!=null&&end.isBefore(now))return "报名已截止";
        return registration.equals("open")?"报名中":"报名未开放";
    }
}
