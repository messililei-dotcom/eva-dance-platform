package cn.com.swod.app;

import android.content.Context;
import android.content.res.ColorStateList;
import android.content.res.Configuration;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.graphics.drawable.RippleDrawable;

/** Shared native surface roles and a single 24 dp outline icon family. */
final class SwodUi {
    private SwodUi() {}
    static boolean dark(Context c) { return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES; }
    static int canvas(Context c) { return Color.parseColor(dark(c) ? "#141619" : "#F5F6F8"); }
    static int surface(Context c) { return Color.parseColor(dark(c) ? "#202328" : "#FFFFFF"); }
    static int ink(Context c) { return Color.parseColor(dark(c) ? "#F3F4F6" : "#20242B"); }
    static int muted(Context c) { return Color.parseColor(dark(c) ? "#B5BAC4" : "#626A77"); }
    static int primary(Context c) { return Color.parseColor(dark(c) ? "#FFACA9" : "#9F1D20"); }
    static int tonal(Context c) { return Color.parseColor(dark(c) ? "#3C272A" : "#F9EDEC"); }
    static int line(Context c) { return Color.parseColor(dark(c) ? "#373D46" : "#E2E5EA"); }
    static GradientDrawable shape(Context c, int color, int radius) {
        GradientDrawable d = new GradientDrawable(); d.setColor(color);
        d.setCornerRadius(radius * c.getResources().getDisplayMetrics().density); return d;
    }
    static Drawable touch(Context c, int color, int radius) {
        return new RippleDrawable(ColorStateList.valueOf(dark(c) ? 0x28FFFFFF : 0x189F1D20), shape(c,color,radius), shape(c,Color.WHITE,radius));
    }
    static Drawable icon(Context c, String kind, int color) { return new Icon(kind,color,Math.round(24*c.getResources().getDisplayMetrics().density)); }
    private static final class Icon extends Drawable {
        private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        private final String kind; private final int size;
        Icon(String kind,int color,int size) { this.kind=kind;this.size=size;paint.setColor(color);paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(1.8f);paint.setStrokeCap(Paint.Cap.ROUND);paint.setStrokeJoin(Paint.Join.ROUND); }
        @Override public int getIntrinsicWidth(){return size;}
        @Override public int getIntrinsicHeight(){return size;}
        private void path(Canvas c,float... points){Path p=new Path();p.moveTo(points[0],points[1]);for(int i=2;i<points.length;i+=2)p.lineTo(points[i],points[i+1]);c.drawPath(p,paint);}
        @Override public void draw(Canvas c) {
            c.save();c.translate(getBounds().left,getBounds().top);c.scale(getBounds().width()/24f,getBounds().height()/24f);
            switch(kind){
                case "learn": c.drawRoundRect(3,4,21,20,3,3,paint);path(c,10,9,16,12,10,15,10,9);break;
                case "calendar": c.drawRoundRect(3,5,21,21,3,3,paint);path(c,3,10,21,10);path(c,8,3,8,7);path(c,16,3,16,7);path(c,8,15,10,15);path(c,14,15,16,15);break;
                case "trophy": path(c,7,3,17,3,17,9);c.drawArc(7,4,17,14,0,180,false,paint);path(c,7,4,3,4,3,8,7,11);path(c,17,4,21,4,21,8,17,11);path(c,12,14,12,20);path(c,7,21,17,21);break;
                case "bag": c.drawRoundRect(4,7,20,21,2,2,paint);c.drawArc(8,2,16,12,180,180,false,paint);break;
                case "person": c.drawCircle(12,7,4,paint);c.drawArc(4,13,20,27,180,180,false,paint);break;
                case "back": path(c,15,5,8,12,15,19);break;
                case "next": path(c,9,6,15,12,9,18);break;
                case "refresh": c.drawArc(4,4,20,20,45,285,false,paint);path(c,20,4,20,10,14,10);break;
                default: c.drawCircle(12,12,8,paint);path(c,10,8,16,12,10,16,10,8);
            }
            c.restore();
        }
        @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
        @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    }
}
