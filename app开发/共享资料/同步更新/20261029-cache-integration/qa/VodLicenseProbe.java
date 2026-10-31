package cn.com.swod.app;
import android.app.Instrumentation;
import android.content.Context;
import android.os.Bundle;
import com.aliyun.common.AlivcLicense;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
public final class VodLicenseProbe extends Instrumentation {
 @Override public void onCreate(Bundle args){super.onCreate(args);start();}
 @Override public void onStart(){ Bundle result=new Bundle();try{
  Context context=getTargetContext(); String namespace="cache-qa-disposable";
  TokenVault vault=new TokenVault(context,namespace);vault.save("cache-test-only");
  if(!"cache-test-only".equals(new TokenVault(context,namespace).read()))throw new Exception("vault restore failed");
  String sealed=context.getSharedPreferences(namespace,0).getString("encrypted","");
  if(sealed.contains("cache-test-only"))throw new Exception("plaintext stored");
  context.getSharedPreferences(namespace,0).edit().putString("encrypted",sealed.substring(0,sealed.length()-4)+"AAAA").commit();
  if(vault.read()!=null)throw new Exception("tampered ciphertext accepted");vault.clear(); result.putBoolean("keystoreRoundTrip",true);result.putBoolean("tamperRejected",true);
  CountDownLatch done=new CountDownLatch(1);
  Bundle meta=context.getPackageManager().getApplicationInfo(context.getPackageName(),128).metaData;
  AlivcLicense.configLicense(context,meta.getString("com.aliyun.alivc_license.licensekey"),meta.getString("com.aliyun.alivc_license.licensefile"),new AlivcLicense.LicenseCallback(){public void onConfigResult(boolean valid,String text){result.putBoolean("licenseValid",valid);result.putString("licenseResult",text);done.countDown();}});
  if(!done.await(35,TimeUnit.SECONDS))throw new Exception("license callback timeout");
  if(!result.getBoolean("licenseValid"))throw new Exception("license rejected");
  finish(-1,result);
 }catch(Exception error){result.putString("failure",error.getMessage());finish(0,result);}}
}
