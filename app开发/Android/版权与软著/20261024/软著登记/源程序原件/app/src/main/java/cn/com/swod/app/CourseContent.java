package cn.com.swod.app;
import android.content.Context;
import org.json.*;
import java.nio.charset.StandardCharsets;
public final class CourseContent {
 private final JSONObject data;
 public CourseContent(Context context){JSONObject copy;try(java.io.InputStream in=context.getAssets().open("official-offline-content.json")){java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[4096];int n;while((n=in.read(b))!=-1)out.write(b,0,n);copy=new JSONObject(out.toString(StandardCharsets.UTF_8.name()));}catch(Exception e){copy=new JSONObject();}data=copy;}
 public JSONObject intro(JSONObject row){JSONObject overrides=data.optJSONObject("periodOverrides"),courses=data.optJSONObject("courses"),aliases=data.optJSONObject("aliases");JSONObject result=overrides==null?null:overrides.optJSONObject(row.optString("source_id"));if(result==null&&courses!=null&&aliases!=null)result=courses.optJSONObject(aliases.optString(row.optString("group_key")));return result==null?new JSONObject():result;}
 public String description(JSONObject row){return intro(row).optString("fullDescription",row.optString("description")).replaceAll("开课时间：[^｜\\n]+","开课时间：以所选期次安排为准");}
 public static boolean canBuy(JSONObject row){return CoursePolicy.canBuy(row.optString("period_status"),row.optString("end_date"),row.optDouble("price",0),row.optDouble("capacity",0),row.optDouble("remaining",0),row.optInt("source_id"),System.currentTimeMillis());}
}
