import fetch from 'node-fetch';

// 查看任务队列状态
async function checkTasks() {
  try {
    // 由于我们无法直接访问服务器的内存状态，我们可以通过创建一个临时的 API 来查看任务队列
    // 但是，在当前的代码中，没有这样的 API，所以我们只能通过生成答案的 API 来间接测试
    
    // 测试生成答案的 API
    const testQuestionId = '1';
    const testQuestionText = '1+1=?';
    
    console.log('测试生成答案 API...');
    const response = await fetch('http://localhost:3001/api/generate-answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        questionId: testQuestionId,
        questionText: testQuestionText
      })
    });
    
    const data = await response.json();
    console.log('API 响应:', data);
    
    if (data.success) {
      console.log('任务创建成功，任务 ID:', data.taskId);
      
      // 等待一段时间后检查任务状态
      console.log('等待 5 秒后检查任务状态...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const statusResponse = await fetch(`http://localhost:3001/api/answer-task/${data.taskId}`);
      const statusData = await statusResponse.json();
      console.log('任务状态:', statusData);
    }
  } catch (error) {
    console.error('检查任务失败:', error);
  }
}

// 执行检查
checkTasks();
