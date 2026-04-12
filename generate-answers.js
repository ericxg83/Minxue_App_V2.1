import fetch from 'node-fetch';

// 批量为所有没有答案的题目生成答案
async function generateAnswersForAllQuestions() {
  try {
    // 1. 获取所有错题
    const historyResponse = await fetch('http://localhost:3001/api/history?student=雷雨泽');
    const questions = await historyResponse.json();
    
    console.log(`获取到 ${questions.length} 道题目`);
    
    // 2. 筛选出没有答案的题目
    const questionsWithoutAnswers = questions.filter(q => !q.answer || q.answer === '暂无答案' || q.answer === '');
    
    console.log(`其中 ${questionsWithoutAnswers.length} 道题目没有答案`);
    
    // 3. 为每道题目生成答案
    for (const question of questionsWithoutAnswers) {
      console.log(`为题目生成答案: ${question.text.substring(0, 50)}...`);
      
      try {
        // 调用生成答案的 API
        const generateResponse = await fetch('http://localhost:3001/api/generate-answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            questionId: question.id,
            questionText: question.text
          })
        });
        
        const generateData = await generateResponse.json();
        if (generateData.success) {
          console.log(`生成答案任务创建成功，任务 ID: ${generateData.taskId}`);
        } else {
          console.error(`生成答案任务创建失败: ${generateData.error}`);
        }
      } catch (error) {
        console.error(`为题目生成答案失败: ${error.message}`);
      }
      
      // 等待 1 秒，避免请求过快
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('批量生成答案任务已全部创建');
  } catch (error) {
    console.error('批量生成答案失败:', error);
  }
}

// 执行批量生成
generateAnswersForAllQuestions();
