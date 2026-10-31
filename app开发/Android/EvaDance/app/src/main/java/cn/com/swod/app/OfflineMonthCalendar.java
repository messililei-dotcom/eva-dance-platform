package cn.com.swod.app;

import android.content.Context;
import android.graphics.Color;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.widget.*;
import org.json.JSONArray;
import org.json.JSONObject;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.*;

/** Public course periods only; no cached purchase or account state. */
public final class OfflineMonthCalendar extends LinearLayout {
    public interface OpenCourse { void open(JSONObject row); }
    private final JSONArray courses;
    private final OpenCourse open;
    private YearMonth month = YearMonth.now();
    private float touchX, touchY;
    private int axis;
    private long suppressUntil;
    private static final int[][] COLORS={{0xfff9dfe0,0xff842e39},{0xffdcecd6,0xff315c35},{0xffdce7f4,0xff345575},{0xfff4e7cc,0xff745529}};
    public OfflineMonthCalendar(Context context, JSONArray courses, OpenCourse open) {
        super(context); this.courses=courses; this.open=open;
        setOrientation(VERTICAL); setBackground(SwodUi.touch(context,SwodUi.surface(context),12)); render();
    }
    private int dp(float n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private TextView text(String value,int size,int color){TextView t=new TextView(getContext());t.setText(value);t.setTextSize(size);t.setTextColor(color);t.setGravity(Gravity.CENTER);return t;}
    private Button button(String label,String accessibility,Runnable action){Button b=new Button(getContext());b.setText(label);b.setTextSize(13);b.setTextColor(SwodUi.primary(getContext()));b.setContentDescription(accessibility);b.setMinWidth(0);b.setMinimumWidth(0);b.setPadding(0,0,0,0);b.setBackground(SwodUi.touch(getContext(),Color.TRANSPARENT,8));b.setOnClickListener(v->action.run());return b;}
    private LocalDate date(String value){try{String s=value.length()>10?value.substring(0,10):value;LocalDate d=LocalDate.parse(s);return d.toString().equals(s)?d:null;}catch(Exception ignored){return null;}}
    private static final class Period {JSONObject row;int index;LocalDate start,end;Period(JSONObject r,int i,LocalDate s,LocalDate e){row=r;index=i;start=s;end=e;}}
    private void move(int offset){month=month.plusMonths(offset);render();announceForAccessibility(month.getYear()+"年"+month.getMonthValue()+"月");}
    private void render(){
        removeAllViews();ArrayList<Period> periods=new ArrayList<>();
        for(int i=0;i<courses.length();i++){JSONObject r=courses.optJSONObject(i);if(r==null)continue;LocalDate start=date(r.optString("start_date")),end=date(r.optString("end_date").isEmpty()?r.optString("start_date"):r.optString("end_date"));if(start!=null&&end!=null&&!end.isBefore(start))periods.add(new Period(r,i,start,end));}
        periods.sort((a,b)->{int d=a.start.compareTo(b.start);if(d==0)d=b.end.compareTo(a.end);return d==0?Integer.compare(a.index,b.index):d;});
        LocalDate first=month.atDay(1),last=month.atEndOfMonth();int count=0;for(Period p:periods)if(!p.start.isAfter(last)&&!p.end.isBefore(first))count++;
        LinearLayout toolbar=new LinearLayout(getContext());toolbar.setGravity(Gravity.CENTER_VERTICAL);toolbar.setPadding(dp(8),dp(8),dp(8),dp(8));
        LinearLayout heading=new LinearLayout(getContext());heading.setOrientation(VERTICAL);TextView title=text(month.getYear()+"年"+month.getMonthValue()+"月",18,SwodUi.ink(getContext()));title.setGravity(Gravity.START);heading.addView(title);TextView subtitle=text(count+" 个课程期次 · 左右滑动切月",10,SwodUi.muted(getContext()));subtitle.setGravity(Gravity.START);heading.addView(subtitle);toolbar.addView(heading,new LinearLayout.LayoutParams(0,-2,1));
        toolbar.addView(button("‹","上个月",()->move(-1)),new LinearLayout.LayoutParams(dp(40),dp(44)));toolbar.addView(button("本月","返回本月",()->{month=YearMonth.now();render();}),new LinearLayout.LayoutParams(dp(44),dp(44)));toolbar.addView(button("›","下个月",()->move(1)),new LinearLayout.LayoutParams(dp(40),dp(44)));addView(toolbar);
        LinearLayout weekdays=new LinearLayout(getContext());for(String d:new String[]{"一","二","三","四","五","六","日"})weekdays.addView(text("周"+d,11,SwodUi.muted(getContext())),new LinearLayout.LayoutParams(0,dp(40),1));addView(weekdays);
        int offset=first.getDayOfWeek().getValue()-1,weeks=(int)Math.ceil((offset+month.lengthOfMonth())/7.0);LocalDate grid=first.minusDays(offset);
        for(int w=0;w<weeks;w++){
            LocalDate start=grid.plusDays(w*7L),end=start.plusDays(6);FractionRow row=new FractionRow(getContext());ArrayList<Integer> lanes=new ArrayList<>();
            for(int day=0;day<7;day++){LocalDate current=start.plusDays(day);LinearLayout cell=new LinearLayout(getContext());cell.setGravity(Gravity.TOP|Gravity.CENTER_HORIZONTAL);cell.setPadding(0,dp(8),0,0);if(!YearMonth.from(current).equals(month))cell.setBackgroundColor(SwodUi.field(getContext()));TextView date=text(String.valueOf(current.getDayOfMonth()),14,current.equals(LocalDate.now())?(SwodUi.dark(getContext())?0xff3c1012:Color.WHITE):SwodUi.ink(getContext()));if(current.equals(LocalDate.now()))date.setBackground(SwodUi.touch(getContext(),SwodUi.primary(getContext()),16));date.setContentDescription(current.toString()+(current.equals(LocalDate.now())?" 今天":""));cell.addView(date,new LinearLayout.LayoutParams(dp(32),dp(32)));row.addFraction(cell,day,1,0,0);}
            for(Period p:periods){if(p.start.isAfter(end)||p.end.isBefore(start))continue;int left=(int)Math.max(0,p.start.toEpochDay()-start.toEpochDay()),right=(int)Math.min(6,p.end.toEpochDay()-start.toEpochDay());int lane=0;while(lane<lanes.size()&&lanes.get(lane)>=left)lane++;if(lane==lanes.size())lanes.add(right);else lanes.set(lane,right);
                String type=p.row.optString("category",p.row.optString("type"));int index=type.contains("集训")||type.equals("bootcamp")?0:type.contains("传承")||type.equals("masterclass")?1:type.contains("认证")||type.equals("certification")?2:3;
                TextView course=text(p.row.optString("name","线下课程"),12,COLORS[index][1]);course.setGravity(Gravity.CENTER_VERTICAL|Gravity.START);course.setSingleLine(true);course.setEllipsize(TextUtils.TruncateAt.END);course.setPadding(dp(5),0,dp(5),0);course.setBackground(SwodUi.touch(getContext(),COLORS[index][0],4));course.setContentDescription(p.row.optString("name")+"，"+p.start+"至"+p.end+"，查看详情");course.setFocusable(true);course.setOnClickListener(v->{if(android.os.SystemClock.uptimeMillis()>=suppressUntil)open.open(p.row);});row.addFraction(course,left,right-left+1,44+lane*36,32);
            }
            addView(row,new LinearLayout.LayoutParams(-1,dp(Math.max(116,52+lanes.size()*36))));View line=new View(getContext());line.setBackgroundColor(SwodUi.line(getContext()));addView(line,new LinearLayout.LayoutParams(-1,dp(1)));
        }
        if(count==0){TextView empty=text("本月暂无课程安排，请切换月份查看。",12,SwodUi.muted(getContext()));empty.setPadding(dp(8),dp(16),dp(8),dp(16));addView(empty);}
    }
    @Override public boolean onInterceptTouchEvent(MotionEvent e){
        if(e.getActionMasked()==MotionEvent.ACTION_DOWN){touchX=e.getX();touchY=e.getY();axis=0;suppressUntil=0;}
        else if(e.getPointerCount()!=1){axis=2;}
        else if(e.getActionMasked()==MotionEvent.ACTION_MOVE){float dx=Math.abs(e.getX()-touchX),dy=Math.abs(e.getY()-touchY);if(axis==0&&Math.max(dx,dy)>dp(10))axis=dx>dy*1.5?1:2;if(axis==1){getParent().requestDisallowInterceptTouchEvent(true);return true;}}
        return super.onInterceptTouchEvent(e);
    }
    @Override public boolean onTouchEvent(MotionEvent e){
        if(e.getActionMasked()==MotionEvent.ACTION_CANCEL){axis=0;getParent().requestDisallowInterceptTouchEvent(false);return true;}
        if(e.getPointerCount()!=1){axis=2;return true;}
        if(e.getActionMasked()==MotionEvent.ACTION_UP){float dx=e.getX()-touchX,dy=e.getY()-touchY;if(axis!=2&&Math.abs(dx)>=dp(48)&&Math.abs(dx)>Math.abs(dy)*1.5){suppressUntil=android.os.SystemClock.uptimeMillis()+500;move(dx<0?1:-1);}axis=0;getParent().requestDisallowInterceptTouchEvent(false);return true;}
        return true;
    }
    private final class FractionRow extends FrameLayout {
        FractionRow(Context c){super(c);}
        void addFraction(View view,int left,int span,int top,int height){view.setTag(new int[]{left,span,top,height});addView(view,new FrameLayout.LayoutParams(1,1));}
        @Override protected void onMeasure(int w,int h){super.onMeasure(w,h);for(int i=0;i<getChildCount();i++){View child=getChildAt(i);int[] f=(int[])child.getTag();int width=(int)(getMeasuredWidth()*f[1]/7f)-(f[3]>0?dp(4):0);child.measure(MeasureSpec.makeMeasureSpec(Math.max(0,width),MeasureSpec.EXACTLY),MeasureSpec.makeMeasureSpec(f[3]>0?dp(f[3]):getMeasuredHeight(),MeasureSpec.EXACTLY));}}
        @Override protected void onLayout(boolean changed,int l,int t,int r,int b){for(int i=0;i<getChildCount();i++){View child=getChildAt(i);int[] f=(int[])child.getTag();int x=(int)((r-l)*f[0]/7f)+(f[3]>0?dp(2):0),y=dp(f[2]);child.layout(x,y,x+child.getMeasuredWidth(),y+child.getMeasuredHeight());}}
    }
}
