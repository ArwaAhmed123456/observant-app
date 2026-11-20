import urllib.request, ssl, re

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

url = 'https://observant-admin-portal.onrender.com'
try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, context=ctx) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
        print('Live HTML fetched, length:', len(html))
        scripts = re.findall(r'src="(/assets/[^"]+\.js)"', html)
        print('Scripts:', scripts)
        for s in scripts:
            js_url = url + s
            with urllib.request.urlopen(urllib.request.Request(js_url, headers={'User-Agent': 'Mozilla/5.0'}), context=ctx) as js_resp:
                js_content = js_resp.read().decode('utf-8', errors='ignore')
                print(f'Checking {s} (length: {len(js_content)}):')
                if 'color:"red"' in js_content or 'color:\'red\'' in js_content or 'color:"#ef4444"' in js_content:
                    print('  FOUND RED COLOR IN LIVE BUNDLE!')
                else:
                    print('  No red color found in live bundle.')
except Exception as e:
    print('Error:', e)
