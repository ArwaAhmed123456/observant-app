import urllib.request, ssl, json

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

# We need an admin/manager token. Let's sign in to get a token from the live backend
login_url = 'https://observant-api-zl49.onrender.com/api/auth/login'
req = urllib.request.Request(
    login_url,
    data=json.dumps({'email': 'mabdullah956@gmail.com', 'password': 'Password123!'}).encode('utf-8'),
    headers={'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0'}
)
try:
    with urllib.request.urlopen(req, context=ctx) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        token = data.get('accessToken') or data.get('token')
        print('Logged in successfully! Token length:', len(token))

        # Now query check-call-log for 2026-08-17 to 2026-08-23
        log_url = 'https://observant-api-zl49.onrender.com/api/reports/check-call-log?startDate=2026-08-17&endDate=2026-08-23'
        req_log = urllib.request.Request(log_url, headers={'Authorization': f'Bearer {token}', 'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req_log, context=ctx) as log_resp:
            log_data = json.loads(log_resp.read().decode('utf-8'))
            print('Total rows returned from live API:', len(log_data.get('rows', [])))
            # Check isLate on entries
            late_count = 0
            for r in log_data.get('rows', []):
                for h in r.get('hourlyChecks', []):
                    for c in h.get('checks', []):
                        if c.get('isLate'):
                            late_count += 1
                            print(f"Late check: {r.get('shiftDate')} {r.get('officerName')} {c.get('time')} isLate={c.get('isLate')}")
            print(f'Total isLate checks in live API response: {late_count}')
except Exception as e:
    print('Error:', e)
