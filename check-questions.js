import fetch from 'node-fetch';

// 查看所有题目的状态
async function checkAllQuestions() {
  try {
    // 1. 获取所有错题
    const historyResponse = await fetch('http://localhost:3001/api/history?student=雷雨泽');
    const questions = await historyResponse.json();
    
    console.log(`获取到 ${questions.length} 道题目`);
    
    // 2. 打印每道题目的状态
    questions.forEach((q, index) => {
      console.log(`\n题目 ${index + 1}:`);
      console.log(`ID: ${q.id}`);
      console.log(`题目: ${q.text.substring(0, 100)}...`);
      console.log(`答案: ${q.answer || '暂无答案'}`);
      console.log(`解析: ${q.explanation || '暂无解析'}`);
      console.log(`是否有图片: ${q.questionImage ? '是' : '否'}`);
    });
  } catch (error) {
    console.error('查看题目状态失败:', error);
  }
}

// 执行查看
checkAllQuestions();
