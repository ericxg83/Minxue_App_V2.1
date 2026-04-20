import express from "express";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import sharp from "sharp";

// 裁剪图片函数
async function cropImage(base64Image: string, box: { x: number; y: number; width: number; height: number }): Promise<string> {
  try {
    // 移除 base64 前缀
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 获取图片信息
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    // 计算实际裁剪坐标（从百分比转换为像素）
    const x = Math.round((box.x / 100) * width);
    const y = Math.round((box.y / 100) * height);
    const cropWidth = Math.round((box.width / 100) * width);
    const cropHeight = Math.round((box.height / 100) * height);
    
    // 确保坐标有效
    const validX = Math.max(0, x);
    const validY = Math.max(0, y);
    const validWidth = Math.min(cropWidth, width - validX);
    const validHeight = Math.min(cropHeight, height - validY);
    
    // 裁剪图片
    const croppedBuffer = await sharp(buffer)
      .extract({
        left: validX,
        top: validY,
        width: validWidth,
        height: validHeight
      })
      .toBuffer();
    
    // 转换回 base64
    const croppedBase64 = `data:image/jpeg;base64,${croppedBuffer.toString('base64')}`;
    return croppedBase64;
  } catch (error) {
    console.error('Crop image error:', error);
    // 如果裁剪失败，返回原图
    return base64Image;
  }
}

// Supabase Configuration - 直接从环境变量读取
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

// Qwen API Configuration
// 强制使用魔搭配置（临时解决方案）
// 临时硬编码 API Key 用于测试
const qwenApiKey = process.env.MODELSCOPE_API_KEY || "ms-dae707ae-bcc4-4d7e-aa83-e2165d0cdbf5";
// 使用魔搭 API-Inference 支持的视觉模型
// moonshotai/Kimi-K2.5 支持视觉多模态理解，适合 OCR 识别
const qwenModelId = "moonshotai/Kimi-K2.5";
const qwenEndpoint = "https://api-inference.modelscope.cn/v1/chat/completions";

// 强制打印调试信息
console.log("==============================================");
console.log("【强制使用魔搭配置 - 版本 2024-04-17-v2】");
console.log("==============================================");
console.log("Endpoint:", qwenEndpoint);
console.log("Model:", qwenModelId);
console.log("API Key 存在:", !!qwenApiKey);
console.log("API Key 长度:", qwenApiKey?.length || 0);
console.log("API Key 前缀:", qwenApiKey ? qwenApiKey.substring(0, 20) + "..." : "未设置");
console.log("==============================================");

// 检查环境变量
console.log("MODELSCOPE_API_KEY 环境变量:", process.env.MODELSCOPE_API_KEY ? "已设置" : "未设置");
console.log("QWEN_API_KEY 环境变量:", process.env.QWEN_API_KEY ? "已设置" : "未设置");

// 🔍 DEBUG: 打印环境变量信息（用于排查线上问题）
console.log("\n" + "=".repeat(60));
console.log("=== ENVIRONMENT VARIABLES DEBUG ===");
console.log("=".repeat(60));
console.log("Node ENV:", process.env.NODE_ENV || "undefined");
console.log("SUPABASE_URL present:", !!supabaseUrl);
console.log("SUPABASE_URL value:", supabaseUrl || "NOT SET");
console.log("SUPABASE_ANON_KEY present:", !!supabaseKey);
console.log("SUPABASE_ANON_KEY length:", supabaseKey?.length || 0);
console.log("SUPABASE_ANON_KEY preview:", supabaseKey ? `${supabaseKey.substring(0, 20)}...` : "NOT SET");
console.log("QWEN_API_KEY present:", !!qwenApiKey);
console.log("QWEN_MODEL_ID:", qwenModelId);
console.log("QWEN_ENDPOINT:", qwenEndpoint);
console.log("=".repeat(60) + "\n");

// 全局变量，供所有函数访问
let supabase: any = null;
let useMockMode = false;

// 只有当环境变量存在时才初始化 Supabase 客户端
if (supabaseUrl && supabaseKey) {
  try {
    console.log("🔧 Initializing Supabase client...");
    console.log("🔗 URL:", supabaseUrl);
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log("✅ Supabase client initialized successfully");
    
    // 测试连接
    console.log("🧪 Testing Supabase connection...");
  } catch (error: any) {
    console.error("❌ Supabase client initialization FAILED:", error.message);
    useMockMode = true;
  }
} else {
  console.error("❌ CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY not set!");
  console.error("❌ Available env vars:", Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET')).join(', '));
  useMockMode = true;
}

if (useMockMode) {
  console.warn("⚠️⚠️⚠️ RUNNING IN MOCK MODE - DATA WILL NOT BE SAVED! ⚠️⚠️⚠️");
}

// 打印任务存储
const printTasks: any[] = [];

// 全局 mock 数据库
let mockDb: any[] = [
  { id: '1', student: '雷雨泽', subject: '数学', text: '1+1=?', imageUrl: 'https://picsum.photos/seed/math/800/600', questionImage: 'https://picsum.photos/seed/math1/400/300', originalImage: 'https://picsum.photos/seed/math/800/600', box: { x: 10, y: 10, width: 80, height: 30 }, time: '2024-04-01 10:00', status: 'pending' },
  { id: '2', student: '雷雨泽', subject: '英语', text: 'Apple means what?', imageUrl: 'https://picsum.photos/seed/english/800/600', questionImage: 'https://picsum.photos/seed/english1/400/300', originalImage: 'https://picsum.photos/seed/english/800/600', box: { x: 10, y: 20, width: 80, height: 25 }, time: '2024-04-01 11:00', status: 'mastered' },
  { id: '3', student: '雷雨泽', subject: '数学', text: 'Calculate: 2x + 5 = 15, find x', imageUrl: 'https://picsum.photos/seed/math2/800/600', questionImage: 'https://picsum.photos/seed/math3/400/300', originalImage: 'https://picsum.photos/seed/math2/800/600', box: { x: 15, y: 15, width: 70, height: 35 }, time: '2024-04-02 10:00', status: 'pending' },
  { id: '4', student: '雷雨泽', subject: '语文', text: '阅读理解：春天的景色', imageUrl: 'https://picsum.photos/seed/chinese/800/600', questionImage: 'https://picsum.photos/seed/chinese1/400/300', originalImage: 'https://picsum.photos/seed/chinese/800/600', box: { x: 12, y: 12, width: 76, height: 40 }, time: '2024-04-02 11:00', status: 'pending' },
  { id: '5', student: '雷雨泽', subject: '数学', text: '6. 如图,网格点上三点 A,B,C 在某平面直角坐标系中的坐标分别为 (a,b),(c,d),(a+c,b+d),则下列判断错误的是 A. a<0 B. b=2d C. a+c=b+d D. a+b+d=c', imageUrl: 'https://picsum.photos/seed/math4/800/600', questionImage: 'https://picsum.photos/seed/math5/400/300', originalImage: 'https://picsum.photos/seed/math4/800/600', box: { x: 10.2, y: 99.2, width: 85.6, height: 18.5 }, time: '2024-04-10 10:00', status: 'pending' },
  { id: '6', student: '雷雨泽', subject: '数学', text: '3. 在平面直角坐标系中,下列说法正确的是 A. 若点 M(-2,a)与点 N(x,a)之间的距离是 1,则 x 的值是 -1 B. 若 m≠0,则点 (-2,m²)一定在第四象限 C. 若点 P 到 x 轴和 y 轴的距离均为 2,则符合条件的点 P 有 4 个 D. 已知点 A(4,5), B(-5,5),则 AB⊥y 轴', imageUrl: 'https://picsum.photos/seed/math6/800/600', questionImage: 'https://picsum.photos/seed/math7/400/300', originalImage: 'https://picsum.photos/seed/math6/800/600', box: { x: 10.2, y: 49.2, width: 85.6, height: 13.5 }, time: '2024-04-10 11:00', status: 'pending' },
  // 袁怡希的测试数据
  { id: '7', student: '袁怡希', subject: '数学', text: '4. 若点 A(a+2,a²-4)在坐标轴上,则点 A 的坐标为 A.(0,0) B.(4,0) C.(0,', imageUrl: 'https://picsum.photos/seed/yuan1/800/600', questionImage: 'https://picsum.photos/seed/yuan1q/400/300', originalImage: 'https://picsum.photos/seed/yuan1/800/600', box: { x: 10, y: 10, width: 80, height: 30 }, time: '2024-04-15 10:00', status: 'pending', options: ['A.(0,0)', 'B.(4,0)', 'C.(0,'], stem: '4. 若点 A(a+2,a²-4)在坐标轴上,则点 A 的坐标为' },
  { id: '8', student: '袁怡希', subject: '数学', text: '2. 在平面直角坐标系内,已知点A(m,0)、B(0,-3),且 AB=5,那么m的值是 A.-4 B.2 C.4 D.4或-', imageUrl: 'https://picsum.photos/seed/yuan2/800/600', questionImage: 'https://picsum.photos/seed/yuan2q/400/300', originalImage: 'https://picsum.photos/seed/yuan2/800/600', box: { x: 10, y: 50, width: 80, height: 30 }, time: '2024-04-15 11:00', status: 'pending', options: ['A.-4', 'B.2', 'C.4', 'D.4或-'], stem: '2. 在平面直角坐标系内,已知点A(m,0)、B(0,-3),且 AB=5,那么m的值是' }
];

// 定义 OCR 文本行接口
interface OCRTextLine {
  text: string;
  bbox: [number, number, number, number]; // [x, y, width, height]
}

// 实现试卷题目自动识别与切块逻辑
function processOCRData(ocrLines: OCRTextLine[], pageWidth: number = 1000): any[] {
  // 控制台暴力打印
  console.log("!!! OCR DATA RECEIVED !!!", { ocrLines, pageWidth });
  
  // 步骤 1: 原始数据可视化（在前端实现）
  // 这里输出日志，供前端参考
  console.log(`OCR 识别到 ${ocrLines.length} 个文本块`);
  ocrLines.forEach((line, index) => {
    const [x, y, w, h] = line.bbox;
    console.log(`文本块 ${index + 1}: (${x.toFixed(1)}, ${y.toFixed(1)}, ${w.toFixed(1)}, ${h.toFixed(1)}) - "${line.text}"`);
  });
  
  // 步骤 2: 基于 Y 轴间距的“暴力切块”算法
  // 按 Y 坐标排序所有文本行
  const sortedLines = [...ocrLines].sort((a, b) => {
    const [_, y1] = a.bbox;
    const [__, y2] = b.bbox;
    return y1 - y2;
  });
  
  // 计算平均行高
  let totalHeight = 0;
  for (const line of sortedLines) {
    const [_, __, ___, h] = line.bbox;
    totalHeight += h;
  }
  const avgLineHeight = sortedLines.length > 0 ? totalHeight / sortedLines.length : 20;
  const thresholdGap = avgLineHeight * 2.5; // 超过平均行高的 2.5 倍视为题目分隔
  
  console.log(`平均行高: ${avgLineHeight.toFixed(2)}, 阈值: ${thresholdGap.toFixed(2)}`);
  
  // 寻找“断层”并强制切分
  const questionRegions: OCRTextLine[][] = [];
  let currentRegion: OCRTextLine[] = [];
  
  for (let i = 0; i < sortedLines.length; i++) {
    currentRegion.push(sortedLines[i]);
    
    // 检查与下一行的间距
    if (i < sortedLines.length - 1) {
      const [_, y1, __, h1] = sortedLines[i].bbox;
      const [___, y2] = sortedLines[i+1].bbox;
      const gap = y2 - (y1 + h1);
      
      console.log(`行 ${i+1} 到行 ${i+2} 的间距: ${gap.toFixed(2)} (阈值: ${thresholdGap.toFixed(2)})`);
      
      if (gap > thresholdGap) {
        // 间距超过阈值，开始新区域
        console.log(`在第 ${i+1} 行和第 ${i+2} 行之间切分`);
        questionRegions.push([...currentRegion]);
        currentRegion = [];
      }
    }
  }
  
  // 添加最后一个区域
  if (currentRegion.length > 0) {
    questionRegions.push(currentRegion);
  }
  
  console.log(`初步划分了 ${questionRegions.length} 个区域`);
  
  // 步骤 3: 忽略题号内容，强制顺序编号
  const finalQuestions: any[] = [];
  
  for (let i = 0; i < questionRegions.length; i++) {
    const region = questionRegions[i];
    const questionNumber = (i + 1).toString();
    
    // 计算外接矩形
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    
    region.forEach(line => {
      const [x, y, w, h] = line.bbox;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    });
    
    // 确保外接矩形有效
    if (minX === Infinity || minY === Infinity) {
      continue;
    }
    
    const width = maxX - minX;
    const height = maxY - minY;
    
    // 合并文本内容
    const text = region.map(line => line.text).join(' ');
    
    // 提取题干和选项
    const stem = text;
    const options: string[] = [];
    
    // 提取选项（支持 A.、A、A．、A) 等多种格式）
    // 匹配 A/B/C/D 后跟标点符号（英文点、中文点、顿号、右括号等）
    const optionRegex = /([A-D])[\.．、\)\s]\s*(.+?)(?=([A-D])[\.．、\)\s]|$)/g;
    let optionMatch;
    while ((optionMatch = optionRegex.exec(stem)) !== null) {
      options.push(`${optionMatch[1]}. ${optionMatch[2].trim()}`);
    }
    
    // 调试日志：打印选项提取结果
    console.log(`题目 ${questionNumber} 选项提取:`, {
      text: stem.substring(0, 100) + '...',
      optionsCount: options.length,
      options: options
    });
    
    // 创建题目对象
    finalQuestions.push({
      id: `q-${questionNumber}-${Date.now()}`,
      number: questionNumber,
      box: {
        x: (minX / pageWidth) * 100,
        y: (minY / pageWidth) * 100,
        width: (width / pageWidth) * 100,
        height: (height / pageWidth) * 100
      },
      text,
      stem: stem.replace(/([A-D])[\.．、\)\s]\s*.+?/g, '').trim(),
      options,
      hasImage: false,
      selected: false,
      isEditing: false,
      isVirtual: false,
      // 添加原始文本块信息，供前端可视化
      originalLines: region.map(line => ({
        text: line.text,
        bbox: line.bbox
      }))
    });
  }
  
  // 步骤 4: UI 表现优化（在前端实现）
  // 前端需要在每一个切好的题目区域左侧，生成一个蓝色的数字标号
  
  console.log(`最终识别出 ${finalQuestions.length} 道题目`);
  
  return finalQuestions;
}

// 映射到 Canvas 坐标系
function mapToCanvasCoordinates(regionBox: [number, number, number, number], canvasWidth: number, canvasHeight: number) {
  const [x, y, width, height] = regionBox;
  return {
    x: (x / 100) * canvasWidth,
    y: (y / 100) * canvasHeight,
    width: (width / 100) * canvasWidth,
    height: (height / 100) * canvasHeight
  };
}

const app = express();
const PORT = 3001;

// In-memory mock storage for demo mode
const mockStudents = [
  { id: 's1', name: "雷雨泽", grade: "八年级", semester: "下学期", parentName: "雷爸爸", contact: "13800138000", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=s1" },
  { id: 's2', name: "周俊辰", grade: "七年级", semester: "下学期", parentName: "周妈妈", contact: "13900139000", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=s2" },
  { id: 's3', name: "张三", grade: "一年级", semester: "下学期", parentName: "张爸爸", contact: "13700137000", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=s3" },
  { id: 's4', name: "李四", grade: "二年级", semester: "下学期", parentName: "李妈妈", contact: "13600136000", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=s4" },
  { id: 's5', name: "袁怡希", grade: "八年级", semester: "下学期", parentName: "袁妈妈", contact: "13500135000", avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=yuan" }
];

app.use(express.json({ limit: '50mb' }));

// API: Get Students
app.get("/api/students", async (req, res) => {
  console.log("\n=== 📚 GET STUDENTS API CALLED ===");
  console.log("Timestamp:", new Date().toISOString());
  console.log("Environment:", process.env.NODE_ENV || "development");
  
  try {
    console.log("\n🔌 Supabase Client Status:", !!supabase);
    
    if (!supabase || useMockMode) {
      console.log("⚠️ Using mock students data");
      return res.json(mockStudents);
    }

    console.log("\n💾 Querying database: SELECT specific columns FROM students");
    let { data, error } = await supabase
      .from('students')
      .select('id, name, grade, semester, parentName, contact, avatar');
    
    // 🔧 FIX: 如果 parentName 导致错误，尝试不使用该字段
    if (error && error.message && error.message.includes('parentName')) {
      console.warn("⚠️ parentName error in query, retrying without parentName...");
      const retryResult = await supabase
        .from('students')
        .select('id, name, grade, semester, contact, avatar');
      data = retryResult.data;
      error = retryResult.error;
    }
    
    if (error) {
      console.error("❌ Database query error:", error.message);
      console.error("- Error details:", JSON.stringify(error, null, 2));
      return res.status(500).json({ 
        error: "Database query failed", 
        message: error.message,
        code: error.code
      });
    }
    
    console.log("✅ Query successful:", data?.length, "students found");
    if (data && data.length > 0) {
      console.log("- Student names:", data.map((s: any) => s.name).join(", "));
    }
    
    res.json(data);
  } catch (error: any) {
    console.error("💥 Students API Exception:", error);
    res.status(500).json({ 
      error: "Server error", 
      message: error.message || "Unknown error"
    });
  }
  console.log("=== END GET STUDENTS API ===\n");
});

// API: Add Student
app.post("/api/students", async (req, res) => {
    console.log("\n=== 📝 ADD STUDENT API CALLED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Environment:", process.env.NODE_ENV || "development");
    
    try {
      const studentData = req.body;
      
      // 🔍 DEBUG: 打印完整的请求数据
      console.log("\n📥 Request Body (studentData):");
      console.log("- Keys:", Object.keys(studentData));
      console.log("- Full data:", JSON.stringify(studentData, null, 2));
      console.log("- Name:", studentData?.name);
      console.log("- Grade:", studentData?.grade);
      console.log("- Semester:", studentData?.semester);
      
      if (!studentData.name) {
        console.error("❌ Validation failed: Name is empty");
        return res.status(400).json({ error: "姓名不能为空" });
      }

      // 🔍 DEBUG: 检查 Supabase 客户端状态
      console.log("\n🔌 Supabase Client Status:");
      console.log("- supabase object exists:", !!supabase);
      console.log("- supabase type:", typeof supabase);
      if (!supabase || useMockMode) {
        console.log("⚠️ Using mock mode for adding student");
        const newStudent = {
          id: 's' + Date.now(),
          ...studentData,
          avatar: studentData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(studentData.name)}`
        };
        mockStudents.unshift(newStudent);
        return res.json({ success: true, student: newStudent });
      }

      // ✅ 使用真正的数据库操作
      console.log("\n💾 Attempting database INSERT...");
      console.log("- Table: students");
      console.log("- Data to insert:", JSON.stringify(studentData, null, 2));

      // 🔧 FIX: 移除可能导致 schema cache 问题的字段
      // 如果 parentName 导致问题，先尝试不插入这个字段
      const insertData = { ...studentData };
      
      // 尝试插入，如果失败则可能是 schema cache 问题
      let { data, error } = await supabase
        .from('students')
        .insert([insertData])
        .select('id, name, grade, semester, parentName, contact, avatar');
      
      // 如果失败且错误与 parentName 相关，尝试不插入 parentName
      if (error && error.message && error.message.includes('parentName')) {
        console.warn("⚠️ parentName column error detected, retrying without parentName...");
        delete insertData.parentName;
        
        const retryResult = await supabase
          .from('students')
          .insert([insertData])
          .select('id, name, grade, semester, contact, avatar');
        
        data = retryResult.data;
        error = retryResult.error;
      }

      // 🔍 DEBUG: 检查数据库操作结果
      if (error) {
        console.error("\n❌ DATABASE ERROR!");
        console.error("- Error code:", error.code);
        console.error("- Error message:", error.message);
        console.error("- Error details:", error.details);
        console.error("- Error hint:", error.hint);
        console.error("- Full error object:", JSON.stringify(error, null, 2));
        
        if (error.code === '23505') { // Unique constraint violation
          console.warn("⚠️ Duplicate student detected");
          return res.status(400).json({ error: "该学生已存在" });
        }
        throw error;
      }

      console.log("\n✅ DATABASE INSERT SUCCESSFUL!");
      console.log("- Returned data:", JSON.stringify(data, null, 2));
      console.log("- Inserted student count:", data?.length);
      
      // 🔧 FIX: 立即查询数据库验证数据是否真的写入
      console.log("\n🔍 Verifying data in database...");
      const { data: verifyData, error: verifyError } = await supabase
        .from('students')
        .select('id, name, grade, semester, parentName, contact, avatar')
        .eq('name', insertData.name)
        .single();
      
      if (verifyError) {
        console.warn("⚠️ Verification query failed:", verifyError.message);
      } else if (verifyData) {
        console.log("✅ Data verified in database:", verifyData.name);
      } else {
        console.warn("⚠️ Data not found in database immediately after insert!");
      }
      
      res.json({ success: true, student: data[0] || verifyData });
    } catch (error: any) {
      console.error("\n💥 ADD STUDENT EXCEPTION!");
      console.error("- Error type:", error.constructor.name);
      console.error("- Error message:", error.message);
      console.error("- Error stack:", error.stack);
      console.error("- Full error:", JSON.stringify(error, null, 2));
      
      res.status(500).json({ 
        error: error.message || "添加学生失败",
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
    console.log("=== END ADD STUDENT API ===\n");
  });

  // API: Update Student
  app.put("/api/students/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const studentData = req.body;

      if (!supabase || useMockMode) {
        const index = mockStudents.findIndex(s => s.id === id);
        if (index > -1) {
          mockStudents[index] = { ...mockStudents[index], ...studentData };
          return res.json({ success: true, student: mockStudents[index] });
        }
        return res.status(404).json({ error: "学生未找到" });
      }

      let { data, error } = await supabase
        .from('students')
        .update(studentData)
        .eq('id', id)
        .select('id, name, grade, semester, parentName, contact, avatar');

      // 🔧 FIX: 如果 parentName 导致错误，尝试不包含该字段
      if (error && error.message && error.message.includes('parentName')) {
        console.warn("⚠️ parentName error in update, retrying without parentName...");
        const updateData = { ...studentData };
        delete updateData.parentName;
        
        const retryResult = await supabase
          .from('students')
          .update(updateData)
          .eq('id', id)
          .select('id, name, grade, semester, contact, avatar');
        
        data = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;
      res.json({ success: true, student: data[0] });
    } catch (error: any) {
      console.error("Update Student Error:", error);
      res.status(500).json({ error: error.message || "更新学生失败" });
    }
  });

  // API: Process OCR Data
  app.post("/api/process-ocr", async (req, res) => {
    try {
      const { ocrLines, pageWidth } = req.body;
      if (!ocrLines || !Array.isArray(ocrLines)) {
        return res.status(400).json({ error: "OCR 数据不能为空且必须是数组" });
      }

      console.log(`Processing OCR data with ${ocrLines.length} lines`);
      
      // 调用 processOCRData 函数处理 OCR 数据
      const questions = processOCRData(ocrLines, pageWidth || 1000);
      
      console.log(`Processed ${questions.length} questions`);
      
      res.json({
        questions,
        subject: "数学" // 可以根据实际情况自动识别科目
      });
    } catch (error: any) {
      console.error("Process OCR Error:", error);
      res.status(500).json({ 
        error: error.message || "处理 OCR 数据失败", 
        details: error 
      });
    }
  });

  // API: Analyze Question using QWEN (DashScope)
  app.post("/api/analyze-question", async (req, res) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), 120000); // 120秒超时保护

    try {
      const { base64Image } = req.body;
      if (!base64Image) return res.status(400).json({ error: "图片不能为空" });

      const imageSizeKB = Math.round(base64Image.length * 0.75 / 1024);
      console.log(`Starting AI Analysis with QWEN (${qwenModelId}). Image size: ~${imageSizeKB}KB.`);
      
      const prompt = `你是一个顶级的试卷数字化专家。请对这张试卷进行深度的版面分析（Layout Analysis），并严格按照试卷中明确标注的题号来精准识别出每一道完整的题目。

任务：
1. 首先，仔细观察试卷上的所有题号，包括1、2、3、4、5等。
2. 然后，为每个题号创建一个独立的题目条目，确保每个题号对应一道完整的题目。
3. 最后，按照题号的顺序（1、2、3、4、5）返回所有识别出的题目。

具体要求：
1. **边界框生成**：
   - 为每一道题目生成一个精确的边界框 {x, y, width, height}。
   - 边界框必须从题号的最左上角开始，到该题最后一个选项的最右下角结束。
   - 边界框必须包含完整的题号、题干、所有选项以及该题配套的任何插图。
   - 坐标系：左上角为 (0,0)，右下角为 (100,100)。请确保坐标是相对于整张图片的百分比。

2. **内容提取**：
   - number: 提取题号（如 "1", "2", "3" 等）。
   - text: 提取该题的所有文字内容，包括题号、题干和选项。
   - stem: 仅提取题干部分，不包含题号和选项。
   - options: 提取选项列表（如果是选择题），每个选项必须包含选项字母和内容。
   - hasImage: 如果题目中包含几何图形、函数图、照片等非文字内容，请设为 true。
   - studentAnswer: 提取学生手写的答案（如果有）。
   - grade: 提取批改状态，值为 "correct"（正确，有红勾）、"incorrect"（错误，有红叉）或 "ungraded"（未批改）。
   - type: 题目类型，值为 "objective"（客观题，如选择、填空）或 "subjective"（主观题，如解答、证明）。
   - correctAnswer: 提取正确答案（如果能识别）。

3. **格式要求**：
   - 所有数学符号和公式必须使用标准 LaTeX 格式。
   - 按题目在试卷上的自然阅读顺序返回，即1、2、3、4、5的顺序。

重要提示：
- 确保识别出试卷上的所有题目，包括最后几道题目
- 确保每个题目都是完整的，不要只提取部分内容
- 确保边界框覆盖整个题目，从题号的最左上角开始到该题最后一个选项的最右下角结束
- 不要合并多个题目为一个，也不要将一个题目拆分为多个
- 确保边界框的大小和位置准确，不要过大或过小
- 确保返回的 JSON 格式正确，不包含任何额外的文字

仅返回 JSON 格式，不要包含任何解释文字。
{
  "questions": [
    {
      "number": "1",
      "box": {"x": 10.5, "y": 20.1, "width": 80.0, "height": 12.5},
      "text": "1. 题目内容...",
      "stem": "题目内容...",
      "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
      "hasImage": false,
      "studentAnswer": "A",
      "grade": "correct",
      "type": "objective",
      "correctAnswer": "A"
    },
    {
      "number": "2",
      "box": {"x": 10.5, "y": 35.1, "width": 80.0, "height": 10.5},
      "text": "2. 题目内容...",
      "stem": "题目内容...",
      "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"],
      "hasImage": false,
      "studentAnswer": "C",
      "grade": "incorrect",
      "type": "objective",
      "correctAnswer": "B"
    },
    {
      "number": "3",
      "box": {"x": 10.5, "y": 48.1, "width": 80.0, "height": 11.5},
      "text": "3. 题目内容...",
      "stem": "题目内容...",
      "options": [],
      "hasImage": false,
      "studentAnswer": "4",
      "grade": "ungraded",
      "type": "objective",
      "correctAnswer": "4"
    },
    {
      "number": "4",
      "box": {"x": 10.5, "y": 62.1, "width": 80.0, "height": 13.5},
      "text": "4. 题目内容...",
      "stem": "题目内容...",
      "options": [],
      "hasImage": true,
      "studentAnswer": "",
      "grade": "ungraded",
      "type": "subjective",
      "correctAnswer": ""
    },
    {
      "number": "5",
      "box": {"x": 10.5, "y": 78.1, "width": 80.0, "height": 12.5},
      "text": "5. 题目内容...",
      "stem": "题目内容...",
      "options": [],
      "hasImage": false,
      "studentAnswer": "",
      "grade": "ungraded",
      "type": "subjective",
      "correctAnswer": ""
    }
  ],
  "subject": "数学"
}`;

      // 减少重试次数，提高响应速度
      const maxRetries = 1;
      let attempt = 0;
      let response: Response | null = null;
      let lastError: any = null;

      // 检查是否使用 Gemini API
      const isGemini = qwenEndpoint.includes('generativelanguage.googleapis.com');

      while (attempt < maxRetries) {
        try {
          if (attempt > 0) {
            console.log(`Retrying AI Analysis (attempt ${attempt + 1}/${maxRetries})...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (isGemini) {
            // Gemini API 请求格式
            const base64Data = base64Image.startsWith('data:') ? base64Image.split(',')[1] : base64Image;
            
            response = await fetch(qwenEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${qwenApiKey}`
              },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { "text": prompt },
                      {
                        inline_data: {
                          mime_type: "image/jpeg",
                          data: base64Data
                        }
                      }
                    ]
                  }
                ],
                generationConfig: {
                  max_output_tokens: 2000
                }
              }),
              signal: controller.signal
            });
          } else {
            // OpenAI 风格 API 请求格式
            console.log("发送请求到:", qwenEndpoint);
            console.log("使用模型:", qwenModelId);
            console.log("API Key 前10位:", qwenApiKey ? qwenApiKey.substring(0, 10) + "..." : "未设置");
            
            response = await fetch(qwenEndpoint, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${qwenApiKey}`
              },
              body: JSON.stringify({
                model: qwenModelId, 
                max_tokens: 2000, // 减少最大 tokens，提高响应速度
                temperature: 0.3, // 降低温度，减少随机性，提高速度
                messages: [
                  {
                    role: "user",
                    content: [
                      { "type": "text", "text": prompt },
                      { 
                        "type": "image_url", 
                        "image_url": { 
                          "url": base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}` 
                        } 
                      }
                    ]
                  }
                ]
              }),
              signal: controller.signal
            });
          }

          if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
            break;
          }
          
          throw new Error(`API returned status ${response.status}`);
        } catch (error: any) {
          lastError = error;
          console.error(`Attempt ${attempt + 1} failed:`, error.message);
          if (error.name === 'AbortError' || (error.status && error.status >= 400 && error.status < 500 && error.status !== 429)) {
            break;
          }
          attempt++;
        }
      }

      if (!response) {
        throw lastError || new Error("AI 分析请求失败");
      }

      clearTimeout(timeoutId);
      
      // 检查 QWEN API 响应类型
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text();
        console.error("QWEN API returned non-JSON response:", text);
        throw new Error(`QWEN API 响应异常 (非 JSON): ${text.substring(0, 500)}`);
      }

      const data: any = await response.json();
      if (!response.ok) {
        console.error("API Error Details:", {
          status: response.status,
          statusText: response.statusText,
          endpoint: qwenEndpoint,
          model: qwenModelId,
          response: data
        });
        return res.status(response.status).json({ 
          error: "API 返回错误", 
          status: response.status,
          details: data 
        });
      }

      let content = data.choices[0].message.content;
      console.log("AI Analysis Successful");
      console.log("Raw AI Response:", content);
      
      // 尝试解析内容
      try {
        const parsed = JSON.parse(content);
        console.log("Parsed AI Response:", JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.warn("Failed to parse AI response as JSON:", e.message);
      }

      // 移除可能存在的 Markdown 代码块标记
      content = content.replace(/```json\n?|```/g, '').trim();
      
      // 尝试提取 JSON 对象（如果 AI 返回了多余的文字）
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        content = jsonMatch[0];
      }
      
      const tryParse = (str: string) => {
        try {
          return JSON.parse(str);
        } catch (e: any) {
          console.warn("Initial JSON parse failed, attempting repair...", e.message);
          
          let fixed = str;
          
          // 1. 针对数学公式中的反斜杠进行转义处理 (在处理引号之前，先处理明显的 LaTeX 错误)
          // 许多 AI 会输出 \sqrt 而不是 \\sqrt
          // 我们寻找所有不是有效 JSON 转义序列的反斜杠并双重转义它们
          fixed = fixed.replace(/\\(?!["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');

          // 2. 处理引号内的换行符 (JSON 不允许字符串内直接换行)
          // 使用更健壮的正则来匹配 JSON 字符串，考虑转义引号
          fixed = fixed.replace(/"((?:[^"\\]|\\.)*)"/g, (match, p1) => {
            return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
          });

          // 3. 尝试修复未转义的双引号 (这是一个启发式修复)
          // 匹配 "text": "..." 结构中的内容
          fixed = fixed.replace(/"text":\s*"([\s\S]*?)"(?=\s*[,\}])/g, (match, p1) => {
            // 将内部未转义的引号转义，排除掉已经是 \" 的情况
            const escapedText = p1.replace(/(?<!\\)"/g, '\\"');
            return `"text": "${escapedText}"`;
          });
          
          // 4. 如果 JSON 看起来不完整（例如没有闭合的括号），尝试补齐
          const openBraces = (fixed.match(/\{/g) || []).length;
          const closeBraces = (fixed.match(/\}/g) || []).length;
          if (openBraces > closeBraces) {
            fixed += '}'.repeat(openBraces - closeBraces);
          }
          const openBrackets = (fixed.match(/\[/g) || []).length;
          const closeBrackets = (fixed.match(/\]/g) || []).length;
          if (openBrackets > closeBrackets) {
            fixed += ']'.repeat(openBrackets - closeBrackets);
            // 补齐数组后可能还需要补齐外层对象
            const newOpenBraces = (fixed.match(/\{/g) || []).length;
            const newCloseBraces = (fixed.match(/\}/g) || []).length;
            if (newOpenBraces > newCloseBraces) {
              fixed += '}'.repeat(newOpenBraces - newCloseBraces);
            }
          }
          
          try {
            return JSON.parse(fixed);
          } catch (e2: any) {
            console.warn("Second JSON parse failed, attempting more aggressive repair...", e2.message);
            
            // 8. 尝试使用更宽松的 JSON 解析方法
            // 移除可能导致问题的字符
            let moreFixed = fixed;
            
            // 修复数组元素之间缺少逗号的问题
            moreFixed = moreFixed.replace(/\}\s*\{/g, '}, {');
            moreFixed = moreFixed.replace(/\]\s*\[/g, '], [');
            
            // 移除多余的逗号
            moreFixed = moreFixed.replace(/,\s*}/g, '}');
            moreFixed = moreFixed.replace(/,\s*]/g, ']');
            
            // 尝试再次解析
            try {
              return JSON.parse(moreFixed);
            } catch (e3: any) {
              console.warn("Third JSON parse failed, attempting final repair...", e3.message);
              
              // 9. 最后尝试：提取最小有效的 JSON 结构
              try {
                // 找到第一个 { 和最后一个 }
                const firstBrace = moreFixed.indexOf('{');
                const lastBrace = moreFixed.lastIndexOf('}');
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                  const minimalJSON = moreFixed.substring(firstBrace, lastBrace + 1);
                  return JSON.parse(minimalJSON);
                }
              } catch (e4) {
                // 所有尝试都失败了
              }
              
              throw e3;
            }
          }
        }
      };

      try {
        const parsedData = tryParse(content);
        
        // 为每个题目生成裁剪后的图片
        if (parsedData.questions && Array.isArray(parsedData.questions)) {
          // 串行处理题目，以便实现智能截断逻辑
          const questionsWithImages = [];
          for (let i = 0; i < parsedData.questions.length; i++) {
            const q = parsedData.questions[i];
            try {
              // 如果题目有边界框，生成裁剪后的图片
              if (q.box && q.box.x !== undefined && q.box.y !== undefined && q.box.width !== undefined && q.box.height !== undefined) {
                // 智能截断逻辑
                let adjustedBox = { ...q.box };
                
                // 检查是否有下一题
                if (i < parsedData.questions.length - 1) {
                  const nextQuestion = parsedData.questions[i + 1];
                  if (nextQuestion.box) {
                    const currentBottom = q.box.y + q.box.height;
                    const nextTop = nextQuestion.box.y;
                    const gap = nextTop - currentBottom;
                    
                    // 如果间隙大于0，在中间位置截断
                    if (gap > 0) {
                      const newHeight = q.box.height + (gap * 0.5);
                      // 确保高度为正数
                      if (newHeight > 0) {
                        adjustedBox = { ...q.box, height: newHeight };
                      }
                    }
                  }
                } else {
                  // 最后一题，添加固定的padding（5%的高度）
                  const newHeight = q.box.height + 5;
                  // 确保高度为正数
                  if (newHeight > 0) {
                    adjustedBox = { ...q.box, height: newHeight };
                  }
                }
                
                const questionImage = await cropImage(base64Image, adjustedBox);
                questionsWithImages.push({ ...q, questionImage });
              } else {
                questionsWithImages.push(q);
              }
            } catch (error) {
              console.error(`Error processing question ${q.number}:`, error);
              questionsWithImages.push(q);
            }
          }
          
          // 更新问题列表，包含裁剪后的图片
          parsedData.questions = questionsWithImages;
        }
        
        res.json(parsedData);
      } catch (parseError: any) {
        console.error("All JSON parse attempts failed:", content);
        console.error("Parse Error:", parseError.message);
        res.status(500).json({ 
          error: `AI 返回数据格式错误: ${parseError.message}`, 
          raw: content 
        });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError' || error === 'timeout') {
        console.error("Analyze Question Error: Request timed out");
        return res.status(504).json({ 
          error: "识题请求超时", 
          details: { message: "后端请求 QWEN API 超时，请检查图片大小或网络状况", reason: "timeout" } 
        });
      }
      console.error("Analyze Question Error:", error);
      res.status(500).json({ 
        error: error.message || "智能识题失败", 
        details: error 
      });
    }
  });

  // API: OCR for a single question image
  app.post("/api/ocr-question", async (req, res) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort("timeout"), 60000); // 60秒超时

    try {
      const { base64Image } = req.body;
      if (!base64Image) return res.status(400).json({ error: "图片不能为空" });

      const prompt = `你是一个顶级的试卷数字化专家。请识别这张图片中的题目内容，并整理成标准的试验题格式。
      
任务要求：
1. **完整提取**：提取图片中所有的文字内容，包括题号、题干、选项和答案（如果有）。
2. **数学公式**：所有数学符号和公式必须使用标准 LaTeX 格式。
3. **格式规范**：
   - 题目编号必须清晰明确
   - 题干和选项必须分开
   - 选项必须使用 A、B、C、D 等大写字母标识
   - 数学公式必须使用 $ 符号包围
   - 保持题目原有的结构和顺序
4. **结构化返回**：
   - text: 完整的题目文字，包括题号、题干和选项。
   - stem: 仅题干，不包含题号和选项。
   - options: 选项列表（如果是选择题），每个选项必须包含选项字母和内容。

仅返回 JSON 格式，确保 JSON 格式正确，不包含任何额外的文字：
{
  "text": "1. 题目内容...",
  "stem": "题目内容...",
  "options": ["A. 选项内容", "B. 选项内容", "C. 选项内容", "D. 选项内容"]
}`;

      // 检查是否使用 Gemini API
      const isGemini = qwenEndpoint.includes('generativelanguage.googleapis.com');
      
      let response: Response;
      if (isGemini) {
        // Gemini API 请求格式
        const base64Data = base64Image.startsWith('data:') ? base64Image.split(',')[1] : base64Image;
        
        response = await fetch(qwenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${qwenApiKey}`
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { "text": prompt },
                  {
                    inline_data: {
                      mime_type: "image/jpeg",
                      data: base64Data
                    }
                  }
                ]
              }
            ],
            generationConfig: {
              max_output_tokens: 2000
            }
          }),
          signal: controller.signal
        });
      } else {
        // OpenAI 风格 API 请求格式
        response = await fetch(qwenEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${qwenApiKey}`
          },
          body: JSON.stringify({
            model: qwenModelId,
            max_tokens: 2000,
            messages: [
              {
                role: "user",
                content: [
                  { "type": "text", "text": prompt },
                  { 
                    "type": "image_url", 
                    "image_url": { 
                      "url": base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}` 
                    } 
                  }
                ]
              }
            ]
          }),
          signal: controller.signal
        });
      }

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json();
        return res.status(response.status).json({ error: "OCR 失败", details: errorData });
      }

      const data: any = await response.json();
      let content;
      if (isGemini) {
        // Gemini API 响应格式
        content = data.candidates[0].content.parts[0].text;
      } else {
        // OpenAI 风格 API 响应格式
        content = data.choices[0].message.content;
      }
      content = content.replace(/```json\n?|```/g, '').trim();
      
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) content = jsonMatch[0];

      try {
        const parsed = JSON.parse(content);
        // 如果题目中有图片，将图片包含在 text 字段中
        if (parsed.text && req.body.imageUrl) {
          parsed.text = `![题目图片](${req.body.imageUrl})\n\n${parsed.text}`;
        }
        res.json(parsed);
      } catch (e) {
        // 如果解析失败，将图片包含在 text 字段中
        if (req.body.imageUrl) {
          content = `![题目图片](${req.body.imageUrl})\n\n${content}`;
        }
        res.json({ text: content, stem: content, options: [] });
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      res.status(500).json({ error: error.message || "OCR 失败" });
    }
  });

  // API: Submit Wrong Question
  app.post("/api/submit", async (req, res) => {
    try {
      const { student, subject, text, imageUrl, questionImage, originalImage, box, time, options, stem } = req.body;
      const id = Date.now().toString();
      
      // Normalize text for comparison (remove spaces and common punctuation)
      const normalize = (t: string) => t.replace(/[\s\p{P}]/gu, '');
      const normalizedNew = normalize(text || "");

      if (!supabase || useMockMode) {
        const exists = mockDb.some(q => q.student === student && normalize(q.text) === normalizedNew);
        if (exists) {
          return res.json({ success: true, id: "duplicate", isDuplicate: true });
        }
        mockDb.unshift({ id, student, subject, text, imageUrl, questionImage, originalImage, box, time, options, stem });
        return res.json({ success: true, id });
      }

      // 1. Check for duplicates with normalized text
      const { data: existing, error: checkError } = await supabase
        .from('wrong_questions')
        .select('id, question_text')
        .eq('student_name', student);

      if (checkError) {
        console.error("Supabase Duplicate Check Error:", checkError);
      }

      const isDuplicate = existing?.some(q => normalize(q.question_text) === normalizedNew);

      if (isDuplicate) {
        return res.json({ success: true, id: "duplicate", isDuplicate: true });
      }

      // 2. Insert if not duplicate
      const insertData: any = { 
        student_name: student, 
        subject: subject || '未命名试卷', 
        question_text: text, 
        image_url: imageUrl, 
        question_image: questionImage, 
        original_image: originalImage,
        box: box,
        created_at: time ? new Date(time).toISOString() : new Date().toISOString(),
        status: 'pending'
      };
      
      // 如果有选项数据，也保存到数据库（如果数据库支持）
      if (options && Array.isArray(options)) {
        insertData.options = options;
      }
      if (stem) {
        insertData.stem = stem;
      }
      
      const { data, error } = await supabase
        .from('wrong_questions')
        .insert([insertData])
        .select();

      if (error) {
        console.error("Supabase Submit Error:", error);
        return res.status(400).json({ 
          error: error.message || "数据库写入失败",
          details: error.details,
          hint: error.hint
        });
      }
      
      if (!data || data.length === 0) {
        return res.status(500).json({ error: "写入成功但未返回数据" });
      }

      res.json({ success: true, id: data[0].id });
    } catch (error: any) {
      console.error("Submit API Exception:", error);
      res.status(500).json({ error: error.message || "服务器提交异常" });
    }
  });

  // API: Get Stats
  app.get("/api/stats", async (req, res) => {
    try {
      const { student } = req.query;
      if (!student) return res.json({ count: 0 });
      
      if (!supabase || useMockMode) {
        const count = mockDb.filter(row => row.student === student).length;
        return res.json({ count });
      }

      // Using a more standard query for count
      const { error, count } = await supabase
        .from('wrong_questions')
        .select('id', { count: 'exact', head: true })
        .eq('student_name', student);

      if (error) {
        console.error("Supabase Stats Error Detail:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return res.json({ count: 0 });
      }
      res.json({ count: count || 0 });
    } catch (error) {
      console.error("Stats API Exception:", error);
      res.json({ count: 0 });
    }
  });

  // API: Get History (Wrong Question Book)
  app.get("/api/history", async (req, res) => {
    try {
      const { student } = req.query;
      if (!student) return res.json([]);

      if (!supabase || useMockMode) {
        const history = mockDb.filter(row => row.student === student);
        return res.json(history);
      }

      const { data, error } = await supabase
        .from('wrong_questions')
        .select('*')
        .eq('student_name', student)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Supabase History Error Detail:", {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        return res.status(500).json({ error: error.message || "数据库查询失败" });
      }
      
      const history = (data || []).map(row => {
        const originalText = row.question_text || row.text;
        
        // 处理题目结构，拆分为题干和选项
        let questionText = originalText;
        let options: string[] = [];
        
        // 优先使用数据库中存储的 options 字段
        if (row.options && Array.isArray(row.options) && row.options.length > 0) {
          options = row.options;
          // 如果有存储的 stem 字段，使用它作为题干
          if (row.stem) {
            questionText = row.stem;
          } else {
            // 否则从 text 中解析题干
            const firstOptionMatch = originalText.match(/\s*[Aa][.．]/);
            if (firstOptionMatch) {
              questionText = originalText.substring(0, firstOptionMatch.index || 0).trim();
            }
          }
        } else {
          // 自动从文本中解析选项（兼容旧数据）
          // 找到第一个A选项的位置
          const firstOptionMatch = originalText.match(/\s*[Aa][.．]/);
          if (firstOptionMatch) {
            const firstOptionIndex = firstOptionMatch.index || 0;
            
            // 分割题干和选项文本
            questionText = originalText.substring(0, firstOptionIndex).trim();
            const optionsText = originalText.substring(firstOptionIndex).trim();
            
            // 拆分选项
            const optionRegex = /([A-D][.．]\s*.*?)(?=[A-D][.．]|$)/g;
            options = optionsText.match(optionRegex) || [];
            
            // 清理选项
            options = options.map(opt => opt.trim());
          }
        }
        
        return {
          id: row.id,
          student: row.student_name || row.student,
          subject: row.subject,
          text: originalText,
          question: questionText,
          options: options,
          imageUrl: row.image_url || row.imageUrl,
          questionImage: row.question_image || row.questionImage || row.image_url || row.imageUrl,
          originalImage: row.original_image || row.originalImage || row.image_url || row.imageUrl,
          box: row.box,
          answer: row.answer || row.answer_text || '',
          explanation: row.explanation || row.analysis || '',
          time: row.created_at ? new Date(row.created_at).toLocaleString('zh-CN') : row.time || '未知时间',
          practice_count: row.practice_count || 0,
          status: row.status || 'pending'
        };
      });

      // 在 Mock 模式下，确保 mockDb 中的题目也包含 answer、explanation、question 和 options 字段
      if (!supabase || useMockMode) {
        mockDb.forEach(item => {
          if (!item.answer) item.answer = '';
          if (!item.explanation) item.explanation = '';
          
          // 处理题目结构，拆分为题干和选项
          if (!item.question || !item.options) {
            const originalText = item.text;
            let questionText = originalText;
            let options: string[] = [];
            
            // 找到第一个A选项的位置
            const firstOptionMatch = originalText.match(/\s*[Aa][.．]/);
            if (firstOptionMatch) {
              const firstOptionIndex = firstOptionMatch.index || 0;
              
              // 分割题干和选项文本
              questionText = originalText.substring(0, firstOptionIndex).trim();
              const optionsText = originalText.substring(firstOptionIndex).trim();
              
              // 拆分选项
              const optionRegex = /([A-D][.．]\s*.*?)(?=[A-D][.．]|$)/g;
              options = optionsText.match(optionRegex) || [];
              
              // 清理选项
              options = options.map(opt => opt.trim());
            }
            
            item.question = questionText;
            item.options = options;
          }
        });
      }
        
      res.json(history);
    } catch (error) {
      console.error("History API Exception:", error);
      res.status(500).json({ error: "服务器内部错误" });
    }
  });

  // API: Update Status
  app.patch("/api/history/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status } = req.body;
      if (!supabase || useMockMode) {
        const item = mockDb.find(q => q.id === id);
        if (item) item.status = status;
        return res.json({ success: true });
      }

      const { error } = await supabase
        .from('wrong_questions')
        .update({ status })
        .eq('id', id);

      if (error) {
        console.error("Supabase Status Update Error:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Status Update API Exception:", error);
      res.status(500).json({ error: "服务器内部错误" });
    }
  });

  // API: Delete Student
  app.delete("/api/students/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!supabase || useMockMode) {
        const index = mockStudents.findIndex(s => s.id === id);
        if (index > -1) mockStudents.splice(index, 1);
        return res.json({ success: true });
      }

      const { error } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (error) {
        console.error("Supabase Delete Student Error:", error);
        return res.status(500).json({ error: error.message });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Delete Student API Exception:", error);
      res.status(500).json({ error: "服务器内部错误" });
    }
  });

  // API: Get Subjects
  app.get("/api/subjects", async (req, res) => {
    try {
      if (!supabase || useMockMode) {
        return res.json(['数学', '语文', '英语', '物理', '化学']);
      }
      const { data, error } = await supabase.from('subjects').select('name');
      if (error) return res.json(['数学', '语文', '英语', '物理', '化学']);
      return res.json(data.map((s: any) => s.name));
    } catch (error) {
      res.json(['数学', '语文', '英语', '物理', '化学']);
    }
  });

  // API: Update Practice Count
  app.post("/api/history/:id/practice", async (req, res) => {
    try {
      const { id } = req.params;
      if (!supabase || useMockMode) {
        const item = mockDb.find(q => q.id === id);
        if (item) item.practice_count = (item.practice_count || 0) + 1;
        return res.json({ success: true });
      }

      const { data: current, error: getError } = await supabase
        .from('wrong_questions')
        .select('practice_count')
        .eq('id', id)
        .single();

      if (getError) throw getError;

      const { error: updateError } = await supabase
        .from('wrong_questions')
        .update({ practice_count: (current?.practice_count || 0) + 1 })
        .eq('id', id);

      if (updateError) throw updateError;
      res.json({ success: true });
    } catch (error) {
      console.error("Update practice count error:", error);
      res.status(500).json({ error: "Failed to update" });
    }
  });

  // API: Delete Wrong Question
  app.delete("/api/history/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!supabase || useMockMode) {
        const index = mockDb.findIndex(q => q.id === id);
        if (index > -1) mockDb.splice(index, 1);
        return res.json({ success: true });
      }

      const { error } = await supabase
        .from('wrong_questions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      res.json({ success: true });
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete" });
    }
  });

  

  // API: Batch Submit Wrong Questions
  app.post("/api/batch-submit", async (req, res) => {
    try {
      const { questions, student, subject, time } = req.body;
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "题目列表不能为空" });
      }
      
      if (!student) {
        return res.status(400).json({ error: "学生姓名不能为空" });
      }

      // Normalize text for comparison (remove spaces and common punctuation)
      const normalize = (t: string) => t.replace(/[\s\p{P}]/gu, '');

      if (!supabase || useMockMode) {
        // Mock mode
        const results = [];
        for (const q of questions) {
          const normalizedNew = normalize(q.text || "");
          const exists = mockDb.some(item => item.student === student && normalize(item.text) === normalizedNew);
          
          if (exists) {
            results.push({ id: "duplicate", isDuplicate: true });
          } else {
            const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
            mockDb.unshift({
              id,
              student,
              subject: subject || '未命名试卷',
              text: q.text || '未识别到文字',
              imageUrl: q.imageUrl,
              time: time || new Date().toISOString(),
              options: q.options || [],
              stem: q.stem || ''
            });
            results.push({ id, success: true });
          }
        }
        return res.json({ success: true, results });
      }

      // Supabase mode
      const results = [];
      
      // 1. Check for duplicates with normalized text
      const { data: existing, error: checkError } = await supabase
        .from('wrong_questions')
        .select('id, question_text')
        .eq('student_name', student);

      if (checkError) {
        console.error("Supabase Duplicate Check Error:", checkError);
      }

      for (const q of questions) {
        const normalizedNew = normalize(q.text || "");
        const isDuplicate = existing?.some(item => normalize(item.question_text) === normalizedNew);
        
        if (isDuplicate) {
          results.push({ id: "duplicate", isDuplicate: true });
        } else {
          // 2. Insert if not duplicate
          const insertData: any = { 
            student_name: student, 
            subject: subject || '未命名试卷', 
            question_text: q.text || '未识别到文字', 
            image_url: q.imageUrl,
            created_at: time ? new Date(time).toISOString() : new Date().toISOString(),
            status: 'pending'
          };
          
          // 如果有选项数据，也保存到数据库
          if (q.options && Array.isArray(q.options)) {
            insertData.options = q.options;
          }
          if (q.stem) {
            insertData.stem = q.stem;
          }
          
          const { data, error } = await supabase
            .from('wrong_questions')
            .insert([insertData])
            .select();

          if (error) {
            console.error("Supabase Submit Error:", error);
            results.push({ error: error.message || "数据库写入失败" });
          } else if (!data || data.length === 0) {
            results.push({ error: "写入成功但未返回数据" });
          } else {
            const questionId = data[0].id;
            results.push({ id: questionId, success: true });
          }
        }
      }

      res.json({ success: true, results });
    } catch (error: any) {
      console.error("Batch Submit API Exception:", error);
      res.status(500).json({ error: error.message || "服务器提交异常" });
    }
  });

  // API: Create Print Task
  app.post("/api/print-task/create", async (req, res) => {
    try {
      const { questions, student } = req.body;
      
      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        return res.status(400).json({ error: "题目列表不能为空" });
      }
      
      if (!student) {
        return res.status(400).json({ error: "学生姓名不能为空" });
      }
      
      // 生成唯一任务ID
      const taskId = `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 保存打印任务
      const task = {
        id: taskId,
        questions,
        student,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      
      // 保存到打印任务存储
      printTasks.push(task);
      
      res.json({
        success: true,
        taskId,
        questions,
        student,
        createdAt: task.createdAt
      });
    } catch (error: any) {
      console.error("生成打印任务失败:", error);
      res.status(500).json({ error: error.message || "生成打印任务失败" });
    }
  });

  // API: Get Print Task by QR Code Data
  app.get("/api/print-task/:taskId", async (req, res) => {
    try {
      const { taskId } = req.params;
      
      if (!taskId) {
        return res.status(400).json({ error: "任务 ID 不能为空" });
      }

      // 查找打印任务
      const task = printTasks.find(t => t.id === taskId);
      if (!task) {
        return res.status(404).json({ error: "打印任务不存在" });
      }

      // 获取题目的详细信息
      if (task.questions && task.questions.length > 0) {
        if (!supabase) {
          // Mock mode
          task.questions = task.questions.map((qId: string) => {
            const question = mockDb.find(q => q.id === qId);
            return {
              id: qId,
              text: question?.text || "未找到题目",
              answer: question?.answer || "",
              studentAnswer: ""
            };
          });
        } else {
          // Supabase mode
          const { data, error } = await supabase
            .from('wrong_questions')
            .select('id, question_text, answer')
            .in('id', task.questions);

          if (error) {
            console.error("Supabase Get Questions Error:", error);
          } else {
            task.questions = (data || []).map((q: any) => ({
              id: q.id,
              text: q.question_text,
              answer: q.answer,
              studentAnswer: ""
            }));
          }
        }
      }

      res.json({ success: true, task });
    } catch (error: any) {
      console.error("Get print task error:", error);
      res.status(500).json({ error: error.message || "获取打印任务失败" });
    }
  });

  // API: Submit Grading Results
  app.post("/api/grade", async (req, res) => {
    try {
      const { taskId, questions } = req.body;
      
      if (!taskId || !questions || !Array.isArray(questions)) {
        return res.status(400).json({ error: "任务 ID 和题目列表不能为空" });
      }

      // 计算得分
      let correctCount = 0;
      let totalCount = questions.length;

      for (const q of questions) {
        if (q.studentAnswer === q.answer) {
          correctCount++;
        }
      }

      const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

      // 模拟保存批改结果
      // 实际应用中，应该保存到数据库
      const result = {
        taskId,
        score,
        correctCount,
        totalCount,
        gradedAt: new Date().toISOString()
      };

      res.json({ success: true, result });
    } catch (error: any) {
      console.error("Submit grading error:", error);
      res.status(500).json({ error: error.message || "提交批改结果失败" });
    }
  });

  // API: Generate PDF
  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { taskId } = req.body;
      
      if (!taskId) {
        return res.status(400).json({ error: "任务 ID 不能为空" });
      }

      // 查找打印任务
      const task = printTasks.find(t => t.id === taskId);
      if (!task) {
        return res.status(404).json({ error: "打印任务不存在" });
      }

      // 获取题目详情
      const questions = task.questions.map((qId: string, index: number) => {
        const question = mockDb.find((q: any) => q.id === qId);
        const originalText = question?.text || `题目 ${qId}`;
        
        // 处理题目结构，拆分为题干和选项
        let questionText = originalText;
        let options: string[] = [];
        
        // 找到第一个A选项的位置
        const firstOptionMatch = originalText.match(/\s*[Aa][.．]/);
        if (firstOptionMatch) {
          const firstOptionIndex = firstOptionMatch.index || 0;
          
          // 分割题干和选项文本
          questionText = originalText.substring(0, firstOptionIndex).trim();
          const optionsText = originalText.substring(firstOptionIndex).trim();
          
          // 拆分选项
          const optionRegex = /([A-D][.．]\s*.*?)(?=[A-D][.．]|$)/g;
          options = optionsText.match(optionRegex) || [];
          
          // 清理选项
          options = options.map(opt => opt.trim());
          
          // 打印调试信息
          console.log("STRUCTURED:", questionText, options);
        }
        
        return {
          id: qId,
          text: originalText,
          question: questionText,
          options: options,
          number: (index + 1).toString()
        };
      });

      // 生成PDF
      const { generatePDF } = await import('./src/utils/pdfGenerator');
      const pdfBuffer = await generatePDF({
        id: task.id,
        questions,
        student: task.student
      });

      // 设置响应头
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=wrong-questions-${task.id}.pdf`);
      res.setHeader('Content-Length', pdfBuffer.length);

      // 发送PDF
      res.send(pdfBuffer);
    } catch (error: any) {
      console.error("Generate PDF error:", error);
      res.status(500).json({ error: error.message || "生成PDF失败" });
    }
  });

  // 导出默认处理函数，用于 Vercel 部署
export default app;
