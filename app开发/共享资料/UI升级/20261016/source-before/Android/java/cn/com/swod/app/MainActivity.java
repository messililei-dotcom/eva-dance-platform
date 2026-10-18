package cn.com.swod.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayDeque;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Five compact native tabs. All business records remain on the digital platform. */
public final class MainActivity extends Activity {
    private final ExecutorService io = Executors.newFixedThreadPool(3);
    private final ExecutorService imageIO = Executors.newFixedThreadPool(2);
    private final ArrayDeque<Runnable> history = new ArrayDeque<>();
    private Api api;
    private LinearLayout root, content;
    private TextView title;
    private final Button[] tabButtons = new Button[5];
    private boolean memberWriteBusy;
    private boolean authBusy, smsBusy;
    private long smsSentAt;
    private Runnable page;
    private volatile int generation;
    private String staffToken;
    private boolean staffBusy;
    private byte[] musicBytes;
    private String musicFilename = "";
    private TextView musicLabel;
    private int musicPickerGeneration;
    private boolean registrationBusy;
    private final int red = Color.rgb(159,29,32);
    @Override public void onCreate(Bundle state) {
        super.onCreate(state); api = Api.get(this);
        root = column(); root.setBackgroundColor(Color.rgb(250,248,246));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) { android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime()); root.setPadding(safe.left,safe.top,safe.right,safe.bottom); }
            else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar = row(); Button back = button("‹", () -> back()); bar.addView(back,new LinearLayout.LayoutParams(dp(48),dp(48)));
        title = text("线上学院",18); title.setGravity(Gravity.CENTER_VERTICAL); bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        Button refresh = button("刷新", () -> { if (page != null) page.run(); }); bar.addView(refresh); root.addView(bar);
        ScrollView scroll = new ScrollView(this); content = column(); content.setPadding(dp(12),0,dp(12),dp(12)); scroll.addView(content); root.addView(scroll,new LinearLayout.LayoutParams(-1,0,1));
        LinearLayout tabs = row(); String[] names={"线上学院","线下课","赛事","商城","我的"};
        Runnable[] pages={this::courses,this::offline,this::events,this::shop,this::account};
        for(int i=0;i<names.length;i++) { final Runnable p=pages[i]; final int index=i; Button b=button(names[i],()->{history.clear();selectTab(index);page=p;p.run();}); b.setTextSize(11); b.setPadding(0,0,0,0);tabButtons[i]=b; tabs.addView(b,new LinearLayout.LayoutParams(0,dp(56),1)); }
        tabs.setBackgroundColor(Color.WHITE);root.addView(tabs);selectTab(0); setContentView(root);if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{if(history.isEmpty())finish();else back();}); page=this::courses; courses();
    }
    // API 33+ registers OnBackInvokedDispatcher in onCreate; this override serves API 26-32.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { if(history.isEmpty()) super.onBackPressed(); else back(); }
    private void back() { if(!history.isEmpty()) {page=history.pop();page.run();} }
    private void open(Runnable next) { if(page!=null) history.push(page); page=next; next.run(); }
    private void selectTab(int selected){for(int i=0;i<tabButtons.length;i++){Button b=tabButtons[i];if(b!=null){b.setSelected(i==selected);b.setTextColor(i==selected?red:Color.rgb(140,129,114));b.setBackground(round(i==selected?Color.rgb(249,234,232):Color.WHITE,12));}}}
    private GradientDrawable round(int color,int radius){GradientDrawable d=new GradientDrawable();d.setColor(color);d.setCornerRadius(dp(radius));return d;}
    private void hero(String name,String description){LinearLayout box=column();box.setPadding(dp(16),dp(14),dp(16),dp(14));box.setBackground(round(Color.rgb(249,234,232),18));TextView heading=text(name,24);heading.setTextColor(red);box.addView(heading);box.addView(text(description,14));content.addView(box);}
    private void section(String name){TextView label=text(name,18);label.setPadding(dp(4),dp(20),dp(4),dp(8));content.addView(label);}
    private void begin(String name) { generation++; content.removeAllViews(); title.setText(name); }
    private int dp(int x) {return Math.round(x*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    private TextView text(String s,int size){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(Color.rgb(40,35,35));v.setPadding(dp(4),dp(5),dp(4),dp(5));return v;}
    private Button button(String s,Runnable tap){Button b=new Button(this);b.setText(s);b.setTextColor(red);b.setMinHeight(dp(48));b.setAllCaps(false);b.setBackground(round(Color.WHITE,12));b.setOnClickListener(v->tap.run());return b;}
    private void action(String s,Runnable tap){LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,-2);layout.topMargin=dp(6);content.addView(button(s,tap),layout);}
    private void info(String s){content.addView(text(s,14));}
    private EditText field(LinearLayout box,String hint, boolean digits){EditText v=new EditText(this);v.setHint(hint);v.setTextSize(15);v.setSingleLine(true);if(digits)v.setInputType(android.text.InputType.TYPE_CLASS_PHONE);box.addView(v,new LinearLayout.LayoutParams(-1,dp(52)));return v;}
    private interface Result{void receive(Object value)throws Exception;}
    private void load(String path,String method,JSONObject body,boolean auth,Result result){
        if(auth&&!api.loggedIn()){info("登录后查看个人学习和服务记录");action("手机号登录",()->open(this::login));return;}
        int version=generation; ProgressBar busy=new ProgressBar(this);content.addView(busy);
        io.execute(()->{Object value=null;Exception failure=null;try{value=api.request(path,method,body,auth);}catch(Exception e){failure=e;}
            final Object data=value;final Exception error=failure;
            runOnUiThread(()->{if(isFinishing()||version!=generation)return;content.removeView(busy);
                if(error!=null){info(error.getMessage());if(error instanceof Api.Failure && ((Api.Failure)error).status==401)action("重新登录",()->open(this::login));else action("重试",()->load(path,method,body,auth,result));return;}
                try{result.receive(data);}catch(Exception e){info("数据暂不可用，请刷新页面");}
            });});
    }
    private static JSONObject object(Object v){return v instanceof JSONObject?(JSONObject)v:new JSONObject();}
    private static JSONArray array(Object v){return v instanceof JSONArray?(JSONArray)v:new JSONArray();}
    private static String first(JSONObject v,String... keys){for(String k:keys){String s=v.optString(k,"");if(!s.isEmpty()&&!s.equals("null"))return s;}return "";}
    private static JSONObject body(Object... values){JSONObject v=new JSONObject();try{for(int i=0;i<values.length;i+=2)v.put((String)values[i],values[i+1]);}catch(Exception ignored){}return v;}
    private void confirm(String message,Runnable send){new AlertDialog.Builder(this).setMessage(message).setNegativeButton("取消",null).setPositiveButton("确认",(d,w)->send.run()).show();}
    private void card(LinearLayout box,String name,String summary,Runnable tap){LinearLayout item=column();item.setPadding(dp(8),dp(7),dp(8),dp(7));item.setBackground(round(Color.WHITE,14));item.addView(text(name,16));if(!summary.trim().isEmpty())item.addView(text(summary,12));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(7);box.addView(item,p);if(tap!=null){item.setContentDescription(name+"，"+summary+"，查看详情");item.setMinimumHeight(dp(64));item.setFocusable(true);item.setOnClickListener(v->tap.run());}}
    private interface RowTap{void tap(JSONObject row);}
    private void searchable(JSONArray rows,String[] fields,RowTap tap){
        EditText search=field(content,"搜索名称、老师或组别",false); LinearLayout results=column();content.addView(results);
        Runnable render=()->{results.removeAllViews();String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);int count=0;
            for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r==null)continue;String all="";for(String f:fields)all+=r.optString(f)+" ";boolean match=true;for(String part:query.split("\\s+"))if(!all.toLowerCase(Locale.ROOT).contains(part))match=false;
                if(match){count++;int before=results.getChildCount();card(results,first(r,"name","series_name","course_name","competitionName"),first(r,"subtitle","teacher","groupName","category","venue"),()->tap.tap(r));String cover=first(r,"cover_image","image");if(!cover.isEmpty())cover((LinearLayout)results.getChildAt(before),cover,false);}}
            if(count==0)results.addView(text("暂无匹配记录",14));};
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});render.run();
    }
    private void cover(LinearLayout box,String source,boolean goods){
        String url=source.startsWith("/")?(goods?"https://www.swod.com.cn":"https://admin.swod.com.cn")+source:source;
        if(!Policy.secureURL(url))return;
        ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setContentDescription("封面");box.addView(image,0,new LinearLayout.LayoutParams(-1,dp(goods?220:160)));
        int version=generation;imageIO.execute(()->{if(version!=generation)return;try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(!isFinishing()&&version==generation&&bitmap!=null)image.setImageBitmap(bitmap);else if(version==generation)box.removeView(image);});}catch(Exception ignored){runOnUiThread(()->{if(version==generation)box.removeView(image);});}});
    }
    private void courses(){begin("线上学院");hero("伊娃东方舞","线上学院 · 舞蹈作品 · 每天进步一点");action("继续学习",()->open(()->records("最近学习","/member/recent-courses","",r->play(r.optInt("video_id"),first(r,"course_name","name")))));action("我的课程",()->open(this::myCourses));action("学习助手",()->open(this::assistant));action("东方舞圈 · 官网资讯",()->open(this::website));section("探索课程");load("/public/series","GET",null,false,v->searchable(array(v),new String[]{"name","teacher","category"},r->open(()->course(r))));}
    private void myCourses(){begin("我的线上课程");load("/member/authorized-series","GET",null,true,v->{JSONArray rows=array(v);for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);int id=r.optInt("series_id",r.optInt("id"));card(content,first(r,"series_name","name"),first(r,"teacher","expire_at","expires_at"),()->open(()->catalog(id,first(r,"series_name","name"))));}if(rows.length()==0)info("暂无已授权线上课程");});}
    private void course(JSONObject r){begin(first(r,"name"));load("/public/series/"+r.optInt("id")+"/detail","GET",null,false,v->{JSONObject detail=object(v);hero(first(detail,"name"),first(detail,"subtitle","teacher"));cover(content,first(detail,"cover_image"),false);info(strip(first(detail,"rich_description","description")));info("共 "+detail.optInt("total_courses")+" 节课程");info((detail.optBoolean("is_free")||detail.optInt("is_free")==1)?"免费课程":"课程价格 ¥"+String.format(Locale.ROOT,"%.2f",detail.optDouble("price")));action("查看课程目录",()->open(()->catalog(detail.optInt("id"),detail.optString("name"))));});}
    private void website(){begin("东方舞圈与品牌服务");hero("东方舞圈","官网资讯、教学体系与品牌服务");String[] labels={"东方舞圈资讯","关于伊娃","品牌故事","传承弟子","出版著作","证书查询","联系与合作"};String[] paths={"/dance-circle","/about","/about/brand-story","/disciples","/about/publications","/certification","/contact"};for(int i=0;i<labels.length;i++){String url="https://www.swod.com.cn"+paths[i];action(labels[i],()->link(url));}}
    private void catalog(int id,String name){begin(name);load("/public/series/"+id+"/courses","GET",null,false,v->{JSONArray units=array(v);for(int i=0;i<units.length();i++){JSONObject unit=units.getJSONObject(i);JSONArray videos=unit.optJSONArray("videos");if(videos==null)continue;for(int j=0;j<videos.length();j++){JSONObject lesson=videos.getJSONObject(j);String label=unit.optString("name")+(videos.length()>1?" · "+lesson.optString("name"):"");card(content,label,"视频课程 · 登录后验证学习权限",()->play(lesson.optInt("id"),label));}}if(units.length()==0)info("暂无课节");});}
    private void play(int id,String name){playAt(id,name,-1);}
    private void playAt(int id,String name,int seconds){if(id<=0){info("课节信息无效，请刷新后重试");return;}if(!api.loggedIn()){open(this::login);return;}Intent intent=new Intent(this,PlayerActivity.class).putExtra("lesson",id).putExtra("title",name);if(seconds>=0)intent.putExtra("positionSeconds",seconds);startActivity(intent);}
    private void offline(){begin("线下课程");hero("线下课","专业培训 · 期次课时 · 到课核销");action("期次课时与核销",()->open(this::schedule));load("/public/offline-courses","GET",null,false,v->searchable(array(v),new String[]{"name","teacher","location"},r->open(()->{begin(first(r,"name"));info(strip(first(r,"description")));info(first(r,"start_date")+" — "+first(r,"end_date"));info(first(r,"location"));action("查看期次课时",()->open(this::schedule));})));}
    private void schedule(){begin("期次课时与核销");load("/offline/overview","GET",null,true,v->{JSONObject o=object(v);info("购买课程期次的课时，到课后核销扣减，无需预约。");JSONArray es=array(o.opt("entitlements"));for(int i=0;i<es.length();i++){JSONObject r=es.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("course_period")+" · 剩余 "+r.optInt("available_sessions")+" 课时 · 已核销 "+r.optInt("used_sessions")+" 课时");}info("核销记录");JSONArray records=array(o.opt("consumes"));for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("consume_date")+" · 核销 "+r.optInt("count")+" 课时");}});}
    private void booking(JSONObject r){open(this::schedule);}
    private void events(){begin("东方舞赛事");hero("东方舞赛事","完整组别 · 节目报名 · 赛程与成绩");action("工作人员 · 赛事管理",()->open(this::staffHome));action("我的报名与成绩",()->open(()->records("赛事记录","/member/events","entries",null)));load("/events","GET",null,false,v->searchable(array(v),new String[]{"name","venue","city"},r->open(()->event(r.optInt("id")))));}
    private void event(int id){begin("赛事详情");load("/events/"+id,"GET",null,false,v->{JSONObject o=object(v),c=o.optJSONObject("competition");if(c!=null){info(c.optString("name"));info(first(c,"startDate","start_date")+" · "+first(c,"venue"));info(strip(first(c,"description","introduction")));}info("完整组别名称");searchable(array(o.opt("groups")),new String[]{"name"},r->open(()->register(id,r)));info("赛程");displayRows(array(o.opt("sessions")),new String[]{"name","startsAt","venue"},null);info("已发布成绩");displayRows(array(o.opt("rankings")),new String[]{"rankNo","playerName","groupName","publishedTotal"},null);});}

    private void register(int id,JSONObject group){
        begin("报名与参赛音乐");musicBytes=null;musicFilename="";
        if(!api.loggedIn()){action("登录后报名",()->open(this::login));return;}
        info(group.optString("name"));info("报名费 ¥"+group.optDouble("registrationFee"));
        EditText name=field(content,"参赛姓名",false),phone=field(content,"手机号",true),org=field(content,"机构（选填）",false),teacher=field(content,"指导老师（选填）",false),performance=field(content,"节目名称",false),remark=field(content,"备注（选填）",false);
        musicLabel=text("支持MP3、WAV、M4A、AAC、FLAC，单个文件不超过10MB",12);content.addView(musicLabel);
        action("选择参赛音乐",()->{musicPickerGeneration=generation;Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(picker,460);});
        action("提交报名与音乐",()->{
            if(registrationBusy)return;
            if(name.getText().toString().trim().isEmpty()||!phone.getText().toString().matches("1[3-9][0-9]{9}")||performance.getText().toString().trim().isEmpty()||musicBytes==null){info("请填写姓名、手机号、节目名称并选择音乐");return;}
            confirm("确认提交本组报名、节目名称及音乐？",()->{
                if(registrationBusy)return;registrationBusy=true;int version=generation;
                JSONObject fields=body("groupId",group.optInt("id"),"name",name.getText().toString().trim(),"phone",phone.getText().toString(),"organization",org.getText().toString(),"teacher",teacher.getText().toString(),"performanceTitle",performance.getText().toString().trim(),"remark",remark.getText().toString());
                byte[] bytes=musicBytes;String filename=musicFilename;
                io.execute(()->{Exception failure=null;try{api.registerWithMusic(id,fields,filename,bytes);}catch(Exception e){failure=e;}
                    final Exception error=failure;runOnUiThread(()->{registrationBusy=false;if(version!=generation||isFinishing())return;
                        if(error!=null){info(error.getMessage());return;}musicBytes=null;begin("报名与音乐已提交");info("付款及处理进度请在赛事记录中查看。");action("查看报名记录",()->open(()->records("赛事记录","/member/events","entries",null)));});
                });
            });
        });
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(request!=460||result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();int version=musicPickerGeneration;
        io.execute(()->{try{
            String filename="";try(android.database.Cursor c=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())filename=c.getString(0);}
            if(!filename.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|wav|m4a|aac|flac)$"))throw new Exception("请选择MP3、WAV、M4A、AAC或FLAC音乐");
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();try(java.io.InputStream stream=getContentResolver().openInputStream(uri)){if(stream==null)throw new Exception("无法读取所选文件");byte[] chunk=new byte[8192];int n;while((n=stream.read(chunk))!=-1){bytes.write(chunk,0,n);if(bytes.size()>10*1024*1024)throw new Exception("音乐文件不能超过10MB");}}
            if(bytes.size()==0)throw new Exception("音乐文件为空");String selected=filename;byte[] payload=bytes.toByteArray();
            runOnUiThread(()->{if(version!=generation||isFinishing())return;musicBytes=payload;musicFilename=selected;musicLabel.setText("已选择："+selected);});
        }catch(Exception e){runOnUiThread(()->{if(version==generation&&!isFinishing())info(e.getMessage());});}});
    }

    private void shop(){begin("伊娃甄选");hero("伊娃甄选","东方舞生活 · 官方商城");action("我的商城订单",()->open(this::orders));action("收货地址",()->open(this::shipping));section("精选商品");load("/shop/products","GET",null,false,v->{JSONArray products=array(object(v).opt("products"));EditText query=field(content,"搜索商品、颜色或尺码",false);Spinner category=new Spinner(this);java.util.ArrayList<String> categories=new java.util.ArrayList<>();categories.add("全部商品");for(int i=0;i<products.length();i++){String c=products.optJSONObject(i).optString("category");if(!c.isEmpty()&&!categories.contains(c))categories.add(c);}category.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,categories));content.addView(category);LinearLayout list=column();content.addView(list);Runnable render=()->{list.removeAllViews();String keyword=query.getText().toString().trim().toLowerCase(Locale.ROOT),selected=categories.get(category.getSelectedItemPosition());for(int i=0;i<products.length();i++){JSONObject r=products.optJSONObject(i);if(r==null||(!selected.equals("全部商品")&&!selected.equals(r.optString("category"))))continue;String search=(r.optString("name")+" "+r.optString("color")+" "+r.optString("size")+" "+r.optString("spec")).toLowerCase(Locale.ROOT);if(!search.contains(keyword))continue;int index=list.getChildCount();card(list,r.optString("name"),productSpec(r)+" · ¥"+Commerce.money(r.optLong("priceFen"))+" · "+(r.optInt("stock")>0?"有货":"售罄"),()->open(()->product(r)));cover((LinearLayout)list.getChildAt(index),first(r,"image"),true);}if(list.getChildCount()==0)list.addView(text("暂无符合条件的商品",14));};query.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});category.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int at,long id){render.run();}});render.run();});}
    private String productSpec(JSONObject r){java.util.ArrayList<String> values=new java.util.ArrayList<>();for(String key:new String[]{"spec","color","size"}){String value=first(r,key);if(!value.isEmpty())values.add(value);}return String.join(" · ",values);}
    private void product(JSONObject r){begin(r.optString("name"));cover(content,first(r,"image"),true);hero(r.optString("name"),productSpec(r));info(strip(first(r,"description")));info("¥"+Commerce.money(r.optLong("priceFen"))+" · 库存 "+r.optInt("stock"));info("购买及支付接入验证中。可查看商品和既有订单。");action("查看我的订单",()->open(this::orders));}
    private void shipping(){begin("收货地址");load("/shop/shipping","GET",null,true,v->{JSONObject o=object(v);JSONObject a=o.optJSONObject("shipping");if(a==null)a=o;EditText name=field(content,"收件人",false),phone=field(content,"手机号",true),address=field(content,"完整收货地址（省市区和门牌）",false);name.setText(first(a,"recipient","name"));phone.setText(a.optString("phone"));address.setText(a.optString("address"));action("保存地址",()->{String n=name.getText().toString().trim(),p=phone.getText().toString().trim(),d=address.getText().toString().trim();if(n.isEmpty()||n.length()>60||!p.matches("1[3-9][0-9]{9}")||d.length()<5||d.length()>200){info("请填写收件人、有效手机号和完整地址");return;}memberWrite("/shop/shipping","PUT",body("recipient",n,"phone",p,"address",d),this::shipping);});});}
    private void orders(){begin("我的商城订单");load("/shop/orders","GET",null,true,v->{JSONArray rows=array(object(v).opt("orders"));for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,"订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind"))+" · ¥"+Commerce.money(r.optLong("totalFen"))+" · "+first(r,"createdAt"),()->open(()->order(r.optString("id"))));}if(rows.length()==0)info("暂无商城订单");});}
    private void order(String id){begin("订单详情");String path="/shop/orders/"+Uri.encode(id);load(path,"GET",null,true,v->{JSONObject r=object(v).optJSONObject("order");if(r==null)throw new Exception("订单不存在");hero("订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind")));info("合计 ¥"+Commerce.money(r.optLong("totalFen")));JSONArray items=array(r.opt("items"));for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);card(content,item.optString("name"),"¥"+Commerce.money(item.optLong("unit_fen"))+" × "+item.optInt("quantity"),null);}info(first(r,"createdAt"));info(first(r,"carrier")+" "+first(r,"trackingNo"));info(first(r,"recipient")+" · "+mask(r.optString("phone"))+" · "+first(r,"address"));JSONObject shipping=r.optJSONObject("shipping");if(shipping!=null)info(first(shipping,"recipient")+" · "+mask(shipping.optString("phone"))+" · "+shipping.optString("address"));action("同步最新订单状态",()->memberWrite(path+"/refresh","POST",body(),()->order(id)));String state=r.optString("status");if(state.equals("pending"))action("取消订单",()->confirm("确认取消此订单？",()->memberWrite(path+"/cancel","POST",body(),()->order(id))));if(state.equals("shipped")&&r.optString("kind").equals("goods"))action("确认收货",()->confirm("请确认已经收到商品",()->memberWrite(path+"/received","POST",body(),()->order(id))));if(Commerce.refundable(state)){EditText reason=field(content,"退款原因",false);action("申请退款",()->{String message=reason.getText().toString().trim();if(message.isEmpty()||message.length()>300){info("请填写300字以内退款原因");return;}confirm("确认提交退款申请？结果以平台审核为准",()->memberWrite(path+"/refund","POST",body("reason",message),()->order(id)));});}});}
    private void memberWrite(String path,String method,JSONObject body,Runnable next){if(memberWriteBusy)return;memberWriteBusy=true;int version=generation;io.execute(()->{try{api.request(path,method,body,true);runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing()){page=next;next.run();}});}catch(Exception e){runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing())info(e.getMessage());});}});}
    private void profileEditor(){begin("个人资料");load("/member/profile","GET",null,true,v->{JSONObject r=object(v);info("手机号 "+mask(r.optString("phone"))+" · 资料与官网同步");String[] keys={"name","gender","birthday","country","province","city","address"},labels={"姓名","性别（男/女/其他，选填）","生日（YYYY-MM-DD，选填）","国家/地区","省份/地区","城市","详细地址"};EditText[] inputs=new EditText[keys.length];for(int i=0;i<keys.length;i++){inputs[i]=field(content,labels[i],false);inputs[i].setText(first(r,keys[i]));}action("保存个人资料",()->{JSONObject draft=body();for(int i=0;i<keys.length;i++){String value=inputs[i].getText().toString().trim();if(value.length()>300||(i==0&&(value.isEmpty()||value.length()>60))){info("请填写姓名，单项资料不能超过300字");return;}try{draft.put(keys[i],value);}catch(Exception ignored){}}String birthday=inputs[2].getText().toString().trim();if(!birthday.isEmpty()){try{java.time.LocalDate date=java.time.LocalDate.parse(birthday);if(date.isAfter(java.time.LocalDate.now()))throw new Exception();}catch(Exception e){info("请填写有效生日 YYYY-MM-DD");return;}}memberWrite("/member/profile","PUT",draft,this::account);});});}
    private void account(){begin("个人中心");if(!api.loggedIn()){hero("欢迎来到伊娃东方舞","登录后同步课程、比赛、证书与订单");action("手机号登录",()->open(this::login));}else{LinearLayout summary=column();content.addView(summary);load("/member/profile","GET",null,true,v->{JSONObject r=object(v);card(summary,first(r,"name"),mask(r.optString("phone"))+" · "+first(r,"level"),()->open(this::profileEditor));JSONObject stats=r.optJSONObject("stats");if(stats!=null)card(summary,"我的学习","线上课 "+stats.optInt("authorized_count")+" · 已学完 "+stats.optInt("completed_count")+" · 线下剩余 "+stats.optInt("offline_remaining_sessions")+" 课时",null);});section("学习与服务");action("个人资料",()->open(this::profileEditor));action("我的线上课程",()->open(this::myCourses));action("我的线下课时",()->open(this::schedule));action("我的比赛与成绩",()->open(()->records("赛事记录","/member/events","entries",null)));action("我的商城订单",()->open(this::orders));action("学习消息",()->open(()->messages(0)));action("我的证书",()->open(this::certificates));action("学习笔记",()->open(()->learningRecords(false)));action("学习书签",()->open(()->learningRecords(true)));action("成长档案",()->open(()->records("成长档案","/member/growth","",null)));section("账号与安全");action("登录设备",()->open(this::devices));action("注销账号",()->open(this::deletion));action("退出登录",()->confirm("退出当前账号？",()->{generation++;io.execute(()->{try{api.logout();}catch(Exception ignored){}runOnUiThread(()->{history.clear();page=this::account;account();});});}));}section("更多服务");action("东方舞圈与品牌服务",()->open(this::website));action("工作人员 · 赛事管理",()->open(this::staffHome));action("隐私政策",()->link("https://www.swod.com.cn/privacy"));action("服务条款",()->link("https://www.swod.com.cn/terms"));info("SWOD 1.0.0 (5)");}
    private void learningRecords(boolean bookmarks){begin(bookmarks?"学习书签":"学习笔记");String path=bookmarks?"/bookmarks":"/notes";load(path+"/all","GET",null,true,v->{JSONArray rows=array(v);for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,first(r,"course_name","video_name","series_name"),first(r,"content","label")+" · "+r.optInt("timestamp_seconds")+"秒",()->playAt(r.optInt("video_id"),first(r,"course_name","video_name"),r.optInt("timestamp_seconds")));action("删除此"+(bookmarks?"书签":"笔记"),()->confirm("确认删除此记录？",()->memberWrite(path+"/"+r.optInt("id"),"DELETE",body(),()->learningRecords(bookmarks))));}if(rows.length()==0)info("暂无记录");});}
    private void certificates(){begin("我的证书");load("/certificates","GET",null,true,v->{JSONArray rs=array(v);for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);card(content,r.optString("courseName"),r.optString("certificateNo")+" · "+r.optString("issueDate")+" · "+r.optString("status"),()->{String url=r.optString("verifyUrl");if(Policy.certificateURL(url))link(url);});String raw=r.optString("pdfUrl");String url=raw.startsWith("/")?"https://admin.swod.com.cn"+raw:raw;if("active".equals(r.optString("status"))&&Policy.certificateURL(url))action("查看电子证书",()->link(url));}if(rs.length()==0)info("暂无已颁发证书");});}
    private void messages(int cursor){begin("学习消息");load("/member/messages?limit=20&cursor="+cursor,"GET",null,true,v->{JSONObject o=object(v);JSONArray rs=array(o.opt("items"));for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);card(content,r.optString("title"),r.optString("content"),()->open(()->{begin(r.optString("title"));info(r.optString("content"));load("/member/messages/"+Uri.encode(r.optString("recipientId"))+"/read","PATCH",body(),true,ignored->{});}));}if(rs.length()==0)info("暂无消息");if(o.optBoolean("hasMore"))action("下一页",()->open(()->messages(o.optInt("nextCursor"))));action("全部标记已读",()->mutate("/member/messages/read-all","POST",body(),()->messages(0)));});}
    private void devices(){begin("登录设备");load("/devices","GET",null,true,v->{JSONArray rs=array(v);for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);card(content,r.optString("device_name"),r.optString("current")+" · "+r.optString("last_seen"),()->confirm("撤销此设备登录？",()->mutate("/devices/"+Uri.encode(r.optString("id")),"DELETE",body(),()->{if(r.optBoolean("current")){api.clear();account();}else devices();})));}});}
    private void deletion(){
        begin("注销账号");info("注销需要验证当前账号手机号，提交后由平台处理。处理进度以平台反馈为准。");
        load("/member/profile","GET",null,true,v->{String phone=object(v).optString("phone");info("当前账号："+mask(phone));EditText code=field(content,"六位短信验证码",true);
            action("获取验证码",()->sendSMS(phone));
            action("申请注销",()->{String sms=code.getText().toString().trim();if(!sms.matches("[0-9]{6}")){info("请填写六位验证码");return;}
                confirm("确认申请注销账号？提交后所有 App 登录设备将退出",()->memberWrite("/account-deletion-requests","POST",body("confirmation","注销账号","code",sms),()->{api.clear();history.clear();begin("申请已提交");info("注销申请已提交，等待平台处理。");action("返回个人中心",()->{page=this::account;account();});}));
            });
        });
    }
    private void sendSMS(String phone){
        if(smsBusy)return;
        if(!phone.matches("1[3-9][0-9]{9}")){info("请填写有效手机号");return;}
        long elapsed=android.os.SystemClock.elapsedRealtime();if(smsSentAt>0&&elapsed-smsSentAt<60000){info("验证码已发送，请稍后再试");return;}
        int version=generation;smsBusy=true;io.execute(()->{try{api.request("/send-code","POST",body("phone",phone),false);runOnUiThread(()->{smsBusy=false;smsSentAt=android.os.SystemClock.elapsedRealtime();if(version==generation)info("验证码已发送");});}catch(Exception e){runOnUiThread(()->{smsBusy=false;if(version==generation)info(e.getMessage());});}});
    }
    private void login(){
        begin("手机号登录");EditText phone=field(content,"手机号",true),code=field(content,"短信验证码",true);CheckBox consent=new CheckBox(this);consent.setText("我已阅读并同意隐私政策和服务条款");content.addView(consent);
        action("阅读隐私政策",()->link("https://www.swod.com.cn/privacy"));action("阅读服务条款",()->link("https://www.swod.com.cn/terms"));
        action("获取验证码",()->{if(!consent.isChecked()){info("请阅读并同意协议");return;}sendSMS(phone.getText().toString().trim());});
        action("登录",()->{if(authBusy)return;if(!consent.isChecked()){info("请阅读并同意协议");return;}String number=phone.getText().toString().trim(),sms=code.getText().toString().trim();if(!number.matches("1[3-9][0-9]{9}")||!sms.matches("[0-9]{6}")){info("请填写有效手机号和六位验证码");return;}int version=generation;authBusy=true;io.execute(()->{try{JSONObject response=object(api.request("/auth/login","POST",body("phone",number,"code",sms,"deviceName","伊娃东方舞 Android"),false));runOnUiThread(()->{authBusy=false;if(version!=generation||isFinishing())return;try{api.accept(response);history.clear();page=this::account;account();}catch(Exception e){info(e.getMessage());}});}catch(Exception e){runOnUiThread(()->{authBusy=false;if(version==generation&&!isFinishing())info(e.getMessage());});}});});
    }
    private void assistant(){begin("学习助手");info("根据已有课程制定练习安排");action("20 分钟：热身 4 · 技巧 12 · 复习 4",()->open(()->records("最近学习","/member/recent-courses","",r->play(r.optInt("video_id"),first(r,"course_name")))));action("30 分钟：热身 6 · 技巧 18 · 复习 6",()->open(()->records("最近学习","/member/recent-courses","",r->play(r.optInt("video_id"),first(r,"course_name")))));}
    private void records(String name,String path,String key,RowTap tap){begin(name);load(path,"GET",null,true,v->{Object items=key.isEmpty()?v:object(v).opt(key);JSONArray rs=array(items);if(rs.length()==0&&items instanceof JSONObject)rs=new JSONArray().put(items);displayRows(rs,new String[]{"series_name","course_name","competitionName","name","groupName","auditStatus","totalScore","content","label","status"},tap);if(rs.length()==0)info("暂无记录");});}
    private void displayRows(JSONArray rs,String[] fields,RowTap tap)throws Exception{for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);String summary="";for(String f:fields){String s=first(r,f);if(!s.isEmpty())summary+=s+" · ";}card(content,first(r,"name","title","courseName","series_name","course_name","playerName"),summary,tap==null?null:()->tap.tap(r));}}
    private void mutate(String path,String method,JSONObject body,Runnable next){load(path,method,body,true,v->{history.clear();page=next;next.run();});}
    private void link(String url){if(Policy.secureURL(url))try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){info("暂时无法打开链接");}}
    private static String strip(String html){return android.text.Html.fromHtml(html,android.text.Html.FROM_HTML_MODE_LEGACY).toString();}
    private static String mask(String phone){return phone.length()==11?phone.substring(0,3)+"****"+phone.substring(7):"";}
    @Override protected void onDestroy(){generation++;io.shutdownNow();imageIO.shutdownNow();super.onDestroy();}
    private void staffLoad(String path,String method,JSONObject body,Result result){
        if(staffToken==null){staffHome();return;}boolean writing=!method.equals("GET");if(writing&&staffBusy)return;
        int version=generation;String credential=staffToken;if(writing)staffBusy=true;ProgressBar busy=new ProgressBar(this);content.addView(busy);
        io.execute(()->{Object value=null;Exception failure=null;try{value=api.staffRequest(path,method,body,credential);}catch(Exception e){failure=e;}
            Object data=value;Exception error=failure;
            runOnUiThread(()->{if(writing)staffBusy=false;if(isFinishing()||version!=generation||!credential.equals(staffToken))return;content.removeView(busy);
                if(error!=null){info(error.getMessage());if(error instanceof Api.Failure&&((Api.Failure)error).status==401){staffToken=null;action("重新登录管理账号",()->open(this::staffHome));}else action("重试",()->staffLoad(path,method,body,result));return;}
                try{result.receive(data);}catch(Exception e){info("管理记录加载失败，请刷新");}});
        });
    }
    private void staffHome(){
        begin("赛事管理");if(staffToken==null){
            info("使用数字化平台工作人员账号，赛事管理员只能查看自己拥有的赛事。");
            EditText user=field(content,"工作人员账号",false),password=field(content,"密码",false);password.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);
            Button submit=button("登录管理账号",()->{if(staffBusy)return;if(user.getText().toString().trim().isEmpty()||password.getText().toString().isEmpty())return;
                String username=user.getText().toString().trim(),secret=password.getText().toString();int version=generation;staffBusy=true;password.setText("");
                io.execute(()->{try{JSONObject login=api.staffLogin(username,secret);runOnUiThread(()->{staffBusy=false;if(version!=generation||isFinishing())return;staffToken=login.optString("token");staffHome();});}catch(Exception e){runOnUiThread(()->{staffBusy=false;if(version==generation)info(e.getMessage());});}});
            });content.addView(submit);return;
        }
        action("退出赛事管理",()->{staffToken=null;history.clear();staffHome();});
        staffLoad("/event/competitions","GET",null,v->searchable(array(v),new String[]{"name","code","location"},r->open(()->staffCompetition(r))));
    }
    private void staffCompetition(JSONObject event){
        begin(event.optString("name"));int id=event.optInt("id");
        action("报名和音乐 · 节目汇总",()->open(()->staffEntries(id,0,false)));
        action("选手汇总 · 一人多项报名",()->open(()->staffEntries(id,0,true)));
        action("组别与出场顺序",()->open(()->staffGroups(id)));
        String[] labels={"开放报名","关闭报名","公开报名","隐藏报名","公开评委评分","隐藏评委评分"};
        String[] actions={"openRegistration","closeRegistration","showRegistration","hideRegistration","showJudgeScores","hideJudgeScores"};
        for(int i=0;i<labels.length;i++){String name=labels[i],operation=actions[i];action(name,()->confirm("确认"+name+"？",()->staffLoad("/event/competitions/"+id,"PATCH",body("action",operation),v->staffCompetition(event))));}
    }
    private void staffGroups(int id){
        begin("完整组别名称");staffLoad("/event/groups?competitionId="+id,"GET",null,v->searchable(array(v),new String[]{"name"},r->open(()->{
            begin(r.optString("name"));info(r.optInt("playerCount")+" 条报名 · ¥"+r.optDouble("registrationFee"));
            action("报名、音乐与出场顺序",()->open(()->staffEntries(id,r.optInt("id"),false)));
            action("随机安排本组出场顺序",()->confirm("重新编排本组有效报名的出场顺序？编号保持独立。",()->staffLoad("/event/players/batch","PATCH",body("competitionId",id,"groupId",r.optInt("id"),"action","randomize_sequence"),result->{info("已编排 "+object(result).optInt("updated")+" 条报名");})));
        })));
    }
    private void staffEntries(int id,int group,boolean contestants){
        begin(contestants?"选手汇总":"报名和音乐");
        staffLoad("/event/entry-summary?competitionId="+id,"GET",null,v->{
            JSONObject summary=object(v);JSONArray all=array(summary.opt("players")),people=array(summary.opt("contestants"));
            info("共 "+people.length()+" 名选手 · "+all.length()+" 个节目；编号在筛选前生成");
            JSONArray filtered=new JSONArray();JSONArray source=contestants?people:all;
            for(int i=0;i<source.length();i++){JSONObject r=source.getJSONObject(i);boolean has=group==0||r.optInt("groupId")==group;if(!has&&contestants){JSONArray entries=array(r.opt("entries"));for(int n=0;n<entries.length();n++)if(entries.getJSONObject(n).optInt("groupId")==group)has=true;}if(has)filtered.put(r);}
            searchable(filtered,new String[]{"name","groupName","phone","musicName","performanceTitle","contestantNumber","programNumber"},r->open(()->{
                if(!contestants){staffPlayer(r.optInt("id"));return;}
                begin(r.optString("contestantNumber")+" · "+r.optString("name"));info("报名费合计 ¥"+r.optDouble("totalRegistrationFee"));
                JSONArray entries=array(r.opt("entries"));for(int n=0;n<entries.length();n++){JSONObject entry=entries.optJSONObject(n);if(entry==null)continue;card(content,entry.optString("programNumber")+" · "+entry.optString("groupName"),entry.optString("performanceTitle"),()->open(()->staffPlayer(entry.optInt("id"))));}
            }));
        });
    }
    private void staffPlayer(int id){
        begin("报名详情");staffLoad("/event/players/"+id,"GET",null,v->{JSONObject r=object(v);
            displayRows(new JSONArray().put(r),new String[]{"name","phone","groupName","organization","teacher","performanceTitle","playerNo","sequenceNo","musicName","musicDuration","registrationFee","paidAmount","paidStatus"},null);
            action("修正报名资料",()->open(()->staffEditor(r)));
            action("缴费与退款流水",()->open(()->{begin("缴费流水");staffLoad("/event/players/"+id+"/payments","GET",null,rows->displayRows(array(rows),new String[]{"kind","amount","method","paid_at","remark"},null));}));
            action("登记实际缴费 / 退款",()->open(()->staffPayment(r)));
        });
    }
    private void staffEditor(JSONObject r){
        begin("报名修正");EditText name=field(content,"姓名",false),phone=field(content,"手机号",true),org=field(content,"机构",false),teacher=field(content,"指导老师",false),performance=field(content,"节目名称",false),remark=field(content,"备注",false);
        name.setText(r.optString("name"));phone.setText(r.optString("phone"));org.setText(r.optString("organization"));teacher.setText(r.optString("teacher"));performance.setText(r.optString("performanceTitle"));remark.setText(r.optString("remark"));
        info("缴费状态通过独立流水登记；编号由平台管理。");
        action("保存修正",()->confirm("确认保存本条报名资料？",()->staffLoad("/event/players/"+r.optInt("id"),"PUT",body("name",name.getText().toString(),"phone",phone.getText().toString(),"organization",org.getText().toString(),"teacher",teacher.getText().toString(),"performanceTitle",performance.getText().toString(),"remark",remark.getText().toString()),v->staffPlayer(r.optInt("id")))));
    }
    private void staffPayment(JSONObject r){
        begin("缴费登记");info(r.optString("name")+" · "+r.optString("groupName"));
        Spinner kind=new Spinner(this);kind.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"实际缴费","实际退款"}));content.addView(kind);
        EditText amount=field(content,"金额（元，最多两位小数）",false);amount.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);amount.setText(String.format(Locale.ROOT,"%.2f",r.optDouble("registrationFee")));
        Spinner method=new Spinner(this);method.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"微信","支付宝","银行卡","现金","其他"}));content.addView(method);
        EditText date=field(content,"实际缴费时间（ISO日期时间）",false),remark=field(content,"备注",false);date.setText(java.time.Instant.now().toString());String requestKey=java.util.UUID.randomUUID().toString();
        info("单条报名一次缴清；退款须全额退回。此处登记实际流水，款项须另行完成。");
        action("登记",()->{double value;try{value=Double.parseDouble(amount.getText().toString());}catch(Exception e){info("请填写有效金额");return;}
            confirm("确认已经实际完成这笔收款或退款，并登记 ¥"+amount.getText()+"？",()->staffLoad("/event/players/"+r.optInt("id")+"/payments","POST",body("kind",kind.getSelectedItemPosition()==0?"charge":"refund","amount",value,"method",new String[]{"wechat","alipay","bank","cash","other"}[method.getSelectedItemPosition()],"paidAt",date.getText().toString(),"remark",remark.getText().toString(),"requestKey",requestKey),v->staffPlayer(r.optInt("id"))));
        });
    }

}
