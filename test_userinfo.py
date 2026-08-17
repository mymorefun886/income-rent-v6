import urllib.request, json

print('=== Get Bot User Info ===')
data = json.dumps({'username': 'morefun886', 'password': 'Mf848886'}).encode()
req = urllib.request.Request('http://localhost:8788/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
r = urllib.request.urlopen(req)
response = json.loads(r.read().decode())
token = response['data']['accessToken']

# Check status
print('1. Check bot status...')
status_req = urllib.request.Request('http://localhost:8788/api/wechat/status', headers={'Authorization': 'Bearer ' + token})
r = urllib.request.urlopen(status_req)
status = json.loads(r.read().decode())
print('   Full Status:', json.dumps(status, indent=2, ensure_ascii=False))
