// Allocate integer hundredths, preserving proportions and per-item caps.
function distributeScores(maxima, current, target) {
 const caps=maxima.map(n=>Math.max(0,Math.floor((Number(n)||0)*100+1e-7)));
 const goal=Math.round(Number(target)*100);
 if(!Number.isFinite(Number(target))||goal<0||goal>caps.reduce((a,b)=>a+b,0))throw new Error('总分超出范围');
 let weights=current.map((n,i)=>Math.min(caps[i],Math.max(0,(Number(n)||0)*100)));
 if(!weights.some(n=>n>0))weights=caps.slice();
 const exact=caps.map(()=>0);let remaining=goal, active=caps.map((_,i)=>i).filter(i=>caps[i]>0);
 while(active.length && remaining>1e-8){
  let sum=active.reduce((s,i)=>s+weights[i],0);
  if(sum<=0){for(const i of active)weights[i]=caps[i];sum=active.reduce((s,i)=>s+weights[i],0);}
  const saturated=active.filter(i=>remaining*weights[i]/sum>=caps[i]);
  if(!saturated.length){for(const i of active)exact[i]=remaining*weights[i]/sum;break;}
  for(const i of saturated){exact[i]=caps[i];remaining-=caps[i];}
  active=active.filter(i=>!saturated.includes(i));
 }
 const cents=exact.map(n=>Math.floor(n+1e-8));let left=goal-cents.reduce((s,n)=>s+n,0);
 const order=caps.map((_,i)=>i).filter(i=>cents[i]<caps[i]).sort((a,b)=>(exact[b]-cents[b])-(exact[a]-cents[a])||a-b);
 for(const i of order){if(left<=0)break;cents[i]++;left--;}
 return cents.map(n=>n/100);
}
module.exports={distributeScores};
