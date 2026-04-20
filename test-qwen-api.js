import fetch from 'node-fetch';

// 测试阿里云百炼通义千问-VL API
const apiKey = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || "sk-替换为你的APIKey";
const endpoint = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";
const model = "qwen-vl-max";

// 使用一个小的测试图片（1x1 像素的透明 PNG）
const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

const prompt = `识别图片内容，返回JSON格式：{"text": "描述"}`;

console.log('Testing Qwen-VL API...');
console.log('Endpoint:', endpoint);
console.log('Model:', model);
console.log('API Key exists:', !!apiKey);
console.log('API Key starts with:', apiKey.substring(0, 10) + '...');
console.log('');

const startTime = Date.now();

fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: model,
    max_tokens: 500,
    temperature: 0.3,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          {
            type: "image_url",
            image_url: {
              url: testImage
            }
          }
        ]
      }
    ]
  })
})
.then(async (response) => {
  const duration = Date.now() - startTime;
  console.log(`Response received in ${duration}ms`);
  console.log('Status:', response.status);
  console.log('Status Text:', response.statusText);
  console.log('');

  if (!response.ok) {
    const text = await response.text();
    console.error('Error response:', text.substring(0, 500));
    return;
  }

  const data = await response.json();
  console.log('Response data:', JSON.stringify(data, null, 2));
})
.catch((error) => {
  const duration = Date.now() - startTime;
  console.error(`Error after ${duration}ms:`, error.message);
});
