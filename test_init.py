import urllib.request, json, time

print('Logging in...')
try:
    # Login
    data = json.dumps({'username': 'morefun886', 'password': 'Mf848886'}).encode()
    req = urllib.request.Request('http://localhost:8788/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
    r = urllib.request.urlopen(req)
    response = json.loads(r.read().decode())
    print('Login response:', response)
    token = response['data']['accessToken']
    print('token:', token[:50] + '...')

    # Init WeChat Bot
    print('Initializing WeChat Bot...')
    init_req = urllib.request.Request('http://localhost:8788/api/wechat/init', data=json.dumps({}).encode(), headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method='POST')
    r = urllib.request.urlopen(init_req)
    print('Init response:', r.read().decode())

    time.sleep(2)

    # Check status
    print('Checking status...')
    status_req = urllib.request.Request('http://localhost:8788/api/wechat/status', headers={'Authorization': 'Bearer ' + token})
    r = urllib.request.urlopen(status_req)
    print('Status response:', r.read().decode())
except Exception as e:
    print(f'Error: {e}')
