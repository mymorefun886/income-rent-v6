import urllib.request, json, time

print('=== Test: Send message to group ===')
data = json.dumps({'username': 'morefun886', 'password': 'Mf848886'}).encode()
req = urllib.request.Request('http://localhost:8788/api/auth/login', data=data, headers={'Content-Type': 'application/json'})
r = urllib.request.urlopen(req)
response = json.loads(r.read().decode())
token = response['data']['accessToken']

# Check status first
print('1. Check bot status...')
status_req = urllib.request.Request('http://localhost:8788/api/wechat/status', headers={'Authorization': 'Bearer ' + token})
r = urllib.request.urlopen(status_req)
status = json.loads(r.read().decode())
print('   Status:', status)

if status['data']['ready']:
    print('2. Bot is ready, testing send...')
    # Note: Need a real chatId to test sending
    # For now, just verify the API endpoint works
    send_data = json.dumps({
        'chatId': 'test_chat_id',
        'content': 'Test message from V6 API'
    }).encode()
    send_req = urllib.request.Request('http://localhost:8788/api/wechat/send', data=send_data, headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token}, method='POST')
    try:
        r = urllib.request.urlopen(send_req)
        print('   Send response:', r.read().decode())
    except urllib.error.HTTPError as e:
        print('   Send error:', e.read().decode())
else:
    print('2. Bot not ready, skipping send test')
