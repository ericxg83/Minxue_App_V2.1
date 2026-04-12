import http from 'http';

// Test 1: Generate answer for question 1
const generateAnswerData = JSON.stringify({
  questionId: '1',
  questionText: '1+1=?'
});

const generateAnswerOptions = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/generate-answer',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': generateAnswerData.length
  }
};

console.log('Test 1: Generating answer for question 1...');
const generateAnswerReq = http.request(generateAnswerOptions, res => {
  let body = '';
  res.on('data', chunk => {
    body += chunk;
  });
  res.on('end', () => {
    console.log('Generate answer response:', body);
    
    // Parse the response to get the task ID
    try {
      const response = JSON.parse(body);
      if (response.success && response.taskId) {
        console.log('Task created successfully with ID:', response.taskId);
        
        // Wait for 5 seconds and check task status
        setTimeout(() => {
          checkTaskStatus(response.taskId);
        }, 5000);
      }
    } catch (error) {
      console.error('Error parsing response:', error);
    }
  });
});

generateAnswerReq.on('error', error => {
  console.error('Error generating answer:', error);
});

generateAnswerReq.write(generateAnswerData);
generateAnswerReq.end();

// Function to check task status
function checkTaskStatus(taskId) {
  console.log(`\nTest 2: Checking task status for ID ${taskId}...`);
  
  const checkStatusOptions = {
    hostname: 'localhost',
    port: 3001,
    path: `/api/answer-task/${taskId}`,
    method: 'GET'
  };
  
  const checkStatusReq = http.request(checkStatusOptions, res => {
    let body = '';
    res.on('data', chunk => {
      body += chunk;
    });
    res.on('end', () => {
      console.log('Task status response:', body);
      
      // Check if the task is completed
      try {
        const response = JSON.parse(body);
        if (response.success && response.task) {
          console.log('Task status:', response.task.status);
          if (response.task.status === 'completed' && response.task.result) {
            console.log('Answer generated successfully:', response.task.result.answer);
            console.log('Explanation:', response.task.result.explanation.substring(0, 100) + '...');
          }
        }
      } catch (error) {
        console.error('Error parsing task status response:', error);
      }
    });
  });
  
  checkStatusReq.on('error', error => {
    console.error('Error checking task status:', error);
  });
  
  checkStatusReq.end();
}
