package cn.com.swod.app;

import android.app.Activity;
import android.app.AlertDialog;
import android.os.Bundle;
import android.content.Intent;
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
    private LinearLayout root, content, pageActions, chromeBar;
    private TextView title;
    private TextView loginFeedback;
    private Button backButton;
    private ScrollView pageScroll;
    private final Button[] tabButtons = new Button[5];
    private boolean memberWriteBusy;
    private boolean authBusy, smsBusy;
    private final java.util.Map<String,Long> smsSentTimes = new java.util.HashMap<>();
    private Runnable page;
    private volatile int generation;
    private String staffToken;
    private boolean staffBusy;
    private byte[] musicBytes;
    private String musicFilename = "";
    private TextView musicLabel;
    private int musicPickerGeneration;
    private boolean registrationBusy;
    private int red;
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if(!PrivacyConsent.accepted(this)){PrivacyConsent.welcome(this,this::initializeApp);return;}
        initializeApp();
    }
    private void initializeApp(){
        api = Api.get(this); red = SwodUi.primary(this);
        root = column(); root.setBackgroundColor(SwodUi.canvas(this));
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) { android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.ime() | WindowInsets.Type.displayCutout()); root.setPadding(safe.left,safe.top,safe.right,safe.bottom); }
            else root.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
        });
        LinearLayout bar = row(); chromeBar=bar;bar.setPadding(dp(8),0,dp(8),0);bar.setBackgroundColor(SwodUi.surface(this));
        backButton = button("", () -> back());backButton.setPadding(dp(12),dp(12),dp(12),dp(12));backButton.setCompoundDrawablesWithIntrinsicBounds(SwodUi.icon(this,"back",red),null,null,null);backButton.setContentDescription("返回上一页"); bar.addView(backButton,new LinearLayout.LayoutParams(dp(48),dp(48)));
        title = text("线上学院",20);title.setTypeface(null,android.graphics.Typeface.BOLD); title.setGravity(Gravity.CENTER_VERTICAL); bar.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));
        pageActions=row();bar.addView(pageActions);
        Button refresh = button("", () -> { if (page != null) page.run(); });refresh.setPadding(dp(12),dp(12),dp(12),dp(12));refresh.setCompoundDrawablesWithIntrinsicBounds(SwodUi.icon(this,"refresh",red),null,null,null);refresh.setContentDescription("刷新当前页面");bar.addView(refresh,new LinearLayout.LayoutParams(dp(48),dp(48))); root.addView(bar);
        pageScroll = new ScrollView(this);pageScroll.setFillViewport(true); content = column();int inset=Math.max(16,(getResources().getConfiguration().screenWidthDp-760)/2);content.setPadding(dp(inset),dp(4),dp(inset),dp(16));pageScroll.addView(content);
        LinearLayout tabs = row(); String[] names={"线上学院","线下课","赛事","商城","个人中心"};
        boolean expanded=getResources().getConfiguration().screenWidthDp>=600;if(expanded){tabs.setOrientation(LinearLayout.VERTICAL);tabs.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);}
        String[] icons={"learn","calendar","trophy","bag","person"};
        Runnable[] pages={this::courses,this::offline,this::events,this::shop,this::account};
        for(int i=0;i<names.length;i++) { final Runnable p=pages[i]; final int index=i; Button b=button(names[i],()->{history.clear();selectTab(index);page=p;p.run();}); b.setTextSize(12);b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],red),null,null);b.setCompoundDrawablePadding(dp(6));b.setGravity(Gravity.CENTER);b.setPadding(dp(2),dp(expanded?6:10),dp(2),dp(expanded?6:8));tabButtons[i]=b; tabs.addView(b,expanded?new LinearLayout.LayoutParams(-1,dp(64)):new LinearLayout.LayoutParams(0,dp(68),1)); }
        tabs.setPadding(dp(6),dp(4),dp(6),dp(4));tabs.setBackgroundColor(SwodUi.surface(this));
        if(expanded){LinearLayout body=row();body.setGravity(Gravity.TOP);ScrollView rail=new ScrollView(this);rail.setVerticalScrollBarEnabled(false);rail.addView(tabs,new ScrollView.LayoutParams(-1,-2));body.addView(rail,new LinearLayout.LayoutParams(dp(104),-1));body.addView(pageScroll,new LinearLayout.LayoutParams(0,-1,1));root.addView(body,new LinearLayout.LayoutParams(-1,0,1));}
        else{root.addView(pageScroll,new LinearLayout.LayoutParams(-1,0,1));root.addView(tabs);}
        selectTab(0); setContentView(root);if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{if(history.isEmpty())finish();else back();}); page=this::courses; courses();
    }
    // API 33+ registers OnBackInvokedDispatcher in onCreate; this override serves API 26-32.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { if(history.isEmpty()) super.onBackPressed(); else back(); }
    private void back() { if(!history.isEmpty()) {page=history.pop();page.run();} }
    private void open(Runnable next) { if(page!=null) history.push(page); page=next; next.run(); }
    private void selectTab(int selected){String[] icons={"learn","calendar","trophy","bag","person"};for(int i=0;i<tabButtons.length;i++){Button b=tabButtons[i];if(b!=null){boolean active=i==selected;b.setSelected(active);b.setTextColor(active?red:SwodUi.muted(this));b.setTypeface(null,active?android.graphics.Typeface.BOLD:android.graphics.Typeface.NORMAL);b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],active?red:SwodUi.muted(this)),null,null);b.setBackground(SwodUi.touch(this,active?SwodUi.tonal(this):SwodUi.surface(this),14));}}}
    private void hero(String name,String description){LinearLayout box=column();box.setPadding(dp(4),dp(6),dp(4),dp(12));TextView heading=text(name,22);heading.setTypeface(null,android.graphics.Typeface.BOLD);box.addView(heading);TextView summary=text(description,14);summary.setTextColor(SwodUi.muted(this));box.addView(summary);content.addView(box);}
    private void section(String name){TextView label=text(name,18);label.setTypeface(null,android.graphics.Typeface.BOLD);label.setPadding(dp(4),dp(16),dp(4),dp(8));content.addView(label);}
    private void begin(String name) { if(pageActions!=null)pageActions.removeAllViews();loginFeedback=null;courseAccessVisible=false; generation++; content.removeAllViews(); title.setText("");title.setContentDescription(name);chromeBar.setVisibility(history.isEmpty()?View.GONE:View.VISIBLE);backButton.setVisibility(history.isEmpty()?View.GONE:View.VISIBLE);pageScroll.scrollTo(0,0); }
    private int dp(int x) {return Math.round(x*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    private TextView text(String s,int size){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(SwodUi.ink(this));v.setPadding(dp(4),dp(5),dp(4),dp(5));return v;}
    private Button button(String s,Runnable tap){Button b=new Button(this);b.setText(s);b.setTextSize(15);b.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{SwodUi.muted(this),red}));b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setAllCaps(false);b.setStateListAnimator(null);b.setElevation(0);b.setPadding(dp(16),dp(10),dp(16),dp(10));b.setBackground(SwodUi.touch(this,SwodUi.surface(this),14));b.setOnClickListener(v->tap.run());return b;}
    private void action(String s,Runnable tap){LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,-2);layout.topMargin=dp(8);Button b=button(s,tap);b.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);b.setCompoundDrawablesWithIntrinsicBounds(null,null,SwodUi.icon(this,"next",SwodUi.muted(this)),null);content.addView(b,layout);}
    private void info(String s){if(loginFeedback!=null){loginFeedback.setText(s);loginFeedback.setVisibility(View.VISIBLE);return;}content.addView(text(s,14));}
    private EditText field(LinearLayout box,String hint, boolean digits){EditText v=new EditText(this);v.setHint(hint);v.setContentDescription(hint);v.setTextSize(16);v.setTextColor(SwodUi.ink(this));v.setHintTextColor(SwodUi.muted(this));v.setPadding(dp(16),dp(12),dp(16),dp(12));v.setBackground(SwodUi.shape(this,SwodUi.surface(this),12));v.setSingleLine(true);if(digits)v.setInputType(android.text.InputType.TYPE_CLASS_PHONE);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(8);v.setMinimumHeight(dp(48));box.addView(v,p);return v;}
    private interface Result{void receive(Object value)throws Exception;}
    private void load(String path,String method,JSONObject body,boolean auth,Result result){
        if(path.matches("/public/series(?:/\\d+/detail)?")||path.equals("/member/authorized-series"))courseAccessVisible=true;
        if(auth&&!api.loggedIn()){info("登录后查看个人学习和服务记录");action("手机号登录",()->open(this::login));return;}
        int version=generation; ProgressBar busy=new ProgressBar(this);content.addView(busy);
        io.execute(()->{Object value=null;Exception failure=null;try{value=withCourseAccess(path,api.request(path,method,body,auth));}catch(Exception e){failure=e;}
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
    private void card(LinearLayout box,String name,String summary,Runnable tap){LinearLayout item=column();item.setPadding(dp(12),dp(10),dp(12),dp(10));item.setBackground(SwodUi.touch(this,SwodUi.surface(this),16));TextView heading=text(name,17);heading.setTypeface(null,android.graphics.Typeface.BOLD);item.addView(heading);if(!summary.trim().isEmpty()){TextView detail=text(summary,14);detail.setTextColor(SwodUi.muted(this));item.addView(detail);}LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(12);box.addView(item,p);if(tap!=null){item.setContentDescription(name+"，"+summary+"，查看详情");item.setMinimumHeight(dp(64));item.setFocusable(true);item.setOnClickListener(v->tap.run());}}
    private boolean courseAccessVisible,needsCourseRefresh;
    @Override protected void onPause(){needsCourseRefresh=true;super.onPause();}
    private String pendingCourseOrder="";
    private int pendingCourseId=0;
    @Override protected void onResume(){super.onResume();boolean refresh=needsCourseRefresh;needsCourseRefresh=false;if(refresh&&courseAccessVisible&&page!=null)page.run();if(api==null||pendingCourseOrder.isEmpty()||!api.loggedIn())return;String id=pendingCourseOrder;int courseId=pendingCourseId,version=generation;io.execute(()->{try{JSONObject result=object(api.request("/shop/orders/"+Uri.encode(id)+"/refresh","POST",body(),true));String state=object(result.opt("order")).optString("status");runOnUiThread(()->{if(version==generation&&!isFinishing()&&(state.equals("paid")||state.equals("completed"))){pendingCourseOrder="";open(()->schedule(courseId));}});}catch(Exception ignored){}});}
    private final java.util.Map<Integer,Integer> catalogSelection=new java.util.HashMap<>();
    private Object withCourseAccess(String path,Object value)throws Exception {
        if(!path.matches("/public/series(?:/\\d+/detail)?"))return value;
        long account=api.accountGeneration();boolean loggedIn=api.loggedIn();java.util.Set<Integer> ids=new java.util.HashSet<>();boolean known=true;
        if(loggedIn)try{
            Object response=api.request("/member/authorized-series","GET",null,true);
            if(!(response instanceof JSONArray))throw new Exception("Invalid entitlement response");
            JSONArray rights=(JSONArray)response;
            for(int n=0;n<rights.length();n++)ids.add(CourseAccessPolicy.canonicalId(rights.getJSONObject(n).opt("series_id")));
        }catch(Exception error){known=false;ids.clear();}
        if(account!=api.accountGeneration())throw new Api.Failure(401,"账号已切换，请刷新课程");
        JSONArray rows=value instanceof JSONArray?(JSONArray)value:new JSONArray().put(value);
        for(int n=0;n<rows.length();n++){
            JSONObject row=rows.getJSONObject(n);int seriesId=CourseAccessPolicy.canonicalId(row.opt("id"));
            CourseAccessPolicy.State state=CourseAccessPolicy.evaluate(loggedIn,known,seriesId,ids);
            row.put("course_access_scope","online");row.put("course_access_known",state!=CourseAccessPolicy.State.UNKNOWN);row.put("learning_unlocked",state==CourseAccessPolicy.State.UNLOCKED);
        }
        return value;
    }
    private void unlockedBadge(LinearLayout box,int size){TextView badge=text("✓ 已解锁",size);badge.setTextColor(SwodUi.dark(this)?android.graphics.Color.rgb(74,222,128):android.graphics.Color.rgb(21,128,61));box.addView(badge);}
    private void retryCourseAccess(){action("重新查询学习权益",()->{if(page!=null)page.run();});}
    private String coursePrice(JSONObject row){if("online".equals(row.optString("course_access_scope"))&&row.optBoolean("learning_unlocked"))return "继续学习";if("online".equals(row.optString("course_access_scope"))&&!row.optBoolean("course_access_known",true))return "学习权益暂无法确认，请重试";String result=CoursePolicy.price(row.optDouble("price",0),row.optDouble("promo_price",0),!row.has("period_status")&&(row.optBoolean("is_free")||row.optInt("is_free")==1));if(CoursePolicy.discount(row.optDouble("price",0),row.optDouble("promo_price",0),row.optBoolean("is_free")||row.optInt("is_free")==1))result+=" · 原价 ¥"+String.format(Locale.ROOT,"%.2f",row.optDouble("price"));return result;}
    private String publicSummary(JSONObject r){String detail="online".equals(r.optString("course_access_scope"))?first(r,"teacher","category"):first(r,"subtitle","teacher","groupName","category","venue","location");if(r.has("total_courses"))detail+=" · "+r.optInt("total_courses")+" 节课程";if(r.has("price"))detail+="\n"+coursePrice(r);if(r.has("start_date")&&!r.has("registrationStatus"))detail+=" · "+first(r,"start_date")+" · 期次课时";return detail;}
    private interface RowTap{void tap(JSONObject row);}
    private void searchable(JSONArray rows,String[] fields,RowTap tap){
        EditText search=field(content,java.util.Arrays.asList(fields).contains("category")?"搜索课程、老师或分类":"搜索名称、老师或组别",false); if(history.isEmpty()){content.removeView(search);content.addView(search,0);} LinearLayout results=column();content.addView(results);
        Runnable render=()->{results.removeAllViews();String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);int count=0;
            for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r==null)continue;String all="";for(String f:fields)all+=r.optString(f)+" ";boolean match=true;for(String part:query.split("\\s+"))if(!all.toLowerCase(Locale.ROOT).contains(part))match=false;
                if(match){count++;int before=results.getChildCount();card(results,first(r,"name","series_name","course_name","competitionName"),publicSummary(r),()->tap.tap(r));if("online".equals(r.optString("course_access_scope"))&&r.optBoolean("learning_unlocked"))unlockedBadge((LinearLayout)results.getChildAt(before),14);String cover=first(r,"cover_image","image");if(!cover.isEmpty())cover((LinearLayout)results.getChildAt(before),cover,false);}}
            if(count==0)results.addView(text("暂无匹配记录",14));};
        search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});render.run();
    }
    private void cover(LinearLayout box,String source,boolean goods){
        String url=source.startsWith("/")?(goods?"https://www.swod.com.cn":"https://admin.swod.com.cn")+source:source;
        boolean validCover=Policy.secureURL(url);if(!validCover&&goods)return;
        ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER);image.setImageDrawable(SwodUi.icon(this,goods?"bag":"learn",red));image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);image.setBackground(SwodUi.shape(this,SwodUi.tonal(this),12));image.setClipToOutline(true);
        if(!goods&&box!=content){LinearLayout details=column();while(box.getChildCount()>0){View child=box.getChildAt(0);box.removeViewAt(0);details.addView(child);}box.setOrientation(LinearLayout.HORIZONTAL);box.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams picture=new LinearLayout.LayoutParams(dp(112),dp(84));picture.rightMargin=dp(12);box.addView(image,picture);
            details.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int height=Math.min(dp(160),Math.max(dp(84),b-t));if(image.getLayoutParams().height!=height){android.view.ViewGroup.LayoutParams params=image.getLayoutParams();params.height=height;image.setLayoutParams(params);}});box.addView(details,new LinearLayout.LayoutParams(0,-2,1));}
        else{LinearLayout.LayoutParams picture=new LinearLayout.LayoutParams(-1,dp(goods?220:Math.min(240,(getResources().getConfiguration().screenWidthDp-32)*3/4)));picture.bottomMargin=dp(12);box.addView(image,0,picture);}
        if(!validCover)return;int version=generation;imageIO.execute(()->{if(version!=generation)return;try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(!isFinishing()&&version==generation&&bitmap!=null){image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImageBitmap(bitmap);}});}catch(Exception ignored){/* Keep a stable, non-deceptive cover placeholder. */}});
    }
    private void learningShortcuts(){LinearLayout shortcuts=row();String[] labels={"我的课程","课时与核销","报名与成绩"};String[] icons={"learn","calendar","trophy"};Runnable[] targets={()->open(this::myCourses),()->open(this::schedule),()->open(this::myEvents)};for(int i=0;i<labels.length;i++){Button b=button(labels[i],targets[i]);b.setTextSize(14);b.setGravity(Gravity.CENTER);b.setPadding(dp(4),dp(12),dp(4),dp(12));b.setMinimumHeight(dp(64));b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],red),null,null);b.setCompoundDrawablePadding(dp(8));b.setBackground(SwodUi.touch(this,SwodUi.surface(this),14));LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(0,-2,1);if(i<2)p.rightMargin=dp(10);shortcuts.addView(b,p);}content.addView(shortcuts);}
    private void courses(){begin("线上学院");hero("伊娃东方舞","线上学院 · 从基础到进阶，找到适合你的课程");learningShortcuts();section("课程列表");load("/public/series","GET",null,false,v->{JSONArray rows=array(v);if(rows.length()>0&&!rows.getJSONObject(0).optBoolean("course_access_known",true))retryCourseAccess();searchable(rows,new String[]{"name","teacher","category"},r->open(()->{if(r.optBoolean("learning_unlocked"))catalog(r.optInt("id"),r.optString("name"));else course(r);}));action("东方舞圈 · 官网资讯",()->open(this::website));});}
    private void myCourses(){begin("我的课程");load("/member/authorized-series","GET",null,true,v->{if(!(v instanceof JSONArray))throw new Exception();JSONArray rows=(JSONArray)v;for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);int id=CourseAccessPolicy.canonicalId(r.opt("series_id"));int before=content.getChildCount();Runnable learn=()->open(()->catalog(id,first(r,"series_name","name")));card(content,first(r,"series_name","name"),"",learn);LinearLayout box=(LinearLayout)content.getChildAt(before);unlockedBadge(box,14);box.addView(button("继续学习",learn));}if(rows.length()==0)info("暂无已解锁课程");});}
    private void course(JSONObject r){begin(first(r,"name"));load("/public/series/"+r.optInt("id")+"/detail","GET",null,false,v->{JSONObject detail=object(v);hero(first(detail,"name"),first(detail,"subtitle","teacher"));cover(content,first(detail,"cover_image"),false);info(strip(first(detail,"rich_description","description")));info("共 "+detail.optInt("total_courses")+" 节课程");if(detail.optBoolean("learning_unlocked"))unlockedBadge(content,16);else if(!detail.optBoolean("course_access_known",true))retryCourseAccess();else{info(coursePrice(detail));int seriesId=detail.optInt("id");if(seriesId>0)action("立即购买 · 前往官方支付",()->link("https://www.swod.com.cn/checkout/online/"+seriesId));}action(detail.optBoolean("learning_unlocked")?"继续学习":"查看课程目录",()->open(()->catalog(detail.optInt("id"),detail.optString("name"))));action("客服与售后",()->open(this::support));});}
    private void support(){begin("客服与售后");hero("课程与订单客服","购买、学习权限及售后问题可直接联系课程顾问");info("海艳老师：153 6787 0529");info("伊琳老师：193 1002 9982");action("拨打海艳老师电话",()->dial("15367870529"));action("拨打伊琳老师电话",()->dial("19310029982"));action("查看微信客服二维码",()->link("https://www.swod.com.cn/contact"));}
    private void dial(String phone){try{startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+phone)));}catch(Exception error){info("暂时无法打开拨号，请记录页面上的号码");}}
    private void website(){begin("东方舞圈与品牌服务");hero("东方舞圈","官网资讯、教学体系与品牌服务");String[] labels={"东方舞圈资讯","关于伊娃","品牌故事","传承弟子","出版著作","证书查询","联系与合作"};String[] paths={"/dance-circle","/about","/about/brand-story","/disciples","/about/publications","/certification","/contact"};for(int i=0;i<labels.length;i++){String url="https://www.swod.com.cn"+paths[i];action(labels[i],()->link(url));}}
    private void catalog(int id,String name){
        begin(name);load("/public/series/"+id+"/courses","GET",null,false,v->{
            JSONArray units=array(v);java.util.List<JSONObject> lessons=new java.util.ArrayList<>();
            for(int i=0;i<units.length();i++){JSONObject unit=units.getJSONObject(i);JSONArray videos=array(unit.opt("videos"));for(int j=0;j<videos.length();j++){JSONObject video=videos.getJSONObject(j);lessons.add(body("id",video.optInt("id"),"name",first(video,"name").isEmpty()?unit.optString("name"):video.optString("name"),"subtitle",unit.optString("name"),"ordinal",lessons.size()+1,"duration",video.optDouble("duration",0)));}}
            final int[] pageNumber={1};final boolean[] synced={false};final java.util.Map<Integer,JSONObject> progress=new java.util.HashMap<>();
            EditText search=field(content,"搜索课节名称",false);LinearLayout results=column();content.addView(results);final Runnable[] render={null};
            render[0]=()->{results.removeAllViews();String keyword=search.getText().toString().trim().toLowerCase(Locale.ROOT);java.util.List<JSONObject> filtered=new java.util.ArrayList<>();for(JSONObject lesson:lessons)if((lesson.optString("name")+" "+lesson.optString("subtitle")).toLowerCase(Locale.ROOT).contains(keyword))filtered.add(lesson);
                int pages=Math.max(1,(filtered.size()+49)/50);pageNumber[0]=Math.max(1,Math.min(pages,pageNumber[0]));TextView heading=text("课节目录 · 共 "+lessons.size()+" 节",18);heading.setTypeface(null,android.graphics.Typeface.BOLD);results.addView(heading);
                if(catalogSelection.containsKey(id))results.addView(button("定位当前",()->{search.setText("");int selected=catalogSelection.get(id);for(int i=0;i<lessons.size();i++)if(lessons.get(i).optInt("id")==selected)pageNumber[0]=i/50+1;render[0].run();pageScroll.smoothScrollTo(0,0);}));
                if(pages>1){LinearLayout nav=row();Button prev=button("上一页",()->{pageNumber[0]--;render[0].run();pageScroll.smoothScrollTo(0,0);});prev.setEnabled(pageNumber[0]>1);nav.addView(prev,new LinearLayout.LayoutParams(0,-2,1));nav.addView(text("第 "+pageNumber[0]+" / "+pages+" 页",14));Button next=button("下一页",()->{pageNumber[0]++;render[0].run();pageScroll.smoothScrollTo(0,0);});next.setEnabled(pageNumber[0]<pages);nav.addView(next,new LinearLayout.LayoutParams(0,-2,1));results.addView(nav);}
                for(int i=(pageNumber[0]-1)*50;i<Math.min(filtered.size(),pageNumber[0]*50);i++){JSONObject lesson=filtered.get(i);int videoId=lesson.optInt("id");JSONObject record=progress.get(videoId);int percent=record==null?0:CoursePolicy.percent(record.optDouble("progress",0),record.optDouble("duration",lesson.optDouble("duration",0)),record.optInt("completed")==1);boolean current=catalogSelection.getOrDefault(id,0)==videoId;int duration=(int)lesson.optDouble("duration",0);String state=record==null&&!synced[0]?"进度待同步":percent>=100?"已学完":percent>0?"已学 "+percent+"%":"未开始";int before=results.getChildCount();card(results,lesson.optInt("ordinal")+"  "+lesson.optString("name"),(duration>0?String.format(Locale.ROOT,"%d:%02d",duration/60,duration%60):"时长待更新")+" · "+state+(current?" · 当前课节":""),()->{catalogSelection.put(id,videoId);render[0].run();playPlaylist(videoId,lesson.optString("name"),lessons,id,name,progress,synced[0]);});if(current)results.getChildAt(before).setBackground(SwodUi.shape(this,SwodUi.tonal(this),16));}
                if(filtered.isEmpty())results.addView(text(keyword.isEmpty()?"暂无课节":"未找到匹配课节",14));
            };
            search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence x,int a,int c,int f){}public void onTextChanged(CharSequence x,int a,int b,int c){pageNumber[0]=1;render[0].run();}public void afterTextChanged(Editable x){}});render[0].run();
            if(api.loggedIn()){int version=generation;io.execute(()->{try{JSONArray records=array(api.request("/public/series/"+id+"/progress","GET",null,true));runOnUiThread(()->{if(version!=generation||isFinishing())return;for(int i=0;i<records.length();i++){JSONObject record=records.optJSONObject(i);if(record!=null)progress.put(record.optInt("video_id"),record);}synced[0]=true;render[0].run();});}catch(Exception ignored){}});}
        });
    }
    private void playPlaylist(int id,String name,java.util.List<JSONObject> lessons,int seriesId,String seriesTitle,java.util.Map<Integer,JSONObject> progress,boolean synced){
        if(!api.loggedIn()){open(this::login);return;}
        int[] ids=new int[lessons.size()];String[] names=new String[lessons.size()];
        JSONArray metadata=new JSONArray();
        for(int i=0;i<lessons.size();i++){JSONObject source=lessons.get(i);ids[i]=source.optInt("id");names[i]=source.optString("name");JSONObject record=progress.get(ids[i]);JSONObject row=body("id",ids[i],"duration",source.optDouble("duration"),"subtitle",source.optString("subtitle"));if(record!=null){try{row.put("percent",CoursePolicy.percent(record.optDouble("progress"),record.optDouble("duration",source.optDouble("duration")),record.optInt("completed")==1));}catch(org.json.JSONException ignored){}}metadata.put(row);}
        startActivity(new Intent(this,PlayerActivity.class).putExtra("lesson",id).putExtra("title",name).putExtra("playlistIds",ids).putExtra("playlistNames",names).putExtra("playlistMetadata",metadata.toString()).putExtra("seriesId",seriesId).putExtra("seriesTitle",seriesTitle));
    }
    private void play(int id,String name){playAt(id,name,-1);}
    private void playAt(int id,String name,int seconds){if(id<=0){info("课节信息无效，请刷新后重试");return;}if(!api.loggedIn()){open(this::login);return;}Intent intent=new Intent(this,PlayerActivity.class).putExtra("lesson",id).putExtra("title",name);if(seconds>=0)intent.putExtra("positionSeconds",seconds);startActivity(intent);}
    private void offline(){begin("线下课程");hero("线下课","购买课程期次的课时，到课后核销扣减，无需预约。");action("期次课时与核销",()->open(this::schedule));load("/public/offline-courses","GET",null,false,v->{JSONArray all=array(v),groups=new JSONArray();java.util.Set<String> seen=new java.util.HashSet<>();for(int i=0;i<all.length();i++){JSONObject period=all.getJSONObject(i);if(seen.add(first(period,"group_key","name")))groups.put(period);}searchable(groups,new String[]{"name","teacher","location"},r->open(()->offlineDetail(r,all)));});}
    private void offlineDetail(JSONObject course,JSONArray all){begin(first(course,"name"));CourseContent copy=new CourseContent(this);hero(first(course,"name"),first(course,"teacher"));cover(content,first(course,"cover_image"),false);section("课程介绍");info(copy.description(course));JSONObject intro=copy.intro(course);JSONArray outline=array(intro.opt("outline"));if(outline.length()==0)outline=array(course.opt("outline"));if(outline.length()>0)section("课程大纲");for(int i=0;i<outline.length();i++)info((i+1)+". "+outline.optString(i));section("课程期次");for(int i=0;i<all.length();i++){JSONObject period=all.optJSONObject(i);if(period==null||!first(period,"group_key","name").equals(first(course,"group_key","name")))continue;card(content,first(period,"subtitle","start_date"),first(period,"start_date")+" — "+first(period,"end_date")+"\n"+first(period,"location")+" · "+period.optInt("total_courses")+" 课时 · "+coursePrice(period)+"\n已报名 "+period.optInt("total_students")+" 人（匿名）",null);if(CourseContent.canBuy(period))action("购买本期课时",()->open(()->courseCheckout(period.optInt("source_id"))));else info("本期暂不可购买，请查看期次安排或咨询课程顾问");action("查看本期课时",()->open(()->schedule(period.optInt("source_id"))));}}
    private void courseCheckout(int courseId){begin("确认课程订单");load("/shop/courses/offline/"+courseId,"GET",null,true,v->{JSONObject quote=object(v),offer=object(quote.opt("offer")),payment=object(quote.opt("payment"));hero(offer.optString("name"),offer.optString("period"));info("购买课时："+offer.optInt("sessions")+" 课时 · ¥"+Commerce.money(offer.optLong("priceFen")));info("付款后自动开通本期课时，到课后核销扣减，无需预约。");String key=java.util.UUID.randomUUID().toString();for(String provider:new String[]{"alipay","wechat"})if(payment.optBoolean(provider)){String channel=provider;action(provider.equals("alipay")?"支付宝支付":"微信支付",()->{if(memberWriteBusy)return;memberWriteBusy=true;int version=generation;io.execute(()->{try{JSONObject created=object(api.request("/shop/orders","POST",body("kind","offline","targetId",courseId,"provider",channel,"expectedTotalFen",offer.optLong("priceFen"),"requestKey",key+channel),true));String orderId=object(created.opt("order")).optString("id");JSONObject pay=object(api.request("/shop/orders/"+Uri.encode(orderId)+"/pay","POST",body(),true));runOnUiThread(()->{memberWriteBusy=false;if(version!=generation||isFinishing())return;if("redirect".equals(pay.optString("kind"))&&CoursePolicy.paymentURL(pay.optString("url"))){pendingCourseOrder=orderId;pendingCourseId=courseId;link(pay.optString("url"));}else info("当前支付通道暂不可用");action("同步付款结果并查看课时",()->load("/shop/orders/"+Uri.encode(orderId)+"/refresh","POST",body(),true,result->{String state=object(object(result).opt("order")).optString("status");if(state.equals("paid")||state.equals("completed"))open(()->schedule(courseId));else info("支付结果待确认，可在我的订单继续付款");}));action("查看订单",()->open(()->order(orderId)));});}catch(Exception error){runOnUiThread(()->{memberWriteBusy=false;if(version==generation)info(error.getMessage());});}});});}if(!payment.optBoolean("alipay")&&!payment.optBoolean("wechat"))info("App 支付暂未开放");action("我的订单／继续处理",()->open(this::orders));});}
    private void schedule(){schedule(0);}
    private void schedule(int courseId){begin("期次课时与核销");load("/offline/overview"+(courseId>0?"?course_ids="+courseId:""),"GET",null,true,v->{JSONObject o=object(v);info("购买课程期次的课时，到课后核销扣减，无需预约。");JSONArray es=array(o.opt("entitlements"));for(int i=0;i<es.length();i++){JSONObject r=es.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("course_period")+" · 剩余 "+r.optInt("available_sessions")+" 课时 · 已核销 "+r.optInt("used_sessions")+" 课时");}info("核销记录");JSONArray records=array(o.opt("consumes"));for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("consume_date")+" · 核销 "+r.optInt("count")+" 课时");}});}
    private void booking(JSONObject r){open(this::schedule);}
    private TextView eventMetric(String value,String label,boolean hero){
        TextView cell=text(value+"\n"+label,hero?16:12);cell.setGravity(Gravity.CENTER);cell.setTextColor(hero?(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE):red);cell.setTypeface(null,android.graphics.Typeface.BOLD);return cell;
    }
    private void events(){
        begin("赛事");
        LinearLayout overview=column();overview.setPadding(dp(16),dp(12),dp(16),dp(12));overview.setBackground(SwodUi.shape(this,red,16));
        TextView chip=text("东方舞赛事平台",12);chip.setTextColor(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE);overview.addView(chip);
        TextView heading=text("AiwaRaks赛事平台",22);heading.setTypeface(null,android.graphics.Typeface.BOLD);heading.setTextColor(chip.getCurrentTextColor());overview.addView(heading);
        LinearLayout totals=row();TextView total=eventMetric("—","赛事总数",true),people=eventMetric("—","累计参赛",true),records=eventMetric("—","记录数据",true);
        totals.addView(total,new LinearLayout.LayoutParams(0,-2,1));totals.addView(people,new LinearLayout.LayoutParams(0,-2,1));totals.addView(records,new LinearLayout.LayoutParams(0,-2,1));overview.addView(totals);
        content.addView(overview);
        LinearLayout eventActions=row();Button mine=button("",()->open(this::myEvents));mine.setCompoundDrawablesWithIntrinsicBounds(SwodUi.icon(this,"person",red),null,null,null);mine.setContentDescription("我的比赛");eventActions.addView(mine,new LinearLayout.LayoutParams(dp(48),dp(48)));
        Button manage=button("",()->open(this::staffHome));manage.setCompoundDrawablesWithIntrinsicBounds(SwodUi.icon(this,"trophy",red),null,null,null);manage.setContentDescription("赛事管理");eventActions.addView(manage,new LinearLayout.LayoutParams(dp(48),dp(48)));

        EditText search=field(content,"搜索赛事或地点",false);content.removeView(search);
        LinearLayout searchRow=row();searchRow.addView(search,new LinearLayout.LayoutParams(0,-2,1));searchRow.addView(eventActions);content.addView(searchRow,0);
        LinearLayout grid=column();content.addView(grid);
        load("/events","GET",null,false,v->{
            JSONArray rows=array(v);total.setText(rows.length()+"\n赛事总数");people.setText(EventPresentation.aggregate(rows,true)+"\n累计参赛");records.setText(EventPresentation.aggregate(rows,false)+"\n记录数据");
            Runnable render=()->{
                grid.removeAllViews();LinearLayout line=null;int matches=0;
                boolean single=getResources().getConfiguration().fontScale>1.4f;
                String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);
                for(int i=0;i<rows.length();i++){
                    JSONObject event=rows.optJSONObject(i);if(event==null)continue;
                    String location=EventPresentation.value(event,"location","city","venue");
                    if(!(event.optString("name")+" "+location).toLowerCase(Locale.ROOT).contains(query))continue;
                    if(single||matches%2==0){line=row();line.setGravity(Gravity.TOP);LinearLayout.LayoutParams rowLayout=new LinearLayout.LayoutParams(-1,-2);rowLayout.bottomMargin=dp(12);grid.addView(line,rowLayout);}
                    LinearLayout card=column();card.setBackground(SwodUi.shape(this,SwodUi.surface(this),14));card.setClipToOutline(true);
                    LinearLayout.LayoutParams cardLayout=new LinearLayout.LayoutParams(single?-1:0,-2,single?0:1);if(!single&&matches%2==0)cardLayout.rightMargin=dp(10);line.addView(card,cardLayout);
                    String state=EventPresentation.state(event);boolean open=state.equals("报名中");
                    android.widget.FrameLayout artwork=new android.widget.FrameLayout(this);artwork.setBackgroundColor(SwodUi.tonal(this));
                    int width=(getResources().getConfiguration().screenWidthDp-42)/(single?1:2);card.addView(artwork,new LinearLayout.LayoutParams(-1,dp(Math.min(230,width*4/5))));
                    ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.FIT_CENTER);image.setImageDrawable(SwodUi.icon(this,"trophy",red));image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);artwork.addView(image,new android.widget.FrameLayout.LayoutParams(-1,-1));
                    String raw=EventPresentation.value(event,"coverUrl","cover_url"),url=raw.startsWith("/")?"https://admin.swod.com.cn"+raw:raw;
                    int version=generation;
                    if(Policy.secureURL(url))imageIO.execute(()->{try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(version==generation&&!isFinishing()&&bitmap!=null)image.setImageBitmap(bitmap);});}catch(Exception ignored){}});
                    TextView badge=text(state,11);badge.setTextColor(open?(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE):SwodUi.ink(this));badge.setBackground(SwodUi.shape(this,open?red:SwodUi.surface(this),16));android.widget.FrameLayout.LayoutParams badgeLayout=new android.widget.FrameLayout.LayoutParams(-2,-2);badgeLayout.setMargins(dp(6),dp(6),dp(6),dp(6));artwork.addView(badge,badgeLayout);
                    LinearLayout body=column();body.setPadding(dp(8),dp(8),dp(8),dp(8));card.addView(body);
                    TextView date=text(EventPresentation.dates(event)+"\n"+(location.isEmpty()?"地点待定":location),11);date.setTextColor(SwodUi.muted(this));date.setMinHeight(dp(50));body.addView(date);
                    TextView name=text(event.optString("name"),15);name.setTypeface(null,android.graphics.Typeface.BOLD);name.setMinHeight(dp(64));body.addView(name);
                    LinearLayout counts=row();String[] keys={"groupCount","playerCount","judgeCount"},labels={"组别","选手","评委"};
                    for(int j=0;j<keys.length;j++){Long count=EventPresentation.count(event,keys[j]);counts.addView(eventMetric(count==null?"未公开":Long.toString(count),labels[j],false),new LinearLayout.LayoutParams(0,-2,1));}body.addView(counts);
                    Button entry=loginAction(open?"点击报名 ›":"查看详情 ›",()->open(()->event(event.optInt("id"))));body.addView(entry,new LinearLayout.LayoutParams(-1,-2));
                    card.setOnClickListener(view->open(()->event(event.optInt("id"))));matches++;
                }
                if(!single&&matches%2==1&&line!=null)line.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));
                if(matches==0)grid.addView(text(query.isEmpty()?"暂无公开赛事":"未找到匹配赛事，请更换名称或地点",14));
            };
            search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int d){}public void onTextChanged(CharSequence v,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});
            render.run();
        });
    }
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
                        if(error!=null){info(error.getMessage());return;}musicBytes=null;begin("报名与音乐已提交");info("付款及处理进度请在赛事记录中查看。");action("查看报名记录",()->open(this::myEvents));});
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

    private void shop(){begin("伊娃甄选");hero("伊娃甄选","东方舞生活 · 官方商城");action("我的商城订单",()->open(this::orders));action("收货地址",()->open(this::shipping));section("精选商品");load("/shop/products","GET",null,false,v->{JSONArray products=array(object(v).opt("products"));EditText query=field(content,"搜索商品、颜色或尺码",false);content.removeView(query);content.addView(query,0);Spinner category=new Spinner(this);java.util.ArrayList<String> categories=new java.util.ArrayList<>();categories.add("全部商品");for(int i=0;i<products.length();i++){String c=products.optJSONObject(i).optString("category");if(!c.isEmpty()&&!categories.contains(c))categories.add(c);}category.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,categories));content.addView(category);LinearLayout list=column();content.addView(list);Runnable render=()->{list.removeAllViews();String keyword=query.getText().toString().trim().toLowerCase(Locale.ROOT),selected=categories.get(category.getSelectedItemPosition());for(int i=0;i<products.length();i++){JSONObject r=products.optJSONObject(i);if(r==null||(!selected.equals("全部商品")&&!selected.equals(r.optString("category"))))continue;String search=(r.optString("name")+" "+r.optString("color")+" "+r.optString("size")+" "+r.optString("spec")).toLowerCase(Locale.ROOT);if(!search.contains(keyword))continue;int index=list.getChildCount();card(list,r.optString("name"),productSpec(r)+" · "+ProductPresentation.price(r.opt("priceFen"))+" · "+ProductPresentation.stock(r.opt("stock")),()->open(()->product(r)));cover((LinearLayout)list.getChildAt(index),first(r,"image"),true);}if(list.getChildCount()==0)list.addView(text("暂无符合条件的商品",14));};query.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});category.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int at,long id){render.run();}});render.run();});}
    private String productSpec(JSONObject r){java.util.ArrayList<String> values=new java.util.ArrayList<>();for(String key:new String[]{"spec","color","size"}){String value=first(r,key);if(!value.isEmpty())values.add(value);}return String.join(" · ",values);}
    private void product(JSONObject r){begin(r.optString("name"));cover(content,first(r,"image"),true);hero(r.optString("name"),productSpec(r));info(strip(first(r,"description")));info(ProductPresentation.price(r.opt("priceFen"))+" · "+ProductPresentation.stock(r.opt("stock")));info("App 暂未开放下单，可查看商品及已有订单。");action("查看我的订单",()->open(this::orders));}
    private void shipping(){begin("收货地址");load("/shop/shipping","GET",null,true,v->{JSONObject o=object(v);JSONObject a=o.optJSONObject("shipping");if(a==null)a=o;EditText name=field(content,"收件人",false),phone=field(content,"手机号",true),address=field(content,"完整收货地址（省市区和门牌）",false);name.setText(first(a,"recipient","name"));phone.setText(a.optString("phone"));address.setText(a.optString("address"));action("保存地址",()->{String n=name.getText().toString().trim(),p=phone.getText().toString().trim(),d=address.getText().toString().trim();if(n.isEmpty()||n.length()>60||!p.matches("1[3-9][0-9]{9}")||d.length()<5||d.length()>200){info("请填写收件人、有效手机号和完整地址");return;}memberWrite("/shop/shipping","PUT",body("recipient",n,"phone",p,"address",d),this::shipping);});});}
    private void orders(){begin("我的商城订单");load("/shop/orders","GET",null,true,v->{JSONArray rows=array(object(v).opt("orders"));for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,"订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind"))+" · ¥"+Commerce.money(r.optLong("totalFen"))+" · "+first(r,"createdAt"),()->open(()->order(r.optString("id"))));}if(rows.length()==0)info("暂无商城订单");});}
    private void order(String id){begin("订单详情");String path="/shop/orders/"+Uri.encode(id);load(path,"GET",null,true,v->{JSONObject r=object(v).optJSONObject("order");if(r==null)throw new Exception("订单不存在");hero("订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind")));info("合计 ¥"+Commerce.money(r.optLong("totalFen")));JSONArray items=array(r.opt("items"));for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);card(content,item.optString("name"),"¥"+Commerce.money(item.optLong("unit_fen"))+" × "+item.optInt("quantity"),null);}info(first(r,"createdAt"));info(first(r,"carrier")+" "+first(r,"trackingNo"));info(first(r,"recipient")+" · "+mask(r.optString("phone"))+" · "+first(r,"address"));JSONObject shipping=r.optJSONObject("shipping");if(shipping!=null)info(first(shipping,"recipient")+" · "+mask(shipping.optString("phone"))+" · "+shipping.optString("address"));action("同步最新订单状态",()->memberWrite(path+"/refresh","POST",body(),()->order(id)));String state=r.optString("status");if(state.equals("pending"))action("取消订单",()->confirm("确认取消此订单？",()->memberWrite(path+"/cancel","POST",body(),()->order(id))));if(state.equals("shipped")&&r.optString("kind").equals("goods"))action("确认收货",()->confirm("请确认已经收到商品",()->memberWrite(path+"/received","POST",body(),()->order(id))));if(Commerce.refundable(state)){EditText reason=field(content,"退款原因",false);action("申请退款",()->{String message=reason.getText().toString().trim();if(message.isEmpty()||message.length()>300){info("请填写300字以内退款原因");return;}confirm("确认提交退款申请？结果以平台审核为准",()->memberWrite(path+"/refund","POST",body("reason",message),()->order(id)));});}});}
    private void memberWrite(String path,String method,JSONObject body,Runnable next){if(memberWriteBusy)return;memberWriteBusy=true;int version=generation;io.execute(()->{try{api.request(path,method,body,true);runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing()){page=next;next.run();}});}catch(Exception e){runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing())info(e.getMessage());});}});}
    private void profileEditor(){begin("个人资料");load("/member/profile","GET",null,true,v->{JSONObject r=object(v);info("手机号 "+mask(r.optString("phone"))+" · 资料与官网同步");String[] keys={"name","gender","birthday","country","province","city","address"},labels={"姓名","性别（男/女/其他，选填）","生日（YYYY-MM-DD，选填）","国家/地区","省份/地区","城市","详细地址"};EditText[] inputs=new EditText[keys.length];for(int i=0;i<keys.length;i++){inputs[i]=field(content,labels[i],false);inputs[i].setText(first(r,keys[i]));}action("保存个人资料",()->{JSONObject draft=body();for(int i=0;i<keys.length;i++){String value=inputs[i].getText().toString().trim();if(value.length()>300||(i==0&&(value.isEmpty()||value.length()>60))){info("请填写姓名，单项资料不能超过300字");return;}try{draft.put(keys[i],value);}catch(Exception ignored){}}String birthday=inputs[2].getText().toString().trim();if(!birthday.isEmpty()){try{java.time.LocalDate date=java.time.LocalDate.parse(birthday);if(date.isAfter(java.time.LocalDate.now()))throw new Exception();}catch(Exception e){info("请填写有效生日 YYYY-MM-DD");return;}}memberWrite("/member/profile","PUT",draft,this::account);});});}
    private void account(){begin("个人中心");if(!api.loggedIn()){hero("欢迎来到伊娃东方舞","登录后同步课程、比赛、证书与订单");action("手机号登录",()->open(this::login));}else{LinearLayout summary=column();content.addView(summary);load("/member/profile","GET",null,true,v->{JSONObject r=object(v);card(summary,first(r,"name"),mask(r.optString("phone"))+" · "+first(r,"level"),()->open(this::profileEditor));JSONObject stats=r.optJSONObject("stats");if(stats!=null)card(summary,"我的学习","线上课 "+stats.optInt("authorized_count")+" · 已学完 "+stats.optInt("completed_count")+" · 线下剩余 "+stats.optInt("offline_remaining_sessions")+" 课时",null);});section("个人资料");action("个人资料",()->open(this::profileEditor));action("我的比赛",()->open(this::myEvents));action("我的订单",()->open(this::orders));section("我的课程");LinearLayout courseRows=column();content.addView(courseRows);load("/member/authorized-series","GET",null,true,v->{if(!(v instanceof JSONArray))throw new Exception();JSONArray owned=(JSONArray)v;for(int n=0;n<owned.length();n++){JSONObject r=owned.getJSONObject(n);int id=CourseAccessPolicy.canonicalId(r.opt("series_id"));if(id<=0)continue;int at=courseRows.getChildCount();card(courseRows,first(r,"series_name","name"),"继续学习",()->open(()->catalog(id,first(r,"series_name","name"))));unlockedBadge((LinearLayout)courseRows.getChildAt(at),14);}if(owned.length()==0)courseRows.addView(text("暂无已解锁课程",14));});action("查看全部课程与学习记录",()->open(this::myCourses));section("线下课与证书");action("我的线下课 · 课时与核销",()->open(this::schedule));action("我的证书",()->open(this::certificates));section("更多学习服务");action("学习消息",()->open(()->messages(0)));action("学习笔记",()->open(()->learningRecords(false)));action("学习书签",()->open(()->learningRecords(true)));action("成长档案",()->open(()->records("成长档案","/member/growth","",null)));section("账号与安全");action("登录设备",()->open(this::devices));action("注销账号",()->open(this::deletion));action("退出登录",()->confirm("退出当前账号？",()->{generation++;io.execute(()->{try{api.logout();}catch(Exception ignored){}runOnUiThread(()->{history.clear();page=this::account;account();});});}));}section("更多服务");action("客服与售后",()->open(this::support));action("东方舞圈与品牌服务",()->open(this::website));action("工作人员 · 赛事管理",()->open(this::staffHome));action("关于 SWOD",()->open(this::about));action("隐私政策",()->open(()->legalDocument("隐私政策","app-privacy.txt")));action("服务条款",()->open(()->legalDocument("服务条款","app-terms.txt")));info("SWOD "+ReleaseInfo.version(this));}
    private void learningRecords(boolean bookmarks){begin(bookmarks?"学习书签":"学习笔记");String path=bookmarks?"/bookmarks":"/notes";load(path+"/all","GET",null,true,v->{JSONArray rows=array(v);for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,first(r,"course_name","video_name","series_name"),first(r,"content","label")+" · "+r.optInt("timestamp_seconds")+"秒",()->playAt(r.optInt("video_id"),first(r,"course_name","video_name"),r.optInt("timestamp_seconds")));action("删除此"+(bookmarks?"书签":"笔记"),()->confirm("确认删除此记录？",()->memberWrite(path+"/"+r.optInt("id"),"DELETE",body(),()->learningRecords(bookmarks))));}if(rows.length()==0)info("暂无记录");});}
    private void legalDocument(String name,String asset){begin(name);try{TextView body=text(ReleaseInfo.read(this,asset),16);body.setTextIsSelectable(true);content.addView(body);}catch(Exception error){info("文件读取失败，请返回重试");}}
    private void about(){begin("关于 SWOD");JSONObject info=ReleaseInfo.data(this);hero("SWOD",ReleaseInfo.version(this));info(info.optString("operator"));action(info.optString("filingNumber"),()->link("https://beian.miit.gov.cn/"));action("隐私政策",()->open(()->legalDocument("隐私政策","app-privacy.txt")));action("服务条款",()->open(()->legalDocument("服务条款","app-terms.txt")));action("服务商与数据清单",()->open(()->legalDocument("服务商与数据清单","app-processors.txt")));action("官方客服",()->link(info.optString("supportURL")));action("撤回隐私授权",()->confirm("撤回将清除本地登录并停止使用 App。服务器账号不会因此自动注销，注销请使用个人中心的独立入口。",()->{generation++;io.execute(()->{try{api.logout();}catch(Exception ignored){}runOnUiThread(()->{if(!PrivacyConsent.revoke(this)){Toast.makeText(this,"保存失败，请重试撤回",Toast.LENGTH_LONG).show();return;}history.clear();recreate();});});}));}
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
        long elapsed=android.os.SystemClock.elapsedRealtime();if(smsSentTimes.containsKey(phone)&&elapsed-smsSentTimes.get(phone)<60000){info("验证码已发送，请稍后再试");return;}
        int version=generation;smsBusy=true;io.execute(()->{try{api.request("/send-code","POST",body("phone",phone),false);runOnUiThread(()->{smsBusy=false;smsSentTimes.put(phone,android.os.SystemClock.elapsedRealtime());if(version==generation)info("验证码已发送");});}catch(Exception e){runOnUiThread(()->{smsBusy=false;if(version==generation)info(e.getMessage());});}});
    }
    private final CarrierLogin carrierLogin = new CarrierLogin();
    private void loginWithCarrier(CheckBox consent){
        if(authBusy)return;
        if(!consent.isChecked()){consent.setError("请阅读并同意协议");consent.requestFocus();return;}
        int version=generation;long account=api.accountGeneration();authBusy=true;
        io.execute(()->{try{
            JSONObject config=object(api.request("/config","GET",null,false));
            if(!config.optBoolean("oneTapLogin"))throw new Exception("本机号码登录暂未开放，请使用短信登录");
            runOnUiThread(()->{if(version!=generation||isFinishing()){authBusy=false;return;}carrierLogin.start(this,(token,error)->{
                if(version!=generation||isFinishing()){authBusy=false;return;}
                if(token==null){authBusy=false;if(error!=null)info(error);return;}
                io.execute(()->{try{
                    JSONObject response=object(api.request("/auth/one-tap","POST",body("accessToken",token,"deviceName","SWOD Android"),false));
                    runOnUiThread(()->{authBusy=false;if(version!=generation||account!=api.accountGeneration()||isFinishing())return;try{api.accept(response);history.clear();page=this::account;account();}catch(Exception failure){info("登录结果保存失败，请重新登录");}});
                }catch(Exception failure){runOnUiThread(()->{authBusy=false;if(version==generation&&!isFinishing())info(failure.getMessage());});}});
            });});
        }catch(Exception error){runOnUiThread(()->{authBusy=false;if(version==generation&&!isFinishing())info(error.getMessage());});}});
    }
    private Button loginAction(String label,Runnable tap){
        Button view=button(label,tap);view.setGravity(Gravity.CENTER);
        view.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{SwodUi.muted(this),SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE}));
        view.setBackgroundTintList(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{SwodUi.tonal(this),red}));
        return view;
    }
    private EditText loginInput(LinearLayout box,String hint,boolean digits){
        EditText view=field(box,hint,digits);view.setBackground(SwodUi.shape(this,SwodUi.canvas(this),12));view.setSaveEnabled(false);return view;
    }
    private void login(){login(false,"");}
    private void login(boolean passwordMode){login(passwordMode,"");}
    private void login(boolean passwordMode,String initialPhone){
        begin("登录");int pageVersion=generation;
        LinearLayout branding=column();branding.setGravity(Gravity.CENTER);branding.setPadding(0,dp(12),0,dp(20));
        ImageView logo=new ImageView(this);logo.setImageResource(cn.com.swod.app.R.drawable.brand_logo);logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setPadding(dp(6),dp(6),dp(6),dp(6));logo.setBackground(SwodUi.shape(this,android.graphics.Color.WHITE,18));logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        branding.addView(logo,new LinearLayout.LayoutParams(dp(80),dp(80)));
        TextView name=text("伊娃东方舞",26);name.setTypeface(null,android.graphics.Typeface.BOLD);name.setGravity(Gravity.CENTER);branding.addView(name);
        TextView tagline=text("舞者成长系统",14);tagline.setGravity(Gravity.CENTER);tagline.setTextColor(SwodUi.muted(this));branding.addView(tagline);content.addView(branding);
        LinearLayout card=column();card.setPadding(dp(20),dp(20),dp(20),dp(16));card.setBackground(SwodUi.shape(this,SwodUi.surface(this),20));
        LinearLayout.LayoutParams cardLayout=new LinearLayout.LayoutParams(Math.min(dp(440),getResources().getDisplayMetrics().widthPixels-dp(32)),-2);cardLayout.gravity=Gravity.CENTER_HORIZONTAL;content.addView(card,cardLayout);
        CheckBox consent=new CheckBox(this);consent.setText("我已阅读并同意以下协议");consent.setTextColor(SwodUi.ink(this));consent.setMinHeight(dp(48));consent.setChecked(false);consent.setSaveEnabled(false);
        boolean[] carrierAvailable={false};
        Button carrier=loginAction("手机号一键登录",()->loginWithCarrier(consent));card.addView(carrier,new LinearLayout.LayoutParams(-1,-2));
        TextView carrierStatus=text("正在检查本机号码登录…",12);carrierStatus.setTextColor(SwodUi.muted(this));carrierStatus.setGravity(Gravity.CENTER);card.addView(carrierStatus);
        TextView divider=text(passwordMode?"或使用账号密码登录":"或使用验证码登录",12);divider.setGravity(Gravity.CENTER);divider.setTextColor(SwodUi.muted(this));divider.setPadding(0,dp(16),0,dp(12));card.addView(divider);
        card.addView(text("手机号",14));EditText phone=loginInput(card,"请输入手机号",true);phone.setText(initialPhone);phone.setContentDescription("手机号");
        card.addView(text(passwordMode?"账号密码":"验证码",14));
        LinearLayout codeRow=row();boolean large=getResources().getConfiguration().fontScale>1.4f;if(large)codeRow.setOrientation(LinearLayout.VERTICAL);card.addView(codeRow);
        EditText secret=loginInput(codeRow,passwordMode?"请输入账号密码":"请输入验证码",!passwordMode);
        secret.setContentDescription(passwordMode?"密码":"短信验证码");secret.setLayoutParams(new LinearLayout.LayoutParams(passwordMode||large?-1:0,-2,passwordMode||large?0:1));
        if(passwordMode){secret.setInputType(android.text.InputType.TYPE_CLASS_TEXT|android.text.InputType.TYPE_TEXT_VARIATION_PASSWORD);secret.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO);}
        else secret.setInputType(android.text.InputType.TYPE_CLASS_NUMBER);
        Button send=button("获取验证码",()->sendSMS(phone.getText().toString().trim()));send.setBackground(SwodUi.touch(this,SwodUi.tonal(this),12));
        if(!passwordMode){LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(large?-1:-2,-2);params.leftMargin=large?0:dp(10);codeRow.addView(send,params);}
        card.addView(consent);
        LinearLayout links=row();links.setGravity(Gravity.CENTER);if(large)links.setOrientation(LinearLayout.VERTICAL);
        Button privacy=button("《隐私政策》",()->open(()->legalDocument("隐私政策","app-privacy.txt")));
        Button terms=button("《服务条款》",()->open(()->legalDocument("服务条款","app-terms.txt")));
        links.addView(privacy);links.addView(terms);card.addView(links);
        loginFeedback=text("",14);loginFeedback.setVisibility(View.GONE);card.addView(loginFeedback);
        Button submit=loginAction(passwordMode?"密码登录":"验证码登录",()->{
            if(authBusy)return;
            if(!consent.isChecked()){consent.setError("请阅读并同意协议");consent.requestFocus();return;}
            String number=phone.getText().toString().trim(),credential=secret.getText().toString();
            if(!number.matches("1[3-9][0-9]{9}")){phone.setError("请填写有效手机号");phone.requestFocus();return;}
            if(passwordMode?credential.isEmpty():!credential.matches("[0-9]{6}")){secret.setError(passwordMode?"请填写密码":"请填写六位验证码");secret.requestFocus();return;}
            int version=generation;long accountVersion=api.accountGeneration();authBusy=true;secret.setText("");
            io.execute(()->{try{
                JSONObject response=object(api.request(passwordMode?"/auth/password-login":"/auth/login","POST",body("phone",number,passwordMode?"password":"code",credential,"deviceName","伊娃东方舞 Android"),false));
                runOnUiThread(()->{authBusy=false;if(version!=generation||accountVersion!=api.accountGeneration()||isFinishing())return;try{api.accept(response);history.clear();page=this::account;account();}catch(Exception e){info(e.getMessage());}});
            }catch(Exception e){runOnUiThread(()->{authBusy=false;if(version==generation&&!isFinishing())info(e.getMessage());});}});
        });
        card.addView(submit,new LinearLayout.LayoutParams(-1,-2));
        TextView fallback=text("授权失败时可使用短信验证码登录",12);fallback.setTextColor(SwodUi.muted(this));fallback.setGravity(Gravity.CENTER);card.addView(fallback);
        Button alternate=button(passwordMode?"使用验证码登录":"使用账号密码登录",()->{if(!authBusy){String number=phone.getText().toString();secret.setText("");page=()->login(!passwordMode,number);page.run();}});
        card.addView(alternate,new LinearLayout.LayoutParams(-1,-2));
        Button cancel=button("返回",()->{secret.setText("");carrierLogin.cancel();back();});LinearLayout.LayoutParams cancelLayout=new LinearLayout.LayoutParams(-2,-2);cancelLayout.gravity=Gravity.CENTER_HORIZONTAL;cancelLayout.topMargin=dp(20);content.addView(cancel,cancelLayout);
        TextView shared=text("与官网、小程序共用学习账号",12);shared.setGravity(Gravity.CENTER);shared.setTextColor(SwodUi.muted(this));content.addView(shared);
        Runnable update=()->{
            boolean idle=!authBusy&&!smsBusy,agreed=consent.isChecked(),valid=phone.getText().toString().trim().matches("1[3-9][0-9]{9}");
            long sent=smsSentTimes.getOrDefault(phone.getText().toString().trim(),0L);
            int seconds=sent==0?0:(int)Math.max(0,Math.ceil((60000-(android.os.SystemClock.elapsedRealtime()-sent))/1000.0));
            send.setText(smsBusy?"发送中…":seconds>0?seconds+" 秒后重发":"获取验证码");send.setEnabled(idle&&agreed&&valid&&seconds==0);
            submit.setEnabled(idle&&agreed&&valid&&(passwordMode?secret.length()>0:secret.getText().toString().matches("[0-9]{6}")));
            carrier.setEnabled(idle&&agreed&&carrierAvailable[0]);alternate.setEnabled(idle);phone.setEnabled(idle);secret.setEnabled(idle);consent.setEnabled(idle);
        };
        TextWatcher edits=new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int d){}public void onTextChanged(CharSequence v,int a,int b,int c){update.run();}public void afterTextChanged(Editable e){}};
        secret.addTextChangedListener(edits);
        phone.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int d){}public void onTextChanged(CharSequence v,int a,int b,int c){secret.setText("");update.run();}public void afterTextChanged(Editable e){}});
        consent.setOnCheckedChangeListener((v,checked)->update.run());update.run();
        android.os.Handler timer=new android.os.Handler(android.os.Looper.getMainLooper());
        timer.postDelayed(new Runnable(){public void run(){if(pageVersion!=generation||isFinishing())return;update.run();timer.postDelayed(this,1000);}},1000);
        io.execute(()->{try{JSONObject config=object(api.request("/config","GET",null,false));runOnUiThread(()->{if(pageVersion!=generation||isFinishing())return;carrierAvailable[0]=config.optBoolean("oneTapLogin");carrierStatus.setText(carrierAvailable[0]?"由运营商验证本机号码，登录前请先同意下方协议":"本机号码登录暂未开放，请使用短信验证或账号密码登录");update.run();});}catch(Exception e){runOnUiThread(()->{if(pageVersion==generation)carrierStatus.setText("暂时无法检查本机号码登录，请使用短信验证");});}});
    }
    private void assistant(){begin("学习助手");info("根据已有课程制定练习安排");action("20 分钟：热身 4 · 技巧 12 · 复习 4",()->open(()->records("最近学习","/member/recent-courses","",r->play(r.optInt("video_id"),first(r,"course_name")))));action("30 分钟：热身 6 · 技巧 18 · 复习 6",()->open(()->records("最近学习","/member/recent-courses","",r->play(r.optInt("video_id"),first(r,"course_name")))));}
    private void myEvents(){begin("我的比赛");load("/member/events","GET",null,true,v->{JSONArray entries=array(object(v).opt("entries"));if(entries.length()==0){info("暂无比赛报名和结果记录");return;}for(int i=0;i<entries.length();i++){JSONObject r=entries.getJSONObject(i);String detail=first(r,"groupName")+(first(r,"playerNo").isEmpty()?"":" · 选手号 "+first(r,"playerNo"));if(!first(r,"entrantName").isEmpty())detail+="\n参赛人："+first(r,"entrantName");if(!first(r,"performanceTitle").isEmpty())detail+="\n节目："+first(r,"performanceTitle");detail+="\n"+CompetitionRecord.audit(r.optString("auditStatus"))+" · "+CompetitionRecord.paid(r.optString("paidStatus"))+" · "+first(r,"startDate");detail+="\n"+CompetitionRecord.result(r.opt("resultPublished"),first(r,"totalScore"),r.optInt("rankNo"),first(r,"awardName"));card(content,first(r,"competitionName"),detail,null);int id=r.optInt("competitionId");if(id>0)action("赛事详情",()->open(()->event(id)));}});}
    private void records(String name,String path,String key,RowTap tap){begin(name);load(path,"GET",null,true,v->{Object items=key.isEmpty()?v:object(v).opt(key);JSONArray rs=array(items);if(rs.length()==0&&items instanceof JSONObject)rs=new JSONArray().put(items);displayRows(rs,new String[]{"series_name","course_name","competitionName","name","groupName","auditStatus","totalScore","content","label","status"},tap);if(rs.length()==0)info("暂无记录");});}
    private void displayRows(JSONArray rs,String[] fields,RowTap tap)throws Exception{for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);String summary="";for(String f:fields){String s=first(r,f);if(!s.isEmpty())summary+=s+" · ";}card(content,first(r,"name","title","courseName","series_name","course_name","playerName"),summary,tap==null?null:()->tap.tap(r));}}
    private void mutate(String path,String method,JSONObject body,Runnable next){load(path,method,body,true,v->{history.clear();page=next;next.run();});}
    private void link(String url){if(Policy.secureURL(url))try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){info("暂时无法打开链接");}}
    private static String strip(String html){return android.text.Html.fromHtml(html,android.text.Html.FROM_HTML_MODE_LEGACY).toString();}
    private static String mask(String phone){return phone.length()==11?phone.substring(0,3)+"****"+phone.substring(7):"";}
    @Override protected void onDestroy(){generation++;carrierLogin.cancel();io.shutdownNow();imageIO.shutdownNow();super.onDestroy();}
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
