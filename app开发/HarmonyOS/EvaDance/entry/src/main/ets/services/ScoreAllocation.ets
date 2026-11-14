// Allocate integer hundredths, preserving proportions and per-item caps.
export function distributeScores(maxima: number[], current: number[], target: number) {
 const caps=maxima.map((n: number)=>Math.max(0,Math.floor((Number(n)||0)*100+1e-7)));
 const goal=Math.round(Number(target)*100);
 if(!Number.isFinite(Number(target))||goal<0||goal>caps.reduce((a: number,b: number)=>a+b,0))throw new Error('总分超出范围');
 let weights=current.map((n: number,i: number)=>Math.min(caps[i],Math.max(0,(Number(n)||0)*100)));
 if(!weights.some((n: number)=>n>0))weights=caps.slice();
 const exact=caps.map((): number=>0);let remaining=goal, active=caps.map((_: number,i: number)=>i).filter((i: number)=>caps[i]>0);
 while(active.length && remaining>1e-8){
  let sum=active.reduce((s: number,i: number)=>s+weights[i],0);
  if(sum<=0){for(const i of active)weights[i]=caps[i];sum=active.reduce((s: number,i: number)=>s+weights[i],0);}
  const saturated=active.filter((i: number)=>remaining*weights[i]/sum>=caps[i]);
  if(!saturated.length){for(const i of active)exact[i]=remaining*weights[i]/sum;break;}
  for(const i of saturated){exact[i]=caps[i];remaining-=caps[i];}
  active=active.filter((i: number)=>!saturated.includes(i));
 }
 const cents=exact.map((n: number)=>Math.floor(n+1e-8));let left=goal-cents.reduce((s: number,n: number)=>s+n,0);
 const order=caps.map((_: number,i: number)=>i).filter((i: number)=>cents[i]<caps[i]).sort((a: number,b: number)=>(exact[b]-cents[b])-(exact[a]-cents[a])||a-b);
 for(const i of order){if(left<=0)break;cents[i]++;left--;}
 return cents.map((n: number)=>n/100);
}

