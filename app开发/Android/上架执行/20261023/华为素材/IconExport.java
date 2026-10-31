package cn.com.swod.app;
import android.app.Activity;import android.os.Bundle;import android.graphics.*;import android.graphics.drawable.*;import java.io.*;
public final class IconExport extends Activity {
 public void onCreate(Bundle state){super.onCreate(state);try{
  Drawable icon=getDrawable(R.mipmap.ic_launcher);Bitmap bitmap=Bitmap.createBitmap(216,216,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);
  if(icon instanceof AdaptiveIconDrawable){AdaptiveIconDrawable adaptive=(AdaptiveIconDrawable)icon;Drawable background=adaptive.getBackground(),foreground=adaptive.getForeground();background.setBounds(0,0,216,216);background.draw(canvas);foreground.setBounds(0,0,216,216);foreground.draw(canvas);}
  else{icon.setBounds(0,0,216,216);icon.draw(canvas);}
  try(FileOutputStream output=new FileOutputStream(new File(getExternalFilesDir(null),"icon-216.png"))){bitmap.compress(Bitmap.CompressFormat.PNG,100,output);}finish();
 }catch(Exception error){throw new RuntimeException(error);}}
}