/* the real aladhan shape, taken from live responses observed for these dates */
const REAL = {
  "31-08-2026": {day:"18",month:{number:3,en:"Rabīʿ al-awwal"},year:"1448",holidays:[],method:"HJCoSA"},
  "14-05-2027": {day:"8", month:{number:12,en:"Dhū al-Ḥijjah"},year:"1448",holidays:[],method:"HJCoSA"},
  "15-05-2027": {day:"9", month:{number:12,en:"Dhū al-Ḥijjah"},year:"1448",holidays:["Hajj","Arafa"],method:"HJCoSA"},
  "16-05-2027": {day:"10",month:{number:12,en:"Dhū al-Ḥijjah"},year:"1448",holidays:["Eid-ul-Adha"],method:"HJCoSA"}
};
/* everything else is generated off the 31-08-2026 anchor so ranges work */
const ANCHOR = Date.parse("2026-08-31T12:00:00Z"), AH = {d:18,m:3,y:1448};
function synth(dd){
  const [d,m,y]=dd.split("-").map(Number);
  const t=Date.parse(`${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}T12:00:00Z`);
  let n=Math.round((t-ANCHOR)/86400000), hd=AH.d, hm=AH.m, hy=AH.y;
  const len=x=>x%2===1?30:29;
  while(n>0){hd++; if(hd>len(hm)){hd=1;hm++; if(hm>12){hm=1;hy++;}} n--;}
  while(n<0){hd--; if(hd<1){hm--; if(hm<1){hm=12;hy--;} hd=len(hm);} n++;}
  return {day:String(hd),month:{number:hm,en:"m"+hm},year:String(hy),holidays:[],method:"HJCoSA"};
}
export function stubFetch(failFor){
  return async (url)=>{
    const dd=String(url).split("/").pop();
    if(failFor&&failFor(dd)) return {ok:false,status:503,json:async()=>({})};
    const h=REAL[dd]||synth(dd);
    return {ok:true,status:200,json:async()=>({data:{hijri:h}})};
  };
}
