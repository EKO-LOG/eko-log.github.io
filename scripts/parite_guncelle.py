#!/usr/bin/env python3
"""data/parite-veri.json uretir: Yahoo (BIST, emtia, kripto), Frankfurter (doviz). Sunucuda calistigi icin CORS sorunu yok."""
import json, time, datetime as dt, urllib.request, urllib.parse, sys
UA={'User-Agent':'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36'}
Y={'XAU':'GC=F','XAG':'SI=F','XPT':'PL=F','XPD':'PA=F','BIST100':'XU100.IS','BRENT':'BZ=F','WTI':'CL=F','NG':'NG=F','TTF':'TTF=F','HO':'HO=F','RB':'RB=F',
'XCU':'HG=F','ALU':'ALI=F','REMX':'REMX','LIT':'LIT','URA':'URA','WHEAT':'ZW=F','CORN':'ZC=F','SOY':'ZS=F','COFFEE':'KC=F','SUGAR':'SB=F','COTTON':'CT=F','COCOA':'CC=F',
'BTC':'BTC-USD','ETH':'ETH-USD','BNB':'BNB-USD','SOL':'SOL-USD','XRP':'XRP-USD','ADA':'ADA-USD','DOGE':'DOGE-USD'}
# Sitedeki k carpani (ornek bushel .01) sitede uygulanir; burada ham fiyat yazilir.
def get(u,tries=3):
    for i in range(tries):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=30))
        except Exception as e:
            err=e; time.sleep(2*(i+1))
    raise err
def yahoo(sym):
    for h in ('query1','query2'):
        try:
            j=get(f'https://{h}.finance.yahoo.com/v8/finance/chart/{urllib.parse.quote(sym)}?range=5y&interval=1d')
            r=j['chart']['result'][0]; q=r['indicators']['quote'][0]['close']
            return [[dt.datetime.fromtimestamp(t,dt.timezone.utc).strftime('%Y-%m-%d'),round(c,6)] for t,c in zip(r['timestamp'],q) if c and c>0]
        except Exception as e: print('yahoo',sym,h,e,file=sys.stderr)
    return None
out={'updated':dt.datetime.now(dt.timezone.utc).isoformat(),'series':{},'fx':{}}
for code,sym in Y.items():
    s=yahoo(sym)
    if s and len(s)>1: out['series'][code]=s
    else: print('YOK',code,file=sys.stderr)
    time.sleep(.4)
try:
    end=dt.date.today(); start=end-dt.timedelta(days=1830)
    j=get(f'https://api.frankfurter.dev/v1/{start}..{end}?base=USD')
    out['fx']=j['rates']
except Exception as e: print('frankfurter',e,file=sys.stderr)
if not out['series'].get('BIST100') and not out['fx']: sys.exit('veri alinamadi, dosya degistirilmedi')
json.dump(out,open('data/parite-veri.json','w'),separators=(',',':'))
print('tamam',len(out['series']),'seri,',len(out['fx']),'gun doviz')
