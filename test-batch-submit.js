import http from 'http';

const data = JSON.stringify({
  questions: [
    {
      text: 'What is 2+2?',
      imageUrl: 'https://picsum.photos/seed/test/400/300'
    }
  ],
  student: '雷雨泽',
  subject: '数学'
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/batch-submit',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = '';
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Response:', body);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();