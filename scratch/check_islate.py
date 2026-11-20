import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://observant-admin-portal.onrender.com/assets/index-ByIcYoO7.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as resp:
    js = resp.read().decode('utf-8', errors='ignore')
    for m in re.finditer(r'isLate', js):
        start = max(0, m.start() - 50)
        end = min(len(js), m.end() + 100)
        print('isLate snippet:', js[start:end])
        print('-'*40)
