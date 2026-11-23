// GitHub Actions ile çalışır (Cloudflare gerekmez). Çıktı: haberler.json (sitenin kök klasörüne yazılır)
import { writeFileSync } from 'node:fs';
const RSS = {
 'BM Haberleri':{u:'https://news.un.org/feed/subscribe/en/news/all/rss.xml',tur:'resmi',ulke:'BM',sahip:'Uluslararası örgüt'},
 'BBC World':{u:'https://feeds.bbci.co.uk/news/world/rss.xml',tur:'basin',ulke:'Birleşik Krallık',sahip:'Kamu yayıncısı'},
 'Al Jazeera':{u:'https://www.aljazeera.com/xml/rss/all.xml',tur:'basin',ulke:'Katar',sahip:'Katar devleti tarafından finanse edilir'},
 'Anadolu Ajansı':{u:'https://www.aa.com.tr/en/rss/default?cat=world',tur:'ajans',ulke:'Türkiye',sahip:'Devlet ajansı'},
 'Deutsche Welle':{u:'https://rss.dw.com/rdf/rss-en-world',tur:'basin',ulke:'Almanya',sahip:'Kamu yayıncısı'},
 'The Guardian':{u:'https://www.theguardian.com/world/rss',tur:'basin',ulke:'Birleşik Krallık',sahip:'Vakıf sahipliğinde gazete'},
 'France 24':{u:'https://www.france24.com/en/rss',tur:'basin',ulke:'Fransa',sahip:'Kamu grubu (France Médias Monde)'},
 'TASS':{u:'https://tass.com/rss/v2.xml',tur:'ajans',ulke:'Rusya',sahip:'Devlet ajansı'},
 'Xinhua':{u:'http://www.xinhuanet.com/english/rss/worldrss.xml',tur:'ajans',ulke:'Çin',sahip:'Devlet ajansı'}
};
const temiz=(s,max)=>s.replace(/<!\[CDATA\[|\]\]>/g,'').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/<[^>]*>/g,' ')
 .replace(/&quot;/g,'"').replace(/&#0?39;|&apos;/g,"'").replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,max);
const tag=(b,t)=>{const m=b.match(new RegExp('<'+t+'[^>]*>([\\s\\S]*?)</'+t+'>','i'));return m?m[1]:''};
function ayir(x){
  const out=[];
  for(const m of x.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)){
    if(out.length>=12)break;
    const b=m[0];
    let url=temiz(tag(b,'link'),500);
    if(!/^https?:\/\//.test(url)){const h=b.match(/<link[^>]*href=["']([^"']+)["']/i);url=h?h[1]:''}
    const t=temiz(tag(b,'pubDate')||tag(b,'published')||tag(b,'updated')||tag(b,'dc:date'),60);
    const tarih=t&&!isNaN(Date.parse(t))?new Date(t).toISOString().slice(0,10):'';
    const baslik=temiz(tag(b,'title'),220);
    if(baslik&&/^https?:\/\//.test(url))out.push({baslik,url,tarih,ozet:temiz(tag(b,'description')||tag(b,'summary'),300)});
  }
  return out;
}
const haberler=[],hatalar=[];
for(const [k,v] of Object.entries(RSS)){
  try{
    const r=await fetch(v.u,{headers:{'User-Agent':'Mozilla/5.0 (compatible; EkoLogBot/1.0)'},signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw new Error(r.status);
    const l=ayir(await r.text());if(!l.length)throw new Error('boş');
    l.forEach(i=>haberler.push({...i,kaynak:k,tur:v.tur,ulke:v.ulke,sahip:v.sahip}));
  }catch(e){hatalar.push(k+': '+e.message)}
}
writeFileSync('haberler.json',JSON.stringify({guncelleme:new Date().toISOString(),haberler,hatalar},null,1));
console.log(haberler.length+' haber, hatalar:',hatalar);
