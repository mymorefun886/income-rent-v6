import urllib.request, json

data = json.dumps({'username': 'morefun886', 'password': 'Mf848886'}).encode()
req = urllib.request.Request('http://localhost:8788/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
r = urllib.request.urlopen(req)
response = json.loads(r.read().decode())
token = response['data']['accessToken']

# Get counts
for endpoint in ['tenants', 'properties', 'records']:
    req = urllib.request.Request(f'http://localhost:8788/api/{endpoint}?limit=1', headers={'Authorization': 'Bearer ' + token})
    r = urllib.request.urlopen(req)
    data = json.loads(r.read().decode())
    print(f'{endpoint}: {data}')
