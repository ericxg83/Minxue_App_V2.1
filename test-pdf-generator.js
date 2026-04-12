import http from 'http';
import fs from 'fs';

const taskId = 'print-1775917154593-krfyll1el';
const data = JSON.stringify({
  taskId: taskId
});

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate-pdf',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, res => {
  let body = [];
  res.on('data', chunk => {
    body.push(chunk);
  });
  res.on('end', () => {
    const buffer = Buffer.concat(body);
    console.log('PDF generated successfully!');
    console.log('Content-Type:', res.headers['content-type']);
    console.log('Content-Disposition:', res.headers['content-disposition']);
    console.log('PDF size:', buffer.length, 'bytes');
    
    // 保存PDF文件
    const filename = `错题本-Test Student-${taskId}.pdf`;
    fs.writeFileSync(filename, buffer);
    console.log(`PDF saved as: ${filename}`);
  });
});

req.on('error', error => {
  console.error('Error:', error);
});

req.write(data);
req.end();
