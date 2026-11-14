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
    private androidx.swiperefreshlayout.widget.SwipeRefreshLayout refreshLayout;
    private boolean refreshRequested;
    private int pendingLoads;
    private String courseKeyword="",courseCategory="";
    private boolean onlyUnlocked;
    private final Button[] tabButtons = new Button[5];
    private boolean memberWriteBusy,loginPageVisible;
    private boolean courseEntryBusy,foreground;
    private int courseEntryRequest;
    private boolean authBusy, smsBusy;
    private final java.util.Map<String,Long> smsSentTimes = new java.util.HashMap<>();
    private Runnable page;
    private volatile int generation;
    private byte[] musicBytes;
    private String musicFilename = "";
    private TextView musicLabel;
    private int musicPickerGeneration;
    private boolean musicReading;
    private boolean registrationBusy;
    private int red;
    private Button accountNotice;
    private int unreadMessages;
    private boolean unreadLoaded;
    private final android.os.Handler messageHandler=new android.os.Handler(android.os.Looper.getMainLooper());
    private final Runnable messagePoll=new Runnable(){public void run(){refreshUnread();messageHandler.postDelayed(this,30000);}};
    private void refreshUnread(){if(api==null)return;AppPush.flushRevocations(this);if(!api.loggedIn()){unreadMessages=0;unreadLoaded=false;updateMessageBadge();return;}long account=api.accountGeneration();io.execute(()->{try{JSONObject value=(JSONObject)api.request("/member/messages/unread-count","GET",null,true);int count=Math.max(0,value.optInt("count"));runOnUiThread(()->{if(api.accountGeneration()!=account||isFinishing())return;if(unreadLoaded&&count>unreadMessages)Toast.makeText(this,"你有新的学习消息",Toast.LENGTH_SHORT).show();unreadMessages=count;unreadLoaded=true;updateMessageBadge();});}catch(Exception ignored){}});AppPush.register(getApplication(),null);}
    private void updateMessageBadge(){if(tabButtons[4]!=null){tabButtons[4].setText("个人中心"+(unreadMessages>0?" · "+(unreadMessages>99?"99+":unreadMessages):""));tabButtons[4].setContentDescription("个人中心"+(unreadMessages>0?"，"+unreadMessages+" 条未读消息":""));}if(accountNotice!=null){accountNotice.setText(unreadMessages>0?(unreadMessages>99?"99+":String.valueOf(unreadMessages))+" 未读":"通知");accountNotice.setContentDescription("通知，"+unreadMessages+"条未读");}}
    private void notificationIntent(Intent intent){String id=intent.getStringExtra("pushRecipientId");intent.removeExtra("pushRecipientId");if(id!=null&&id.matches("[1-9][0-9]{0,15}")&&api!=null&&api.loggedIn())open(()->messageDetail(id));}
    @Override protected void onNewIntent(Intent intent){super.onNewIntent(intent);setIntent(intent);notificationIntent(intent);}
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] grants){super.onRequestPermissionsResult(request,permissions,grants);if(request==701&&grants.length>0&&grants[0]==android.content.pm.PackageManager.PERMISSION_GRANTED)AppPush.enable(this,this::refreshUnread);}
    private void messageDetail(String id){begin("学习消息");load("/member/messages/"+id,"GET",null,true,v->{JSONObject item=object(v);hero(item.optString("title"),item.optString("createdAt"));info(item.optString("content"));load("/member/messages/"+id+"/read","PATCH",body(),true,ignored->refreshUnread());});}

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
        int windowWidth = getResources().getConfiguration().screenWidthDp;
        boolean expanded = windowWidth >= 600;
        int railWidth = 104;
        int inset = Math.max(16, (windowWidth - (expanded ? railWidth : 0) - 880) / 2);
        pageScroll = new ScrollView(this);pageScroll.setFillViewport(true); content = column();content.setPadding(dp(inset),dp(4),dp(inset),dp(16));pageScroll.addView(content);
        refreshLayout=new androidx.swiperefreshlayout.widget.SwipeRefreshLayout(this);refreshLayout.addView(pageScroll);refreshLayout.setColorSchemeColors(red);refreshLayout.setOnChildScrollUpCallback((parent,child)->pageScroll.getScrollY()>0);refreshLayout.setOnRefreshListener(()->{dismissKeyboard();if(page!=null){refreshRequested=true;page.run();if(pendingLoads==0)refreshLayout.setRefreshing(false);}else refreshLayout.setRefreshing(false);});
        LinearLayout tabs = row(); String[] names={"线上学院","线下课","赛事","商城","个人中心"};
        if(expanded){tabs.setOrientation(LinearLayout.VERTICAL);tabs.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);}
        String[] icons={"learn","calendar","trophy","bag","person"};
        Runnable[] pages={this::courses,this::offline,this::events,this::shop,this::account};
        for(int i=0;i<names.length;i++) { final Runnable p=pages[i]; final int index=i; Button b=button(names[i],()->{if(index==4&&!api.loggedIn()){if(!loginPageVisible)open(this::login);return;}history.clear();selectTab(index);page=p;p.run();}); b.setTextSize(12);b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],red),null,null);b.setCompoundDrawablePadding(dp(6));b.setGravity(Gravity.CENTER);b.setPadding(dp(2),dp(expanded?6:10),dp(2),dp(expanded?6:8));tabButtons[i]=b; tabs.addView(b,expanded?new LinearLayout.LayoutParams(-1,dp(64)):new LinearLayout.LayoutParams(0,dp(68),1)); }
        tabs.setPadding(dp(6),dp(4),dp(6),dp(4));tabs.setBackgroundColor(SwodUi.surface(this));
        if(expanded){LinearLayout body=row();body.setGravity(Gravity.TOP);ScrollView rail=new ScrollView(this);rail.setVerticalScrollBarEnabled(false);rail.addView(tabs,new ScrollView.LayoutParams(-1,-2));body.addView(rail,new LinearLayout.LayoutParams(dp(railWidth),-1));body.addView(refreshLayout,new LinearLayout.LayoutParams(0,-1,1));root.addView(body,new LinearLayout.LayoutParams(-1,0,1));}
        else{root.addView(refreshLayout,new LinearLayout.LayoutParams(-1,0,1));root.addView(tabs);}
        selectTab(0); setContentView(root);if(android.os.Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->{if(history.isEmpty())finish();else back();}); page=this::courses; courses();notificationIntent(getIntent());messageHandler.removeCallbacks(messagePoll);messageHandler.post(messagePoll);
    }
    // API 33+ registers OnBackInvokedDispatcher in onCreate; this override serves API 26-32.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() { if(history.isEmpty()) super.onBackPressed(); else back(); }
    private void back() { if(!history.isEmpty()) {page=history.pop();page.run();} }
    private void open(Runnable next) { if(page!=null) history.push(page); page=next; next.run(); }
    private void selectTab(int selected){String[] icons={"learn","calendar","trophy","bag","person"};for(int i=0;i<tabButtons.length;i++){Button b=tabButtons[i];if(b!=null){boolean active=i==selected;b.setSelected(active);b.setTextColor(active?red:SwodUi.muted(this));b.setTypeface(null,active?android.graphics.Typeface.BOLD:android.graphics.Typeface.NORMAL);b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],active?red:SwodUi.muted(this)),null,null);b.setBackground(SwodUi.touch(this,active?SwodUi.tonal(this):SwodUi.surface(this),14));}}}
    private void hero(String name,String description){LinearLayout box=column();box.setPadding(0,dp(4),0,dp(8));TextView heading=text(name,22);heading.setTypeface(null,android.graphics.Typeface.BOLD);box.addView(heading);TextView summary=text(description,14);summary.setTextColor(SwodUi.muted(this));box.addView(summary);content.addView(box);}
    private void section(String name){TextView label=text(name,18);label.setTypeface(null,android.graphics.Typeface.BOLD);label.setPadding(0,dp(12),0,dp(4));content.addView(label);}
    private void begin(String name) {pageScroll.setBackgroundColor(SwodUi.canvas(this));accountNotice=null;if(refreshLayout!=null){refreshLayout.setEnabled(history.isEmpty());refreshLayout.setRefreshing(refreshRequested);}refreshRequested=false;pendingLoads=0;loginPageVisible=false;courseEntryRequest++;courseEntryBusy=false; if(pageActions!=null)pageActions.removeAllViews();loginFeedback=null;courseAccessVisible=false; generation++; content.removeAllViews(); title.setText("");title.setContentDescription(name);chromeBar.setVisibility(history.isEmpty()?View.GONE:View.VISIBLE);backButton.setVisibility(history.isEmpty()?View.GONE:View.VISIBLE);pageScroll.scrollTo(0,0); }
    private int dp(int x) {return Math.round(x*getResources().getDisplayMetrics().density);}
    private LinearLayout column(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.VERTICAL);return v;}
    private LinearLayout row(){LinearLayout v=new LinearLayout(this);v.setOrientation(LinearLayout.HORIZONTAL);v.setGravity(Gravity.CENTER_VERTICAL);return v;}
    private TextView text(String s,int size){TextView v=new TextView(this);v.setText(s);v.setTextSize(size);v.setTextColor(SwodUi.ink(this));v.setPadding(dp(4),dp(5),dp(4),dp(5));return v;}
    private Button button(String s,Runnable tap){Button b=new Button(this);b.setText(s);b.setTextSize(15);b.setTextColor(new android.content.res.ColorStateList(new int[][]{new int[]{-android.R.attr.state_enabled},new int[]{}},new int[]{SwodUi.muted(this),red}));b.setMinHeight(dp(48));b.setMinimumHeight(dp(48));b.setAllCaps(false);b.setStateListAnimator(null);b.setElevation(0);b.setPadding(dp(16),dp(10),dp(16),dp(10));b.setBackground(SwodUi.touch(this,android.graphics.Color.TRANSPARENT,0));b.setOnClickListener(v->tap.run());return b;}
    private void action(String s,Runnable tap){LinearLayout.LayoutParams layout=new LinearLayout.LayoutParams(-1,-2);layout.topMargin=dp(8);Button b=button(s,tap);b.setBackground(SwodUi.row(this));b.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);b.setCompoundDrawablesWithIntrinsicBounds(null,null,SwodUi.icon(this,"next",SwodUi.muted(this)),null);content.addView(b,layout);}
    private void info(String s){if(loginFeedback!=null){loginFeedback.setText(s);loginFeedback.setVisibility(View.VISIBLE);return;}content.addView(text(s,14));}
    private EditText field(LinearLayout box,String hint, boolean digits){EditText v=new EditText(this);v.setHint(hint);v.setContentDescription(hint);v.setTextSize(16);v.setTextColor(SwodUi.ink(this));v.setHintTextColor(SwodUi.muted(this));v.setPadding(dp(16),dp(12),dp(16),dp(12));v.setBackground(SwodUi.shape(this,SwodUi.field(this),8));v.setSingleLine(true);if(digits)v.setInputType(android.text.InputType.TYPE_CLASS_PHONE);LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(8);v.setMinimumHeight(dp(48));box.addView(v,p);return v;}
    private interface Result{void receive(Object value)throws Exception;}
    private void load(String path,String method,JSONObject body,boolean auth,Result result){
        if(path.matches("/public/series(?:/\\d+/detail)?")||path.equals("/member/authorized-series"))courseAccessVisible=true;
        if(auth&&!api.loggedIn()){info("登录后查看个人学习和服务记录");action("手机号登录",()->open(this::login));return;}
        int version=generation;pendingLoads++; ProgressBar busy=new ProgressBar(this);content.addView(busy);
        io.execute(()->{Object value=null;Exception failure=null;try{value=withCourseAccess(path,api.request(path,method,body,auth));}catch(Exception e){failure=e;}
            final Object data=value;final Exception error=failure;
            runOnUiThread(()->{if(isFinishing()||version!=generation)return;content.removeView(busy);pendingLoads=Math.max(0,pendingLoads-1);if(pendingLoads==0&&refreshLayout!=null)refreshLayout.setRefreshing(false);
                if(error!=null){info(error.getMessage());if(error instanceof Api.Failure && ((Api.Failure)error).status==401)action("重新登录",()->open(this::login));else action("重试",()->load(path,method,body,auth,result));return;}
                try{result.receive(data);}catch(Exception e){info("数据暂不可用，请刷新页面");}
            });});
    }
    private static JSONObject object(Object v){return v instanceof JSONObject?(JSONObject)v:new JSONObject();}
    private static JSONArray array(Object v){return v instanceof JSONArray?(JSONArray)v:new JSONArray();}
    private static String first(JSONObject v,String... keys){for(String k:keys){String s=v.optString(k,"");if(!s.isEmpty()&&!s.equals("null"))return s;}return "";}
    private static JSONObject body(Object... values){JSONObject v=new JSONObject();try{for(int i=0;i<values.length;i+=2)v.put((String)values[i],values[i+1]);}catch(Exception ignored){}return v;}
    private void confirm(String message,Runnable send){new AlertDialog.Builder(this).setMessage(message).setNegativeButton("取消",null).setPositiveButton("确认",(d,w)->send.run()).show();}
    private void card(LinearLayout box,String name,String summary,Runnable tap){LinearLayout item=column();item.setPadding(0,dp(6),0,dp(6));item.setBackground(SwodUi.row(this));TextView heading=text(name,17);heading.setTypeface(null,android.graphics.Typeface.BOLD);item.addView(heading);if(!summary.trim().isEmpty()){TextView detail=text(summary,14);detail.setTextColor(SwodUi.muted(this));item.addView(detail);}LinearLayout.LayoutParams p=new LinearLayout.LayoutParams(-1,-2);p.bottomMargin=dp(4);box.addView(item,p);if(tap!=null){item.setContentDescription(name+"，"+summary+"，查看详情");item.setMinimumHeight(dp(64));item.setFocusable(true);item.setOnClickListener(v->tap.run());}}
    private boolean courseAccessVisible,needsCourseRefresh;
    @Override protected void onPause(){foreground=false;courseEntryRequest++;courseEntryBusy=false;messageHandler.removeCallbacks(messagePoll);needsCourseRefresh=true;super.onPause();}
    private String pendingCourseOrder="";
    private int pendingCourseId=0;
    @Override protected void onResume(){super.onResume();foreground=true;messageHandler.removeCallbacks(messagePoll);messageHandler.post(messagePoll);boolean refresh=needsCourseRefresh;needsCourseRefresh=false;if(refresh&&courseAccessVisible&&page!=null)page.run();if(api==null||pendingCourseOrder.isEmpty()||!api.loggedIn())return;String id=pendingCourseOrder;int courseId=pendingCourseId,version=generation;io.execute(()->{try{JSONObject result=object(api.request("/shop/orders/"+Uri.encode(id)+"/refresh","POST",body(),true));String state=object(result.opt("order")).optString("status");runOnUiThread(()->{if(version==generation&&!isFinishing()&&(state.equals("paid")||state.equals("completed"))){pendingCourseOrder="";open(()->schedule(courseId));}});}catch(Exception ignored){}});}
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
    private String coursePrice(JSONObject row){if("online".equals(row.optString("course_access_scope"))&&row.optBoolean("learning_unlocked"))return "✓ 已解锁";if("online".equals(row.optString("course_access_scope"))&&!row.optBoolean("course_access_known",true))return "学习权益暂无法确认，请重试";String result=CoursePolicy.price(row.optDouble("price",0),row.optDouble("promo_price",0),!row.has("period_status")&&(row.optBoolean("is_free")||row.optInt("is_free")==1));if(CoursePolicy.discount(row.optDouble("price",0),row.optDouble("promo_price",0),row.optBoolean("is_free")||row.optInt("is_free")==1))result+=" · 原价 ¥"+String.format(Locale.ROOT,"%.2f",row.optDouble("price"));return result;}
    // Same configured display count as the mini-program; never label it concurrent viewers.
    private String learnerText(JSONObject r){
        double base=r.optDouble("student_display_base",Double.NaN),students=r.optDouble("total_students",Double.NaN);
        if(!Double.isFinite(base)||base<500||base>1000||base!=Math.floor(base)||!Double.isFinite(students)||students<0||students!=Math.floor(students)||students>Long.MAX_VALUE-1000d)return "";
        return ((long)(base+students))+"名学员";
    }
    private String publicSummary(JSONObject r){String detail="online".equals(r.optString("course_access_scope"))?first(r,"teacher","category"):first(r,"subtitle","teacher","groupName","category","venue","location");if(r.has("total_courses"))detail+=" · "+r.optInt("total_courses")+" 节课程";if("online".equals(r.optString("course_access_scope"))&&!learnerText(r).isEmpty())detail+=" · "+learnerText(r);if(r.has("price"))detail+="\n"+coursePrice(r);if(r.has("start_date")&&!r.has("registrationStatus"))detail+=" · "+first(r,"start_date")+" · 期次课时";return detail;}
    private void dismissKeyboard(){View focus=getCurrentFocus();if(focus!=null){((android.view.inputmethod.InputMethodManager)getSystemService(INPUT_METHOD_SERVICE)).hideSoftInputFromWindow(focus.getWindowToken(),0);focus.clearFocus();}}
    private interface RowTap{void tap(JSONObject row);}
    private void searchable(JSONArray rows,String[] fields,RowTap tap){
        boolean online=java.util.Arrays.asList(fields).contains("category");
        android.content.res.Configuration configuration = getResources().getConfiguration();
        boolean twoColumns = online && configuration.screenWidthDp >= 840 && configuration.fontScale <= 1.2f;
        SearchView search=new SearchView(this);search.setIconifiedByDefault(false);search.setQueryHint(online?"搜索课程、老师或分类":"搜索名称、老师或组别");search.setMaxWidth(Integer.MAX_VALUE);search.setMinimumHeight(dp(48));search.setBackground(SwodUi.shape(this,SwodUi.field(this),8));content.addView(search);
        if(online)search.setQuery(courseKeyword,false);
        java.util.ArrayList<String> categories=new java.util.ArrayList<>();categories.add("全部分类");
        for(int i=0;i<rows.length();i++){String c=rows.optJSONObject(i).optString("category");if(!c.isEmpty()&&!categories.contains(c))categories.add(c);}
        Spinner scope=new Spinner(this),category=new Spinner(this);
        if(online){LinearLayout filters=row();scope.setContentDescription("课程范围");category.setContentDescription("课程分类");scope.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,new String[]{"全部课程","已解锁"}));category.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,categories));scope.setSelection(onlyUnlocked&&api.loggedIn()?1:0);category.setSelection(Math.max(0,categories.indexOf(courseCategory)));filters.addView(scope,new LinearLayout.LayoutParams(0,dp(48),1));if(categories.size()>1)filters.addView(category,new LinearLayout.LayoutParams(0,dp(48),1));content.addView(filters);}
        TextView countLabel=text("",12);countLabel.setTextColor(SwodUi.muted(this));content.addView(countLabel);LinearLayout results=column();content.addView(results);int pageVersion=generation;long account=api.accountGeneration();
        Runnable render=()->{if(pageVersion!=generation||account!=api.accountGeneration())return;results.removeAllViews();String query=search.getQuery().toString().trim().toLowerCase(Locale.ROOT);int count=0;boolean rightsUnknown=false;
            LinearLayout gridRow = null;
            for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r==null)continue;String all="";for(String f:fields)all+=r.optString(f)+" ";boolean match=true;for(String part:query.split("\\s+"))if(!all.toLowerCase(Locale.ROOT).contains(part))match=false;
                if(online&&!courseCategory.isEmpty()&&!r.optString("category").equals(courseCategory))match=false;
                if(online&&onlyUnlocked){if(!r.optBoolean("course_access_known",true))rightsUnknown=true;if(!api.loggedIn()||!r.optBoolean("course_access_known",true)||!r.optBoolean("learning_unlocked"))match=false;}
                if (!match) continue;
                LinearLayout parent = results;
                if (twoColumns) {
                    if (count % 2 == 0) {
                        gridRow = row();
                        gridRow.setWeightSum(2);
                        results.addView(gridRow, new LinearLayout.LayoutParams(-1, -2));
                    }
                    parent = column();
                    LinearLayout.LayoutParams cell = new LinearLayout.LayoutParams(0, -2, 1);
                    if (count % 2 == 0) cell.setMarginEnd(dp(16));
                    gridRow.addView(parent, cell);
                }
                if(r.has("offline_period_count")){offlineCourseCard(parent,r,()->tap.tap(r));count++;continue;}
                int before = parent.getChildCount();
                card(parent, first(r, "name", "series_name", "course_name", "competitionName"), publicSummary(r), () -> tap.tap(r));
                LinearLayout item = (LinearLayout) parent.getChildAt(before);
                if ("online".equals(r.optString("course_access_scope")) && r.optBoolean("learning_unlocked")) unlockedBadge(item, 14);
                String artwork = first(r, "cover_image", "image");
                if (!artwork.isEmpty()) cover(item, artwork, false);
                count++;
            }
            countLabel.setText(count+" 条结果");
            if(count==0){results.addView(text(rightsUnknown?"学习权益暂无法确认，请重试":"暂无匹配记录",14));if(rightsUnknown)results.addView(button("重新查询学习权益",()->{if(page!=null)page.run();}));else results.addView(button("清除搜索与筛选",()->{courseCategory="";onlyUnlocked=false;search.setQuery("",false);category.setSelection(0);scope.setSelection(0);}));}
        };
        android.os.Handler ui=new android.os.Handler(android.os.Looper.getMainLooper());
        search.setOnQueryTextListener(new SearchView.OnQueryTextListener(){public boolean onQueryTextSubmit(String query){dismissKeyboard();render.run();return true;}public boolean onQueryTextChange(String query){if(online)courseKeyword=query;ui.removeCallbacks(render);ui.postDelayed(render,120);return true;}});
        if(online){scope.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int index,long id){if(index==1&&!api.loggedIn()){scope.setSelection(0);open(MainActivity.this::login);return;}onlyUnlocked=index==1;dismissKeyboard();render.run();}});category.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int index,long id){courseCategory=index==0?"":categories.get(index);dismissKeyboard();render.run();}});}
        render.run();
    }
    private void cover(LinearLayout box,String source,boolean goods){cover(box,source,goods,false);}
    private void cover(LinearLayout box,String source,boolean goods,boolean offline){
        String url=source.startsWith("/")?(goods?"https://www.swod.com.cn":"https://admin.swod.com.cn")+source:source;
        boolean validCover=Policy.secureURL(url);if(!validCover&&goods)return;
        ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER);image.setImageDrawable(SwodUi.icon(this,goods?"bag":"learn",red));image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);image.setBackground(SwodUi.shape(this,SwodUi.tonal(this),12));image.setClipToOutline(true);
        if(!goods&&box!=content){LinearLayout details=column();while(box.getChildCount()>0){View child=box.getChildAt(0);box.removeViewAt(0);details.addView(child);}box.setOrientation(LinearLayout.HORIZONTAL);box.setGravity(Gravity.CENTER_VERTICAL);LinearLayout.LayoutParams picture=new LinearLayout.LayoutParams(dp(112),dp(84));picture.rightMargin=dp(12);box.addView(image,picture);
            details.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int height=offline?dp(95):Math.min(dp(160),Math.max(dp(84),b-t));if(image.getLayoutParams().height!=height){android.view.ViewGroup.LayoutParams params=image.getLayoutParams();params.height=height;image.setLayoutParams(params);}});box.addView(details,new LinearLayout.LayoutParams(0,-2,1));}
        else{int available=Math.max(1,getResources().getConfiguration().screenWidthDp-32);if(box!=content)available-=24;LinearLayout.LayoutParams picture=new LinearLayout.LayoutParams(-1,dp(goods?available:available*3/4));picture.bottomMargin=dp(12);box.addView(image,0,picture);image.addOnLayoutChangeListener((v,l,t,r,b,ol,ot,or,ob)->{int height=Math.round((r-l)*(goods?1f:0.75f));if(height>0&&image.getLayoutParams().height!=height){android.view.ViewGroup.LayoutParams params=image.getLayoutParams();params.height=height;image.setLayoutParams(params);}});}
        if(!validCover)return;int version=generation;imageIO.execute(()->{if(version!=generation)return;try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(!isFinishing()&&version==generation&&bitmap!=null){image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setImageBitmap(bitmap);image.setBackground(SwodUi.shape(this,android.graphics.Color.TRANSPARENT,8));}});}catch(Exception ignored){/* Keep a stable, non-deceptive cover placeholder. */}});
    }
    private void learningShortcuts(){LinearLayout shortcuts=row();boolean stacked=getResources().getConfiguration().fontScale>1.3f||getResources().getConfiguration().screenWidthDp<360;if(stacked)shortcuts.setOrientation(LinearLayout.VERTICAL);String[] labels={"我的课程","课时与核销","报名与成绩"};String[] icons={"learn","calendar","trophy"};Runnable[] targets={()->open(this::myCourses),()->open(this::schedule),()->open(this::myEvents)};for(int i=0;i<labels.length;i++){Button b=button(labels[i],targets[i]);b.setTextSize(14);b.setGravity(Gravity.CENTER);b.setPadding(dp(4),dp(6),dp(4),dp(6));b.setMinimumHeight(dp(52));b.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],red),null,null);b.setCompoundDrawablePadding(dp(8));b.setBackground(SwodUi.touch(this,android.graphics.Color.TRANSPARENT,0));LinearLayout.LayoutParams p=stacked?new LinearLayout.LayoutParams(-1,-2):new LinearLayout.LayoutParams(0,-2,1);if(i<2&&!stacked)p.rightMargin=dp(8);shortcuts.addView(b,p);}content.addView(shortcuts);}
    private void courses(){begin("线上学院");hero("伊娃东方舞","线上学院 · 从基础到进阶，找到适合你的课程");learningShortcuts();section("课程列表");load("/public/series","GET",null,false,v->{JSONArray rows=array(v);if(rows.length()>0&&!rows.getJSONObject(0).optBoolean("course_access_known",true))retryCourseAccess();searchable(rows,new String[]{"name","teacher","category"},r->{if(r.optBoolean("learning_unlocked"))studyCourse(r.optInt("id"),r.optString("name"));else open(()->course(r));});action("东方舞圈 · 官网资讯",()->open(this::website));});}
    private void myCourses(){
        begin("我的课程");
        LinearLayout courseRows=column();content.addView(courseRows);
        load("/member/authorized-series","GET",null,true,value->{
            if(!(value instanceof JSONArray))throw new Exception();
            JSONArray owned=(JSONArray)value;
            renderAccountCourses(courseRows,owned,new JSONArray());
            loadOwnedCourseDetails(courseRows,owned);
        });
    }
    private void course(JSONObject r){begin(first(r,"name"));load("/public/series/"+r.optInt("id")+"/detail","GET",null,false,v->{JSONObject detail=object(v);hero(first(detail,"name"),first(detail,"subtitle","teacher"));cover(content,first(detail,"cover_image"),false);info(strip(first(detail,"rich_description","description")));info("共 "+detail.optInt("total_courses")+" 节课程");if(!learnerText(detail).isEmpty())info(learnerText(detail));if(detail.optBoolean("learning_unlocked"))unlockedBadge(content,16);else if(!detail.optBoolean("course_access_known",true))retryCourseAccess();else{info(coursePrice(detail));int seriesId=detail.optInt("id");if(seriesId>0)action("立即购买 · 前往官方支付",()->link("https://www.swod.com.cn/checkout/online/"+seriesId));}action(detail.optBoolean("learning_unlocked")?"立即学习":"查看课程目录",()->{if(detail.optBoolean("learning_unlocked"))studyCourse(detail.optInt("id"),detail.optString("name"));else open(()->catalog(detail.optInt("id"),detail.optString("name")));});action("客服与售后",()->open(this::support));});}
    private void support(){begin("客服与售后");hero("课程与订单客服","购买、学习权限及售后问题可直接联系课程顾问");info("海艳老师：153 6787 0529");info("伊琳老师：193 1002 9982");action("拨打海艳老师电话",()->dial("15367870529"));action("拨打伊琳老师电话",()->dial("19310029982"));action("查看微信客服二维码",()->link("https://www.swod.com.cn/contact"));}
    private void dial(String phone){try{startActivity(new Intent(Intent.ACTION_DIAL,Uri.parse("tel:"+phone)));}catch(Exception error){info("暂时无法打开拨号，请记录页面上的号码");}}
    private void website(){begin("东方舞圈与品牌服务");hero("东方舞圈","官网资讯、教学体系与品牌服务");String[] labels={"东方舞圈资讯","关于伊娃","品牌故事","传承弟子","出版著作","证书查询","联系与合作"};String[] paths={"/dance-circle","/about","/about/brand-story","/disciples","/about/publications","/certification","/contact"};for(int i=0;i<labels.length;i++){String url="https://www.swod.com.cn"+paths[i];action(labels[i],()->link(url));}}
    private java.util.List<JSONObject> courseLessons(JSONArray units)throws Exception{
        java.util.List<JSONObject> lessons=new java.util.ArrayList<>();
        for(int i=0;i<units.length();i++){JSONObject unit=units.getJSONObject(i);JSONArray videos=array(unit.opt("videos"));for(int j=0;j<videos.length();j++){JSONObject video=videos.getJSONObject(j);if(video.optInt("id")<=0)continue;lessons.add(body("id",video.optInt("id"),"name",first(video,"name").isEmpty()?unit.optString("name"):video.optString("name"),"subtitle",unit.optString("name"),"ordinal",lessons.size()+1,"duration",video.optDouble("duration",0)));}}
        return lessons;
    }
    private void studyCourse(int seriesId,String courseTitle){
        if(!api.loggedIn()){open(this::login);return;}
        if(courseEntryBusy)return;
        if(seriesId<=0){info("课程信息无效，请刷新后重试");return;}
        courseEntryBusy=true;final int request=++courseEntryRequest,version=generation;final long account=api.accountGeneration();
        ProgressBar spinner=new ProgressBar(this);content.addView(spinner);
        io.execute(()->{try{
            java.util.List<JSONObject> lessons=courseLessons(array(api.request("/public/series/"+seriesId+"/courses","GET",null,false)));
            if(account!=api.accountGeneration())throw new Api.Failure(401,"账号已切换，请重新打开课程");
            JSONArray records=array(api.request("/public/series/"+seriesId+"/progress","GET",null,true));
            int[] ids=new int[lessons.size()],recordIds=new int[records.length()];String[] times=new String[records.length()];
            java.util.Map<Integer,JSONObject> progress=new java.util.HashMap<>();
            for(int i=0;i<lessons.size();i++)ids[i]=lessons.get(i).optInt("id");
            for(int i=0;i<records.length();i++){JSONObject record=records.getJSONObject(i);recordIds[i]=record.optInt("video_id");times[i]=record.optString("last_play_at","");progress.put(recordIds[i],record);}
            int selected=CoursePolicy.startingLesson(ids,recordIds,times);
            JSONObject lesson=null;for(JSONObject row:lessons)if(row.optInt("id")==selected)lesson=row;
            if(lesson==null)throw new Exception("暂无可学习课节，请稍后重试");
            final JSONObject target=lesson;
            runOnUiThread(()->{content.removeView(spinner);if(request!=courseEntryRequest)return;courseEntryBusy=false;if(version!=generation||account!=api.accountGeneration()||!foreground||isFinishing()||isDestroyed())return;playPlaylist(selected,target.optString("name"),lessons,seriesId,courseTitle,progress,true);});
        }catch(Exception error){runOnUiThread(()->{content.removeView(spinner);if(request!=courseEntryRequest)return;courseEntryBusy=false;if(version!=generation||account!=api.accountGeneration()||!foreground||isFinishing())return;new AlertDialog.Builder(this).setTitle("课程暂时无法打开").setMessage(error.getMessage()).setNegativeButton("返回",null).setPositiveButton("重试",(d,w)->studyCourse(seriesId,courseTitle)).show();});}});
    }
    private void catalog(int id,String name){
        begin(name);load("/public/series/"+id+"/courses","GET",null,false,v->{
            java.util.List<JSONObject> lessons=courseLessons(array(v));
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
    private void offlineCourseCard(LinearLayout parent,JSONObject course,Runnable tap){
        int before=parent.getChildCount();String latest=course.optString("offline_latest_period");
        card(parent,first(course,"name"),(first(course,"teacher").isEmpty()?"伊娃东方舞导师":first(course,"teacher"))+"\n"+(latest.equals("期次待公布")?"期次安排待公布":"最新期次："+latest)+"\n"+course.optInt("offline_student_count")+" 位已报名学员",tap);
        LinearLayout item=(LinearLayout)parent.getChildAt(before);
        View line=new View(this);line.setBackgroundColor(SwodUi.line(this));LinearLayout.LayoutParams rule=new LinearLayout.LayoutParams(-1,dp(1));rule.setMargins(0,dp(8),0,dp(8));item.addView(line,rule);
        LinearLayout footer=row();TextView periods=text(course.optInt("offline_period_count")+" 个期次",14);periods.setTextColor(SwodUi.muted(this));footer.addView(periods,new LinearLayout.LayoutParams(0,-2,1));TextView price=text(OfflineCatalog.price(course),14);price.setTextColor(SwodUi.primary(this));footer.addView(price);item.addView(footer);cover(item,first(course,"cover_image"),false,true);
    }
    private void offline(){begin("线下课程");hero("线下课","购买课程期次的课时，到课后核销扣减，无需预约。");action("期次课时与核销",()->open(this::schedule));load("/public/offline-courses","GET",null,false,v->{
        JSONArray all=array(v),groups=OfflineCatalog.grouped(all);
        LinearLayout switches=row();Button list=button("课程列表",()->{}),calendar=button("课程日历",()->{});switches.addView(list,new LinearLayout.LayoutParams(0,-2,1));switches.addView(calendar,new LinearLayout.LayoutParams(0,-2,1));content.addView(switches);
        LinearLayout container=column();content.addView(container);LinearLayout outer=content;
        Runnable showList=()->{container.removeAllViews();content=container;searchable(groups,new String[]{"offline_search_text"},r->open(()->offlineDetail(r,all)));content=outer;list.setSelected(true);calendar.setSelected(false);};
        list.setOnClickListener(view->showList.run());calendar.setOnClickListener(view->{container.removeAllViews();container.addView(new OfflineMonthCalendar(this,all,r->open(()->offlineDetail(r,all))));list.setSelected(false);calendar.setSelected(true);});showList.run();
    });}
    private void offlineDetail(JSONObject course,JSONArray all){begin(first(course,"name"));CourseContent copy=new CourseContent(this);hero(first(course,"name"),first(course,"teacher"));cover(content,first(course,"cover_image"),false);section("课程介绍");info(copy.description(course));JSONObject intro=copy.intro(course);JSONArray outline=array(intro.opt("outline"));if(outline.length()==0)outline=array(course.opt("outline"));if(outline.length()>0)section("课程大纲");for(int i=0;i<outline.length();i++)info((i+1)+". "+outline.optString(i));section("课程期次");for(JSONObject period:OfflineCatalog.periods(all,course)){card(content,first(period,"subtitle","start_date"),first(period,"start_date")+" — "+first(period,"end_date")+"\n"+first(period,"location")+" · "+period.optInt("total_courses")+" 课时 · "+coursePrice(period)+"\n已报名 "+period.optInt("total_students")+" 人（匿名）",null);if(CourseContent.canBuy(period))action("购买本期课时",()->open(()->courseCheckout(period.optInt("source_id"))));else info("本期暂不可购买，请查看期次安排或咨询课程顾问");action("查看本期课时",()->open(()->schedule(period.optInt("source_id"))));}}
    private void courseCheckout(int courseId){begin("确认课程订单");load("/shop/courses/offline/"+courseId,"GET",null,true,v->{JSONObject quote=object(v),offer=object(quote.opt("offer")),payment=object(quote.opt("payment"));hero(offer.optString("name"),offer.optString("period"));info("购买课时："+offer.optInt("sessions")+" 课时 · ¥"+Commerce.money(offer.optLong("priceFen")));info("付款后自动开通本期课时，到课后核销扣减，无需预约。");String key=java.util.UUID.randomUUID().toString();for(String provider:new String[]{"alipay","wechat"})if(payment.optBoolean(provider)){String channel=provider;action(provider.equals("alipay")?"支付宝支付":"微信支付",()->{if(memberWriteBusy)return;memberWriteBusy=true;int version=generation;io.execute(()->{try{JSONObject created=object(api.request("/shop/orders","POST",body("kind","offline","targetId",courseId,"provider",channel,"expectedTotalFen",offer.optLong("priceFen"),"requestKey",key+channel),true));String orderId=object(created.opt("order")).optString("id");JSONObject pay=object(api.request("/shop/orders/"+Uri.encode(orderId)+"/pay","POST",body(),true));runOnUiThread(()->{memberWriteBusy=false;if(version!=generation||isFinishing())return;if("redirect".equals(pay.optString("kind"))&&CoursePolicy.paymentURL(pay.optString("url"))){pendingCourseOrder=orderId;pendingCourseId=courseId;link(pay.optString("url"));}else info("当前支付通道暂不可用");action("同步付款结果并查看课时",()->load("/shop/orders/"+Uri.encode(orderId)+"/refresh","POST",body(),true,result->{String state=object(object(result).opt("order")).optString("status");if(state.equals("paid")||state.equals("completed"))open(()->schedule(courseId));else info("支付结果待确认，可在我的订单继续付款");}));action("查看订单",()->open(()->order(orderId)));});}catch(Exception error){runOnUiThread(()->{memberWriteBusy=false;if(version==generation)info(error.getMessage());});}});});}if(!payment.optBoolean("alipay")&&!payment.optBoolean("wechat"))info("App 支付暂未开放");action("我的订单／继续处理",()->open(this::orders));});}
    private void schedule(){schedule(0);}
    private void schedule(int courseId){begin("期次课时与核销");load("/offline/overview"+(courseId>0?"?course_ids="+courseId:""),"GET",null,true,v->{JSONObject o=object(v);info("购买课程期次的课时，到课后核销扣减，无需预约。");JSONArray es=array(o.opt("entitlements"));for(int i=0;i<es.length();i++){JSONObject r=es.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("course_period")+" · 剩余 "+r.optInt("available_sessions")+" 课时 · 已核销 "+r.optInt("used_sessions")+" 课时");}info("核销记录");JSONArray records=array(o.opt("consumes"));for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);info(r.optString("course_name")+" · "+r.optString("consume_date")+" · 核销 "+r.optInt("count")+" 课时");}});}
    private void booking(JSONObject r){open(this::schedule);}
    private TextView eventMetric(String value,String label,boolean hero){
        TextView cell=text(value+"\n"+label,hero?16:12);cell.setGravity(Gravity.CENTER);cell.setTextColor(hero?(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE):red);cell.setTypeface(null,android.graphics.Typeface.BOLD);return cell;
    }
    private void events(){
        begin("赛事");
        LinearLayout overview=column();overview.setPadding(0,dp(8),0,dp(8));overview.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        
        TextView heading=text("AiwaRaks赛事平台",22);heading.setTypeface(null,android.graphics.Typeface.BOLD);heading.setTextColor(SwodUi.ink(this));overview.addView(heading);
        LinearLayout totals=row();TextView total=eventMetric("—","赛事总数",false),people=eventMetric("—","累计参赛",false),records=eventMetric("—","记录数据",false);
        totals.addView(total,new LinearLayout.LayoutParams(0,-2,1));totals.addView(people,new LinearLayout.LayoutParams(0,-2,1));totals.addView(records,new LinearLayout.LayoutParams(0,-2,1));overview.addView(totals);
        content.addView(overview);
        LinearLayout eventActions=row();Button mine=button("",()->open(this::myEvents));mine.setCompoundDrawablesWithIntrinsicBounds(SwodUi.icon(this,"person",red),null,null,null);mine.setContentDescription("我的比赛");eventActions.addView(mine,new LinearLayout.LayoutParams(dp(48),dp(48)));

        EditText search=field(content,"搜索赛事或地点",false);content.removeView(search);
        LinearLayout searchRow=row();searchRow.addView(search,new LinearLayout.LayoutParams(0,-2,1));searchRow.addView(eventActions);content.addView(searchRow,0);
        LinearLayout grid=column();content.addView(grid);
        load("/events","GET",null,false,v->{
            JSONArray rows=array(v);total.setText(rows.length()+"\n赛事总数");people.setText(EventPresentation.aggregate(rows,true)+"\n累计参赛");records.setText(EventPresentation.aggregate(rows,false)+"\n记录数据");
            Runnable render=()->{
                grid.removeAllViews();LinearLayout line=null;int matches=0;
                boolean single=getResources().getConfiguration().screenWidthDp<720||getResources().getConfiguration().fontScale>1.4f;
                String query=search.getText().toString().trim().toLowerCase(Locale.ROOT);
                for(int i=0;i<rows.length();i++){
                    JSONObject event=rows.optJSONObject(i);if(event==null)continue;
                    String location=EventPresentation.value(event,"location","city","venue");
                    if(!(event.optString("name")+" "+location).toLowerCase(Locale.ROOT).contains(query))continue;
                    if(single||matches%2==0){line=row();line.setGravity(Gravity.TOP);LinearLayout.LayoutParams rowLayout=new LinearLayout.LayoutParams(-1,-2);rowLayout.bottomMargin=dp(12);grid.addView(line,rowLayout);}
                    LinearLayout card=column();card.setBackgroundColor(android.graphics.Color.TRANSPARENT);
                    LinearLayout.LayoutParams cardLayout=new LinearLayout.LayoutParams(single?-1:0,-2,single?0:1);if(!single&&matches%2==0)cardLayout.rightMargin=dp(10);line.addView(card,cardLayout);
                    String state=EventPresentation.state(event);boolean open=state.equals("报名中");
                    android.widget.FrameLayout artwork=new android.widget.FrameLayout(this);artwork.setBackgroundColor(SwodUi.tonal(this));
                    int width=(getResources().getConfiguration().screenWidthDp-42)/(single?1:2);card.addView(artwork,new LinearLayout.LayoutParams(-1,dp(Math.min(230,Math.round(width*0.47f)))));
                    ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER);image.setImageDrawable(SwodUi.icon(this,"trophy",red));image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);artwork.addView(image,new android.widget.FrameLayout.LayoutParams(-1,-1));
                    String raw=EventPresentation.value(event,"coverUrl","cover_url"),url=raw.startsWith("/")?"https://admin.swod.com.cn"+raw:raw;
                    int version=generation;
                    if(Policy.secureURL(url))imageIO.execute(()->{try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(version==generation&&!isFinishing()&&bitmap!=null){image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setImageBitmap(bitmap);artwork.setBackgroundColor(android.graphics.Color.TRANSPARENT);}});}catch(Exception ignored){}});
                    TextView badge=text(state,11);badge.setTextColor(open?(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE):SwodUi.ink(this));badge.setBackground(SwodUi.shape(this,open?red:SwodUi.surface(this),16));android.widget.FrameLayout.LayoutParams badgeLayout=new android.widget.FrameLayout.LayoutParams(-2,-2);badgeLayout.setMargins(dp(6),dp(6),dp(6),dp(6));artwork.addView(badge,badgeLayout);
                    LinearLayout body=column();body.setPadding(0,dp(8),0,dp(8));card.addView(body);
                    TextView name=text(event.optString("name"),18);name.setTypeface(null,android.graphics.Typeface.BOLD);body.addView(name);
                    TextView date=text(EventPresentation.dates(event)+"\n"+(location.isEmpty()?"地点待定":location),14);date.setTextColor(SwodUi.muted(this));body.addView(date);
                    LinearLayout counts=row();String[] keys={"groupCount","playerCount","judgeCount"},labels={"组别","选手","评委"};
                    for(int j=0;j<keys.length;j++){Long count=EventPresentation.count(event,keys[j]);counts.addView(eventMetric(count==null?"未公开":Long.toString(count),labels[j],false),new LinearLayout.LayoutParams(0,-2,1));}body.addView(counts);
                    Button entry=loginAction(open?"点击报名 ›":"查看详情 ›",()->{if(open)open(()->register(event.optInt("id"),new JSONObject()));else open(()->event(event.optInt("id")));});body.addView(entry,new LinearLayout.LayoutParams(-1,-2));
                    card.setOnClickListener(view->open(()->event(event.optInt("id"))));matches++;
                }
                if(!single&&matches%2==1&&line!=null)line.addView(new View(this),new LinearLayout.LayoutParams(0,1,1));
                if(matches==0)grid.addView(text(query.isEmpty()?"暂无公开赛事":"未找到匹配赛事，请更换名称或地点",14));
            };
            search.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int d){}public void onTextChanged(CharSequence v,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});
            render.run();
        });
    }
    private void judgeWorkspace(int eventId,int groupId,int playerId){
        begin("评委工作台");title.setText("评委工作台");pageScroll.setBackgroundColor(eventCanvas());
        if(!api.loggedIn()){info("请使用获授权评委的学习账号登录");action("手机号登录",()->open(this::login));return;}
        String path="/events/"+eventId+"/judge"+(groupId>0?"?groupId="+groupId:"")+(playerId>0?"&playerId="+playerId:"");
        load(path,"GET",null,true,value->{
            JSONObject data=object(value),group=object(data.opt("group"));
            hero(object(data.opt("competition")).optString("name"),"评委："+object(data.opt("judge")).optString("name"));
            if(groupId>0)info(group.optString("name"));
            if(playerId==0){
                JSONArray rows=array(data.opt(groupId==0?"groups":"players"));
                for(int i=0;i<rows.length();i++){JSONObject r=rows.optJSONObject(i);if(r!=null)r.put("subtitle",groupId==0?"已评分 "+r.optInt("scored_count")+" / "+r.optInt("player_count"):(r.isNull("my_score")?"未评分":"本人评分 "+r.optString("my_score")));}
                eventRows(eventSurface(content,groupId==0?"获授权的评分组别":"选手与本人评分"),rows,"assignments","暂无可评分记录",r->open(()->judgeWorkspace(eventId,groupId==0?r.optInt("id"):groupId,groupId==0?0:r.optInt("id"))));
                if(rows.length()==0)info("暂无可评分记录");return;
            }
            JSONObject player=object(data.opt("player")),current=object(data.opt("currentScore")),existing=object(current.opt("values"));
            section("选手："+player.optString("name"));info(player.optString("performance_title"));
            boolean locked="locked".equals(group.optString("scoring_status"));if(locked)info("该组别评分已锁定，只能查看");
            if(current.optBoolean("needsRescore"))info("评分规则已变化，请按当前规则重新评分");
            JSONArray criteria=array(data.opt("criteria"));java.util.ArrayList<EditText> fields=new java.util.ArrayList<>();
            for(int i=0;i<criteria.length();i++){JSONObject c=criteria.getJSONObject(i);EditText input=registrationField(content,c.optString("name")+"（0–"+c.optString("maxScore")+"分）","请输入分数");input.setInputType(android.text.InputType.TYPE_CLASS_NUMBER|android.text.InputType.TYPE_NUMBER_FLAG_DECIMAL);input.setEnabled(!locked);if(existing.has(c.optString("key"))&&!existing.isNull(c.optString("key")))input.setText(existing.optString(c.optString("key")));fields.add(input);}
            if(!locked)action(current.optString("status").isEmpty()?"提交评分":"修改本人评分",()->{
                if(memberWriteBusy||criteria.length()==0)return;JSONObject scores=body();double total=0;
                for(int i=0;i<criteria.length();i++){JSONObject c=criteria.optJSONObject(i);try{double n=Double.parseDouble(fields.get(i).getText().toString().trim());if(!Double.isFinite(n)||n<0||n>c.optDouble("maxScore"))throw new Exception();scores.put(c.optString("key"),n);total+=n;}catch(Exception e){info("请填写 "+c.optString("name")+"（0–"+c.optString("maxScore")+"分）");return;}}
                long account=api.accountGeneration();int pageVersion=generation;
                confirm("确认提交 "+player.optString("name")+" 的本人评分？合计 "+String.format(java.util.Locale.ROOT,"%.2f",total)+" 分",()->{
                    if(memberWriteBusy||account!=api.accountGeneration()||pageVersion!=generation)return;memberWriteBusy=true;
                    io.execute(()->{try{if(account!=api.accountGeneration())throw new Exception("账号已变化，请重新加载");api.request(path,"POST",body("scores",scores),true);runOnUiThread(()->{memberWriteBusy=false;if(pageVersion==generation&&account==api.accountGeneration()&&!isFinishing())judgeWorkspace(eventId,groupId,playerId);});}catch(Exception e){runOnUiThread(()->{memberWriteBusy=false;if(pageVersion==generation&&account==api.accountGeneration()&&!isFinishing())info(e.getMessage());});}});
                });
            });
        });
    }
    private int eventCanvas(){return android.graphics.Color.parseColor(SwodUi.dark(this)?"#141619":"#F8F3EA");}
    private LinearLayout eventSurface(LinearLayout parent,String heading){LinearLayout box=column();box.setPadding(dp(14),dp(14),dp(14),dp(14));box.setBackground(SwodUi.shape(this,SwodUi.surface(this),14));LinearLayout.LayoutParams params=new LinearLayout.LayoutParams(-1,-2);params.topMargin=dp(12);parent.addView(box,params);if(!heading.isEmpty()){TextView label=text(heading,20);label.setTypeface(null,android.graphics.Typeface.BOLD);box.addView(label);}return box;}
    private void eventInfo(LinearLayout parent,String label,String value){LinearLayout line=row();TextView key=text(label,14);key.setTextColor(SwodUi.muted(this));line.addView(key,new LinearLayout.LayoutParams(0,-2,1));TextView result=text(value,14);result.setGravity(Gravity.END);line.addView(result,new LinearLayout.LayoutParams(0,-2,1));parent.addView(line);View rule=new View(this);rule.setBackgroundColor(registrationLine());parent.addView(rule,new LinearLayout.LayoutParams(-1,dp(1)));}
    private String publicScore(Object value){if(value==null||value==JSONObject.NULL||String.valueOf(value).isEmpty())return "—";try{double n=Double.parseDouble(String.valueOf(value));return Double.isFinite(n)?String.format(Locale.ROOT,"%.3f",n).replaceAll("\\.?0+$",""):"—";}catch(Exception ignored){return "—";}}
    private String publicRank(JSONObject row){int rank=row.optInt("rankNo");return rank==1?"冠军":rank==2?"亚军":rank==3?"季军":rank>0?"第"+rank+"名":"成绩待公示";}
    private ImageView eventAvatar(JSONObject row){ImageView image=new ImageView(this);image.setScaleType(ImageView.ScaleType.CENTER_CROP);image.setImageDrawable(SwodUi.icon(this,"person",red));image.setBackground(SwodUi.shape(this,SwodUi.tonal(this),24));image.setClipToOutline(true);String url=first(row,"avatarUrl");int version=generation;if(Policy.secureURL(url))imageIO.execute(()->{try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(version==generation&&!isFinishing()&&bitmap!=null)image.setImageBitmap(bitmap);});}catch(Exception ignored){}});image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);return image;}
    private void eventHero(JSONObject event){
        int width=getResources().getConfiguration().screenWidthDp-(getResources().getConfiguration().screenWidthDp>=600?104:0)-32;
        android.widget.FrameLayout hero=new android.widget.FrameLayout(this);hero.setBackgroundColor(android.graphics.Color.parseColor("#1A1A1A"));content.addView(hero,new LinearLayout.LayoutParams(-1,dp(Math.min(500,Math.round(width*0.75f)))));
        ImageView cover=new ImageView(this);cover.setScaleType(ImageView.ScaleType.CENTER_CROP);hero.addView(cover,new android.widget.FrameLayout.LayoutParams(-1,-1));String url=first(event,"coverUrl","cover_url");int version=generation;if(Policy.secureURL(url))imageIO.execute(()->{try{android.graphics.Bitmap image=Images.read(url);runOnUiThread(()->{if(version==generation&&!isFinishing()&&image!=null)cover.setImageBitmap(image);});}catch(Exception ignored){}});
        View shade=new View(this);shade.setBackground(new android.graphics.drawable.GradientDrawable(android.graphics.drawable.GradientDrawable.Orientation.TOP_BOTTOM,new int[]{0x10000000,0xEE000000}));hero.addView(shade,new android.widget.FrameLayout.LayoutParams(-1,-1));
        LinearLayout words=column();words.setPadding(dp(16),dp(12),dp(16),dp(16));TextView code=text(first(event,"code"),12);code.setTextColor(android.graphics.Color.parseColor("#C8A96E"));words.addView(code);TextView name=text(first(event,"name"),23);name.setTextColor(android.graphics.Color.WHITE);name.setTypeface(null,android.graphics.Typeface.BOLD);words.addView(name);TextView date=text(EventPresentation.dates(event)+" · "+(first(event,"location","venue","city").isEmpty()?"地点待定":first(event,"location","venue","city")),14);date.setTextColor(android.graphics.Color.LTGRAY);words.addView(date);android.widget.FrameLayout.LayoutParams position=new android.widget.FrameLayout.LayoutParams(-1,-2,Gravity.BOTTOM);hero.addView(words,position);
    }
    private void event(int id){begin("赛事详情");pageScroll.setBackgroundColor(eventCanvas());load("/events/"+id,"GET",null,false,value->renderEventDetail(id,object(value),0));}
    private void renderEventDetail(int id,JSONObject data,int panel){
        content.removeAllViews();JSONObject event=object(data.opt("competition"));title.setText(first(event,"name"));eventHero(event);Button judge=button("评委入口",()->open(()->judgeWorkspace(id,0,0)));registrationPrimary(judge);content.addView(judge);
        LinearLayout metrics=eventSurface(content,"");LinearLayout counts=row();String[] keys={"groupCount","approvedPlayerCount","judgeCount"},labels={"组别","选手","评委"},collections={"groups","players","judges"};for(int i=0;i<3;i++){Long n=EventPresentation.count(event,keys[i]);String number=i==1&&!event.optBoolean("registrationPublic")?"—":n==null?String.valueOf(array(data.opt(collections[i])).length()):n.toString();counts.addView(eventMetric(number,labels[i],false),new LinearLayout.LayoutParams(0,-2,1));}metrics.addView(counts);
        HorizontalScrollView strip=new HorizontalScrollView(this);strip.setHorizontalScrollBarEnabled(false);LinearLayout tabs=row();String[] panels={"赛事","组别","选手","评委","成绩"};for(int i=0;i<panels.length;i++){final int index=i;Button tab=button(panels[i],()->renderEventDetail(id,data,index));tab.setBackground(SwodUi.touch(this,index==panel?red:SwodUi.surface(this),24));tab.setTextColor(index==panel?SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE:SwodUi.ink(this));LinearLayout.LayoutParams param=new LinearLayout.LayoutParams(-2,dp(48));param.rightMargin=dp(6);tabs.addView(tab,param);}strip.addView(tabs);content.addView(strip);
        if(panel==0){LinearLayout info=eventSurface(content,"赛事信息");eventInfo(info,"主办方",first(event,"organizer").isEmpty()?"伊娃东方舞":first(event,"organizer"));eventInfo(info,"比赛地点",first(event,"location","venue","city").isEmpty()?"地点待定":first(event,"location","venue","city"));eventInfo(info,"报名状态",EventPresentation.state(event));eventInfo(info,"报名费用",event.optDouble("registrationFee")>0?"¥"+event.optString("registrationFee"):"免费");info.addView(text(strip(first(event,"description")).isEmpty()?"赛事介绍正在完善中。":strip(first(event,"description")),15));JSONArray sessions=array(data.opt("sessions"));if(sessions.length()>0){LinearLayout schedule=eventSurface(content,"赛事日程");for(int i=0;i<sessions.length();i++){JSONObject session=sessions.optJSONObject(i);card(schedule,first(session,"name"),first(session,"startsAt")+" · "+first(session,"venue"),null);}}if(api.loggedIn())action("我的报名、音乐与缴费",()->open(this::myEvents));}
        else {JSONArray rows=array(data.opt(panel==1?"groups":panel==2?"players":panel==3?"judges":"rankings"));String empty=panel==1?"没有找到符合条件的组别":panel==2?(event.optBoolean("registrationPublic")?"暂无报名信息":"报名信息尚未公开"):panel==3?"评委阵容暂未公布":"成绩经统一平台审核发布后在这里公示";eventRows(eventSurface(content,panels[panel]),rows,panel==1?"groups":panel==3?"judges":panel==4?"results":"players",empty,row->{if(panel==1)open(()->eventGroup(id,row.optInt("id")));else if(panel!=3)open(()->eventPlayer(id,row.optInt("groupId"),row.optInt("playerId",row.optInt("id"))));});}
        Button register=button("报名中".equals(EventPresentation.state(event))?"立即报名":EventPresentation.state(event),()->open(()->register(id,new JSONObject())));registrationPrimary(register);register.setEnabled("报名中".equals(EventPresentation.state(event)));content.addView(register);
    }
    private void eventRows(LinearLayout parent,JSONArray rows,String kind,String empty,RowTap tap){
        EditText query=registrationInput(parent,kind.equals("groups")?"搜索组别、舞种或年龄":kind.equals("judges")?"搜索评委":"搜索选手、编号或机构");LinearLayout results=column();parent.addView(results);int[] page={1};Runnable[] render={null};render[0]=()->{results.removeAllViews();java.util.List<JSONObject> matches=new java.util.ArrayList<>();String needle=query.getText().toString().trim().toLowerCase(Locale.ROOT);for(int i=0;i<rows.length();i++){JSONObject item=rows.optJSONObject(i);String corpus="";for(String field:new String[]{"name","playerName","groupName","category","ageRange","danceType","playerNo","organization","teacher","player_no","subtitle"})corpus+=item.optString(field)+" ";if(corpus.toLowerCase(Locale.ROOT).contains(needle))matches.add(item);}int pages=Math.max(1,(matches.size()+19)/20);page[0]=Math.min(page[0],pages);
            for(int i=(page[0]-1)*20;i<Math.min(page[0]*20,matches.size());i++){JSONObject item=matches.get(i);if(kind.equals("assignments")){card(results,first(item,"name"),first(item,"subtitle"),()->tap.tap(item));continue;}if(kind.equals("groups")){card(results,first(item,"name"),(item.isNull("playerCount")?"报名信息未公开":item.optInt("playerCount")+" 位选手")+" · "+(item.optInt("rankingCount")>0?item.optInt("rankingCount")+" 项成绩":"成绩待公布"),()->tap.tap(item));continue;}
                LinearLayout line=row();line.setPadding(0,dp(10),0,dp(10));line.addView(eventAvatar(item),new LinearLayout.LayoutParams(dp(44),dp(44)));LinearLayout body=column();body.setPadding(dp(10),0,dp(6),0);TextView name=text(first(item,"name","playerName"),16);name.setTypeface(null,android.graphics.Typeface.BOLD);body.addView(name);body.addView(text(kind.equals("judges")?first(item,"title")+" · "+first(item,"organization")+"\n"+strip(first(item,"bio")):first(item,"groupName")+" · "+first(item,"playerNo")+" · "+first(item,"organization","teacher"),13));line.addView(body,new LinearLayout.LayoutParams(0,-2,1));if(kind.equals("results")){TextView score=text("🏆 "+publicRank(item)+"\n"+publicScore(item.opt("publishedTotal"))+"\n最终得分",13);score.setGravity(Gravity.END);score.setTextColor(red);line.addView(score);}if(!kind.equals("judges")){line.setMinimumHeight(dp(64));line.setOnClickListener(view->tap.tap(item));line.setFocusable(true);}results.addView(line);View rule=new View(this);rule.setBackgroundColor(registrationLine());results.addView(rule,new LinearLayout.LayoutParams(-1,dp(1)));}
            if(matches.isEmpty())results.addView(text(query.getText().length()>0?"未找到匹配记录":empty,14));if(pages>1){LinearLayout pager=row();Button before=button("上一页",()->{page[0]--;render[0].run();});before.setEnabled(page[0]>1);pager.addView(before,new LinearLayout.LayoutParams(0,-2,1));pager.addView(text(page[0]+" / "+pages+" · "+matches.size()+" 条",12));Button next=button("下一页",()->{page[0]++;render[0].run();});next.setEnabled(page[0]<pages);pager.addView(next,new LinearLayout.LayoutParams(0,-2,1));results.addView(pager);}
        };query.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int f){}public void onTextChanged(CharSequence v,int a,int b,int c){page[0]=1;render[0].run();}public void afterTextChanged(Editable e){}});render[0].run();
    }
    private void eventGroup(int eventId,int groupId){begin("赛事组别");pageScroll.setBackgroundColor(eventCanvas());load("/events/"+eventId+"/groups/"+groupId,"GET",null,false,value->{JSONObject data=object(value),group=object(data.opt("group")),competition=object(data.opt("competition"));title.setText(first(group,"name"));LinearLayout header=eventSurface(content,first(group,"name"));header.addView(text(first(competition,"name"),14));header.addView(text(first(group,"category")+" · "+first(group,"ageRange")+" · "+first(group,"danceType")+" · "+first(group,"entryType"),14));eventInfo(header,"已报名选手",competition.optBoolean("registrationPublic")?String.valueOf(array(data.opt("players")).length()):"—");eventInfo(header,"已公布成绩",String.valueOf(group.optInt("rankingCount")));JSONArray players=array(data.opt("players"));boolean published=group.optInt("rankingCount")>0;for(int i=0;i<players.length();i++)if(players.optJSONObject(i).optBoolean("resultPublished"))published=true;LinearLayout podium=null;for(int i=0;i<players.length();i++){JSONObject player=players.optJSONObject(i);if(player.optInt("rankNo")>0&&player.optInt("rankNo")<=3){if(podium==null)podium=eventSurface(content,"🏆 获奖选手");card(podium,publicRank(player)+" · "+first(player,"name"),publicScore(player.opt("publishedTotal"))+" 分",()->open(()->eventPlayer(eventId,groupId,player.optInt("id"))));}}
        eventRows(eventSurface(content,published?"公示结果":"选手列表"),players,published?"results":"players",competition.optBoolean("registrationPublic")?"该组别暂无报名选手":"报名信息尚未公开",player->open(()->eventPlayer(eventId,groupId,player.optInt("id"))));});}
    private void eventPlayer(int eventId,int groupId,int playerId){begin("参赛详情");pageScroll.setBackgroundColor(eventCanvas());load("/events/"+eventId+"/groups/"+groupId+"/players/"+playerId,"GET",null,false,value->{JSONObject data=object(value),player=object(data.opt("player")),competition=object(data.opt("competition")),group=object(data.opt("group"));title.setText(first(player,"name")+" · 参赛详情");LinearLayout hero=eventSurface(content,first(player,"name"));hero.addView(eventAvatar(player),new LinearLayout.LayoutParams(dp(64),dp(64)));hero.addView(text(first(competition,"name"),14));Button groupButton=button(first(group,"name")+" ›",()->open(()->eventGroup(eventId,groupId)));hero.addView(groupButton);LinearLayout info=eventSurface(content,"参赛详情");eventInfo(info,"编号",first(player,"playerNo").isEmpty()?"未编号":first(player,"playerNo"));if(!first(player,"organization").isEmpty())eventInfo(info,"机构 / 舞蹈室",first(player,"organization"));if(!first(player,"teacher").isEmpty())eventInfo(info,"指导老师",first(player,"teacher"));eventInfo(info,"节目名称",first(player,"performanceTitle").isEmpty()?"未填写":first(player,"performanceTitle"));LinearLayout result=eventSurface(content,publicRank(player));TextView score=text(publicScore(player.opt("publishedTotal"))+"\n最终得分",26);score.setTextColor(red);score.setGravity(Gravity.CENTER);result.addView(score);LinearLayout judges=eventSurface(content,"评委评分");if(!competition.optBoolean("judgeScoresPublic"))judges.addView(text("个人评分未公开，评委身份可通过评委入口查看。",14));JSONArray scores=array(data.opt("judgeScores"));for(int i=0;i<scores.length();i++){JSONObject row=scores.optJSONObject(i);eventInfo(judges,first(row,"name"),row.isNull("score")?"未公开":publicScore(row.opt("score")));}if(scores.length()==0)judges.addView(text("评分发布后在此展示",14));});}

    private void register(int id, JSONObject group) {
        begin("赛事报名");title.setText("赛事报名");
        if (!api.loggedIn()) { action("登录后报名", () -> open(this::login)); return; }
        long account=api.accountGeneration();
        load("/events/"+id,"GET",null,false,value->{
            if(account!=api.accountGeneration())return;
            JSONObject event=object(value);
            load("/member/profile","GET",null,true,profile->{
                if(account!=api.accountGeneration())return;
                JSONObject member=object(profile);if(member.optJSONObject("member")!=null)member=member.optJSONObject("member");
                registrationForm(id,group.optInt("id"),0,body("name",member.optString("name"),"phone",member.optString("phone"),"countryCode","+86"),"",object(event.opt("competition")),array(event.opt("groups")));
            });
        });
    }

    private void editRegistration(long player) {
        begin("修改报名 / 补交音乐");title.setText("修改报名 / 补交音乐");
        String path = "/member/event-registrations/" + player;
        load(path, "GET", null, true, value -> {
            JSONObject details = object(value);
            if (!details.optBoolean("canEdit")) { info("此报名当前不可修改"); return; }
            load(path + "/music", "GET", null, true, audio ->
                    registrationForm(0, 0, player, details, object(audio).optString("fileName"), details, new JSONArray()));
        });
    }

    private int registrationLine(){return android.graphics.Color.parseColor(SwodUi.dark(this)?"#4A433A":"#EADFCE");}
    private android.graphics.drawable.GradientDrawable registrationBox(int color){android.graphics.drawable.GradientDrawable shape=SwodUi.shape(this,color,8);shape.setStroke(dp(1),registrationLine());return shape;}
    private void registrationLabel(LinearLayout parent,String label){TextView v=text(label,15);v.setTypeface(null,android.graphics.Typeface.BOLD);v.setPadding(0,dp(18),0,dp(10));parent.addView(v);}
    private EditText registrationInput(LinearLayout parent,String prompt){EditText v=field(parent,prompt,false);v.setBackground(registrationBox(SwodUi.surface(this)));return v;}
    private EditText registrationField(LinearLayout parent,String label,String prompt){registrationLabel(parent,label);EditText value=registrationInput(parent,prompt);value.setContentDescription(label);return value;}
    private void registrationPrimary(Button button){button.setGravity(Gravity.CENTER);button.setTextColor(SwodUi.dark(this)?android.graphics.Color.BLACK:android.graphics.Color.WHITE);button.setTypeface(null,android.graphics.Typeface.BOLD);button.setCompoundDrawables(null,null,null,null);button.setBackground(SwodUi.touch(this,SwodUi.primary(this),8));}
    private java.util.List<JSONObject> registrationGroups(JSONArray groups,String query){java.util.List<JSONObject> result=new java.util.ArrayList<>();String q=query.trim().toLowerCase(Locale.ROOT);for(int i=0;i<groups.length();i++){JSONObject row=groups.optJSONObject(i);if(row!=null&&row.optInt("id")>0&&row.optString("name").toLowerCase(Locale.ROOT).contains(q))result.add(row);}return result;}
    private void registrationForm(int event, int group, long player, JSONObject existing, String currentMusic,JSONObject competition,JSONArray groups) {
        musicBytes = null; musicFilename = ""; musicReading = false;
        final long registrationAccount=api.accountGeneration();
        pageScroll.setBackgroundColor(android.graphics.Color.parseColor(SwodUi.dark(this)?"#141619":"#F8F3EA"));
        LinearLayout page=content,outer=column(),header=column();int available=getResources().getConfiguration().screenWidthDp-(getResources().getConfiguration().screenWidthDp>=600?104:0)-32;LinearLayout.LayoutParams formWidth=new LinearLayout.LayoutParams(dp(Math.max(0,Math.min(680,available))),-2);formWidth.gravity=Gravity.CENTER_HORIZONTAL;page.addView(outer,formWidth);content=outer;header.setPadding(dp(16),dp(18),dp(16),dp(18));header.setBackground(SwodUi.shape(this,android.graphics.Color.parseColor("#1A1A1A"),14));
        TextView tag=text("赛事报名",12);tag.setTextColor(android.graphics.Color.parseColor("#C8A96E"));header.addView(tag);
        TextView heading=text(player>0?first(competition,"competitionName","groupName"):first(competition,"name"),22);heading.setTypeface(null,android.graphics.Typeface.BOLD);heading.setTextColor(android.graphics.Color.WHITE);header.addView(heading);
        if(player==0){TextView detail=text((first(competition,"startDate","start_date").isEmpty()?"比赛日期待定":first(competition,"startDate","start_date"))+" · "+(first(competition,"location","venue","city").isEmpty()?"地点待定":first(competition,"location","venue","city")),14);detail.setTextColor(android.graphics.Color.LTGRAY);header.addView(detail);}outer.addView(header);
        LinearLayout form=column();form.setPadding(dp(14),dp(6),dp(14),dp(18));form.setBackground(registrationBox(SwodUi.surface(this)));outer.addView(form);
        TextView formHeading=text(player>0?"修改报名 / 补交音乐":"填写报名信息",21);formHeading.setTypeface(null,android.graphics.Typeface.BOLD);form.addView(formHeading);TextView required=text("带 * 为必填项",12);required.setTextColor(SwodUi.muted(this));form.addView(required);
        View separator=new View(this);separator.setBackgroundColor(registrationLine());form.addView(separator,new LinearLayout.LayoutParams(-1,dp(1)));
        EditText name = registrationField(form,"参赛姓名 *","支持中文、英文和空格");
        name.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(120)});
        registrationLabel(form,"手机号码 *");LinearLayout phoneRow=row();form.addView(phoneRow);
        LinearLayout countryRow=row();countryRow.setPadding(dp(8),0,0,0);countryRow.setBackground(registrationBox(SwodUi.surface(this)));
        String[] countries=RegistrationCountries.LABELS,codes=RegistrationCountries.CODES;
        Button countryPicker=button("🇨🇳⌄",()->{});countryPicker.setPadding(0,0,0,0);countryPicker.setContentDescription("选择国家或地区区号");countryRow.addView(countryPicker,new LinearLayout.LayoutParams(dp(44),dp(48)));
        EditText country=new EditText(this);country.setTextColor(SwodUi.ink(this));country.setTextSize(16);country.setBackgroundColor(android.graphics.Color.TRANSPARENT);country.setContentDescription("国家或地区区号");countryRow.addView(country,new LinearLayout.LayoutParams(0,dp(48),1));
        LinearLayout.LayoutParams countryParams=new LinearLayout.LayoutParams(dp(128),-2);countryParams.rightMargin=dp(8);phoneRow.addView(countryRow,countryParams);
        EditText phone=registrationInput(phoneRow,"手机号码");phone.setContentDescription("手机号码，必填");phone.setLayoutParams(new LinearLayout.LayoutParams(0,dp(48),1));
        countryPicker.setOnClickListener(view->new AlertDialog.Builder(this).setTitle("选择国家或地区区号").setItems(countries,(dialog,index)->{country.setText(codes[index]);countryPicker.setText(RegistrationCountries.FLAGS[index]+"⌄");}).setNegativeButton("取消",null).show());
        EditText org=registrationField(form,"机构 / 舞蹈室","选填");EditText teacher=registrationField(form,"指导老师","选填");
        final int[] selectedGroup={0};for(JSONObject row:registrationGroups(groups,""))if(row.optInt("id")==group)selectedGroup[0]=group;
        if(player==0){registrationLabel(form,"参赛组别 *");EditText query=registrationInput(form,"搜索组别、舞种或年龄");Button choose=button("请选择组别 ›",()->{});choose.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);choose.setBackground(registrationBox(SwodUi.surface(this)));form.addView(choose,new LinearLayout.LayoutParams(-1,-2));TextView fee=text("",13);fee.setTextColor(SwodUi.primary(this));form.addView(fee);
            Runnable refreshGroup=()->{JSONObject selected=null;for(JSONObject row:registrationGroups(groups,""))if(row.optInt("id")==selectedGroup[0])selected=row;choose.setText(selected==null?"请选择组别 ›":selected.optString("name")+" ›");fee.setText(selected==null?"":"本组别报名费 ¥"+selected.optDouble("registrationFee"));};refreshGroup.run();
            choose.setOnClickListener(view->{java.util.List<JSONObject> matches=registrationGroups(groups,query.getText().toString());if(matches.isEmpty()){Toast.makeText(this,"未找到匹配组别，请修改搜索内容",Toast.LENGTH_SHORT).show();return;}String[] names=new String[matches.size()];for(int i=0;i<names.length;i++)names[i]=matches.get(i).optString("name");new AlertDialog.Builder(this).setTitle("选择参赛组别").setItems(names,(dialog,index)->{selectedGroup[0]=matches.get(index).optInt("id");refreshGroup.run();}).setNegativeButton("取消",null).show();});
        }else if(!existing.optString("groupName").isEmpty())form.addView(text("参赛组别："+existing.optString("groupName"),14));
        EditText title=registrationField(form,"节目（音乐）名字 *","节目（音乐）名字");title.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(120)});
        name.setText(existing.optString("name"));country.setText(existing.optString("countryCode", "+86"));phone.setInputType(android.text.InputType.TYPE_CLASS_PHONE);country.setInputType(android.text.InputType.TYPE_CLASS_PHONE);phone.setText(existing.optString("phone"));org.setText(existing.optString("organization"));teacher.setText(existing.optString("teacher"));title.setText(existing.optString("performanceTitle"));
        for(int i=0;i<codes.length;i++)if(codes[i].equals(country.getText().toString()))countryPicker.setText(RegistrationCountries.FLAGS[i]+"⌄");
        country.addTextChangedListener(new android.text.TextWatcher(){public void beforeTextChanged(CharSequence v,int start,int count,int after){}public void onTextChanged(CharSequence v,int start,int before,int count){String flag="🌐";for(int i=0;i<codes.length;i++)if(codes[i].equals(v.toString()))flag=RegistrationCountries.FLAGS[i];countryPicker.setText(flag+"⌄");}public void afterTextChanged(android.text.Editable value){}});
        registrationLabel(form,"上传音乐（选填）");form.addView(text("可先报名，之后在个人中心补交或更换音乐。",14));
        Button selectMusic=button("选择音乐文件",()->{if(registrationBusy||musicReading)return;musicPickerGeneration=generation;Intent picker=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(picker,460);});registrationPrimary(selectMusic);form.addView(selectMusic,new LinearLayout.LayoutParams(-1,-2));
        form.addView(text("从系统文件中选择。支持 MP3、WAV、M4A、AAC、FLAC，最大10MB。",13));if(!currentMusic.isEmpty())form.addView(text("当前音乐："+currentMusic,13));
        String musicHint="尚未选择音乐文件";musicLabel=text(musicHint,13);musicLabel.setTextColor(SwodUi.muted(this));form.addView(musicLabel);
        Button removeMusic=button("移除所选音乐",()->{if(registrationBusy||musicReading)return;musicBytes=null;musicFilename="";musicLabel.setText(musicHint);});form.addView(removeMusic);
        EditText remark=registrationField(form,"备注","可填写参赛项目、作品或其他说明");remark.setSingleLine(false);remark.setMinLines(4);remark.setGravity(Gravity.TOP|Gravity.START);remark.setFilters(new android.text.InputFilter[]{new android.text.InputFilter.LengthFilter(500)});remark.setText(existing.optString("remark"));
        content=outer;
        java.util.function.Supplier<JSONObject> fields = () -> body("name", name.getText().toString().trim(),
                "phone", phone.getText().toString().trim(), "countryCode", country.getText().toString().trim(),
                "organization", org.getText().toString(), "teacher", teacher.getText().toString(),
                "performanceTitle", title.getText().toString().trim(), "remark", remark.getText().toString());
        if (player > 0) action("保存报名资料", () -> {
            if (registrationBusy || musicReading) return;
            memberWrite("/member/event-registrations/" + player, "PUT", fields.get(), () -> editRegistration(player));
        });
        action(player > 0 ? "上传音乐" : "提交赛事报名", () -> {
            if (registrationBusy || memberWriteBusy || musicReading) return;
            if(registrationAccount!=api.accountGeneration()){info("登录账户已切换，请重新打开报名页");return;}
            if(player==0&&selectedGroup[0]<=0){info("请选择参赛组别");return;}
            JSONObject values = fields.get();
            if (values.optString("performanceTitle").isEmpty()
                    || (player == 0 && (values.optString("name").isEmpty() || values.optString("phone").isEmpty()))
                    || (player > 0 && musicBytes == null)) {
                info(player > 0 ? "请填写节目名称并选择音乐" : "请填写姓名、联系电话和节目名称");
                return;
            }
            confirm(player > 0 ? "确认上传参赛音乐？" : "确认提交本组报名？", () -> {
                if (registrationBusy || memberWriteBusy || musicReading) return;
                registrationBusy = true;
                int version = generation;
                byte[] bytes = musicBytes;
                String filename = musicFilename;
                io.execute(() -> {
                    Exception failure = null;
                    try {
                        if (player > 0) api.replaceEventMusic(player, values.optString("performanceTitle"), filename, bytes);
                        else {if(registrationAccount!=api.accountGeneration())throw new Exception("登录账户已切换，请重新打开报名页");api.registerWithMusic(event, values.put("groupId", selectedGroup[0]), filename, bytes);}
                    } catch (Exception e) { failure = e; }
                    Exception error = failure;
                    runOnUiThread(() -> {
                        registrationBusy = false;
                        if (version != generation || registrationAccount!=api.accountGeneration() || isFinishing()) return;
                        if (error != null) { info(error.getMessage()); return; }
                        musicBytes = null;
                        if (player > 0) { editRegistration(player); return; }
                        begin("报名已提交");
                        info("可在「我的比赛」查看进度、补交或更换音乐。");
                        action("查看报名记录", () -> open(this::myEvents));
                    });
                });
            });
        });
        registrationPrimary((Button)outer.getChildAt(outer.getChildCount()-1));
        if(player==0){TextView note=text("同一赛事可报名多个组别。未付款可在个人中心继续缴费。",12);note.setGravity(Gravity.CENTER);note.setTextColor(SwodUi.muted(this));outer.addView(note);}
        content=page;
    }
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);if(request!=460||result!=RESULT_OK||data==null||data.getData()==null)return;
        Uri uri=data.getData();int version=musicPickerGeneration;
        if(version!=generation||isFinishing())return;
        musicReading=true;
        io.execute(()->{try{
            String filename="";try(android.database.Cursor c=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())filename=c.getString(0);}
            if(!filename.toLowerCase(Locale.ROOT).matches(".*\\.(mp3|wav|m4a|aac|flac)$"))throw new Exception("请选择MP3、WAV、M4A、AAC或FLAC音乐");
            java.io.ByteArrayOutputStream bytes=new java.io.ByteArrayOutputStream();try(java.io.InputStream stream=getContentResolver().openInputStream(uri)){if(stream==null)throw new Exception("无法读取所选文件");byte[] chunk=new byte[8192];int n;while((n=stream.read(chunk))!=-1){bytes.write(chunk,0,n);if(bytes.size()>10*1024*1024)throw new Exception("音乐文件不能超过10MB");}}
            if(bytes.size()==0)throw new Exception("音乐文件为空");String selected=filename;byte[] payload=bytes.toByteArray();
            runOnUiThread(()->{if(version!=generation||isFinishing())return;musicReading=false;musicBytes=payload;musicFilename=selected;musicLabel.setText("已选择："+selected);});
        }catch(Exception e){runOnUiThread(()->{if(version==generation&&!isFinishing()){musicReading=false;info(e.getMessage());}});}});
    }

    private void shop(){begin("伊娃甄选");hero("伊娃甄选","东方舞生活 · 官方商城");action("我的商城订单",()->open(this::orders));action("收货地址",()->open(this::shipping));section("精选商品");load("/shop/products","GET",null,false,v->{JSONArray products=array(object(v).opt("products"));EditText query=field(content,"搜索商品、颜色或尺码",false);content.removeView(query);content.addView(query,0);Spinner category=new Spinner(this);java.util.ArrayList<String> categories=new java.util.ArrayList<>();categories.add("全部商品");for(int i=0;i<products.length();i++){String c=products.optJSONObject(i).optString("category");if(!c.isEmpty()&&!categories.contains(c))categories.add(c);}category.setAdapter(new ArrayAdapter<>(this,android.R.layout.simple_spinner_dropdown_item,categories));content.addView(category);LinearLayout list=column();content.addView(list);Runnable render=()->{list.removeAllViews();String keyword=query.getText().toString().trim().toLowerCase(Locale.ROOT),selected=categories.get(category.getSelectedItemPosition());for(int i=0;i<products.length();i++){JSONObject r=products.optJSONObject(i);if(r==null||(!selected.equals("全部商品")&&!selected.equals(r.optString("category"))))continue;String search=(r.optString("name")+" "+r.optString("color")+" "+r.optString("size")+" "+r.optString("spec")).toLowerCase(Locale.ROOT);if(!search.contains(keyword))continue;int index=list.getChildCount();card(list,r.optString("name"),productSpec(r)+" · "+ProductPresentation.price(r.opt("priceFen"))+" · "+ProductPresentation.stock(r.opt("stock")),()->open(()->product(r)));cover((LinearLayout)list.getChildAt(index),first(r,"image"),true);}if(list.getChildCount()==0)list.addView(text("暂无符合条件的商品",14));};query.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence s,int a,int c,int f){}public void onTextChanged(CharSequence s,int a,int b,int c){render.run();}public void afterTextChanged(Editable e){}});category.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener(){public void onNothingSelected(AdapterView<?> p){}public void onItemSelected(AdapterView<?> p,View v,int at,long id){render.run();}});render.run();});}
    private String productSpec(JSONObject r){java.util.ArrayList<String> values=new java.util.ArrayList<>();for(String key:new String[]{"spec","color","size"}){String value=first(r,key);if(!value.isEmpty())values.add(value);}return String.join(" · ",values);}
    private void product(JSONObject r){begin(r.optString("name"));cover(content,first(r,"image"),true);hero(r.optString("name"),productSpec(r));info(strip(first(r,"description")));info(ProductPresentation.price(r.opt("priceFen"))+" · "+ProductPresentation.stock(r.opt("stock")));info("App 暂未开放下单，可查看商品及已有订单。");action("查看我的订单",()->open(this::orders));}
    private void shipping(){begin("收货地址");load("/shop/shipping","GET",null,true,v->{JSONObject o=object(v);JSONObject a=o.optJSONObject("shipping");if(a==null)a=o;EditText name=field(content,"收件人",false),phone=field(content,"手机号",true),address=field(content,"完整收货地址（省市区和门牌）",false);name.setText(first(a,"recipient","name"));phone.setText(a.optString("phone"));address.setText(a.optString("address"));action("保存地址",()->{String n=name.getText().toString().trim(),p=phone.getText().toString().trim(),d=address.getText().toString().trim();if(n.isEmpty()||n.length()>60||!p.matches("1[3-9][0-9]{9}")||d.length()<5||d.length()>200){info("请填写收件人、有效手机号和完整地址");return;}memberWrite("/shop/shipping","PUT",body("recipient",n,"phone",p,"address",d),this::shipping);});});}
    private void orders(){begin("我的商城订单");load("/shop/orders","GET",null,true,v->{JSONArray rows=array(object(v).opt("orders"));for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,"订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind"))+" · ¥"+Commerce.money(r.optLong("totalFen"))+" · "+first(r,"createdAt"),()->open(()->order(r.optString("id"))));}if(rows.length()==0)info("暂无商城订单");});}
    private void order(String id){begin("订单详情");String path="/shop/orders/"+Uri.encode(id);load(path,"GET",null,true,v->{JSONObject r=object(v).optJSONObject("order");if(r==null)throw new Exception("订单不存在");hero("订单 "+r.optString("id"),Commerce.status(r.optString("status"),r.optString("kind")));info("合计 ¥"+Commerce.money(r.optLong("totalFen")));JSONArray items=array(r.opt("items"));for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);card(content,item.optString("name"),"¥"+Commerce.money(item.optLong("unit_fen"))+" × "+item.optInt("quantity"),null);}info(first(r,"createdAt"));info(first(r,"carrier")+" "+first(r,"trackingNo"));info(first(r,"recipient")+" · "+mask(r.optString("phone"))+" · "+first(r,"address"));JSONObject shipping=r.optJSONObject("shipping");if(shipping!=null)info(first(shipping,"recipient")+" · "+mask(shipping.optString("phone"))+" · "+shipping.optString("address"));action("同步最新订单状态",()->memberWrite(path+"/refresh","POST",body(),()->order(id)));String state=r.optString("status");if(state.equals("pending"))action("取消订单",()->confirm("确认取消此订单？",()->memberWrite(path+"/cancel","POST",body(),()->order(id))));if(state.equals("shipped")&&r.optString("kind").equals("goods"))action("确认收货",()->confirm("请确认已经收到商品",()->memberWrite(path+"/received","POST",body(),()->order(id))));if(Commerce.refundable(state)){EditText reason=field(content,"退款原因",false);action("申请退款",()->{String message=reason.getText().toString().trim();if(message.isEmpty()||message.length()>300){info("请填写300字以内退款原因");return;}confirm("确认提交退款申请？结果以平台审核为准",()->memberWrite(path+"/refund","POST",body("reason",message),()->order(id)));});}});}
    private void memberWrite(String path,String method,JSONObject body,Runnable next){if(memberWriteBusy)return;memberWriteBusy=true;int version=generation;io.execute(()->{try{api.request(path,method,body,true);runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing()){page=next;next.run();}});}catch(Exception e){runOnUiThread(()->{memberWriteBusy=false;if(version==generation&&!isFinishing())info(e.getMessage());});}});}
    private void profileEditor(){begin("个人资料");load("/member/profile","GET",null,true,v->{JSONObject r=object(v);info("手机号 "+mask(r.optString("phone"))+" · 资料与官网同步");String[] keys={"name","gender","birthday","country","province","city","address"},labels={"姓名","性别（男/女/其他，选填）","生日（YYYY-MM-DD，选填）","国家/地区","省份/地区","城市","详细地址"};EditText[] inputs=new EditText[keys.length];for(int i=0;i<keys.length;i++){inputs[i]=field(content,labels[i],false);inputs[i].setText(first(r,keys[i]));}action("保存个人资料",()->{JSONObject draft=body();for(int i=0;i<keys.length;i++){String value=inputs[i].getText().toString().trim();if(value.length()>300||(i==0&&(value.isEmpty()||value.length()>60))){info("请填写姓名，单项资料不能超过300字");return;}try{draft.put(keys[i],value);}catch(Exception ignored){}}String birthday=inputs[2].getText().toString().trim();if(!birthday.isEmpty()){try{java.time.LocalDate date=java.time.LocalDate.parse(birthday);if(date.isAfter(java.time.LocalDate.now()))throw new Exception();}catch(Exception e){info("请填写有效生日 YYYY-MM-DD");return;}}memberWrite("/member/profile","PUT",draft,this::account);});});}
    private void account(){
        begin("个人中心");
        if(!api.loggedIn()){
            accountHeader(content,new JSONObject(),false);
            action("手机号登录",()->open(this::login));
        }else{
            LinearLayout summary=column();content.addView(summary);
            accountHeader(summary,new JSONObject(),false);accountShortcuts(summary,null);
            load("/member/profile","GET",null,true,v->{JSONObject profile=object(v);summary.removeAllViews();accountHeader(summary,profile,true);accountShortcuts(summary,profile.optJSONObject("stats"));});
            accountService("person","个人资料","姓名、手机号、生日和地址",()->open(this::profileEditor));
            accountService("trophy","我的比赛","报名、缴费与比赛结果",()->open(this::myEvents));
            accountService("bag","我的订单","订单、到账与退款记录",()->open(this::orders));
            LinearLayout coursesHeading=row();coursesHeading.setGravity(Gravity.CENTER_VERTICAL);
            TextView coursesTitle=text("我的课程",18);coursesTitle.setTypeface(null,android.graphics.Typeface.BOLD);
            coursesHeading.addView(coursesTitle,new LinearLayout.LayoutParams(0,-2,1));
            Button courseToggle=button("收起 ⌃",()->{});courseToggle.setContentDescription("收起我的课程，已展开");
            courseToggle.setMinHeight(dp(44));coursesHeading.addView(courseToggle);content.addView(coursesHeading);
            if(Policy.SUPPORTS_OFFLINE_DOWNLOAD)accountService("download","课程缓存","查看离线课程",()->startActivity(new Intent(this,CourseCacheActivity.class)));
            LinearLayout courseRows=column();content.addView(courseRows);
            courseToggle.setOnClickListener(view->{boolean expand=courseRows.getVisibility()!=android.view.View.VISIBLE;courseRows.setVisibility(expand?android.view.View.VISIBLE:android.view.View.GONE);courseToggle.setText(expand?"收起 ⌃":"展开 ⌄");courseToggle.setContentDescription(expand?"收起我的课程，已展开":"展开我的课程，已收起");});
            load("/member/authorized-series","GET",null,true,v->{
                if(!(v instanceof JSONArray))throw new Exception();JSONArray owned=(JSONArray)v;
                renderAccountCourses(courseRows,owned,new JSONArray());
                loadOwnedCourseDetails(courseRows,owned);
            });
            accountService("learn","查看全部课程与学习记录","已解锁课程与学习进度",()->open(this::myCourses));
            section("线下课与证书");
            accountService("calendar","我的线下课程","课时余额、期次与核销记录",()->open(this::schedule));
            accountService("certificate","我的证书","查看已颁发的学习证书",()->open(this::certificates));
            section("学习服务");
            accountService("bell","学习消息",unreadMessages>0?unreadMessages+" 条未读消息":"课程与服务通知",()->open(()->messages(0)));
            accountService("notes","学习笔记","回顾课程中的学习心得",()->open(()->learningRecords(false)));
            accountService("bookmark","学习书签","快速找到标记过的课节",()->open(()->learningRecords(true)));
            accountService("growth","成长档案","记录学习与练习成长",()->open(this::growth));
            section("账号与隐私");
            accountService("device","登录设备","查看与管理账号登录设备",()->open(this::devices));
            accountService("shield","注销账号","申请注销与查看处理说明",()->open(this::deletion));
            action("退出登录",()->confirm("退出当前账号？",()->{generation++;io.execute(()->{try{api.logout();}catch(Exception ignored){}runOnUiThread(()->{history.clear();page=this::account;account();});});}));
        }
        section("客服与帮助");
        accountService("help","客服与售后","学习权限、课程与订单问题",()->open(this::support));
        accountService("person","东方舞圈与品牌服务","品牌资讯与官方服务",()->open(this::website));
        accountService("info","关于 SWOD","版本信息、品牌与服务商说明",()->open(this::about));
        accountService("shield","隐私政策","个人信息与隐私保护说明",()->open(()->legalDocument("隐私政策","app-privacy.txt")));
        accountService("notes","服务条款","查看平台服务规则",()->open(()->legalDocument("服务条款","app-terms.txt")));
        TextView version=text("SWOD "+ReleaseInfo.version(this),12);version.setGravity(Gravity.CENTER);version.setTextColor(SwodUi.muted(this));version.setPadding(0,dp(16),0,dp(16));content.addView(version);
    }
    private void loadOwnedCourseDetails(LinearLayout box,JSONArray owned){
        int pageVersion=generation;long account=api.accountGeneration();
        io.execute(()->{
            try{
                JSONArray courses=new JSONArray(owned.toString());
                JSONArray catalogue;
                try{catalogue=array(api.request("/public/series","GET",null,false));}catch(Exception error){catalogue=new JSONArray();}
                for(int index=0;index<courses.length();index++){
                    if(pageVersion!=generation||account!=api.accountGeneration())return;
                    JSONObject course=courses.getJSONObject(index);
                    int id=CourseAccessPolicy.canonicalId(course.opt("series_id"));
                    if(id<=0)continue;
                    try{
                        JSONArray records=array(api.request("/public/series/"+id+"/progress","GET",null,true));
                        double total=0;
                        for(int n=0;n<records.length();n++){
                            JSONObject record=records.getJSONObject(n);
                            double duration=record.optDouble("duration",0),watched=record.optDouble("progress",0);
                            total+=record.optInt("completed")==1?1:duration>0&&Double.isFinite(watched)?Math.min(1,Math.max(0,watched/duration)):0;
                        }
                        course.put("learning_percent",records.length()==0?0:(int)Math.floor(total/records.length()*100));
                    }catch(Exception error){/* Keep progress unknown when its request fails. */}
                }
                JSONArray pictures=catalogue;
                runOnUiThread(()->{if(pageVersion==generation&&account==api.accountGeneration()&&!isFinishing())renderAccountCourses(box,courses,pictures);});
            }catch(Exception error){/* The verified course list remains available. */}
        });
    }
    private void renderAccountCourses(LinearLayout box,JSONArray owned,JSONArray catalogue){
        box.removeAllViews();
        for(int n=0;n<owned.length();n++){
            JSONObject course=owned.optJSONObject(n);if(course==null)continue;int id=CourseAccessPolicy.canonicalId(course.opt("series_id"));if(id<=0)continue;
            String learners=learnerText(course);
            for(int k=0;k<catalogue.length();k++){JSONObject entry=catalogue.optJSONObject(k);if(entry!=null&&entry.optInt("id")==id){learners=learnerText(entry);break;}}
            String picture=first(course,"cover_image");if(picture.isEmpty())for(int k=0;k<catalogue.length();k++){JSONObject entry=catalogue.optJSONObject(k);if(entry!=null&&entry.optInt("id")==id){picture=first(entry,"cover_image");break;}}
            Runnable learn=()->studyCourse(id,first(course,"series_name","name"));int at=box.getChildCount();card(box,first(course,"series_name","name"),"",learn);LinearLayout item=(LinearLayout)box.getChildAt(at);if(!learners.isEmpty()){TextView people=text(learners,12);people.setTextColor(SwodUi.muted(this));item.addView(people);}
            String progress=course.has("learning_percent")?"学习进度 "+course.optInt("learning_percent")+"%":"进度待同步";
            TextView label=text(progress,14);label.setTextColor(SwodUi.muted(this));item.addView(label);
            if(course.has("learning_percent")){ProgressBar bar=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);bar.setMax(100);bar.setProgress(course.optInt("learning_percent"));item.addView(bar,new LinearLayout.LayoutParams(-1,dp(4)));}
            cover(item,picture,false);item.setContentDescription(first(course,"series_name","name")+"，"+learners+"，"+progress);
        }
        if(owned.length()==0){TextView empty=text("暂无已解锁课程",14);empty.setTextColor(SwodUi.muted(this));empty.setPadding(0,dp(16),0,dp(16));box.addView(empty);}
    }
    private void accountHeader(LinearLayout box,JSONObject profile,boolean ready){
        LinearLayout header=row();header.setPadding(0,dp(16),0,dp(16));
        ImageView avatar=new ImageView(this);avatar.setImageDrawable(SwodUi.icon(this,"person",red));avatar.setScaleType(ImageView.ScaleType.CENTER);avatar.setBackground(SwodUi.shape(this,SwodUi.tonal(this),32));avatar.setClipToOutline(true);avatar.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        LinearLayout.LayoutParams avatarParams=new LinearLayout.LayoutParams(dp(64),dp(64));avatarParams.rightMargin=dp(14);header.addView(avatar,avatarParams);
        LinearLayout identity=column();String name=first(profile,"wx_nickname","wx_name","name");TextView heading=text(!api.loggedIn()?"欢迎来到伊娃东方舞":name.isEmpty()?"我的学习空间":name,20);heading.setTypeface(null,android.graphics.Typeface.BOLD);identity.addView(heading);
        String phone=mask(profile.optString("phone"));String level=first(profile,"level");TextView caption=text(!api.loggedIn()?"登录后同步课程与个人资料":!ready?"资料与学习账号同步":(level.isEmpty()?"":level+" · ")+phone,14);caption.setTextColor(SwodUi.muted(this));identity.addView(caption);header.addView(identity,new LinearLayout.LayoutParams(0,-2,1));
        if(api.loggedIn()){Button notice=button(unreadMessages>0?(unreadMessages>99?"99+":String.valueOf(unreadMessages))+" 未读":"通知",()->open(()->messages(0)));notice.setTextSize(12);notice.setPadding(dp(6),dp(4),dp(6),dp(4));notice.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,"bell",red),null,null);notice.setCompoundDrawablePadding(dp(4));header.addView(notice);accountNotice=notice;}
        box.addView(header,new LinearLayout.LayoutParams(-1,-2));
        String url=first(profile,"avatar_url","wx_avatar_url");if(Policy.secureURL(url)){int version=generation;long account=api.accountGeneration();imageIO.execute(()->{try{android.graphics.Bitmap bitmap=Images.read(url);runOnUiThread(()->{if(version==generation&&account==api.accountGeneration()&&!isFinishing()&&bitmap!=null){avatar.setScaleType(ImageView.ScaleType.CENTER_CROP);avatar.setImageBitmap(bitmap);}});}catch(Exception ignored){}});}
    }
    private void accountShortcuts(LinearLayout box,JSONObject stats){
        String[] labels={"线上课","线下课","我的比赛","我的证书"};String[] values={stats!=null&&stats.has("authorized_count")?stats.optString("authorized_count"):"—",stats!=null&&stats.has("offline_course_count")?stats.optString("offline_course_count"):"—","报名与成绩","查看证书"};String[] icons={"learn","calendar","trophy","certificate"};Runnable[] targets={()->open(this::myCourses),()->open(this::schedule),()->open(this::myEvents),()->open(this::certificates)};
        boolean large=getResources().getConfiguration().fontScale>1.3f||getResources().getConfiguration().screenWidthDp<360;LinearLayout line=null;
        for(int i=0;i<labels.length;i++){if(i%(large?2:4)==0){line=row();box.addView(line,new LinearLayout.LayoutParams(-1,-2));}Button item=button(values[i]+"\n"+labels[i],targets[i]);item.setTextSize(14);item.setGravity(Gravity.CENTER);item.setPadding(dp(2),dp(12),dp(2),dp(12));item.setMinimumHeight(dp(96));item.setCompoundDrawablesWithIntrinsicBounds(null,SwodUi.icon(this,icons[i],red),null,null);item.setCompoundDrawablePadding(dp(6));item.setContentDescription(labels[i]+"，"+values[i]);line.addView(item,new LinearLayout.LayoutParams(0,-2,1));}
    }
    private void accountService(String icon,String name,String summary,Runnable tap){
        LinearLayout item=row();item.setPadding(0,dp(12),0,dp(12));item.setMinimumHeight(dp(64));item.setBackground(SwodUi.row(this));
        ImageView image=new ImageView(this);image.setImageDrawable(SwodUi.icon(this,icon,red));image.setPadding(dp(6),dp(6),dp(6),dp(6));image.setBackground(SwodUi.shape(this,SwodUi.tonal(this),8));image.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);LinearLayout.LayoutParams ip=new LinearLayout.LayoutParams(dp(36),dp(36));ip.rightMargin=dp(12);item.addView(image,ip);
        LinearLayout copy=column();TextView heading=text(name,16);heading.setTypeface(null,android.graphics.Typeface.BOLD);copy.addView(heading);TextView detail=text(summary,14);detail.setTextColor(SwodUi.muted(this));copy.addView(detail);item.addView(copy,new LinearLayout.LayoutParams(0,-2,1));
        ImageView arrow=new ImageView(this);arrow.setImageDrawable(SwodUi.icon(this,"next",SwodUi.muted(this)));arrow.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);item.addView(arrow,new LinearLayout.LayoutParams(dp(20),dp(20)));item.setFocusable(true);item.setContentDescription(name+"，"+summary);item.setOnClickListener(v->tap.run());content.addView(item,new LinearLayout.LayoutParams(-1,-2));
    }
    private void growth() {
        begin("成长档案");
        load("/member/growth", "GET", null, true, value -> {
            JSONObject data = object(value), growth = data.optJSONObject("growth");
            if (growth == null) throw new Exception("成长档案暂时无法加载，请重试");
            hero(growth.optString("level_display", "学员"), "成长经验 " + growth.optLong("experience_total"));
            String next = growth.optString("next_level_name");
            if (!next.isEmpty()) info("距离" + next + "还需 " + growth.optLong("points_to_next_level") + " 经验");
            JSONArray ledger = array(data.opt("ledger"));
            for (int i = 0; i < ledger.length(); i++) {
                JSONObject entry = ledger.getJSONObject(i);
                long points = entry.optLong("points_delta");
                card(content, entry.optString("description", "经验变动"),
                        entry.optString("occurred_at").split("T", 2)[0] + " · " + (points > 0 ? "+" : "") + points, null);
            }
            if (ledger.length() == 0) info("暂无成长记录");
        });
    }
    private void learningRecords(boolean bookmarks){begin(bookmarks?"学习书签":"学习笔记");String path=bookmarks?"/bookmarks":"/notes";load(path+"/all","GET",null,true,v->{JSONArray rows=array(v);for(int i=0;i<rows.length();i++){JSONObject r=rows.getJSONObject(i);card(content,first(r,"course_name","video_name","series_name"),first(r,"content","label")+" · "+r.optInt("timestamp_seconds")+"秒",()->playAt(r.optInt("video_id"),first(r,"course_name","video_name"),r.optInt("timestamp_seconds")));action("删除此"+(bookmarks?"书签":"笔记"),()->confirm("确认删除此记录？",()->memberWrite(path+"/"+r.optInt("id"),"DELETE",body(),()->learningRecords(bookmarks))));}if(rows.length()==0)info("暂无记录");});}
    private void legalDocument(String name,String asset){begin(name);try{TextView body=text(ReleaseInfo.read(this,asset),16);body.setTextIsSelectable(true);content.addView(body);}catch(Exception error){info("文件读取失败，请返回重试");}}
    private void about(){begin("关于 SWOD");JSONObject info=ReleaseInfo.data(this);hero("SWOD",ReleaseInfo.version(this));info(info.optString("operator"));action(info.optString("filingNumber"),()->link("https://beian.miit.gov.cn/"));action("隐私政策",()->open(()->legalDocument("隐私政策","app-privacy.txt")));action("服务条款",()->open(()->legalDocument("服务条款","app-terms.txt")));action("服务商与数据清单",()->open(()->legalDocument("服务商与数据清单","app-processors.txt")));action("官方客服",()->link(info.optString("supportURL")));action("撤回隐私授权",()->confirm("撤回将清除本地登录并停止使用 App。服务器账号不会因此自动注销，注销请使用个人中心的独立入口。",()->{generation++;io.execute(()->{try{api.logout();}catch(Exception ignored){}runOnUiThread(()->{if(!PrivacyConsent.revoke(this)){Toast.makeText(this,"保存失败，请重试撤回",Toast.LENGTH_LONG).show();return;}history.clear();recreate();});});}));}
    private void certificates(){begin("我的证书");load("/certificates","GET",null,true,v->{JSONArray rs=array(v);for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);card(content,r.optString("courseName"),r.optString("certificateNo")+" · "+r.optString("issueDate")+" · "+r.optString("status"),()->{String url=r.optString("verifyUrl");if(Policy.certificateURL(url))link(url);});String raw=r.optString("pdfUrl");String url=raw.startsWith("/")?"https://admin.swod.com.cn"+raw:raw;if("active".equals(r.optString("status"))&&Policy.certificateURL(url))action("查看电子证书",()->link(url));}if(rs.length()==0)info("暂无已颁发证书");});}
    private void messages(int cursor){begin("学习消息");action("系统通知 · "+(AppPush.allowed(this)?"已允许":"未开启"),()->{AppPush.enable(this,this::refreshUnread);Toast.makeText(this,"若通知仍未启用，请稍后重试或在系统设置中允许通知",Toast.LENGTH_LONG).show();});load("/member/messages?limit=20&cursor="+cursor,"GET",null,true,v->{JSONObject o=object(v);JSONArray rs=array(o.opt("items"));for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);card(content,("unread".equals(r.optString("status"))?"● ":"")+r.optString("title"),r.optString("content")+"\n"+r.optString("createdAt"),()->open(()->messageDetail(r.optString("recipientId"))));}if(rs.length()==0)info("暂无学习消息");if(o.optBoolean("hasMore"))action("下一页",()->open(()->messages(o.optInt("nextCursor"))));action("全部标记已读",()->mutate("/member/messages/read-all","POST",body(),()->{getSystemService(android.app.NotificationManager.class).cancelAll();refreshUnread();messages(0);}));refreshUnread();});}
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
                    runOnUiThread(()->{authBusy=false;if(version!=generation||account!=api.accountGeneration()||isFinishing())return;try{api.accept(response);history.clear();selectTab(4);page=this::account;account();}catch(Exception failure){info("登录结果保存失败，请重新登录");}});
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
        EditText view=field(box,hint,digits);view.setBackground(SwodUi.shape(this,SwodUi.field(this),8));view.setSaveEnabled(false);return view;
    }
    private void login(){login(false,"");}
    private void login(boolean passwordMode){login(passwordMode,"");}
    private void login(boolean passwordMode,String initialPhone){
        begin("登录");loginPageVisible=true;int pageVersion=generation;
        LinearLayout branding=column();branding.setGravity(Gravity.CENTER);branding.setPadding(0,dp(12),0,dp(20));
        ImageView logo=new ImageView(this);logo.setImageResource(cn.com.swod.app.R.drawable.brand_logo);logo.setScaleType(ImageView.ScaleType.FIT_CENTER);
        logo.setPadding(dp(6),dp(6),dp(6),dp(6));logo.setBackground(SwodUi.shape(this,android.graphics.Color.WHITE,18));logo.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        branding.addView(logo,new LinearLayout.LayoutParams(dp(80),dp(80)));
        TextView name=text("伊娃东方舞",26);name.setTypeface(null,android.graphics.Typeface.BOLD);name.setGravity(Gravity.CENTER);branding.addView(name);
        TextView tagline=text("舞者成长系统",14);tagline.setGravity(Gravity.CENTER);tagline.setTextColor(SwodUi.muted(this));branding.addView(tagline);content.addView(branding);
        LinearLayout card=column();card.setPadding(dp(12),dp(8),dp(12),dp(8));card.setBackgroundColor(android.graphics.Color.TRANSPARENT);
        LinearLayout.LayoutParams cardLayout=new LinearLayout.LayoutParams(Math.min(dp(440),getResources().getDisplayMetrics().widthPixels-dp(32)),-2);cardLayout.gravity=Gravity.CENTER_HORIZONTAL;content.addView(card,cardLayout);
        CheckBox consent=new CheckBox(this);consent.setText("我已阅读并同意以下协议");consent.setTextColor(SwodUi.ink(this));consent.setMinHeight(dp(48));consent.setChecked(false);consent.setSaveEnabled(false);
        boolean[] carrierAvailable={false};
        Button carrier=loginAction("手机号一键登录",()->{
            if(consent.isChecked()){loginWithCarrier(consent);return;}
            int consentPage=generation;
            new AlertDialog.Builder(this).setTitle("请先阅读并同意协议")
                .setMessage("请阅读登录页的《隐私政策》和《服务条款》。点击“同意并继续”将勾选协议，并进入运营商号码认证。")
                .setNegativeButton("暂不同意",null)
                .setPositiveButton("同意并继续",(dialog,which)->{if(consentPage==generation&&!isFinishing()){consent.setChecked(true);loginWithCarrier(consent);}}).show();
        });card.addView(carrier,new LinearLayout.LayoutParams(-1,-2));
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
                runOnUiThread(()->{authBusy=false;if(version!=generation||accountVersion!=api.accountGeneration()||isFinishing())return;try{api.accept(response);history.clear();selectTab(4);page=this::account;account();}catch(Exception e){info(e.getMessage());}});
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
            carrier.setEnabled(idle&&carrierAvailable[0]);alternate.setEnabled(idle);phone.setEnabled(idle);secret.setEnabled(idle);consent.setEnabled(idle);
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
    private void myEvents(){begin("我的比赛");title.setText("我的比赛");pageScroll.setBackgroundColor(eventCanvas());load("/member/events","GET",null,true,value->{JSONObject data=object(value),summary=object(data.opt("summary"));JSONArray entries=array(data.opt("entries"));LinearLayout stats=eventSurface(content,"我的比赛");eventInfo(stats,"已报名赛事",summary.optString("eventCount","—"));eventInfo(stats,"参赛组别",summary.optString("groupCount",String.valueOf(entries.length())));eventInfo(stats,"已公布成绩",summary.optString("publishedCount","—"));EditText query=registrationInput(content,"搜索赛事、组别或参赛人");LinearLayout parent=column();content.addView(parent);int[] page={1};Runnable[] render={null};render[0]=()->{parent.removeAllViews();java.util.List<JSONObject> matches=new java.util.ArrayList<>();String q=query.getText().toString().trim().toLowerCase(Locale.ROOT);for(int i=0;i<entries.length();i++){JSONObject row=entries.optJSONObject(i);if((first(row,"competitionName")+" "+first(row,"groupName")+" "+first(row,"entrantName")).toLowerCase(Locale.ROOT).contains(q))matches.add(row);}int pages=Math.max(1,(matches.size()+19)/20);page[0]=Math.min(page[0],pages);for(int i=(page[0]-1)*20;i<Math.min(page[0]*20,matches.size());i++){JSONObject row=matches.get(i);LinearLayout box=eventSurface(parent,first(row,"competitionName"));box.addView(text(first(row,"groupName")+" · "+first(row,"playerNo"),16));box.addView(text("参赛人："+first(row,"entrantName"),14));if(!first(row,"performanceTitle").isEmpty())box.addView(text("节目："+first(row,"performanceTitle"),14));box.addView(text(CompetitionRecord.audit(row.optString("auditStatus"))+" · "+CompetitionRecord.paid(row.optString("paidStatus"))+" · "+first(row,"startDate"),14));TextView result=text(CompetitionRecord.result(row.opt("resultPublished"),first(row,"totalScore"),row.optInt("rankNo"),first(row,"awardName")),17);result.setTextColor(red);box.addView(result);if(row.optBoolean("resultPublished")){JSONArray scores=array(row.opt("judgeScores"));for(int n=0;n<scores.length();n++){JSONObject score=scores.optJSONObject(n);eventInfo(box,first(score,"judgeName"),publicScore(score.opt("score")));}}LinearLayout previous=content;content=box;long player=row.optLong("playerId");if(row.optBoolean("canPay")&&player>0)action("继续缴费 · 前往官方收银台",()->link("https://www.swod.com.cn/checkout/event/"+player));if(player>0)action("修改报名 / 补交音乐",()->open(()->editRegistration(player)));int id=row.optInt("competitionId");if(id>0)action("赛事详情",()->open(()->event(id)));content=previous;}if(matches.isEmpty())parent.addView(text(q.isEmpty()?"暂无比赛报名和结果记录":"未找到匹配记录",14));if(pages>1){LinearLayout pagination=row();Button prev=button("上一页",()->{page[0]--;render[0].run();});prev.setEnabled(page[0]>1);pagination.addView(prev,new LinearLayout.LayoutParams(0,-2,1));pagination.addView(text(page[0]+" / "+pages,14));Button next=button("下一页",()->{page[0]++;render[0].run();});next.setEnabled(page[0]<pages);pagination.addView(next,new LinearLayout.LayoutParams(0,-2,1));parent.addView(pagination);}};query.addTextChangedListener(new TextWatcher(){public void beforeTextChanged(CharSequence v,int a,int c,int f){}public void onTextChanged(CharSequence v,int a,int b,int c){page[0]=1;render[0].run();}public void afterTextChanged(Editable value){}});render[0].run();});}

    private void records(String name,String path,String key,RowTap tap){begin(name);load(path,"GET",null,true,v->{Object items=key.isEmpty()?v:object(v).opt(key);JSONArray rs=array(items);if(rs.length()==0&&items instanceof JSONObject)rs=new JSONArray().put(items);displayRows(rs,new String[]{"series_name","course_name","competitionName","name","groupName","auditStatus","totalScore","content","label","status"},tap);if(rs.length()==0)info("暂无记录");});}
    private void displayRows(JSONArray rs,String[] fields,RowTap tap)throws Exception{for(int i=0;i<rs.length();i++){JSONObject r=rs.getJSONObject(i);String summary="";for(String f:fields){String s=first(r,f);if(!s.isEmpty())summary+=s+" · ";}card(content,first(r,"name","title","courseName","series_name","course_name","playerName"),summary,tap==null?null:()->tap.tap(r));}}
    private void mutate(String path,String method,JSONObject body,Runnable next){load(path,method,body,true,v->{history.clear();page=next;next.run();});}
    private void link(String url){if(Policy.secureURL(url))try{startActivity(new Intent(Intent.ACTION_VIEW,Uri.parse(url)));}catch(Exception e){info("暂时无法打开链接");}}
    private static String strip(String html){return android.text.Html.fromHtml(html,android.text.Html.FROM_HTML_MODE_LEGACY).toString();}
    private static String mask(String phone){return phone.length()==11?phone.substring(0,3)+"****"+phone.substring(7):"";}
    @Override protected void onDestroy(){generation++;carrierLogin.cancel();io.shutdownNow();imageIO.shutdownNow();super.onDestroy();}
}
