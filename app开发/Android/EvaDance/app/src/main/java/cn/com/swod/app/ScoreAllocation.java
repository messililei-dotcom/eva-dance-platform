package cn.com.swod.app;
import java.util.*;
/** Integer hundredths; bounded proportional distribution with stable remainder. */
final class ScoreAllocation {
 static double[] distribute(double[] maxima,double[] current,double target){
  int n=maxima.length,goal=(int)Math.round(target*100),capacity=0;int[] caps=new int[n];double[] w=new double[n],exact=new double[n];boolean any=false;
  for(int i=0;i<n;i++){caps[i]=(int)Math.floor(maxima[i]*100+1e-7);capacity+=caps[i];w[i]=Math.min(caps[i],Math.max(0,current[i]*100));any|=w[i]>0;}
  if(!Double.isFinite(target)||target<0||target>capacity/100.0)throw new IllegalArgumentException("总分超出范围");
  List<Integer> active=new ArrayList<>();for(int i=0;i<n;i++){if(!any)w[i]=caps[i];if(caps[i]>0)active.add(i);}double remaining=goal;
  while(!active.isEmpty()&&remaining>1e-8){double sum=0;for(int i:active)sum+=w[i];if(sum<=0){for(int i:active){w[i]=caps[i];sum+=w[i];}}List<Integer> saturated=new ArrayList<>();for(int i:active)if(remaining*w[i]/sum>=caps[i])saturated.add(i);if(saturated.isEmpty()){for(int i:active)exact[i]=remaining*w[i]/sum;break;}for(int i:saturated){exact[i]=caps[i];remaining-=caps[i];}active.removeAll(saturated);}
  int[] cents=new int[n];int left=goal;List<Integer> order=new ArrayList<>();for(int i=0;i<n;i++){cents[i]=(int)Math.floor(exact[i]+1e-8);left-=cents[i];if(cents[i]<caps[i])order.add(i);}order.sort((a,b)->{int c=Double.compare(exact[b]-cents[b],exact[a]-cents[a]);return c==0?Integer.compare(a,b):c;});for(int i:order){if(left--<=0)break;cents[i]++;}double[] result=new double[n];for(int i=0;i<n;i++)result[i]=cents[i]/100.0;return result;
 }
}
