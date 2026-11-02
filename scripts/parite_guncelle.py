#!/usr/bin/env python3
"""data/parite-veri.json uretir. Hizli pes eder (Yahoo engelliyse 30 sn icinde birakir) ve hatalari dosyadaki 'diag' alanina yazar.
Eklenenler: alinamayan seride eski veri korunur, eksik seriler 20 sn sonra bir kez daha denenir,
gram altin ve ceyrek/yarim/tam/cumhuriyet altini XAU x USDTRY'den hesaplanir."""
import os, json, time, csv, io, bisect, datetime as dt, urllib.request, urllib.parse, sys
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept':'*/*'}
Y={'BIST100':'XU100.IS','XAU':'GC=F','XAG':'SI=F','XPT':'PL=F','XPD':'PA=F','BRENT':'BZ=F','WTI':'CL=F','NG':'NG=F','TTF':'TTF=F','HO':'HO=F','RB':'RB=F',
'XCU':'HG=F','ALU':'ALI=F','REMX':'REMX','LIT':'LIT','URA':'URA','WHEAT':'ZW=F','CORN':'ZC=F','SOY':'ZS=F','COFFEE':'KC=F','SUGAR':'SB=F','COTTON':'CT=F','COCOA':'CC=F',
'BTC':'BTC-USD','ETH':'ETH-USD','BNB':'BNB-USD','SOL':'SOL-USD','XRP':'XRP-USD','ADA':'ADA-USD','DOGE':'DOGE-USD'}
STQ={'BIST100':['^xu100','xu100.tr','xu100'],'XAU':['xauusd'],'XAG':['xagusd']}
OUT='data/parite-veri.json'
SIKKE={'CEYREK':1.754,'YARIM':3.508,'TAM':7.016,'CUMHURIYET':7.216}   # brut agirlik (gr)
AYAR22=0.916                                                          # 22 ayar saflik
OUNCE=31.1034768
diag={}
def raw(u,t=12):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t).read().decode()
PROXY=os.environ.get('PROXY_URL','').strip().rstrip('/')
def yf_get(sym):
    try:
        import yfinance as yf
        h=yf.Ticker(sym).history(period='5y',interval='1d',auto_adjust=False)
        s=[[i.strftime('%Y-%m-%d'),round(float(c),6)] for i,c in h['Close'].dropna().items() if c>0]
        if len(s)>1: return s
        diag[f'yfinance {sym}']='bos'
    except Exception as e: diag[f'yfinance {sym}']=str(e)[:120]
def yahoo(sym):
    s=yf_get(sym)
    if s: return s
    now=int(time.time()); urls=[]
    if PROXY: urls.append(('worker',f'{PROXY}/yahoo?symbol={urllib.parse.quote(sym)}&period1={now-1830*86400}&period2={now}&interval=1d'))
    urls+= [(h,f'https://{h}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=5y&interval=1d') for h in ('query1','query2')]
    for h,u in urls:
        try:
            r=json.loads(raw(u))['chart']['result'][0]; q=r['indicators']['quote'][0]['close']
            return [[dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime('%Y-%m-%d'),round(c,6)] for t,c in zip(r['timestamp'],q) if c and c>0]
        except Exception as e: diag[f'yahoo {sym} {h}']=str(e)[:120]
    return None
def stooq(sym):
    try:
        r=raw(f'https://stooq.com/q/d/l/?s={sym}&i=d',20)
        rows=list(csv.DictReader(io.StringIO(r)))
        cut=(dt.date.today()-dt.timedelta(days=1830)).isoformat()
        s=[[x['Date'],float(x['Close'])] for x in rows if x.get('Close') and x['Date']>=cut and float(x['Close'])>0]
        if len(s)<2: diag[f'stooq {sym}']='bos: '+r[:80].replace('\n',' ')
        return s
    except Exception as e: diag[f'stooq {sym}']=str(e)[:120]

def eski_oku():
    try:
        with open(OUT,encoding='utf-8') as f: return json.load(f)
    except Exception: return {}
eski=eski_oku()
out={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'series':{},'fx':{},'diag':diag}
yfail=0
def al(code):
    global yfail
    sym=Y[code]; s=None
    if yfail<3:                       # Yahoo ust uste 3 kez basarisizsa tamamen birak (hizli pes)
        s=yahoo(sym); yfail=0 if s else yfail+1
    if not s:
        for q in STQ.get(code,[]):
            s=stooq(q)
            if s and len(s)>1: print('stooq ile alindi',code,q); break
    if s and len(s)>1:
        out['series'][code]=s; return True
    print('YOK',code); return False
for code in Y: al(code)
eksik=[c for c in Y if c not in out['series']]
if eksik and yfail<3:                 # hiz siniri yuzunden dusenleri 20 sn sonra bir kez daha dene
    print('Yeniden deneme (20 sn sonra):',eksik); time.sleep(20)
    for c in eksik:
        al(c); time.sleep(2)
try:
    end=dt.date.today(); start=end-dt.timedelta(days=1830)
    out['fx']=json.loads(raw(f'https://api.frankfurter.dev/v1/{start}..{end}?base=USD',30))['rates']
except Exception as e:
    diag['frankfurter']=str(e)[:120]
    out['fx']=eski.get('fx',{})       # kur alinamazsa eskisini koru
def altin_turet():
    xau=out['series'].get('XAU'); fx=out['fx']
    gunler=sorted(g for g,v in fx.items() if isinstance(v,dict) and v.get('TRY'))
    if not xau or not gunler:
        diag['GRAMTL']='hesaplanamadi: XAU veya TRY kuru yok'; return
    gram=[]
    for d,p in xau:
        i=bisect.bisect_right(gunler,d)-1      # o gunun (yoksa en yakin onceki gunun) USD/TRY kuru
        if i<0: continue
        gram.append([d,round(p*fx[gunler[i]]['TRY']/OUNCE,2)])
    if len(gram)<2:
        diag['GRAMTL']='hesaplanamadi: ortak tarih yok'; return
    out['series']['GRAMTL']=gram
    for k,w in SIKKE.items(): out['series'][k]=[[d,round(v*w*AYAR22,2)] for d,v in gram]
    diag['GRAMTL']='hesaplandi: XAU x USDTRY / 31.1035 (TCMB serisi degil); sikkeler: gram x agirlik x 0,916'
for k,v in eski.get('series',{}).items():     # bu turda alinamayan seri eski haliyle dosyada kalsin
    if k not in out['series']:
        out['series'][k]=v; diag[k]='alinamadi, eski veri korundu'
altin_turet()
json.dump(out,open(OUT,'w'),separators=(',',':'))
print('tamam',len(out['series']),'seri,',len(out['fx']),'gun doviz'); print(json.dumps(diag,ensure_ascii=False,indent=1))
