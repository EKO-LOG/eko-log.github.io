(()=>{
const $=s=>document.querySelector(s),app=$("#app");
const toast=m=>{const t=$("#toast");t.textContent=m;t.classList.add("on");setTimeout(()=>t.classList.remove("on"),2000)};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const rx=s=>s.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),tr=s=>String(s).toLocaleLowerCase("tr");
const lbl=n=>n.startsWith("Mükerrer ")?"Mükerrer Madde "+n.slice(9):n.startsWith("Ek ")?"Ek Madde "+n.slice(3):n.startsWith("Geçici ")?"Geçici Madde "+n.slice(7):/^\d/.test(n)?"Madde "+n:n;
const slug=n=>n.replace(/\s+/g,"-").replace(/\//g,"_");
const NOTES={"2576:7":"Site notu: Parasal sınır 7589 sayılı Kanunla (yürürlük: 31/7/2026) 486.000 TL olarak değiştirilmiştir; Ek Madde 1 uyarınca her yıl yeniden değerleme oranında artırılır."};
const AM=/\((?:Değişik|Ek|Mülga|İptal|Aynen kabul|Yeniden düzenleme|Ek cümle|Ek fıkra|Mülga cümle|Mülga birinci cümle|İptal cümle)[^)]*\)/g;
const loaded={};let toks=[],lim=40,term="",tm;
const load=no=>loaded[no]||(loaded[no]=new Promise((ok,no_)=>{if(MZ.data[no])return ok(MZ.data[no]);const s=document.createElement("script");s.src="data/"+no+".js";s.onload=()=>ok(MZ.data[no]);s.onerror=()=>{delete loaded[no];no_()};document.head.appendChild(s)}));
function fmt(t){t=esc(t).replace(AM,m=>'<span class="am">'+m+"</span>").replace(/⟦(\d+)⟧/g,'<sup class="fnm">[$1]</sup>');
 if(!toks.length)return t;const re=new RegExp("("+toks.map(x=>rx(esc(x))).join("|")+")","giu");
 return t.split(/(<[^>]+>)/).map(p=>p[0]==="<"?p:p.replace(re,"<mark>$1</mark>")).join("")}
function flat(m){const a=[m.b||"",m.bo||""];for(const b of m.p){if(typeof b==="string")a.push(b);else b.t.forEach(r=>r.forEach(c=>a.push(c)))}(m.f||[]).forEach(f=>a.push(f[1]));return a.join(" ")}
const hay=(l,m)=>m._h||(m._h=tr(l.no+" "+l.kisa+" "+l.ad+" "+lbl(m.no)+" "+flat(m).replace(/⟦\d+⟧/g,"")));
function body(m){let h=m.p.map(b=>typeof b==="string"?"<p>"+fmt(b)+"</p>":'<div class="tw"><table>'+b.t.map(r=>"<tr>"+r.map(c=>"<td>"+fmt(c)+"</td>").join("")+"</tr>").join("")+"</table></div>").join("");
 if(m.f&&m.f.length)h+='<div class="fns"><b>Dipnotlar</b>'+m.f.map(f=>`<div>[${f[0]}] ${esc(f[1])}</div>`).join("")+"</div>";return h}
function art(l,m,open){const nt=NOTES[l.no+":"+m.no],s=slug(m.no);
 return `<details class="case" id="a-${esc(l.no)}-${esc(s)}"${open?" open":""}><summary><span class="no">${esc(l.kisa)} · ${esc(lbl(m.no))}</span><span class="bs">${fmt((m.b||"").replace(/:(?=(⟦\d+⟧)*$)/,""))}</span></summary><div class="body">${body(m)}${nt?`<div class="note">${esc(nt)}</div>`:""}<div class="acts"><button class="btn sm" data-cp="${esc(l.no+" sayılı "+l.ad+" "+lbl(m.no).replace("Madde","md."))}">Atıf kopyala</button><button class="btn sm" data-ln="#/${esc(l.no)}/${esc(s)}">Bağlantıyı kopyala</button></div></div></details>`}
function search(laws){toks=tr(term).split(/\s+/).filter(Boolean);const h=[];
 for(const l of laws)for(const m of l.m){let sc=0;if(toks.length){const x=hay(l,m);if(!toks.every(t=>x.includes(t)))continue;const mn=tr(m.no);sc=(toks.some(t=>t===mn)?2:0)+(toks.some(t=>tr(m.b||"").includes(t))?1:0)}h.push({l,m,sc})}
 if(toks.length)h.sort((a,b)=>b.sc-a.sc);return h}
function list(hits,box,openSlug,showLaw){let out="",last="",bo="";
 hits.slice(0,lim).forEach(({l,m})=>{
  if(showLaw&&l.no!==last){out+=`<div class="bl">${esc(l.kisa)} · ${esc(l.ad)}</div>`;last=l.no}
  if(!showLaw&&!toks.length&&(m.bo||"")!==bo){bo=m.bo||"";if(bo)out+=`<div class="bl">${fmt(bo)}</div>`}
  out+=art(l,m,(openSlug&&slug(m.no)===openSlug)||(toks.length&&hits.length<4))});
 if(hits.length>lim)out+=`<button class="btn sm more" data-more>Daha fazla göster (${hits.length-lim})</button>`;
 box.innerHTML=out||'<div class="empty">Sonuç bulunamadı.</div>'}
const hero=(inner,sm)=>`<div class="aurora hero${sm?" sm":""}"><i></i><i></i><i></i><div class="wrap">${inner}</div></div>`;
let hq="";
function home(){document.title="Mevzuat · Eko-Log";
 const gs=MZ.groups.map((g,i)=>`<section><div class="wrap"><h2>${esc(g)}</h2><div class="grid">`+MZ.index.filter(x=>x.g===i).map(x=>`<a class="card" href="#/${esc(x.no)}"><b>${esc(x.kisa)}</b><span>${esc(x.ad)}</span><small>${x.n} madde · ${esc(x.no)} sayılı · ${esc(x.rg)}</small></a>`).join("")+"</div></div></section>").join("");
 app.innerHTML=hero(`<h1 class="rise">Mevzuat</h1><p class="rise">İdari yargı ve kamu hukuku mevzuatı; metinler, dipnotlar ve tablolarıyla birlikte, mevzuat.gov.tr kaynağından.</p><div class="rise"><a class="btn line" href="#/sure">⏱ Süre hesaplama aracı</a></div><div class="rise"><input id="hq" type="search" placeholder="Tüm kanunlarda ara: kelime veya madde no…" autocomplete="off" value="${esc(hq)}"></div>`)+`<div id="res" class="wrap" hidden><div class="cnt" id="rc"></div><div id="rl"></div></div><div id="gs">${gs}</div>`;
 $("#hq").oninput=e=>{clearTimeout(tm);tm=setTimeout(()=>{hq=e.target.value.trim();gsearch()},250)};if(hq)gsearch()}
async function gsearch(){const res=$("#res"),gs=$("#gs");if(!hq){res.hidden=true;gs.hidden=false;return}
 gs.hidden=true;res.hidden=false;$("#rc").textContent="Yükleniyor…";
 try{const L=await Promise.all(MZ.index.map(x=>load(x.no)));term=hq;lim=40;const hits=search(L);$("#rc").textContent=hits.length+" madde";list(hits,$("#rl"),null,true)}catch(e){$("#rc").textContent="Veri yüklenemedi, bağlantıyı kontrol edin."}}
async function law(no,openSlug){const meta=MZ.index.find(x=>x.no===no);if(!meta){location.hash="#/";return}
 document.title=meta.kisa+" · Mevzuat · Eko-Log";
 app.innerHTML=hero(`<span class="pill">${esc(meta.kisa)}</span><h1 class="rise">${esc(meta.ad)}</h1><p class="rise">${esc(meta.rg)} · ${meta.n} madde</p><a class="btn line" href="#/">← Kanunlar</a>`,1)+`<div class="wrap"><div class="sbar"><input id="q" type="search" placeholder="Bu kanunda ara: kelime veya madde no…" autocomplete="off"></div><div class="cnt" id="c">Yükleniyor…</div><div id="l"></div></div>`;
 let L;try{L=await load(no)}catch(e){$("#c").textContent="Veri yüklenemedi, bağlantıyı kontrol edin.";return}
 term="";lim=40;const dn=(L.dn||[]).map(f=>`[${f[0]}] ${esc(f[1])}`).join("<br>");
 const draw=()=>{const hits=search([L]);$("#c").innerHTML=hits.length+" madde"+(dn&&!toks.length?`<div style="margin-top:8px">${dn}</div>`:"");
  if(openSlug&&!toks.length){const i=hits.findIndex(h=>slug(h.m.no)===openSlug);if(i>=lim)lim=i+1}
  list(hits,$("#l"),!toks.length?openSlug:null,false)};
 draw();if(openSlug){const e=document.getElementById("a-"+no+"-"+openSlug);if(e)setTimeout(()=>e.scrollIntoView({block:"start"}),60)}
 $("#q").oninput=e=>{clearTimeout(tm);tm=setTimeout(()=>{term=e.target.value.trim();lim=40;openSlug=null;draw()},200)};
 app.onclick=ev=>{if(ev.target.closest("[data-more]")){lim+=40;draw()}}}

/* ---- süre hesaplama aracı: kurallar ve tatiller content.json → ts (Yayın masası) ---- */
const TS_SEED={ara:{bas:"07-20",bit:"08-31",uzama:7},tatil:[],kurallar:[
 {id:"s1",ad:"İdari dava açma süresi (idare mahkemesi, Danıştay)",dayanak:"2577 sayılı İYUK m. 7/1, m. 8",olay:"Tebliğ, yayın veya ilan tarihi",n:60,birim:"gun",adli:true,not:"Özel kanunda ayrı süre varsa o süre uygulanır."},
 {id:"s2",ad:"Vergi davası açma süresi (vergi mahkemesi)",dayanak:"2577 sayılı İYUK m. 7/1, m. 8",olay:"Tebliğ tarihi",n:30,birim:"gun",adli:true,not:"Vergi uyuşmazlıklarında süre, ilgili vergi kanunundaki başlangıç kuralına göre değişebilir."},
 {id:"s3",ad:"İstinaf başvuru süresi",dayanak:"2577 sayılı İYUK m. 45, m. 8",olay:"Kararın tebliğ tarihi",n:30,birim:"gun",adli:true,not:"Kesin kararlar için istinaf yolu yoktur."},
 {id:"s4",ad:"Temyiz başvuru süresi (Danıştay)",dayanak:"2577 sayılı İYUK m. 46, m. 8",olay:"Kararın tebliğ tarihi",n:30,birim:"gun",adli:true,not:""},
 {id:"s5",ad:"İdareye başvuru: zımni ret ve ardından dava süresi",dayanak:"2577 sayılı İYUK m. 10, m. 7, m. 8",olay:"İdareye başvuru tarihi",n:60,birim:"gun",adli:false,z:{n:60,birim:"gun",ad:"Zımni retten sonra dava açma süresi",adli:true},not:"60 gün içinde cevap verilmezse istek reddedilmiş sayılır. İdare kısmi ya da ara cevap verdiyse süreler değişebilir."}
]};
let TS=null;
const isoD=d=>d.toISOString().slice(0,10),pD=t=>{const a=String(t).split("-").map(Number);return new Date(Date.UTC(a[0],a[1]-1,a[2]))};
const addD=(d,n)=>new Date(d.getTime()+n*864e5);
const addM=(d,n)=>{const y=d.getUTCFullYear(),m=d.getUTCMonth()+n,last=new Date(Date.UTC(y,m+1,0)).getUTCDate();return new Date(Date.UTC(y,m,Math.min(d.getUTCDate(),last)))};
const plus=(d,n,b)=>b==="ay"?addM(d,n):b==="yil"?addM(d,n*12):addD(d,n);
const fD=d=>d.toLocaleDateString("tr-TR",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric",weekday:"long"});
const BIR={gun:"gün",ay:"ay",yil:"yıl"};
const okMD=t=>/^\d{2}-\d{2}$/.test(String(t||""));
function normTS(j){const o=j&&typeof j==="object"?j:{};
 const ara=Object.assign({},TS_SEED.ara,o.ara);if(!okMD(ara.bas))ara.bas=TS_SEED.ara.bas;if(!okMD(ara.bit))ara.bit=TS_SEED.ara.bit;ara.uzama=Math.max(0,Math.min(60,Math.floor(+ara.uzama)||0));
 const tatil=(Array.isArray(o.tatil)?o.tatil:[]).filter(x=>x&&/^\d{4}-\d{2}-\d{2}$/.test(x.bas||"")).map(x=>({ad:String(x.ad||"Tatil"),bas:x.bas,bit:/^\d{4}-\d{2}-\d{2}$/.test(x.bit||"")&&x.bit>=x.bas?x.bit:x.bas}));
 let k=(Array.isArray(o.kurallar)?o.kurallar:[]).filter(r=>r&&r.ad&&+r.n>0&&BIR[r.birim]);
 if(!Array.isArray(o.kurallar))k=TS_SEED.kurallar;
 return{ara,tatil,kurallar:k}}
async function loadTS(){if(TS)return TS;let j=null;try{const r=await fetch("../content.json?v="+Date.now(),{cache:"no-store"});if(r.ok)j=(await r.json()).ts}catch(e){}TS=normTS(j);return TS}
function offSet(ts){const s=new Set();ts.tatil.forEach(x=>{for(let d=pD(x.bas),e=pD(x.bit),i=0;d<=e&&i<40;d=addD(d,1),i++)s.add(isoD(d))});return s}
function stage(ev,n,b,adli,ts,off,steps,warn){
 let end=plus(ev,n,b);steps.push("Başlangıç olayı: "+fD(ev)+". Süre ertesi günden işlemeye başlar.");steps.push(n+" "+BIR[b]+" sonra: "+fD(end)+".");
 if(adli&&ts.ara.uzama>0){const y=end.getUTCFullYear(),a=pD(y+"-"+ts.ara.bas),z=pD(y+"-"+ts.ara.bit);
  if(end>=a&&end<=z){end=addD(z,ts.ara.uzama);steps.push("Son gün çalışmaya ara verme dönemine ("+ts.ara.bas.split("-").reverse().join(".")+"–"+ts.ara.bit.split("-").reverse().join(".")+") denk geldi; süre ara vermenin bittiği günden itibaren "+ts.ara.uzama+" gün uzar: "+fD(end)+".")}}
 let k=0;while((end.getUTCDay()===0||end.getUTCDay()===6||off.has(isoD(end)))&&k<60){const why=off.has(isoD(end))?"resmî tatil":"hafta sonu";steps.push(fD(end)+" "+why+" olduğu için süre ertesi güne uzar.");end=addD(end,1);k++}
 if(!ts.tatil.some(x=>x.bas.slice(0,4)===String(end.getUTCFullYear())))warn.add(end.getUTCFullYear()+" yılı için tatil listesi girilmemiş; yalnızca hafta sonları dikkate alındı. Resmî tatilleri ayrıca kontrol et.");
 return end}
function hesapla(r,ymd,ts){const steps=[],warn=new Set(),off=offSet(ts),ev=pD(ymd);let res={};
 if(r.z){let e1=plus(ev,r.n,r.birim);steps.push("İdareye başvuru: "+fD(ev)+". "+r.n+" "+BIR[r.birim]+" içinde cevap verilmezse istek reddedilmiş sayılır.");steps.push("Zımni ret tarihi (bekleme süresinin sonu): "+fD(e1)+".");res.ara=e1;
  const e2=stage(e1,r.z.n,r.z.birim,r.z.adli,ts,off,steps,warn);res.son=e2;res.etiket=r.z.ad||"Son gün"}
 else{res.son=stage(ev,r.n,r.birim,r.adli,ts,off,steps,warn);res.etiket="Son gün"}
 res.steps=steps;res.warn=[...warn];return res}
async function sure(){document.title="Süre hesaplama · Mevzuat · Eko-Log";
 app.innerHTML=hero(`<span class="pill">Araç</span><h1 class="rise">Süre hesaplama</h1><p class="rise">Dava, itiraz ve başvuru sürelerinin son gününü hesapla.</p><a class="btn line" href="#/">← Kanunlar</a>`,1)+`<div class="wrap"><div class="card" id="sr" style="max-width:720px;margin:0 auto;display:grid;gap:12px"><p>Yükleniyor…</p></div></div>`;
 const ts=await loadTS(),box=$("#sr");if(!ts.kurallar.length){box.innerHTML="<p>Henüz süre türü tanımlanmadı.</p>";return}
 const IS="width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:13px 14px;border-radius:14px;border:2px solid var(--line,#ccc);background:var(--bg,transparent);color:var(--ink,inherit)";
 box.innerHTML=`<label for="sr-k"><b>Süre türü</b></label><select id="sr-k" style="${IS}">${ts.kurallar.map((r,i)=>`<option value="${i}">${esc(r.ad)}</option>`).join("")}</select><div id="sr-i" class="cnt" style="margin:0"></div><label for="sr-d" id="sr-l"><b></b></label><input id="sr-d" type="date" style="${IS}"><button class="btn grad" id="sr-b" type="button">Hesapla</button><div id="sr-o" aria-live="polite"></div><p class="cnt" style="margin:6px 0 0">Bu araç bilgilendirme amaçlıdır; sonuç hukuki danışmanlık yerine geçmez. Süre kuralları kanun ve özel mevzuata göre değişebilir. Kesin süre için resmî metne bak, gerekirse avukata danış.</p>`;
 const sel=$("#sr-k"),inp=$("#sr-d"),out=$("#sr-o");
 const info=()=>{const r=ts.kurallar[+sel.value];$("#sr-i").innerHTML=`<b>${r.n} ${BIR[r.birim]}</b>${r.z?` + ${r.z.n} ${BIR[r.z.birim]}`:""} · ${esc(r.dayanak||"")}${r.not?`<br>${esc(r.not)}`:""}`;$("#sr-l").firstChild.textContent=r.olay||"Başlangıç tarihi";out.textContent=""};
 const run=()=>{const r=ts.kurallar[+sel.value];if(!inp.value){out.innerHTML='<p class="empty">Tarihi seç.</p>';return}
  const x=hesapla(r,inp.value,ts),now=new Date(),t=pD(now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0")),kalan=Math.round((x.son-t)/864e5);
  const txt=x.etiket+": "+fD(x.son);
  out.innerHTML=`<div class="note" style="margin:0"><b style="font-size:1.25em">${esc(x.etiket)}: ${esc(fD(x.son))}</b><br>${kalan>=0?`Bugünden itibaren ${kalan} gün kaldı.`:`Bu süre ${-kalan} gün önce dolmuş.`}${x.ara?`<br>Zımni ret tarihi: ${esc(fD(x.ara))}`:""}</div>${x.warn.map(w=>`<p class="note" style="margin:8px 0 0">⚠ ${esc(w)}</p>`).join("")}<details style="margin-top:10px"><summary>Hesap adımları</summary><ol>${x.steps.map(z=>`<li>${esc(z)}</li>`).join("")}</ol></details><button class="btn sm" id="sr-c" type="button" style="margin-top:10px">Sonucu kopyala</button>`;
  $("#sr-c").onclick=()=>{const m=(ts.kurallar[+sel.value].ad)+" | "+(ts.kurallar[+sel.value].olay||"Başlangıç")+": "+fD(pD(inp.value))+" | "+txt+" (Eko-Log Mevzuat süre hesaplama; bilgilendirme amaçlıdır)";navigator.clipboard&&navigator.clipboard.writeText(m).then(()=>toast("Sonuç kopyalandı"))}};
 sel.onchange=info;$("#sr-b").onclick=run;inp.onchange=()=>{if(inp.value)run()};info()}
function route(){const p=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);scrollTo(0,0);
 if(p[0]==="sure")sure();else if(!p.length)home();else law(p[0],p[1]?decodeURIComponent(p[1]):null)}
document.addEventListener("click",e=>{
 const c=e.target.closest("[data-cp]");if(c){navigator.clipboard&&navigator.clipboard.writeText(c.dataset.cp).then(()=>toast("Atıf kopyalandı"));return}
 const l=e.target.closest("[data-ln]");if(l){const u=location.href.split("#")[0]+l.dataset.ln;navigator.clipboard&&navigator.clipboard.writeText(u).then(()=>toast("Bağlantı kopyalandı"));return}
 if(e.target.closest("[data-more]")&&!$("#l")){lim+=40;gsearch()}});
/* ---- üye kapısı: Eko-Log oturumunu (eko_uye) ve onay durumunu Firebase'den doğrular ---- */
const DBU="https://eko-log-b902a-default-rtdb.europe-west1.firebasedatabase.app",KEY="AIzaSyDNwfakrjOuMx0YlonGfOBvk1_hAWiUyk0";
const rdS=()=>{try{return JSON.parse(localStorage.getItem("eko_uye")||"null")}catch(e){return null}};
async function tok(S){if(S.t&&Date.now()<S.exp)return S.t;const r=await fetch("https://securetoken.googleapis.com/v1/token?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"grant_type=refresh_token&refresh_token="+encodeURIComponent(S.r||"")});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error("auth");S.t=j.id_token;S.r=j.refresh_token||S.r;S.exp=Date.now()+(Number(j.expires_in||3600)-90)*1e3;try{localStorage.setItem("eko_uye",JSON.stringify(S))}catch(e){}return S.t}
async function dbg(p,t,q){const r=await fetch(DBU+"/"+p+".json?"+(q?q+"&":"")+"auth="+encodeURIComponent(t),{cache:"no-store"});if(r.status===401||r.status===403)throw new Error("perm");if(!r.ok)throw new Error("net");return r.json()}
async function verify(){const S=rdS();if(!S||!S.uid||!S.r)return"none";
 try{const c=JSON.parse(sessionStorage.getItem("mz_ok")||"null");if(c&&c.u===S.uid&&Date.now()-c.t<18e5)return"ok"}catch(e){}
 let t;try{t=await tok(S)}catch(e){return e.message==="auth"?"none":"net"}
 const ok=()=>{try{sessionStorage.setItem("mz_ok",JSON.stringify({u:S.uid,t:Date.now()}))}catch(e){}return"ok"};
 try{
  try{await dbg("uyeler",t,"shallow=true");return ok()}catch(e){if(e.message!=="perm")throw e}
  const hk=String(S.e||"").trim().toLowerCase().replace(/\./g,",");
  try{if(await dbg("hoca/"+hk,t))return ok()}catch(e){if(e.message!=="perm")throw e}
  const lk=await(await fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({idToken:t})})).json();
  const ver=!!(lk.users&&lk.users[0]&&lk.users[0].emailVerified),rec=await dbg("uyeler/"+S.uid,t);
  if(rec&&rec.s==="onay"&&ver)return ok();
  if(rec&&rec.s==="red")return"red";
  return ver?"wait":"verify"
 }catch(e){return"net"}}
const MSG={none:["Üye girişi gerekli","Mevzuat bölümü yalnızca onaylı Eko-Log üyelerine açıktır. Giriş yaptıktan sonra bu sayfaya dön."],wait:["Onay bekleniyor","Üyeliğin henüz yönetici tarafından onaylanmadı."],verify:["E-posta doğrulaması gerekli","Kullanabilmek için e-postana gelen doğrulama bağlantısına tıkla, sonra tekrar kontrol et."],red:["Başvuru onaylanmadı","Sorular için topluluğa yazabilirsin."],net:["Bağlantı sorunu","Üyelik kontrol edilemedi. İnternetini kontrol edip tekrar dene."]};
const gh=t=>hero(`<h1 class="rise">Mevzuat</h1><p class="rise">${t}</p>`);
const LOGIN="../eko-plus/#/lab";
const FERR={EMAIL_NOT_FOUND:"Bu e-posta ile kayıtlı üye bulunamadı.",INVALID_PASSWORD:"Şifre hatalı.",INVALID_LOGIN_CREDENTIALS:"E-posta veya şifre hatalı.",USER_DISABLED:"Bu hesap devre dışı bırakılmış.",INVALID_EMAIL:"Geçerli bir e-posta yaz.",TOO_MANY_ATTEMPTS_TRY_LATER:"Çok fazla deneme yapıldı, biraz sonra tekrar dene.",MISSING_PASSWORD:"Şifreni yaz."};
const ferr=j=>{const c=String((j&&j.error&&j.error.message)||"").split(" ")[0];return FERR[c]||"Giriş yapılamadı. Bilgilerini kontrol edip tekrar dene."};
async function signIn(em,pw){
 const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:em,password:pw,returnSecureToken:true})});
 const j=await r.json().catch(()=>({}));if(!r.ok||!j.idToken)throw new Error(ferr(j));
 const S={uid:j.localId,e:j.email||em,r:j.refreshToken,t:j.idToken,exp:Date.now()+(Number(j.expiresIn||3600)-90)*1e3};
 try{localStorage.setItem("eko_uye",JSON.stringify(S));sessionStorage.removeItem("mz_ok")}catch(e){}return S}
async function resetPw(em){
 const r=await fetch("https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key="+encodeURIComponent(KEY),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({requestType:"PASSWORD_RESET",email:em})});
 const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(ferr(j))}
const IS='width:100%;box-sizing:border-box;font:inherit;font-size:16px;padding:13px 14px;border-radius:14px;border:2px solid var(--line,#2f2340);background:var(--bg,transparent);color:var(--ink,inherit)';
function loginForm(){app.innerHTML=gh("Eko-Log üyelerine özel.")+`<div class="wrap"><form class="card gate" id="lf" novalidate style="max-width:460px;margin:30px auto;display:grid;gap:12px"><h2 style="margin:0">🔐 Üye girişi</h2><p style="margin:0">Mevzuat bölümü yalnızca onaylı Eko-Log üyelerine açıktır. Eko-Plus ile aynı hesabı kullanırsın.</p><input id="lm" type="email" placeholder="E-posta" autocomplete="email" required style="${IS}"><input id="lp" type="password" placeholder="Şifre" autocomplete="current-password" required style="${IS}"><div id="le" role="alert" style="color:#e5484d;font-size:14.5px;min-height:1px"></div><button class="btn grad" id="lb" type="submit">Giriş yap</button><div class="acts"><button class="btn sm" type="button" id="lr">Şifremi unuttum</button><a class="btn sm" href="${LOGIN}" id="lg">Üye ol / Eko-Plus'ta giriş</a></div></form></div>`;
 const f=$("#lf"),er=$("#le");
 f.onsubmit=async e=>{e.preventDefault();const em=$("#lm").value.trim(),pw=$("#lp").value;er.textContent="";if(!em||!pw){er.textContent="E-posta ve şifreni yaz.";return}
  const b=$("#lb");b.disabled=true;b.textContent="Giriş yapılıyor…";
  try{await signIn(em,pw);started=false;start()}catch(x){er.textContent=x.message;b.disabled=false;b.textContent="Giriş yap"}};
 $("#lr").onclick=async()=>{const em=$("#lm").value.trim();if(!em){er.textContent="Önce e-postanı yaz.";return}er.style.color="";try{await resetPw(em);er.style.color="#2ea44f";er.textContent="Şifre sıfırlama bağlantısı e-postana gönderildi."}catch(x){er.style.color="#e5484d";er.textContent=x.message}};
 $("#lg").onclick=e=>{e.preventDefault();try{sessionStorage.setItem("eko_ret","../mevzuat/")}catch(x){}location.href=LOGIN}}
function showGate(st){if(st==="none"){loginForm();return}
 const m=MSG[st]||MSG.net;app.innerHTML=gh("Eko-Log üyelerine özel.")+`<div class="wrap"><div class="card gate"><h2>🔒 ${m[0]}</h2><p>${m[1]}</p><div class="acts"><button class="btn sm" id="gr">Tekrar kontrol et</button><button class="btn sm" id="go">Farklı hesapla giriş yap</button></div></div></div>`;
 $("#gr").onclick=start;$("#go").onclick=()=>{try{localStorage.removeItem("eko_uye");localStorage.removeItem("eko_uye_ok");sessionStorage.removeItem("mz_ok")}catch(e){}loginForm()}}
let started=false,busy=false;
async function start(){if(started||busy)return;busy=true;app.innerHTML=gh("Üyeliğin kontrol ediliyor…");const st=await verify();busy=false;
 if(st==="ok"){try{const S=rdS();if(S&&S.uid)localStorage.setItem("eko_uye_ok",S.uid)}catch(e){}started=true;addEventListener("hashchange",route);route()}else showGate(st)}
addEventListener("focus",()=>{if(!started)start()});
addEventListener("storage",e=>{if(e.key!=="eko_uye")return;if(started&&!e.newValue){try{sessionStorage.removeItem("mz_ok")}catch(x){}location.reload()}else if(!started)start()});
start();
})();
