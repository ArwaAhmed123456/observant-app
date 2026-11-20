import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://observant-frontend.onrender.com'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx) as resp:
    html = resp.read().decode('utf-8', errors='ignore')
    print('HTML length:', len(html))
    print('HTML snippet:')
    print(html[:600])
    scripts = re.findall(r'<script[^>]*src="([^"]+)"', html)
    print('Scripts found:', scripts)
