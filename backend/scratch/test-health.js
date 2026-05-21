const http = require('http');

http.get('http://localhost:5000/api/health', (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('BODY:', JSON.parse(data));
    process.exit(0);
  });
}).on('error', (err) => {
  console.error('Error reaching health endpoint:', err.message);
  process.exit(1);
});
