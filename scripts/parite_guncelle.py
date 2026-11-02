#!/usr/bin/env python3
"""data/parite-veri.json uretir. Hizli pes eder (Yahoo engelliyse 30 sn icinde birakir) ve hatalari dosyadaki 'diag' alanina yazar."""
import os, json, time, csv, io, datetime as dt, urllib.request, urllib.parse, sys
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36','Accept':'*/*'}
Y={'BIST100':'XU100.IS','XAU':'GC=F','XAG':'SI=F','XPT':'PL=F','XPD':'PA=F','BRENT':'BZ=F','WTI':'CL=F','NG':'NG=F','TTF':'TTF=F','HO':'HO=F','RB':'RB=F',
'XCU':'HG=F','ALU':'ALI=F','REMX':'REMX','LIT':'LIT','URA':'URA','WHEAT':'ZW=F','CORN':'ZC=F','SOY':'ZS=F','COFFEE':'KC=F','SUGAR':'SB=F','COTTON':'CT=F','COCOA':'CC=F',
'BTC':'BTC-USD','ETH':'ETH-USD','BNB':'BNB-USD','SOL':'SOL-USD','XRP':'XRP-USD','ADA':'ADA-USD','DOGE':'DOGE-USD'}
STQ={'BIST100':['^xu100','xu100.tr','xu100'],'XAU':['xauusd'],'XAG':['xagusd']}
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
out={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'series':{},'fx':{},'diag':diag}
yfail=0
for code,sym in Y.items():
    s=None
    if yfail<3:                       # Yahoo ust uste 3 kez basarisizsa tamamen birak (hizli pes)
        s=yahoo(sym); yfail=0 if s else yfail+1
    if not s:
        for q in STQ.get(code,[]):
            s=stooq(q)
            if s and len(s)>1: print('stooq ile alindi',code,q); break
    if s and len(s)>1: out['series'][code]=s
    else: print('YOK',code)
try:
    end=dt.date.today(); start=end-dt.timedelta(days=1830)
    out['fx']=json.loads(raw(f'https://api.frankfurter.dev/v1/{start}..{end}?base=USD',30))['rates']
except Exception as e: diag['frankfurter']=str(e)[:120]
json.dump(out,open('data/parite-veri.json','w'),separators=(',',':'))
print('tamam',len(out['series']),'seri,',len(out['fx']),'gun doviz'); print(json.dumps(diag,ensure_ascii=False,indent=1))
