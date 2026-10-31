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
 app.innerHTML=hero(`<h1 class="rise">Mevzuat</h1><p class="rise">İdari yargı ve kamu hukuku mevzuatı; metinler, dipnotlar ve tablolarıyla birlikte, mevzuat.gov.tr kaynağından.</p><div class="rise"><input id="hq" type="search" placeholder="Tüm kanunlarda ara: kelime veya madde no…" autocomplete="off" value="${esc(hq)}"></div>`)+`<div id="res" class="wrap" hidden><div class="cnt" id="rc"></div><div id="rl"></div></div><div id="gs">${gs}</div>`;
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
function route(){const p=location.hash.replace(/^#\/?/,"").split("/").filter(Boolean);scrollTo(0,0);
 if(!p.length)home();else law(p[0],p[1]?decodeURIComponent(p[1]):null)}
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
function showGate(st){const m=MSG[st]||MSG.net;app.innerHTML=gh("Eko-Log üyelerine özel.")+`<div class="wrap"><div class="card gate"><h2>🔒 ${m[0]}</h2><p>${m[1]}</p><div class="acts"><a class="btn grad" href="../#/lab">Üye girişi yap</a><button class="btn sm" id="gr">Giriş yaptım, kontrol et</button></div></div></div>`;$("#gr").onclick=start}
let started=false,busy=false;
async function start(){if(started||busy)return;busy=true;app.innerHTML=gh("Üyeliğin kontrol ediliyor…");const st=await verify();busy=false;
 if(st==="ok"){started=true;addEventListener("hashchange",route);route()}else showGate(st)}
addEventListener("focus",()=>{if(!started)start()});
addEventListener("storage",e=>{if(e.key!=="eko_uye")return;if(started&&!e.newValue){try{sessionStorage.removeItem("mz_ok")}catch(x){}location.reload()}else if(!started)start()});
start();
})();
