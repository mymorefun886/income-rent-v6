const http = require('http');

// Try morefun886 first
const data = JSON.stringify({ username: 'morefun886', password: 'Mf848886' });

const options = {
  hostname: 'localhost',
  port: 8788,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', body);
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.write(data);
req.end();
