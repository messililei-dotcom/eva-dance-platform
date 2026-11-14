package cn.com.swod.app;

import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Course-level summaries matching the mini-program; original period rows remain unchanged. */
final class OfflineCatalog {
    private static String text(JSONObject row,String field){return row.isNull(field)?"":row.optString(field,"");}
    static String key(JSONObject row){String value=text(row,"group_key");if(value.isEmpty())value=text(row,"name");return value.trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);}
    private static int year(JSONObject row){Matcher m=Pattern.compile("20[0-9]{2}").matcher(text(row,"start_date")+" "+text(row,"end_date")+" "+text(row,"subtitle"));int value=0;while(m.find())value=Math.max(value,Integer.parseInt(m.group()));return value;}
    private static String date(JSONObject row){String value=text(row,"start_date");if(value.isEmpty())value=text(row,"end_date");value=value.trim();return value.substring(0,Math.min(10,value.length()));}
    static List<JSONObject> periods(JSONArray rows,JSONObject course){List<JSONObject> result=new ArrayList<>();for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&key(row).equals(key(course)))result.add(row);}result.sort((a,b)->{int diff=Integer.compare(year(b),year(a));if(diff==0)diff=date(b).compareTo(date(a));if(diff==0)diff=Double.compare(b.optDouble("id",0),a.optDouble("id",0));return diff;});return result;}
    static String periodLabel(JSONObject row){String start=text(row,"start_date").trim(),end=text(row,"end_date").trim();start=start.substring(0,Math.min(10,start.length()));end=end.substring(0,Math.min(10,end.length()));if(!start.isEmpty())return start+(!end.isEmpty()&&!end.equals(start)?" 至 "+end:"");String subtitle=text(row,"subtitle").trim();return !subtitle.isEmpty()&&!subtitle.equalsIgnoreCase("offline")?subtitle:"期次待公布";}
    static JSONArray grouped(JSONArray rows){
        LinkedHashMap<String,JSONObject> sources=new LinkedHashMap<>();
        for(int i=0;i<rows.length();i++){JSONObject row=rows.optJSONObject(i);if(row!=null&&!key(row).isEmpty()&&!sources.containsKey(key(row)))sources.put(key(row),row);}
        JSONArray result=new JSONArray();
        for(JSONObject source:sources.values()){
            List<JSONObject> entries=periods(rows,source);JSONObject first=entries.get(0);
            double min=Double.POSITIVE_INFINITY,students=0;String cover=text(first,"cover_image");StringBuilder search=new StringBuilder();
            for(JSONObject entry:entries){double price=entry.optDouble("price",0);if(Double.isFinite(price)&&price>0)min=Math.min(min,price);students=Math.max(students,entry.isNull("group_total_students")?entry.optDouble("total_students",0):entry.optDouble("group_total_students",0));if(cover.isEmpty())cover=text(entry,"cover_image");for(String field:new String[]{"name","subtitle","teacher","category","start_date","end_date"})search.append(text(entry,field)).append(' ');}
            try{JSONObject group=new JSONObject(first.toString());group.put("offline_period_count",entries.size());group.put("offline_latest_period",periodLabel(first));group.put("offline_student_count",students);group.put("offline_min_price",Double.isFinite(min)?min:0);group.put("cover_image",cover);group.put("offline_search_text",search.toString());result.put(group);}catch(org.json.JSONException error){throw new IllegalStateException("Invalid offline course summary",error);}
        }
        return result;
    }
    static String price(JSONObject row){double value=row.optDouble("offline_min_price",0);if(value<=0)value=row.optDouble("price",0);if(!Double.isFinite(value)||value<=0)return "咨询价格";String amount=String.format(Locale.ROOT,"%.2f",value).replaceAll("\\.00$","").replaceAll("(\\.\\d*[1-9])0+$","$1");return "¥"+amount+(row.optInt("offline_period_count")>1?"起":"");}
}
