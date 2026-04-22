import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, 
  Upload, 
  CheckCircle2, 
  Loader2,
  ChevronRight,
  User,
  UserPlus,
  BookOpen,
  History,
  Send,
  AlertCircle,
  BarChart3,
  RefreshCw,
  X,
  ChevronLeft,
  Edit3,
  Plus,
  Maximize,
  Maximize2,
  Layers,
  Image as ImageIcon,
  Check,
  Trash2,
  Printer,
  Sparkles,
  FileText,
  Search,
  Filter,
  Minus,
  Calendar,
  RotateCw,
  ChevronDown,
   MessageSquare,
  Share2,
  Eye
} from 'lucide-react';
import { Stage, Layer, Image as KonvaImage, Rect, Group, Circle, Text as KonvaText, Path, Transformer } from 'react-konva';
import useImage from 'use-image';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import confetti from 'canvas-confetti';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import QRCode from 'qrcode';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Format Question Function ---

interface FormattedQuestion {
  stem: string;
  options: string[];
  hasImage: boolean;
}

function formatQuestion(text: string, hasImage: boolean): FormattedQuestion {
  // 提取题干（Stem）：提取 A. 选项之前的全部文字
  const optionMatch = text.match(/([A-D][\.、\s])/);
  const stem = optionMatch ? text.substring(0, optionMatch.index).trim() : text.trim();
  
  // 提取选项（Options）：利用正则表达式匹配 [A-D][\.、\s]，将选项拆分为独立的数组
  const options: string[] = [];
  if (optionMatch) {
    const optionsText = text.substring(optionMatch.index);
    const optionRegex = /([A-D][\.、\s])(.*?)(?=[A-D][\.、\s]|$)/g;
    let match;
    while ((match = optionRegex.exec(optionsText)) !== null) {
      options.push(`${match[1]}${match[2].trim()}`);
    }
  }
  
  return {
    stem,
    options,
    hasImage
  };
}

// --- Types ---

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface Student {
  id: string;
  name: string;
  grade: string;
  semester: string;
  parentName?: string;
  contact?: string;
  avatar?: string;
}

interface Question {
  id: string;
  number?: string;
  box: Box;
  text: string;
  stem?: string;
  options?: string[];
  hasImage?: boolean;
  selected: boolean;
  isEditing?: boolean;
}

interface AnalysisResult {
  questions: { box: Box; text: string }[];
  subject: string;
}

// --- Utils ---

function compressImage(base64: string, maxWidth = 1200, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      let width = img.width;
      let height = img.height;

      if (width > maxWidth) {
        height = (maxWidth / width) * height;
        width = maxWidth;
      }

      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = (err) => reject(err);
  });
}

function cropImage(base64: string, box: Box): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = base64;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      const x = (box.x / 100) * img.width;
      const y = (box.y / 100) * img.height;
      const w = (box.width / 100) * img.width;
      const h = (box.height / 100) * img.height;

      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, x, y, w, h, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = (err) => reject(err);
  });
}

// --- App Component ---

export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'wrong_questions' | 'data' | 'settings' | 'grade'>('home');
  const [image, setImage] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subject, setSubject] = useState('数学');
  const [grade, setGrade] = useState('一年级');
  const [term, setTerm] = useState('上学期');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isAddingStudent, setIsAddingStudent] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [studentFormData, setStudentFormData] = useState({
    name: '',
    grade: '一年级',
    semester: '上学期',
    parentName: '',
    contact: '',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default'
  });
  const [isSavingStudent, setIsSavingStudent] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteStudentConfirm, setDeleteStudentConfirm] = useState<{id: string, name: string, grade: string} | null>(null);
  const [reportTimeRange, setReportTimeRange] = useState<'week' | 'month' | 'custom'>('week');
  const [studentSearchTerm, setStudentSearchTerm] = useState('');
  const [isStudentPickerOpen, setIsStudentPickerOpen] = useState(false);

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);

  // History states
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([]);
  const [isPrintMode, setIsPrintMode] = useState(false);
  const [filterSubject, setFilterSubject] = useState('全部');
  const [filterStatus, setFilterStatus] = useState('全部');
  const [filterDate, setFilterDate] = useState('全部');
  const [filterPractice, setFilterPractice] = useState('全部');
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [editingAnswerId, setEditingAnswerId] = useState<string | null>(null);
  const [editedAnswer, setEditedAnswer] = useState<string>('');
  const [editedExplanation, setEditedExplanation] = useState<string>('');
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);
  const [editedQuestionText, setEditedQuestionText] = useState<string>('');
  const [printTaskId, setPrintTaskId] = useState<string>('');
  const [qrcodeUrl, setQrcodeUrl] = useState<string>('');

  // Batch upload states
  const [batchUploading, setBatchUploading] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState<any[]>([]);
  const [isBatchComplete, setIsBatchComplete] = useState(false);

  // Grading states
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<string>('');
  const [gradingTask, setGradingTask] = useState<any>(null);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [submittingGrade, setSubmittingGrade] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [konvaImage] = useImage(image || '');
  
  // ✅ NEW: Database connection status
  const [dbStatus, setDbStatus] = useState<'connected' | 'mock' | 'unknown'>('unknown');
  const [dbMessage, setDbMessage] = useState('');

  const fetchStudents = () => {
    // 🔧 FIX: 添加时间戳参数，强制绕过所有缓存层
    const timestamp = Date.now();
    fetch(`/api/students?_t=${timestamp}`, {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    })
      .then(res => res.json())
      .then(data => {
        setStudents(data);
        if (data.length > 0 && !selectedStudent) setSelectedStudent(data[0].name);
        
        // 🔍 Check if data is from database or mock
        // Mock data usually has IDs like timestamps (e.g., "1713000000000")
        // Real database data usually has UUIDs or shorter IDs
        if (data.length > 0) {
          const firstStudent = data[0];
          const isMockData = firstStudent.id && firstStudent.id.toString().length > 10;
          if (isMockData) {
            setDbStatus('mock');
            setDbMessage('⚠️ 当前使用 Mock 模式，数据不会持久化');
          } else {
            setDbStatus('connected');
            setDbMessage('✅ 已连接到数据库');
          }
        }
      })
      .catch(err => {
        console.error("Failed to fetch students", err);
        setDbStatus('error');
        setDbMessage('❌ 数据库连接失败');
      });
  };

  const [subjects, setSubjects] = useState<string[]>(['数学', '语文', '英语', '物理', '化学']);
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');

  const fetchSubjects = () => {
    fetch('/api/subjects')
      .then(res => res.json())
      .then(data => setSubjects(data))
      .catch(err => console.error("Failed to fetch subjects", err));
  };

  // Fetch students and subjects on mount
  useEffect(() => {
    fetchStudents();
    fetchSubjects();
  }, []);

  // Fetch weekly count when student changes
  useEffect(() => {
    if (selectedStudent) {
      fetch(`/api/stats?student=${encodeURIComponent(selectedStudent)}`)
        .then(res => res.json())
        .then(data => setWeeklyCount(data.count))
        .catch(err => console.error("Failed to fetch stats", err));
      
      if (activeTab === 'wrong_questions') {
        fetchHistory();
      }
    }
  }, [selectedStudent, activeTab]);

  const fetchHistory = async () => {
    if (!selectedStudent) return [];
    setLoadingHistory(true);
    setError(null);
    setSelectedHistoryIds([]); // Clear selection on refresh
    try {
      // 保存当前正在生成答案的题目 ID
      const generatingQuestionIds = history.filter(item => 
        item.answer === 'AI生成中...' || item.explanation === 'AI生成中...'
      ).map(item => item.id);
      
      const res = await fetch(`/api/history?student=${encodeURIComponent(selectedStudent)}`);
      const data = await res.json();
      if (data && data.error) {
        setError(`加载失败: ${data.error}`);
        setHistory([]);
        return [];
      } else if (Array.isArray(data)) {
        // 更新状态，保留正在生成答案的题目状态
        const updatedHistory = data.map((item: any) => {
          if (generatingQuestionIds.includes(item.id)) {
            return {
              ...item,
              answer: 'AI生成中...',
              explanation: 'AI生成中...'
            };
          }
          return item;
        });
        setHistory(updatedHistory);
        return updatedHistory;
      } else {
        console.error("History API returned non-array data:", data);
        setHistory([]);
        return [];
      }
    } catch (err) {
      console.error("Failed to fetch history", err);
      setError("网络错误，无法获取错题本。");
      setHistory([]);
      return [];
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleDelete = (id: string) => {
    setDeleteConfirmId(id);
  };

  const confirmDelete = async () => {
    if (!deleteConfirmId) return;
    const id = deleteConfirmId;
    
    try {
      const res = await fetch(`/api/history/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setHistory(prev => prev.filter(item => item.id !== id));
        // Update stats
        fetch(`/api/stats?student=${encodeURIComponent(selectedStudent)}`)
          .then(res => res.json())
          .then(data => setWeeklyCount(data.count));
      }
    } catch (err) {
      console.error("Delete failed", err);
    } finally {
      setDeleteConfirmId(null);
    }
  };

  const handleUpdateAnswer = async (id: string, answer: string, explanation: string) => {
    try {
      // 这里需要添加一个 API 端点来更新答案和解析
      // 暂时使用 mock 数据更新
      setHistory(history.map(item => {
        if (item.id === id) {
          return {
            ...item,
            answer: answer,
            explanation: explanation
          };
        }
        return item;
      }));
      setEditingAnswerId(null);
      setEditedAnswer('');
      setEditedExplanation('');
    } catch (error) {
      console.error('更新答案失败:', error);
    }
  };

  // 自动生成答案和解析
  const generateAnswerAndExplanation = async (questionId: string, questionText: string) => {
    try {
      // 更新题目状态为生成中
      setHistory(prev => prev.map(item => {
        if (item.id === questionId) {
          return {
            ...item,
            answer: 'AI生成中...',
            explanation: 'AI生成中...'
          };
        }
        return item;
      }));

      // 调用AI接口创建生成任务
      const res = await fetch('/api/generate-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionId: questionId,
          questionText: questionText
        })
      });

      if (!res.ok) {
        throw new Error('创建生成任务失败');
      }

      const data = await res.json();
      const taskId = data.taskId;

      // 轮询任务状态
      const pollTaskStatus = async () => {
        try {
          const statusRes = await fetch(`/api/answer-task/${taskId}`);
          if (!statusRes.ok) {
            throw new Error('获取任务状态失败');
          }

          const statusData = await statusRes.json();
          const task = statusData.task;

          if (task.status === 'completed') {
            // 任务完成，更新题目状态
            setHistory(prev => prev.map(item => {
              if (item.id === questionId) {
                return {
                  ...item,
                  answer: task.result?.answer || '生成失败',
                  explanation: task.result?.explanation || '生成失败'
                };
              }
              return item;
            }));
          } else if (task.status === 'failed') {
            // 任务失败
            setHistory(prev => prev.map(item => {
              if (item.id === questionId) {
                return {
                  ...item,
                  answer: '生成失败',
                  explanation: '生成失败'
                };
              }
              return item;
            }));
          } else {
            // 任务仍在进行中，继续轮询
            setTimeout(pollTaskStatus, 2000);
          }
        } catch (error) {
          console.error('轮询任务状态失败:', error);
          setHistory(prev => prev.map(item => {
            if (item.id === questionId) {
              return {
                ...item,
                answer: '生成失败',
                explanation: '生成失败'
              };
            }
            return item;
          }));
        }
      };

      // 开始轮询
      pollTaskStatus();

    } catch (error) {
      console.error('自动生成答案失败:', error);
      // 更新题目状态为生成失败
      setHistory(prev => prev.map(item => {
        if (item.id === questionId) {
          return {
            ...item,
            answer: '生成失败',
            explanation: '生成失败'
          };
        }
        return item;
      }));
    }
  };

  // Grading functions
  const handleScanQRCode = async () => {
    try {
      setIsScanning(true);
      setGradingError(null);
      
      // 模拟二维码扫描
      // 实际应用中，应该使用摄像头扫描二维码
      // 这里我们假设用户已经扫描了二维码，输入了扫描结果
      
      // 模拟扫描结果
      const mockScanResult = JSON.stringify({
        taskId: 'print-1234567890-abcdef',
        questions: ['1', '2', '3'],
        student: '雷雨泽',
        date: new Date().toISOString()
      });
      
      setScanResult(mockScanResult);
      await handleProcessScanResult(mockScanResult);
    } catch (error: any) {
      console.error('扫描二维码失败:', error);
      setGradingError(error.message || '扫描二维码失败');
    } finally {
      setIsScanning(false);
    }
  };

  const handleProcessScanResult = async (result: string) => {
    try {
      setGradingLoading(true);
      setGradingError(null);
      
      // 解析二维码数据
      const qrData = JSON.parse(result);
      
      // 获取打印任务信息
      const res = await fetch('/api/print-task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(qrData)
      });
      
      if (!res.ok) {
        throw new Error('获取打印任务失败');
      }
      
      const data = await res.json();
      setGradingTask(data.task);
    } catch (error: any) {
      console.error('处理扫描结果失败:', error);
      setGradingError(error.message || '处理扫描结果失败');
    } finally {
      setGradingLoading(false);
    }
  };

  const handleSubmitGrade = async () => {
    if (!gradingTask || !gradingTask.questions) {
      setGradingError('没有可批改的题目');
      return;
    }
    
    try {
      setSubmittingGrade(true);
      setGradingError(null);
      
      // 收集本地暂存的所有题目判定结果
      const gradedQuestions = gradingTask.questions.map((q: any) => ({
        id: q.id,
        status: q.studentAnswer === q.answer ? 'mastered' : 'pending'
      }));
      
      // 计算已掌握的题目数量
      const masteredCount = gradedQuestions.filter((q: any) => q.status === 'mastered').length;
      
      // 提交批改结果
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: gradingTask.id,
          results: gradedQuestions
        })
      });
      
      if (!res.ok) {
        throw new Error('提交批改结果失败');
      }
      
      const data = await res.json();
      
      // 显示批改结果
      if (data.success) {
        // 显示成功反馈
        const confirmed = window.confirm(`同步成功，已掌握 ${masteredCount} 道题\n\n是否返回错题本？`);
        
        // 重置批改状态
        setGradingTask(null);
        setScanResult('');
        
        // 返回错题本
        if (confirmed) {
          setActiveTab('wrong_questions');
        }
      }
    } catch (error: any) {
      console.error('提交批改结果失败:', error);
      setGradingError(error.message || '提交批改结果失败');
    } finally {
      setSubmittingGrade(false);
    }
  };

  const handleStudentAnswerChange = (questionId: string, answer: string) => {
    if (!gradingTask) return;
    
    setGradingTask({
      ...gradingTask,
      questions: gradingTask.questions.map((q: any) => {
        if (q.id === questionId) {
          return { ...q, studentAnswer: answer };
        }
        return q;
      })
    });
  };

  const toggleHistorySelection = (id: string) => {
    setSelectedHistoryIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handlePrint = async () => {
    if (selectedHistoryIds.length === 0) return;
    
    // Generate unique print task ID
    const taskId = `print-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    setPrintTaskId(taskId);
    
    // Generate QR code
    try {
      const qrCodeData = JSON.stringify({
        taskId: taskId,
        questions: selectedHistoryIds,
        student: selectedStudent,
        date: new Date().toISOString()
      });
      
      const qrUrl = await QRCode.toDataURL(qrCodeData, {
        width: 128,
        margin: 1
      });
      setQrcodeUrl(qrUrl);
    } catch (error) {
      console.error('生成二维码失败:', error);
    }
    
    // Increment practice counts in background
    selectedHistoryIds.forEach(id => {
      fetch(`/api/history/${id}/practice`, { method: 'POST' });
    });

    // Wait for QR code to generate
    setTimeout(() => {
      window.print();
      setIsPrintMode(false);
      setSelectedHistoryIds([]);
      // Refresh history to show updated counts
      setTimeout(fetchHistory, 1000);
    }, 500);
  };

  const filteredHistory = history.filter(item => {
    // Subject filter
    if (filterSubject !== '全部' && !item.subject.includes(filterSubject)) return false;

    // Status filter
    if (filterStatus !== '全部') {
      const status = item.status || 'pending';
      if (filterStatus === '待重练' && status !== 'pending') return false;
      if (filterStatus === '已掌握' && status !== 'mastered') return false;
    }
    
    // Date filter
    if (filterDate !== '全部') {
      const itemDate = new Date(item.time);
      const now = new Date();
      if (filterDate === '今天') {
        if (itemDate.toDateString() !== now.toDateString()) return false;
      } else if (filterDate === '本周') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        if (itemDate < weekAgo) return false;
      } else if (filterDate === '本月') {
        if (itemDate.getMonth() !== now.getMonth() || itemDate.getFullYear() !== now.getFullYear()) return false;
      }
    }

    // Practice filter
    if (filterPractice !== '全部') {
      const count = item.practice_count || 0;
      if (filterPractice === '从未重练' && count > 0) return false;
      if (filterPractice === '重练1次+' && count === 0) return false;
      if (filterPractice === '重练3次+' && count < 3) return false;
    }

    return true;
  });

  const handleSaveStudent = async () => {
    if (!studentFormData.name.trim()) return;
    setIsSavingStudent(true);
    setError(null);
    
    console.log("\n=== 💾 SAVING STUDENT ===");
    console.log("Mode:", editingStudent ? "EDIT" : "ADD");
    console.log("Student data:", studentFormData);
    
    try {
      const url = editingStudent ? `/api/students/${editingStudent.id}` : '/api/students';
      const method = editingStudent ? 'PUT' : 'POST';
      
      console.log("Request URL:", url);
      console.log("Request Method:", method);
      
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...studentFormData,
          name: studentFormData.name.trim()
        })
      });
      
      const data = await res.json();
      console.log("Response status:", res.status);
      console.log("Response data:", data);
      
      if (res.ok) {
        // 🔍 检查是否是 mock 模式（数据未持久化）
        if (data.warning) {
          console.warn("⚠️ Server warning:", data.warning);
          setError(data.warning);
          // 仍然更新本地UI，但提示用户
        }
        
        if (editingStudent) {
          console.log("✅ Student updated successfully");
          setStudents(prev => prev.map(s => s.id === editingStudent.id ? data.student : s));
          if (selectedStudent === editingStudent.name) setSelectedStudent(data.student.name);
        } else {
          console.log("✅ Student added successfully");
          
          // ✅ FIX: 直接使用后端返回的数据更新UI，确保立即显示
          setStudents(prev => [...prev, data.student]);
          console.log("📚 Added student to local list:", data.student.name);
          
          // 然后异步刷新完整列表（确保数据一致性）
          setTimeout(() => {
            console.log("🔄 Refreshing student list from server...");
            fetchStudents();
          }, 100);
          
          if (!selectedStudent) setSelectedStudent(data.student.name);
        }
        
        setIsAddingStudent(false);
        setEditingStudent(null);
        setStudentFormData({ name: '', grade: '一年级', semester: '上学期', parentName: '', contact: '', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=default' });
        
        console.log("=== ✅ SAVE STUDENT COMPLETE ===\n");
      } else {
        console.error("❌ Save failed:", data.error);
        setError(data.error || "保存失败");
      }
    } catch (err) {
      console.error("💥 Save student exception:", err);
      setError("网络错误，保存失败");
    } finally {
      setIsSavingStudent(false);
    }
  };

  // --- AI Analysis ---

  const analyzeQuestion = async (base64Data: string) => {
    setLoading(true);
    setError(null);
    
    try {
      // 1. 压缩图片以减少传输体积和 AI 处理时间
      // 大幅降低图片分辨率和质量，确保在 25 秒内完成识别
      const compressedBase64 = await compressImage(base64Data, 400, 0.3);
      
      const res = await fetch('/api/analyze-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: compressedBase64 })
      });
      
      // 检查响应类型
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Non-JSON response from server:", text);
        throw new Error("服务器响应异常 (非 JSON 格式)，请稍后重试。");
      }

      const data = await res.json();
      
      if (!res.ok) {
        // 构建更详细的错误信息
        let errorMessage = data.error || "智能识题失败";
        if (data.details?.message) {
          errorMessage = data.details.message;
        }
        if (data.details?.suggestions && Array.isArray(data.details.suggestions)) {
          errorMessage += '\n\n建议：\n' + data.details.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
        }
        if (data.suggestion) {
          errorMessage += '\n\n提示：' + data.suggestion;
        }
        throw new Error(errorMessage);
      }
      
      // 处理后端返回的数据格式
      let questionsData = [];
      if (Array.isArray(data)) {
        // 后端直接返回了题目数组
        questionsData = data;
      } else if (data.questions && Array.isArray(data.questions)) {
        // 后端返回了包含 questions 字段的对象
        questionsData = data.questions;
      } else {
        throw new Error("未能识别到题目，请尝试手动框选。");
      }
      
      if (questionsData.length === 0) {
        throw new Error("未能识别到题目，请尝试手动框选。");
      }

      // Ensure box coordinates are numbers and in 0-100 range
      const processedQuestions = questionsData.map((q: any, i: number) => {
        let box = q.box || {};
        
        // Handle case where box might be an array [ymin, xmin, ymax, xmax] or [x, y, w, h]
        // Qwen2-VL often returns [ymin, xmin, ymax, xmax] in 0-1000 scale
        if (Array.isArray(box)) {
          if (box.length === 4) {
            // Check if it's [ymin, xmin, ymax, xmax] (common for VL models)
            // Usually ymin < ymax and xmin < xmax
            const [v1, v2, v3, v4] = box;
            if (v3 > v1 && v4 > v2) {
              // Looks like [ymin, xmin, ymax, xmax]
              box = { x: v2, y: v1, width: v4 - v2, height: v3 - v1 };
            } else {
              // Fallback to [x, y, w, h]
              box = { x: v1, y: v2, width: v3, height: v4 };
            }
          }
        }

        const normalize = (val: any, isWidthOrX: boolean) => {
          const num = parseFloat(val);
          if (isNaN(num)) return 0;
          
          // Qwen2-VL often returns 0-1000 scale
          if (num > 100) return (num / 1000) * 100;
          
          // 0-1 scale
          if (num <= 1 && num > 0) return num * 100;
          
          // 0-100 scale
          return num;
        };

        const x = normalize(box.x ?? box.left ?? 0, true);
        const y = normalize(box.y ?? box.top ?? 0, false);
        const w = normalize(box.width ?? box.w ?? 0, true);
        const h = normalize(box.height ?? box.h ?? 0, false);

        return {
          id: `q-${i}-${Date.now()}`,
          number: q.number || `${i + 1}`,
          box: { x, y, width: w, height: h },
          text: q.text || "未识别到文字",
          stem: q.stem || "",
          options: q.options || [],
          hasImage: !!q.hasImage,
          selected: false,
          isEditing: false
        };
      });

      setQuestions(processedQuestions);
      if (data.subject) setSubject(data.subject);
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setError(err.message || "智能识题失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (files.length === 1) {
      // 单文件处理
      const file = files[0];
      const reader = new FileReader();
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        
        // 压缩图片以减少传输体积
        const compressedBase64 = await compressImage(result, 1200, 0.85);
        
        // 立即加入待确认列表，状态为 processing
        // 同时保存原始图片和压缩后的图片（AI识别使用的图片）
        const newItem = {
          id: `temp-${Date.now()}`,
          image: result,           // 原始图片（高质量）
          compressedImage: compressedBase64,  // 压缩图片（AI识别使用，用于裁剪）
          filename: file.name,
          status: 'processing' as const,
          questions: []
        };
        setBatchResults(prev => [...prev, newItem]);
        
        // 跳转到错题页面
        setActiveTab('wrong_questions');
        
        // 后台异步处理识别
        setTimeout(async () => {
          try {
            const res = await fetch('/api/analyze-question', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Image: compressedBase64 })
            });
            
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({ error: '未知错误' }));
              console.error('识别 API 错误:', errorData);
              // 构建更详细的错误信息
              let errorMessage = errorData.error || `识别失败 (${res.status})`;
              if (errorData.details?.message) {
                errorMessage = errorData.details.message;
              }
              if (errorData.details?.suggestions && Array.isArray(errorData.details.suggestions)) {
                errorMessage += '\n\n建议：\n' + errorData.details.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
              }
              if (errorData.suggestion) {
                errorMessage += '\n\n提示：' + errorData.suggestion;
              }
              throw new Error(errorMessage);
            }

            const data = await res.json();
            
            // 处理后端返回的数据格式
            let questionsData = [];
            if (Array.isArray(data)) {
              questionsData = data;
            } else if (data.questions && Array.isArray(data.questions)) {
              questionsData = data.questions;
            } else if (data.error) {
              throw new Error(data.error || '识别失败');
            } else {
              throw new Error('未能识别到题目，请尝试重新上传或更换图片');
            }
            
            // 检查是否识别到题目
            if (questionsData.length === 0) {
              throw new Error('未能识别到题目，请确保图片中包含清晰的题目内容');
            }
            
            // 自动化分流逻辑
            const subjectiveQuestions = [];
            const objectiveWrongQuestions = [];
            
            for (const q of questionsData) {
              if (q.type === 'objective') {
                // 客观题：自动比对答案
                if (q.grade === 'incorrect' || (q.correctAnswer && q.studentAnswer && q.correctAnswer !== q.studentAnswer)) {
                  // 做错的题：自动加入错题本
                  objectiveWrongQuestions.push(q);
                }
                // 做对的题：直接忽略
              } else {
                // 主观题：进入待确认列表
                subjectiveQuestions.push(q);
              }
            }
            
            // 自动加入客观错题到错题本
            if (objectiveWrongQuestions.length > 0) {
              const saveResults = [];
              for (const q of objectiveWrongQuestions) {
                try {
                  // 裁剪图片
                  const croppedImage = q.questionImage || '';

                  const res = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      student: selectedStudent,
                      subject: `${subject} | ${grade} | ${term}`,
                      text: q.text || '未识别到文字',
                      imageUrl: q.image || q.imageUrl || '',  // 原图
                      questionImage: croppedImage,  // 裁剪后的题目图片
                      originalImage: q.originalImage || q.image || q.imageUrl || '',  // 原图（用于小眼睛查看裁剪图块）
                      box: q.box,  // 裁剪框信息
                      time: new Date().toISOString(),
                      options: q.options || [],  // 选项列表
                      stem: q.stem || ''  // 题干
                    })
                  });
                  
                  if (!res.ok) {
                    throw new Error('保存失败');
                  }
                  
                  const data = await res.json();
                  saveResults.push({ ok: true, data });
                } catch (err) {
                  console.error('自动保存客观错题失败:', err);
                  saveResults.push({ ok: false, error: err.message });
                }
              }
              
              // 刷新错题列表
              const updatedHistory = await fetchHistory();
              
              // 自动触发AI生成答案和解析（后台静默执行）
              const newQuestionIds = saveResults.filter(r => r.ok && r.data.id).map(r => r.data.id);
              const newQuestions = updatedHistory.filter(item => {
                const isNew = newQuestionIds.includes(item.id);
                return isNew && !item.answer && !item.explanation;
              });
              
              // 更新本地状态，显示 "AI生成中..."
              setHistory(prev => prev.map(item => {
                if (newQuestionIds.includes(item.id)) {
                  return {
                    ...item,
                    answer: 'AI生成中...',
                    explanation: 'AI生成中...'
                  };
                }
                return item;
              }));
              
              newQuestions.forEach(question => {
                if (question.text) {
                  generateAnswerAndExplanation(question.id, question.text);
                }
              });
            }
            
            // 更新待确认列表（只显示主观题）
            setBatchResults(prev => prev.map(item => {
              if (item.id === newItem.id) {
                return {
                  ...item,
                  status: 'success' as const,
                  questions: subjectiveQuestions
                };
              }
              return item;
            }));
          } catch (err: any) {
            // 更新为失败状态
            setBatchResults(prev => prev.map(item => {
              if (item.id === newItem.id) {
                return {
                  ...item,
                  status: 'failed' as const,
                  error: err.message
                };
              }
              return item;
            }));
          }
        }, 100);
      };
      reader.readAsDataURL(file);
    } else {
      // 多文件处理
      handleBatchUpload(files);
    }
  };

  const handleBatchUpload = async (files: FileList) => {
    if (files.length > 20) {
      setError("最多只能上传20张图片");
      return;
    }

    setBatchResults([]);
    setError(null);

    // 瞬间将所有图片加入待确认列表，状态为 processing
    const newItems = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onload = async (event) => {
        const result = event.target?.result as string;
        
        // 压缩图片（AI识别使用，用于裁剪确保坐标匹配）
        const compressedBase64 = await compressImage(result, 1200, 0.85);
        
        const newItem = {
          id: `temp-${Date.now()}-${i}`,
          image: result,           // 原始图片（高质量）
          compressedImage: compressedBase64,  // 压缩图片（AI识别使用，用于裁剪）
          filename: file.name,
          status: 'processing' as const,
          questions: []
        };
        
        // 添加到待确认列表
        setBatchResults(prev => [...prev, newItem]);
        
        // 后台异步处理识别
        setTimeout(async () => {
          try {
            const res = await fetch('/api/analyze-question', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Image: compressedBase64 })
            });
            
            if (!res.ok) {
              const errorData = await res.json().catch(() => ({ error: '未知错误' }));
              console.error('识别 API 错误:', errorData);
              // 构建更详细的错误信息
              let errorMessage = errorData.error || `识别失败 (${res.status})`;
              if (errorData.details?.message) {
                errorMessage = errorData.details.message;
              }
              if (errorData.details?.suggestions && Array.isArray(errorData.details.suggestions)) {
                errorMessage += '\n\n建议：\n' + errorData.details.suggestions.map((s: string, i: number) => `${i + 1}. ${s}`).join('\n');
              }
              if (errorData.suggestion) {
                errorMessage += '\n\n提示：' + errorData.suggestion;
              }
              throw new Error(errorMessage);
            }

            const data = await res.json();

            // 处理后端返回的数据格式
            let questionsData = [];
            if (Array.isArray(data)) {
              questionsData = data;
            } else if (data.questions && Array.isArray(data.questions)) {
              questionsData = data.questions;
            } else {
              throw new Error('未能识别到题目');
            }
            
            // 自动化分流逻辑
            const subjectiveQuestions = [];
            const objectiveWrongQuestions = [];
            
            for (const q of questionsData) {
              if (q.type === 'objective') {
                // 客观题：自动比对答案
                if (q.grade === 'incorrect' || (q.correctAnswer && q.studentAnswer && q.correctAnswer !== q.studentAnswer)) {
                  // 做错的题：自动加入错题本
                  objectiveWrongQuestions.push(q);
                }
                // 做对的题：直接忽略
              } else {
                // 主观题：进入待确认列表
                subjectiveQuestions.push(q);
              }
            }
            
            // 自动加入客观错题到错题本
            if (objectiveWrongQuestions.length > 0) {
              const saveResults = [];
              for (const q of objectiveWrongQuestions) {
                try {
                  // 裁剪图片
                  const croppedImage = q.questionImage || '';

                  const res = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      student: selectedStudent,
                      subject: `${subject} | ${grade} | ${term}`,
                      text: q.text || '未识别到文字',
                      imageUrl: q.image || q.imageUrl || '',  // 原图
                      questionImage: croppedImage,  // 裁剪后的题目图片
                      originalImage: q.originalImage || q.image || q.imageUrl || '',  // 原图（用于小眼睛查看裁剪图块）
                      box: q.box,  // 裁剪框信息
                      time: new Date().toISOString(),
                      options: q.options || [],  // 选项列表
                      stem: q.stem || ''  // 题干
                    })
                  });
                  
                  if (!res.ok) {
                    throw new Error('保存失败');
                  }
                  
                  const data = await res.json();
                  saveResults.push({ ok: true, data });
                } catch (err) {
                  console.error('自动保存客观错题失败:', err);
                  saveResults.push({ ok: false, error: err.message });
                }
              }
              
              // 刷新错题列表
              const updatedHistory = await fetchHistory();
              
              // 自动触发AI生成答案和解析（后台静默执行）
              const newQuestionIds = saveResults.filter(r => r.ok && r.data.id).map(r => r.data.id);
              const newQuestions = updatedHistory.filter(item => {
                const isNew = newQuestionIds.includes(item.id);
                return isNew && !item.answer && !item.explanation;
              });
              
              // 更新本地状态，显示 "AI生成中..."
              setHistory(prev => prev.map(item => {
                if (newQuestionIds.includes(item.id)) {
                  return {
                    ...item,
                    answer: 'AI生成中...',
                    explanation: 'AI生成中...'
                  };
                }
                return item;
              }));
              
              newQuestions.forEach(question => {
                if (question.text) {
                  generateAnswerAndExplanation(question.id, question.text);
                }
              });
            }
            
            // 更新待确认列表（只显示主观题）
            setBatchResults(prev => prev.map(item => {
              if (item.id === newItem.id) {
                return {
                  ...item,
                  status: 'success' as const,
                  questions: subjectiveQuestions
                };
              }
              return item;
            }));
          } catch (err: any) {
            // 更新为失败状态
            setBatchResults(prev => prev.map(item => {
              if (item.id === newItem.id) {
                return {
                  ...item,
                  status: 'failed' as const,
                  error: err.message
                };
              }
              return item;
            }));
          }
        }, 100);
      };
      
      reader.readAsDataURL(file);
    }
    
    // 跳转到错题页面
    setActiveTab('wrong_questions');
  };

  // --- Image Cropping ---

  const cropImage = (base64: string, box: { x: number, y: number, width: number, height: number }): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Convert percentages to pixels
        const x = (box.x / 100) * img.width;
        const y = (box.y / 100) * img.height;
        const w = (box.width / 100) * img.width;
        const h = (box.height / 100) * img.height;

        // Add a small padding (5%)
        const padding = Math.min(w, h) * 0.05;
        const px = Math.max(0, x - padding);
        const py = Math.max(0, y - padding);
        const pw = Math.min(img.width - px, w + padding * 2);
        const ph = Math.min(img.height - py, h + padding * 2);

        canvas.width = pw;
        canvas.height = ph;
        ctx.drawImage(img, px, py, pw, ph, 0, 0, pw, ph);
        
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = (err) => reject(new Error('Failed to load image'));
      img.src = base64;
    });
  };

  const compressImage = (base64: string, maxWidth: number = 800, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Failed to get canvas context"));
          return;
        }

        // Calculate new dimensions
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = base64;
    });
  };

  const handleSubmit = async () => {
    const selectedQuestions = questions.filter(q => q.selected);
    if (selectedQuestions.length === 0 || !selectedStudent || !image) return;
    
    setIsSubmitting(true);
    setError(null);
    try {
      const results = await Promise.all(
        selectedQuestions.map(async (q) => {
          // 1. Crop the image for this specific question
          const croppedImage = await cropImage(image, q.box);
          
          // 2. Perform OCR on the cropped image to ensure text matches the image
          // This fixes the mismatch issue reported by the user
          let finalOcrText = q.text;
          try {
            const ocrRes = await fetch('/api/ocr-question', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ base64Image: croppedImage })
            });
            if (ocrRes.ok) {
              const ocrData = await ocrRes.json();
              if (ocrData.text) {
                finalOcrText = ocrData.text;
              }
            }
          } catch (ocrErr) {
            console.warn("OCR failed for question, falling back to initial text", ocrErr);
          }

          // 3. Submit to wrong questions notebook
          // image: 原图（完整试卷）
          // croppedImage: 裁剪后的题目图片
          const res = await fetch('/api/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              student: selectedStudent,
              subject: `${subject} | ${grade} | ${term}`,
              text: finalOcrText,
              imageUrl: image,  // 原图
              questionImage: croppedImage,  // 裁剪后的题目图片
              originalImage: image,  // 原图（用于小眼睛查看裁剪图块）
              box: q.box,  // 裁剪框信息
              time: new Date().toISOString(),
              options: q.options || [],  // 选项列表
              stem: q.stem || ''  // 题干
            })
          });
          const data = await res.json();
          return { ok: res.ok, data };
        })
      );
      
      const failed = results.find(r => !r.ok);
      if (failed) {
        setError(`保存失败: ${failed.data.error || "未知错误"}`);
        return;
      }

      const duplicates = results.filter(r => r.data.isDuplicate);
      if (duplicates.length === selectedQuestions.length) {
        setError("所选题目已在错题本中，无需重复保存。");
        return;
      }
      
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });

      if (duplicates.length > 0) {
        setError(`成功保存 ${selectedQuestions.length - duplicates.length} 题，跳过 ${duplicates.length} 题重复项。`);
      }
      
      // 先标记新保存的题目为生成中状态
      const newQuestionIds = results.filter(r => r.data.id && r.data.id !== 'duplicate').map(r => r.data.id);
      
      // 刷新错题列表，获取新保存的题目 ID
      const updatedHistory = await fetchHistory();
      
      // 自动触发AI生成答案和解析（后台静默执行）
      const newQuestions = updatedHistory.filter(item => {
        const isNew = results.some(r => r.data.id === item.id);
        return isNew && !item.answer && !item.explanation;
      });
      
      // 更新本地状态，显示 "AI生成中..."
      setHistory(prev => prev.map(item => {
        if (newQuestionIds.includes(item.id)) {
          return {
            ...item,
            answer: 'AI生成中...',
            explanation: 'AI生成中...'
          };
        }
        return item;
      }));
      
      newQuestions.forEach(question => {
        if (question.text) {
          generateAnswerAndExplanation(question.id, question.text);
        }
      });
      
      setImage(null);
      setQuestions([]);
      const statsRes = await fetch(`/api/stats?student=${encodeURIComponent(selectedStudent)}`);
      const statsData = await statsRes.json();
      setWeeklyCount(statsData.count);
    } catch (err: any) {
      console.error("Submit failed", err);
      setError(`提交异常: ${err.message || "网络连接失败"}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteStudent = (id: string) => {
    console.log("\n=== 🗑️ DELETE STUDENT REQUESTED ===");
    console.log("Student ID:", id);
    
    // 查找要删除的学生信息
    const studentToDelete = students.find(s => s.id === id);
    console.log("Student to delete:", studentToDelete?.name);
    
    if (!studentToDelete) {
      console.error("❌ Student not found");
      return;
    }
    
    // ✅ FIX: 使用与删除错题一致的UI
    setDeleteStudentConfirm({
      id: studentToDelete.id,
      name: studentToDelete.name,
      grade: studentToDelete.grade
    });
  };
  
  const confirmDeleteStudent = async () => {
    if (!deleteStudentConfirm) return;
    
    const { id, name, grade } = deleteStudentConfirm;
    console.log("✅ User confirmed deletion");
    console.log("Sending DELETE request for:", name);
    
    try {
      const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
      const data = await res.json();
      
      console.log("Response status:", res.status);
      console.log("Response data:", data);
      
      if (res.ok) {
        console.log("✅ Student deleted successfully from server");
        
        // 更新本地状态
        setStudents(prev => prev.filter(s => s.id !== id));
        
        // 如果删除的是当前选中的学生，切换到第一个剩余学生
        if (selectedStudent === name) {
          const remaining = students.filter(s => s.id !== id);
          setSelectedStudent(remaining.length > 0 ? remaining[0].name : '');
          console.log("Switched selected student to:", remaining.length > 0 ? remaining[0].name : '(none)');
        }
        
        console.log("=== ✅ DELETE COMPLETE ===\n");
      } else {
        console.error("❌ Delete failed:", data.error);
        setError(`删除失败：${data.error || "服务器错误"}`);
      }
    } catch (err) {
      console.error("💥 Delete student exception:", err);
      setError("网络错误，删除失败");
    } finally {
      setDeleteStudentConfirm(null);
    }
  };

  const updateQuestionStatus = async (id: string, status: 'pending' | 'mastered') => {
    try {
      const res = await fetch(`/api/history/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        setHistory(prev => prev.map(h => h.id === id ? { ...h, status } : h));
      }
    } catch (err) {
      console.error("Update status failed", err);
    }
  };

  const toggleSelect = (id: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, selected: !q.selected } : q));
    const q = questions.find(item => item.id === id);
    if (q) {
      setSelectedQuestionId(id);
      setEditingQuestion(q);
    }
  };

  const handleBoxChange = (id: string, newBox: Box) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, box: newBox } : q));
  };

  const handleUpdateQuestionText = (id: string, newText: string) => {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, text: newText, isEditing: false } : q));
    if (editingQuestion?.id === id) {
      setEditingQuestion(prev => prev ? { ...prev, text: newText } : null);
    }
  };

  const handleReAnalyze = async (id: string) => {
    const q = questions.find(item => item.id === id);
    if (!q || !image) return;
    
    setLoading(true);
    try {
      const croppedBase64 = await cropImage(image, q.box);
      const res = await fetch('/api/analyze-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Image: croppedBase64 })
      });
      const data = await res.json();
      if (res.ok && data.questions && data.questions.length > 0) {
        const newQ = data.questions[0];
        setQuestions(prev => prev.map(item => item.id === id ? {
          ...item,
          text: newQ.text || item.text,
          stem: newQ.stem || item.stem,
          options: newQ.options || item.options,
          hasImage: !!newQ.hasImage
        } : item));
      }
    } catch (err) {
      console.error("Re-analyze failed", err);
      setError("局部重新识别失败");
    } finally {
      setLoading(false);
    }
  };

  const selectedCount = questions.filter(q => q.selected).length;

  return (
    <div className="flex flex-col h-screen bg-[#FDFCFE] font-sans text-[#1D1D1F] max-w-[430px] mx-auto shadow-2xl overflow-hidden relative border-x border-blue-50">
      {/* Main Content */}
      <main className="flex-1 relative overflow-hidden bg-[#F5F5F7] print:hidden">
        {activeTab === 'home' ? (
          !image ? (
            <div className="p-6 space-y-6 h-full flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <div>
                    <h1 className="text-lg font-bold tracking-tight text-gray-900">敏学错题助手</h1>
                    <p className="text-[10px] text-blue-400 uppercase tracking-widest font-bold">AI Study Assistant</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-full border border-blue-100">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-blue-700">{weeklyCount}</span>
                </div>
              </div>

              {/* Student Selection */}
              <section className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <label className="flex items-center gap-2 text-sm font-bold text-gray-700">
                    <User className="w-4 h-4 text-blue-500" />
                    归属学生
                  </label>
                  <button 
                    onClick={() => setIsAddingStudent(true)}
                    className="flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    <UserPlus className="w-3 h-3" /> 新增学生
                  </button>
                </div>
                <button 
                  onClick={() => setIsStudentPickerOpen(true)}
                  className="w-full h-14 bg-white border border-blue-100 rounded-2xl px-5 flex items-center justify-between group active:scale-[0.98] transition-all shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center text-blue-600">
                      <User className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">当前选择</p>
                      <p className="text-sm font-black text-gray-900">{selectedStudent || '请选择学生'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">切换</span>
                    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-400 transition-colors" />
                  </div>
                </button>
              </section>

              <div className="flex-1 flex items-center justify-center">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full aspect-square bg-white border-2 border-dashed border-blue-100 rounded-[3rem] flex flex-col items-center justify-center gap-4 hover:border-blue-300 hover:bg-blue-50/50 transition-all group active:scale-95 shadow-sm"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-blue-700 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-200 group-hover:scale-110 transition-transform">
                    <Camera className="w-10 h-10" />
                  </div>
                  <div className="text-center">
                    <span className="block text-lg font-black text-gray-900">立即拍照</span>
                    <span className="text-xs text-blue-400 font-medium tracking-tight">Qwen-VL 智能识别题目</span>
                  </div>
                </button>
              </div>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleCapture} 
                className="hidden" 
                accept="image/*" 
                multiple
                capture="environment"
              />
            </div>
          ) : (
            <div className="w-full h-screen flex flex-col bg-white fixed inset-0 overflow-hidden">
              {/* Top Bar */}
              <div className="px-4 py-3 bg-white flex items-center justify-between border-b border-gray-50 z-20">
                <button onClick={() => setImage(null)} className="p-2 text-gray-400 hover:text-blue-600 transition-colors">
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <div className="text-center">
                  <span className="text-sm font-bold text-gray-900">试卷预览 (原图)</span>
                </div>
                <button 
                  onClick={() => {
                    const allSelected = questions.every(q => q.selected);
                    setQuestions(prev => prev.map(q => ({ ...q, selected: !allSelected })));
                  }}
                  className="px-3 py-1 bg-blue-50 text-blue-600 text-[10px] font-black rounded-lg border border-blue-100 uppercase tracking-widest active:scale-95 transition-all"
                >
                  {questions.every(q => q.selected) ? "取消全选" : "全选"}
                </button>
              </div>

              {/* Canvas Area - Scrollable */}
              <div className="relative overflow-y-auto bg-gray-50 flex justify-center" style={{ height: 'calc(100vh - 160px)' }}>
                <div className="shadow-2xl shadow-black/5 my-4 bg-white rounded-xl overflow-hidden">
                  {questions.length > 0 && selectedCount === 0 && (
                    <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
                      <div className="bg-blue-600/90 backdrop-blur-sm text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl animate-bounce">
                        点击题号选择要录入的题目
                      </div>
                    </div>
                  )}
                  <Stage
                  width={399.5} // 430 * 0.95
                  height={konvaImage ? 399.5 * (konvaImage.height / konvaImage.width) : window.innerHeight * 0.8}
                  onClick={() => {
                    setSelectedQuestionId(null);
                    setEditingQuestion(null);
                  }}
                >
                  <Layer>
                    {konvaImage && (
                      <KonvaImage 
                        image={konvaImage} 
                        width={399.5} // 430 * 0.95
                        height={399.5 * (konvaImage.height / konvaImage.width)}
                      />
                    )}
                    {questions.map((q) => (
                      <QuestionOverlay 
                        key={q.id}
                        question={q}
                        isSelected={selectedQuestionId === q.id}
                        canvasWidth={399.5} // 430 * 0.95
                        canvasHeight={konvaImage ? 399.5 * (konvaImage.height / konvaImage.width) : window.innerHeight * 0.8}
                        onSelect={() => {
                          setSelectedQuestionId(q.id);
                          setEditingQuestion(q);
                        }}
                        onToggle={() => toggleSelect(q.id)}
                        onBoxChange={(newBox) => handleBoxChange(q.id, newBox)}
                        onReAnalyze={() => handleReAnalyze(q.id)}
                      />
                    ))}
                  </Layer>
                </Stage>
              </div>
            </div>

              {/* Bottom Controls Area */}
              <div className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto h-24 bg-white border-t border-gray-100 flex items-center justify-between px-4 z-30">
                {/* Left Icon Button */}
                <button 
                  onClick={() => {
                    const newId = `q-manual-${Date.now()}`;
                    setQuestions(prev => [...prev, {
                      id: newId,
                      number: "新",
                      box: { x: 10, y: 10, width: 80, height: 10 },
                      text: "手动添加的题目，请调整位置并重新识别",
                      stem: "",
                      options: [],
                      hasImage: false,
                      selected: true,
                      isEditing: false
                    }]);
                    setSelectedQuestionId(newId);
                  }}
                  className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center text-gray-600 hover:bg-gray-100 transition-all active:scale-95 shadow-sm"
                >
                  <Maximize className="w-6 h-6" />
                </button>
                
                {/* Main Button */}
                <button 
                  onClick={handleSubmit}
                  disabled={selectedCount === 0 || isSubmitting}
                  className={cn(
                    "w-[75%] h-12 text-white font-bold rounded-full shadow-xl transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:shadow-none disabled:scale-100",
                    selectedCount > 0 ? "bg-blue-600 shadow-blue-200" : "bg-gray-300"
                  )}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span className="text-base">正在识别并保存...</span>
                    </div>
                  ) : (
                    <>
                      <Check className={cn("w-5 h-5 transition-transform", selectedCount > 0 ? "scale-100" : "scale-0")} />
                      <span className="text-base">保存到错题本 ({selectedCount})</span>
                    </>
                  )}
                </button>
              </div>


              {/* Loading Overlay */}
              {loading && (
                <div className="absolute inset-0 bg-white/60 backdrop-blur-md flex items-center justify-center z-30">
                  <div className="text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <Loader2 className="w-20 h-20 animate-spin text-blue-600 opacity-20" />
                      <Sparkles className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-lg font-black text-gray-900">Qwen 正在思考...</p>
                    <p className="text-xs text-blue-400 font-bold mt-2">正在智能分析试卷结构</p>
                  </div>
                </div>
              )}

              {/* Batch Upload Overlay */}
              {batchUploading && (
                <div className="absolute inset-0 bg-white/90 backdrop-blur-md flex items-center justify-center z-40">
                  <div className="text-center p-8 bg-white rounded-3xl shadow-2xl max-w-md">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                      <Loader2 className="w-20 h-20 animate-spin text-blue-600 opacity-20" />
                      <Sparkles className="w-8 h-8 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    <p className="text-lg font-black text-gray-900 mb-4">正在批量识别...</p>
                    <div className="w-full bg-gray-100 rounded-full h-4 mb-2">
                      <div 
                        className="bg-blue-600 h-4 rounded-full transition-all duration-300 ease-out" 
                        style={{ width: `${batchProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-blue-400 font-bold">{batchProgress}%</p>
                    <p className="text-xs text-gray-400 mt-4">请耐心等待，识别过程可能需要几分钟</p>
                  </div>
                </div>
              )}

              {/* Batch Results Modal */}
              {isBatchComplete && batchResults.length > 0 && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-40">
                  <div className="bg-white rounded-3xl shadow-2xl max-w-[430px] w-full max-h-[80vh] overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                      <h3 className="text-lg font-black text-gray-900">待确认题目</h3>
                      <button 
                        onClick={() => {
                          setIsBatchComplete(false);
                          setBatchResults([]);
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                      >
                        <X className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                      {batchResults.map((result, index) => (
                        <div key={index} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                          <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                            <span className="text-sm font-bold text-gray-700">{result.filename}</span>
                            {result.status === 'processing' && (
                              <span className="text-xs text-yellow-500 font-bold">识别中...</span>
                            )}
                            {result.status === 'success' && (
                              <span className="text-xs text-green-500 font-bold">识别成功</span>
                            )}
                            {result.status === 'failed' && (
                              <span className="text-xs text-red-500 font-bold">识别失败</span>
                            )}
                          </div>
                          <div className="p-4">
                            {result.status === 'processing' ? (
                              <div className="text-center py-4">
                                <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">正在识别题目...</p>
                              </div>
                            ) : result.status === 'success' ? (
                              result.questions.length > 0 ? (
                                <div className="space-y-3">
                                  {result.questions.map((q: any, qIndex: number) => (
                                    <div key={qIndex} className="border border-blue-100 rounded-xl p-3 bg-blue-50/50">
                                      <div className="flex items-start justify-between mb-2">
                                        <span className="text-xs font-bold text-blue-700">题目 {q.number || qIndex + 1}</span>
                                        <input 
                                          type="checkbox" 
                                          className="mt-1"
                                          checked={q.selected || false}
                                          onChange={(e) => {
                                            const updatedResults = [...batchResults];
                                            updatedResults[index].questions[qIndex].selected = e.target.checked;
                                            setBatchResults(updatedResults);
                                          }}
                                        />
                                      </div>
                                      {/* 题干 */}
                                      <p className="text-sm text-gray-700 line-clamp-2">{q.stem || q.text?.split(/(?=[A-D][\.．])/)[0] || q.text || '未识别到文字'}</p>
                                      {/* 选项 */}
                                      {q.options && q.options.length > 0 && (
                                        <div className="grid grid-cols-2 gap-1 mt-1">
                                          {q.options.map((opt: string, i: number) => (
                                            <div key={i} className="text-xs text-gray-500 truncate">
                                              {opt.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-center py-4">
                                  <p className="text-sm text-gray-500">未能识别到题目</p>
                                </div>
                              )
                            ) : result.status === 'failed' ? (
                              <div className="text-center py-4">
                                <p className="text-sm text-red-500 whitespace-pre-line">{result.error || '识别失败'}</p>
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <p className="text-sm text-gray-500">未知状态</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
                      <button 
                        onClick={() => {
                          setIsBatchComplete(false);
                          setBatchResults([]);
                        }}
                        className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        取消
                      </button>
                      <button 
                        onClick={async () => {
                          // 收集所有选中的题目
                          const selectedQuestions = batchResults.flatMap(result => 
                            result.questions.filter((q: any) => q.selected)
                          );
                          
                          if (selectedQuestions.length === 0) {
                            setError('请至少选择一道题目');
                            return;
                          }
                          
                          setIsSubmitting(true);
                          try {
                            // 批量入库
                            const results = await Promise.all(
                              selectedQuestions.map(async (q: any) => {
                                // 这里需要根据实际情况获取图片
                                const imageUrl = q.image || batchResults.find(r => r.questions.includes(q))?.image;
                                if (!imageUrl) return { ok: false, data: { error: '缺少图片' } };

                                // 裁剪图片
                                const croppedImage = await cropImage(imageUrl, q.box);

                                // 提交到错题本
                                const res = await fetch('/api/submit', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    student: selectedStudent,
                                    subject: `${subject} | ${grade} | ${term}`,
                                    text: q.text || '未识别到文字',
                                    imageUrl: imageUrl,  // 原图
                                    questionImage: croppedImage,  // 裁剪后的题目图片
                                    originalImage: imageUrl,  // 原图（用于小眼睛查看裁剪图块）
                                    box: q.box,  // 裁剪框信息
                                    time: new Date().toISOString(),
                                    options: q.options || [],  // 选项列表
                                    stem: q.stem || ''  // 题干
                                  })
                                });
                                const data = await res.json();
                                return { ok: res.ok, data };
                              })
                            );
                            
                            const failed = results.find(r => !r.ok);
                            if (failed) {
                              setError(`保存失败: ${failed.data.error || "未知错误"}`);
                              return;
                            }
                            
                            const duplicates = results.filter(r => r.data.isDuplicate);
                            if (duplicates.length === selectedQuestions.length) {
                              setError("所选题目已在错题本中，无需重复保存。");
                              return;
                            }
                            
                            confetti({
                              particleCount: 100,
                              spread: 70,
                              origin: { y: 0.6 }
                            });
                            
                            if (duplicates.length > 0) {
                              setError(`成功保存 ${selectedQuestions.length - duplicates.length} 题，跳过 ${duplicates.length} 题重复项。`);
                            } else {
                              setError(`成功保存 ${selectedQuestions.length} 题到错题本。`);
                            }
                            
                            // 先标记新保存的题目为生成中状态
                            const newQuestionIds = results.filter(r => r.data.id && r.data.id !== 'duplicate').map(r => r.data.id);
                            
                            // 刷新错题列表，获取新保存的题目 ID
                            const updatedHistory = await fetchHistory();
                            
                            // 自动触发AI生成答案和解析（后台静默执行）
                            const newQuestions = updatedHistory.filter(item => {
                              const isNew = results.some(r => r.data.id === item.id);
                              return isNew && !item.answer && !item.explanation;
                            });
                            
                            // 更新本地状态，显示 "AI生成中..."
                            setHistory(prev => prev.map(item => {
                              if (newQuestionIds.includes(item.id)) {
                                return {
                                  ...item,
                                  answer: 'AI生成中...',
                                  explanation: 'AI生成中...'
                                };
                              }
                              return item;
                            }));
                            
                            newQuestions.forEach(question => {
                              if (question.text) {
                                generateAnswerAndExplanation(question.id, question.text);
                              }
                            });
                            
                            // 清空批量结果
                            setIsBatchComplete(false);
                            setBatchResults([]);
                            
                            // 更新统计
                            const statsRes = await fetch(`/api/stats?student=${encodeURIComponent(selectedStudent)}`);
                            const statsData = await statsRes.json();
                            setWeeklyCount(statsData.count);
                          } catch (err: any) {
                            console.error('批量入库失败:', err);
                            setError(`提交异常: ${err.message || "网络连接失败"}`);
                          } finally {
                            setIsSubmitting(false);
                          }
                        }}
                        className="px-6 py-2 bg-blue-600 text-white font-bold rounded-lg shadow-lg shadow-blue-200 hover:bg-blue-700 transition-colors"
                      >
                        加入错题本 ({batchResults.flatMap(r => r.questions.filter((q: any) => q.selected)).length})
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        ) : activeTab === 'wrong_questions' ? (
          <div className="h-full flex flex-col bg-[#FDFCFE]">
            {/* Header Section */}
            <div className="px-6 py-4 bg-white/80 backdrop-blur-xl border-b border-blue-50/50 sticky top-0 z-30 print:hidden">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black text-gray-900 tracking-tight">题库</h2>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">学生：{selectedStudent || '未选择'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {isPrintMode ? (
                    <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100 shadow-sm">
                      <button 
                        onClick={() => {
                          if (selectedHistoryIds.length === filteredHistory.length) {
                            setSelectedHistoryIds([]);
                          } else {
                            setSelectedHistoryIds(filteredHistory.map(h => h.id));
                          }
                        }}
                        className="text-[10px] font-black text-blue-600 uppercase tracking-widest border-r border-blue-200 pr-3 mr-1"
                      >
                        {selectedHistoryIds.length === filteredHistory.length ? "取消全选" : "全选"}
                      </button>
                      <button 
                        onClick={handlePrint}
                        disabled={selectedHistoryIds.length === 0}
                        className="flex items-center gap-2 text-blue-700 text-xs font-black disabled:opacity-30"
                      >
                        <Printer className="w-4 h-4" />
                        确认打印 ({selectedHistoryIds.length})
                      </button>
                      <button 
                        onClick={() => {
                          setIsPrintMode(false);
                          setSelectedHistoryIds([]);
                        }}
                        className="ml-2 p-1 hover:bg-blue-100 rounded-full transition-colors"
                      >
                        <X className="w-4 h-4 text-blue-400" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <button 
                        onClick={() => setIsPrintMode(true)}
                        className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center hover:bg-blue-100 transition-all active:scale-95 shadow-sm border border-blue-100"
                        title="打印模式"
                      >
                        <Printer className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={fetchHistory}
                        className="w-10 h-10 bg-white text-gray-400 rounded-2xl flex items-center justify-center hover:text-blue-600 hover:bg-blue-50 transition-all active:scale-95 shadow-sm border border-gray-100"
                        title="同步"
                      >
                        <RefreshCw className={cn("w-5 h-5", loadingHistory && "animate-spin")} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Modern Filter Bar */}
              {!isPrintMode && (
                <div className="mt-4 space-y-3">
                  <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar -mx-2 px-2">
                    {['全部', '数学', '语文', '英语', '物理', '化学'].map(s => (
                      <button
                        key={s}
                        onClick={() => setFilterSubject(s)}
                        className={cn(
                          "px-5 py-2 rounded-xl text-[11px] font-black whitespace-nowrap transition-all border shadow-sm",
                          filterSubject === s 
                            ? "bg-blue-600 text-white border-blue-600 shadow-blue-100" 
                            : "bg-white text-gray-400 border-gray-100 hover:border-blue-200 hover:text-blue-400"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
              <button
                onClick={() => setIsBatchComplete(false)}
                className={cn(
                  "flex-1 py-2 text-sm font-bold transition-all",
                  !isBatchComplete
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                )}
              >
                错题列表
              </button>
              <button
                onClick={() => setIsBatchComplete(true)}
                className={cn(
                  "flex-1 py-2 text-sm font-bold transition-all",
                  isBatchComplete
                    ? "text-blue-600 border-b-2 border-blue-600"
                    : "text-gray-500"
                )}
              >
                待确认列表
              </button>
            </div>

            {/* Content Section */}
            {!isBatchComplete ? (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center h-64">
                  <div className="relative w-16 h-16 mb-4">
                    <Loader2 className="w-16 h-16 animate-spin text-blue-600 opacity-20" />
                    <BookOpen className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">正在加载题库...</span>
                </div>
              ) : error && activeTab === 'wrong_questions' ? (
                <div className="flex flex-col items-center justify-center h-80 text-center px-8 bg-red-50/50 rounded-[3rem] border border-red-100">
                  <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                  <p className="text-sm font-bold text-gray-700 mb-6 leading-relaxed">{error}</p>
                  <button 
                    onClick={fetchHistory}
                    className="px-8 py-3 bg-red-500 text-white text-xs font-black rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all uppercase tracking-widest"
                  >
                    重新加载
                  </button>
                </div>
              ) : history.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-80 text-center">
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100">
                    <History className="w-10 h-10 text-blue-200" />
                  </div>
                  <h3 className="text-lg font-black text-gray-900 mb-2">暂无错题记录</h3>
                  <p className="text-xs font-medium text-gray-400 max-w-[200px] leading-relaxed">
                    还没有录入任何错题，点击首页的相机按钮开始录入吧！
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredHistory.map((item) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      key={item.id} 
                      onClick={() => {
                        if (isPrintMode) {
                          toggleHistorySelection(item.id);
                        } else {
                          setExpandedCardId(expandedCardId === item.id ? null : item.id);
                        }
                      }}
                      className={cn(
                        "bg-white rounded-[2rem] p-4 border transition-all relative group",
                        isPrintMode ? "cursor-pointer" : "cursor-pointer",
                        selectedHistoryIds.includes(item.id) 
                          ? "border-blue-500 shadow-2xl shadow-blue-100 ring-4 ring-blue-50" 
                          : "border-gray-100 shadow-sm hover:shadow-xl hover:shadow-blue-50/50 hover:border-blue-100"
                      )}
                    >
                      {/* Selection Indicator */}
                      {isPrintMode && (
                        <div className={cn(
                          "absolute -left-3 -top-3 w-8 h-8 rounded-2xl border-2 flex items-center justify-center transition-all z-10 shadow-lg",
                          selectedHistoryIds.includes(item.id) 
                            ? "bg-blue-600 border-blue-600 text-white scale-110" 
                            : "bg-white border-gray-200 text-transparent"
                        )}>
                          <Check className="w-4 h-4" />
                        </div>
                      )}

                      <div className="flex flex-col gap-3">
                        {/* Card Header */}
                        <div className="flex items-start justify-between">
                          <div className="flex flex-col gap-2">
                            <div className="flex flex-wrap gap-2">
                              <span className="px-3 py-1 text-[10px] font-black rounded-lg uppercase tracking-wider bg-blue-600 text-white shadow-sm">
                                {item.subject.split(' | ')[0]}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                // 显示题目裁剪块，如果没有则显示原图
                                const imageToShow = item.questionImage || item.imageUrl || '';
                                if (imageToShow) {
                                  setPreviewImage(imageToShow);
                                }
                              }}
                              className="w-8 h-8 bg-blue-50 text-blue-300 rounded-xl flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95 border border-blue-100"
                              title="查看题目裁剪块"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(item.id);
                              }}
                              className="w-8 h-8 bg-red-50 text-red-300 rounded-xl flex items-center justify-center hover:bg-red-100 hover:text-red-600 transition-all active:scale-95 border border-red-100"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Question Content */}
                        <div className="space-y-3">
                          {/* 顶部：题目文字和编辑按钮 */}
                          <div className="flex items-start justify-between">
                            <div className="flex-1 text-sm text-gray-800 leading-relaxed font-medium pr-2">
                              {/* 题干 - 可折叠 */}
                              <div className={cn(
                                "whitespace-pre-wrap",
                                !expandedCardId || expandedCardId !== item.id ? "line-clamp-3" : ""
                              )}>
                                {item.question || item.text.replace(/([A-D][\.、])/g, ' $1')}
                              </div>
                              
                              {/* 选项：始终显示，不受折叠影响 */}
                              {item.options && item.options.length > 0 && (
                                <div className="grid grid-cols-2 gap-2 mt-3">
                                  {item.options.map((opt, i) => (
                                    <div key={i} className="text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded">
                                      {opt.trim()}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {!expandedCardId || expandedCardId !== item.id ? (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCardId(item.id);
                                  }}
                                  className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  ...展开
                                </button>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedCardId(null);
                                  }}
                                  className="mt-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition-colors"
                                >
                                  收起
                                </button>
                              )}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingQuestionId(item.id);
                                setEditedQuestionText(item.text);
                                setEditedAnswer(item.answer || '');
                                setEditedExplanation(item.explanation || '');
                              }}
                              className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                              title="编辑题目"
                            >
                              <Edit3 className="w-4 h-4 text-gray-600" />
                            </button>
                          </div>
                          
                          {/* 中部：插图区域 */}
                          {item.imageUrl && (
                            <div className="mt-2 rounded-xl overflow-hidden border border-gray-200">
                              <img 
                                src={item.imageUrl} 
                                alt="题目插图" 
                                className="w-full h-auto object-cover"
                              />
                            </div>
                          )}
                          
                          {/* 答案与解析区域（展开时显示） */}
                          {expandedCardId === item.id && (
                            <div className="mt-3 bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-blue-700 uppercase tracking-wider">答案与解析</h4>
                                {(item.answer === 'AI生成中...' || item.explanation === 'AI生成中...') && (
                                  <div className="flex items-center gap-1 text-xs text-blue-600">
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                    <span>AI生成中...</span>
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-sm text-gray-700 leading-relaxed space-y-3">
                                <div>
                                  <p className="font-bold text-blue-600">答案：</p>
                                  <p className="text-gray-600">{item.answer || '暂无答案'}</p>
                                </div>
                                <div>
                                  <p className="font-bold text-gray-700">解析：</p>
                                  <p className="text-gray-600">{item.explanation || '暂无解析'}</p>
                                </div>
                              </div>
                            </div>
                          )}
                          
                          {/* 底部操作栏 */}
                          <div className="flex items-center justify-between mt-2 pt-3 border-t border-gray-100">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "px-3 py-1 text-[10px] font-black rounded-lg border",
                                item.status === 'mastered' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                              )}>
                                {item.status === 'mastered' ? '已掌握' : '待重练'}
                              </span>
                              {item.practice_count > 0 && (
                                <span className="px-3 py-1 bg-gray-50 text-gray-600 text-[10px] font-black rounded-lg flex items-center gap-1 border border-gray-200">
                                  <RotateCw className="w-3 h-3" />
                                  重练 {item.practice_count} 次
                                </span>
                              )}
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuestionStatus(item.id, item.status === 'mastered' ? 'pending' : 'mastered');
                              }}
                              className={cn(
                                "px-3 py-1 rounded-lg text-[10px] font-black transition-all border shadow-sm active:scale-95",
                                item.status === 'mastered' 
                                  ? "bg-red-50 text-red-700 border-red-200" 
                                  : "bg-green-50 text-green-700 border-green-200"
                              )}
                            >
                              {item.status === 'mastered' ? '标记为待重练' : '标记为已掌握'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                {batchResults.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center h-80 text-center">
                    <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 border border-blue-100">
                      <Camera className="w-10 h-10 text-blue-200" />
                    </div>
                    <h3 className="text-lg font-black text-gray-900 mb-2">暂无待确认题目</h3>
                    <p className="text-xs font-medium text-gray-400 max-w-[200px] leading-relaxed">
                      快去首页拍照或上传试卷吧
                    </p>
                  </div>
                ) : (
                  batchResults.map((result, index) => (
                    <div key={index} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-700">{result.filename}</span>
                        {result.status === 'processing' && (
                          <span className="text-xs text-yellow-500 font-bold">识别中...</span>
                        )}
                        {result.status === 'success' && (
                          <span className="text-xs text-green-500 font-bold">识别成功</span>
                        )}
                        {result.status === 'failed' && (
                          <span className="text-xs text-red-500 font-bold">识别失败</span>
                        )}
                      </div>
                      <div className="p-4">
                        {result.status === 'processing' ? (
                          <div className="text-center py-4">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                            <p className="text-sm text-gray-500">正在识别题目...</p>
                          </div>
                        ) : result.status === 'success' ? (
                          result.questions.length > 0 ? (
                            <div className="space-y-3">
                              {result.questions.map((q: any, qIndex: number) => (
                                <div key={qIndex} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                                  {/* 上半部分：题目原图 */}
                                  <div className="bg-white p-4 border-b border-gray-100">
                                    <div className="flex items-start justify-between mb-3">
                                      <span className="text-xs font-bold text-blue-700">题目 {q.number || qIndex + 1}</span>
                                      <div className="flex items-center gap-2">
                                        {!q.imageUrl && (
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              // 这里可以添加上传图片的逻辑
                                              const input = document.createElement('input');
                                              input.type = 'file';
                                              input.accept = 'image/*';
                                              input.onchange = async (event) => {
                                                const target = event.target as HTMLInputElement;
                                                if (target.files && target.files[0]) {
                                                  const file = target.files[0];
                                                  const reader = new FileReader();
                                                  reader.onload = async (e) => {
                                                    const result = e.target?.result as string;
                                                    // 这里可以上传图片并更新题目
                                                    console.log('上传图片:', result);
                                                  };
                                                  reader.readAsDataURL(file);
                                                }
                                              };
                                              input.click();
                                            }}
                                            className="w-8 h-8 bg-gray-50 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
                                            title="添加插图"
                                          >
                                            <Plus className="w-4 h-4 text-gray-600" />
                                          </button>
                                        )}
                                        <input 
                                          type="checkbox" 
                                          className="mt-1"
                                          checked={q.selected || false}
                                          onChange={(e) => {
                                            const updatedResults = [...batchResults];
                                            updatedResults[index].questions[qIndex].selected = e.target.checked;
                                            setBatchResults(updatedResults);
                                          }}
                                        />
                                      </div>
                                    </div>
                                    <div className="bg-gray-50 rounded-xl p-4 mb-3">
                                      {/* 题干 */}
                                      <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">{q.stem || q.text?.split(/(?=[A-D][\.．])/)[0] || q.text || '未识别到文字'}</p>
                                      {/* 选项 */}
                                      {q.options && q.options.length > 0 && (
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                          {q.options.map((opt: string, i: number) => (
                                            <div key={i} className="text-sm text-gray-600 bg-white px-2 py-1 rounded">
                                              {opt.trim()}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    {/* 题目截图 */}
                                    {q.imageUrl && (
                                      <div className="rounded-xl overflow-hidden border border-gray-100">
                                        <img 
                                          src={q.imageUrl} 
                                          alt="题目截图" 
                                          className="w-full h-auto object-cover"
                                        />
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* 下半部分：作答与批改区域 */}
                                  <div className="p-4 bg-gray-50">
                                    <h4 className="text-xs font-bold text-gray-600 mb-3">作答与批改</h4>
                                    {q.studentAnswer ? (
                                      <div className="mb-3">
                                        <p className="text-sm font-medium text-gray-700 mb-1">学生答案：{q.studentAnswer}</p>
                                        
                                        {/* AI 判断结果 */}
                                        {q.isCorrect !== undefined && (
                                          <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs text-gray-500">AI判断：</span>
                                            {q.isCorrect === true ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                ✓ 正确
                                                {q.confidence && (
                                                  <span className="ml-1 text-green-600">({Math.round(q.confidence * 100)}%)</span>
                                                )}
                                              </span>
                                            ) : q.isCorrect === false ? (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                ✗ 错误
                                                {q.confidence && (
                                                  <span className="ml-1 text-red-600">({Math.round(q.confidence * 100)}%)</span>
                                                )}
                                              </span>
                                            ) : (
                                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                                                ? 不确定
                                                {q.confidence && (
                                                  <span className="ml-1 text-yellow-600">({Math.round(q.confidence * 100)}%)</span>
                                                )}
                                              </span>
                                            )}
                                          </div>
                                        )}
                                        
                                        {q.studentAnswerImage && (
                                          <div className="rounded-xl overflow-hidden border border-gray-100 mt-2">
                                            <img 
                                              src={q.studentAnswerImage} 
                                              alt="学生答案截图" 
                                              className="w-full h-auto object-cover"
                                            />
                                          </div>
                                        )}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-gray-500 mb-3">未识别到学生答案</p>
                                    )}
                                    
                                    {/* 操作按钮 */}
                                    <div className="flex items-center justify-between">
                                      {/* 查看题目裁片按钮 - 使用压缩后的图片裁剪，确保坐标匹配 */}
                                      <button 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          // 使用压缩后的图片（AI识别时使用的图片）进行裁剪，确保 box 坐标匹配
                                          const cropImageSource = result.compressedImage || result.image;
                                          if (q.box && cropImageSource) {
                                            try {
                                              const cropped = await cropImage(cropImageSource, q.box);
                                              setPreviewImage(cropped);
                                            } catch (err) {
                                              console.error('Crop image error:', err);
                                              setPreviewImage(cropImageSource);
                                            }
                                          } else if (cropImageSource) {
                                            setPreviewImage(cropImageSource);
                                          }
                                        }}
                                        className="w-8 h-8 bg-blue-50 text-blue-300 rounded-xl flex items-center justify-center hover:bg-blue-100 hover:text-blue-600 transition-all active:scale-95 border border-blue-100"
                                        title="查看题目裁剪块"
                                      >
                                        <Eye className="w-4 h-4" />
                                      </button>
                                      
                                      <div className="flex gap-2">
                                        {/* 排除按钮 */}
                                        <button 
                                          onClick={() => {
                                            // 从待确认列表中排除该题目
                                            const updatedResults = [...batchResults];
                                            updatedResults[index].questions = updatedResults[index].questions.filter((item: any) => item !== q);
                                            setBatchResults(updatedResults);
                                          }}
                                          className="px-4 py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                          排除
                                        </button>
                                        
                                        {/* 加入错题本按钮 */}
                                        <button 
                                          onClick={async () => {
                                            try {
                                              // 裁剪图片
                                              const imageUrl = q.image || batchResults.find(r => r.questions.includes(q))?.image;
                                              const croppedImage = imageUrl ? await cropImage(imageUrl, q.box) : '';

                                              const res = await fetch('/api/submit', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                  student: selectedStudent,
                                                  subject: `${subject} | ${grade} | ${term}`,
                                                  text: q.text || '未识别到文字',
                                                  imageUrl: imageUrl || '',  // 原图
                                                  questionImage: croppedImage,  // 裁剪后的题目图片
                                                  originalImage: imageUrl || '',  // 原图（用于小眼睛查看裁剪图块）
                                                  box: q.box,  // 裁剪框信息
                                                  time: new Date().toISOString(),
                                                  options: q.options || [],  // 选项列表
                                                  stem: q.stem || ''  // 题干
                                                })
                                              });
                                              
                                              if (!res.ok) {
                                                throw new Error('保存失败');
                                              }
                                              
                                              const data = await res.json();
                                              const newQuestionId = data.id;
                                              
                                              // 从待确认列表中移除该题目
                                              const updatedResults = [...batchResults];
                                              updatedResults[index].questions = updatedResults[index].questions.filter((item: any) => item !== q);
                                              setBatchResults(updatedResults);
                                              
                                              // 刷新错题列表
                                              await fetchHistory();
                                              
                                              // 自动触发AI生成答案和解析（后台静默执行）
                                              if (newQuestionId && q.text) {
                                                generateAnswerAndExplanation(newQuestionId, q.text);
                                              }
                                              
                                              // 显示成功提示
                                              setError('题目已成功加入错题本');
                                            } catch (err: any) {
                                              console.error('保存失败:', err);
                                              setError(`保存失败: ${err.message || '网络连接失败'}`);
                                            }
                                          }}
                                          className="px-4 py-2 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                          加入错题本
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-center py-4">
                              <p className="text-sm text-gray-500">未能识别到题目</p>
                            </div>
                          )
                        ) : result.status === 'failed' ? (
                          <div className="text-center py-4">
                            <p className="text-sm text-red-500">{result.error || '识别失败'}</p>
                            <button 
                              onClick={() => {
                                // 重试识别
                                setBatchResults(prev => prev.map(item => {
                                  if (item.id === result.id) {
                                    return {
                                      ...item,
                                      status: 'processing' as const
                                    };
                                  }
                                  return item;
                                }));
                                
                                // 重新处理识别
                                setTimeout(async () => {
                                  try {
                                    // 压缩图片以减少传输体积
                                    const compressedBase64 = await compressImage(result.image, 400, 0.3);
                                    
                                    const res = await fetch('/api/analyze-question', {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ base64Image: compressedBase64 })
                                    });

                                    if (!res.ok) {
                                      const errorData = await res.json().catch(() => ({ error: '未知错误' }));
                                      console.error('识别 API 错误:', errorData);
                                      throw new Error(errorData.error || `识别失败 (${res.status})`);
                                    }

                                    const data = await res.json();

                                    // 处理后端返回的数据格式
                                    let questionsData = [];
                                    if (Array.isArray(data)) {
                                      questionsData = data;
                                    } else if (data.questions && Array.isArray(data.questions)) {
                                      questionsData = data.questions;
                                    } else {
                                      throw new Error('未能识别到题目');
                                    }
                                    
                                    // 更新待确认列表中的状态
                                    setBatchResults(prev => prev.map(item => {
                                      if (item.id === result.id) {
                                        return {
                                          ...item,
                                          status: 'success' as const,
                                          questions: questionsData
                                        };
                                      }
                                      return item;
                                    }));
                                  } catch (err: any) {
                                    // 更新为失败状态
                                    setBatchResults(prev => prev.map(item => {
                                      if (item.id === result.id) {
                                        return {
                                          ...item,
                                          status: 'failed' as const,
                                          error: err.message
                                        };
                                      }
                                      return item;
                                    }));
                                  }
                                }, 100);
                              }}
                              className="mt-2 px-4 py-1 text-xs font-bold text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                            >
                              重试
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-4">
                            <p className="text-sm text-gray-500">未知状态</p>
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <button 
                            onClick={() => setPreviewImage(result.image)}
                            className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors"
                            title="查看原图"
                          >
                            查看原图
                          </button>
                          <span className="text-xs font-bold text-red-600">
                            已加入错题本 {result.questions?.filter((q: any) => q.added).length || 0}题
                          </span>
                        </div>
                        <button 
                          onClick={() => {
                            // 删除该项目
                            setBatchResults(prev => prev.filter(item => item.id !== result.id));
                          }}
                          className="text-xs font-bold text-red-600 hover:text-red-800 transition-colors"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'data' ? (
          <div className="p-6 space-y-6 h-full overflow-y-auto pb-24">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900 tracking-tight">成果交付</h2>
              <div className="bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">Parent Report</span>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-4">
              <section className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">选择学生</label>
                <button 
                  onClick={() => setIsStudentPickerOpen(true)}
                  className="w-full h-12 bg-white border border-gray-100 rounded-xl px-4 flex items-center justify-between group active:scale-[0.98] transition-all"
                >
                  <div className="flex items-center gap-3">
                    <User className="w-4 h-4 text-blue-500" />
                    <span className="text-xs font-bold text-gray-700">{selectedStudent || '请选择学生'}</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors" />
                </button>
              </section>

              <section className="space-y-2">
                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">时间范围</label>
                <div className="flex gap-2">
                  {[
                    { id: 'week', label: '本周' },
                    { id: 'month', label: '本月' },
                    { id: 'custom', label: '自定义' }
                  ].map(t => (
                    <button
                      key={t.id}
                      onClick={() => setReportTimeRange(t.id as any)}
                      className={cn(
                        "flex-1 py-2 rounded-xl text-xs font-bold transition-all",
                        reportTimeRange === t.id 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                          : "bg-white border border-gray-100 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
                {reportTimeRange === 'custom' && (
                  <div className="flex gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <input 
                      type="date" 
                      className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-[10px] font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <div className="flex items-center text-gray-300">至</div>
                    <input 
                      type="date" 
                      className="flex-1 bg-white border border-gray-100 rounded-xl px-3 py-2 text-[10px] font-bold text-gray-600 focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                )}
              </section>
            </div>

            {/* Report Card - The "Screenshot Area" */}
            <div id="report-card" className="bg-white rounded-[2.5rem] p-8 shadow-2xl shadow-blue-100/50 border border-blue-50 space-y-8 relative overflow-hidden">
              {/* Decorative Elements */}
              <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-blue-100 to-blue-50 rounded-full -mr-24 -mt-24 opacity-30 blur-3xl" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-50 rounded-full -ml-16 -mb-16 opacity-20 blur-2xl" />
              
              {/* Header */}
              <div className="flex justify-between items-start relative">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-black text-gray-900 tracking-tight">
                      {selectedStudent || '未选择'}
                    </h3>
                    {students.find(s => s.name === selectedStudent) && (
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded-lg uppercase tracking-wider border border-blue-100">
                        {students.find(s => s.name === selectedStudent)?.grade}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    {students.find(s => s.name === selectedStudent)?.semester || '上学期'} <span className="text-gray-200 mx-1">|</span> {reportTimeRange === 'week' ? 'Weekly Learning Progress' : reportTimeRange === 'month' ? 'Monthly Learning Progress' : 'Custom Period Progress'}
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
                  <Sparkles className="w-6 h-6" />
                </div>
              </div>

              {/* Main Stats */}
              <div className="grid grid-cols-2 gap-4 relative">
                <div className="bg-gray-50/50 rounded-3xl p-5 space-y-1 border border-white">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">新增错题</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-gray-900">{weeklyCount}</span>
                    <span className="text-xs font-bold text-gray-400">题</span>
                  </div>
                </div>
                <div className="bg-green-50/50 rounded-3xl p-5 space-y-1 border border-white">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">已掌握</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-green-500">{history.filter(h => h.status === 'mastered').length}</span>
                    <span className="text-xs font-bold text-gray-400">题</span>
                  </div>
                </div>
              </div>

              {/* Progress */}
              <div className="space-y-4 relative">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">知识点掌握率</p>
                    <p className="text-xs font-bold text-gray-900">Mastery Rate</p>
                  </div>
                  <span className="text-xl font-black text-blue-600">
                    {history.length > 0 ? Math.round((history.filter(h => h.status === 'mastered').length / history.length) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-4 bg-gray-100 rounded-full overflow-hidden p-1 border border-white shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${history.length > 0 ? (history.filter(h => h.status === 'mastered').length / history.length) * 100 : 0}%` }}
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full shadow-sm"
                  />
                </div>
              </div>

              {/* Weak Points & Distribution */}
              <div className="pt-6 border-t border-dashed border-gray-100 grid grid-cols-2 gap-8 relative">
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">薄弱知识点</p>
                  <div className="space-y-2">
                    {history.length > 0 ? (
                      Object.entries(
                        history.reduce((acc: any, h) => {
                          const sub = h.subject.split('|')[0].trim();
                          acc[sub] = (acc[sub] || 0) + 1;
                          return acc;
                        }, {})
                      )
                      .sort((a: any, b: any) => b[1] - a[1])
                      .slice(0, 2)
                      .map(([sub, count]: any) => (
                        <div key={sub} className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                          <span className="text-xs font-bold text-gray-700">{sub}专项练习</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-gray-300 font-medium italic">暂无数据</p>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">科目分布</p>
                  <div className="space-y-2">
                    {['数学', '语文', '英语'].map(sub => {
                      const count = history.filter(h => h.subject.includes(sub)).length;
                      const total = history.length || 1;
                      if (count === 0) return null;
                      return (
                        <div key={sub} className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-50 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-200 rounded-full" 
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-gray-400 w-8">{sub}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 flex items-center justify-between opacity-30">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-200 rounded-lg" />
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Smart Study AI</span>
                </div>
                <span className="text-[8px] font-bold text-gray-400">{new Date().toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => window.print()}
                className="w-full py-4 bg-white border-2 border-blue-100 rounded-2xl text-blue-600 font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors shadow-sm"
              >
                <Printer className="w-5 h-5" />
                导出 PDF 报告
              </button>
              <p className="text-center text-[10px] text-gray-300 font-medium">
                提示：截图上方卡片即可直接分享至微信群
              </p>
            </div>
          </div>

        ) : (
          <div className="p-6 space-y-8 h-full overflow-y-auto pb-24">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-gray-900 tracking-tight">我的设置</h2>
              <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 border border-blue-100">
                <User className="w-5 h-5" />
              </div>
            </div>

            {/* Student Management */}
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm font-black text-gray-800">
                      学生档案管理
                    </h3>
                    {/* Database Status Indicator */}
                    {dbStatus !== 'unknown' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap ${
                        dbStatus === 'connected' 
                          ? 'bg-green-100 text-green-700 border border-green-200' 
                          : dbStatus === 'mock'
                          ? 'bg-yellow-100 text-yellow-700 border border-yellow-200 animate-pulse'
                          : 'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {dbMessage}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student Profiles ({students.length})</p>
                  
                  {/* Show detailed status message if in mock mode */}
                  {dbStatus === 'mock' && (
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-xl">
                      <p className="text-xs text-yellow-800 font-medium">⚠️ 数据持久化警告</p>
                      <ul className="mt-1 ml-4 list-disc text-xs text-yellow-700 space-y-1">
                        <li>当前数据存储在内存中，刷新后将丢失</li>
                        <li>原因：Supabase 数据库连接失败或未配置</li>
                        <li><strong>解决方案</strong>：请在 Vercel 配置环境变量 SUPABASE_URL 和 SUPABASE_ANON_KEY</li>
                      </ul>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(
                            `SUPABASE_URL=https://bedphahmxdpnzwvsnjay.supabase.co\nSUPABASE_ANON_KEY=sb_publishable_Az5Yk8dG6elDjm4QWkc1cw_sMLOne4t`
                          );
                          alert('环境变量信息已复制到剪贴板！\n\n请前往 Vercel Dashboard → Settings → Environment Variables 粘贴配置');
                        }}
                        className="mt-2 w-full text-xs bg-yellow-600 text-white py-2 px-3 rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        📋 复制环境变量配置
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  onClick={() => {
                    setEditingStudent(null);
                    setStudentFormData({ name: '', grade: '一年级', semester: '上学期', parentName: '', contact: '', avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}` });
                    setIsAddingStudent(true);
                  }}
                  className="w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-blue-100 active:scale-95 transition-all"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>
              
              <div className="relative group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                <input 
                  type="text"
                  placeholder="搜索学生姓名或年级..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  className="w-full h-12 bg-white border border-gray-100 rounded-2xl pl-11 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all shadow-sm"
                />
              </div>

              <div className="space-y-3">
                {students
                  .filter(s => 
                    s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()) || 
                    s.grade.toLowerCase().includes(studentSearchTerm.toLowerCase())
                  )
                  .map((s) => {
                    // 确保头像URL有效，如果无效则使用默认头像
                    const avatarUrl = s.avatar && s.avatar.startsWith('http') 
                      ? s.avatar 
                      : `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name || 'default')}`;
                    
                    return (
                      <div key={s.id} className="bg-white rounded-[2rem] p-4 border border-gray-100 shadow-sm flex items-center justify-between group hover:border-blue-100 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-blue-50 shadow-sm bg-gray-100 flex-shrink-0">
                        <img 
                          src={avatarUrl} 
                          alt={s.name} 
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            // 如果图片加载失败，使用默认头像
                            (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name || 'default')}`;
                          }}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-gray-800">{s.name}</span>
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[9px] font-black rounded-lg uppercase tracking-wider border border-blue-100">
                            {s.grade}
                          </span>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{s.semester}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          console.log("\n=== ✏️ EDIT BUTTON CLICKED ===");
                          console.log("Student to edit:", s);
                          e.stopPropagation(); // 阻止事件冒泡
                          
                          setEditingStudent(s);
                          setStudentFormData({
                            name: s.name,
                            grade: s.grade,
                            semester: s.semester,
                            parentName: s.parentName || '',
                            contact: s.contact || '',
                            avatar: s.avatar || ''
                          });
                          setIsAddingStudent(true);
                          
                          console.log("Editing student set:", s.name);
                          console.log("Form data updated");
                          console.log("IsAddingStudent:", true);
                          console.log("=== END EDIT BUTTON ===\n");
                        }}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                        title="编辑学生信息"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteStudent(s.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
                
                {students.length === 0 && (
                  <div className="py-12 text-center space-y-3 bg-gray-50/50 rounded-[2.5rem] border border-dashed border-gray-200">
                    <UserPlus className="w-10 h-10 text-gray-200 mx-auto" />
                    <p className="text-xs font-bold text-gray-400">暂无学生档案，请添加</p>
                  </div>
                )}
              </div>
            </section>

            {/* Other Settings */}
            <section className="space-y-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">通用设置</h3>
              <div className="bg-white rounded-[2rem] border border-gray-100 overflow-hidden shadow-sm">
                <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center">
                      <Layers className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700">数据归档与备份</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
                <button className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <span className="text-xs font-bold text-gray-700">关于 Smart Study AI</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </button>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Global Navigation - Only visible when NOT in capture mode */}
      {!image && (
        <nav className="bg-white/80 backdrop-blur-xl border-t border-gray-50 px-6 py-3 flex items-center justify-around sticky bottom-0 z-20 print:hidden">
          <button 
            onClick={() => setActiveTab('home')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              activeTab === 'home' ? "text-blue-600 scale-110" : "text-gray-400 hover:text-blue-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all",
              activeTab === 'home' ? "bg-blue-100 shadow-inner" : ""
            )}>
              <Camera className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">首页</span>
          </button>
          <button 
            onClick={() => setActiveTab('wrong_questions')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              activeTab === 'wrong_questions' ? "text-blue-600 scale-110" : "text-gray-400 hover:text-blue-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all",
              activeTab === 'wrong_questions' ? "bg-blue-100 shadow-inner" : ""
            )}>
              <BookOpen className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">错题</span>
          </button>
          <button 
            onClick={() => setActiveTab('data')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              activeTab === 'data' ? "text-blue-600 scale-110" : "text-gray-400 hover:text-blue-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all",
              activeTab === 'data' ? "bg-blue-100 shadow-inner" : ""
            )}>
              <BarChart3 className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">数据</span>
          </button>

          <button 
            onClick={() => setActiveTab('settings')}
            className={cn(
              "flex flex-col items-center gap-1 transition-all duration-300",
              activeTab === 'settings' ? "text-blue-600 scale-110" : "text-gray-400 hover:text-blue-400"
            )}
          >
            <div className={cn(
              "p-2 rounded-2xl transition-all",
              activeTab === 'settings' ? "bg-blue-100 shadow-inner" : ""
            )}>
              <User className="w-6 h-6" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-tighter">我的</span>
          </button>
        </nav>
      )}

      {/* Image Preview Modal */}
      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-[100] flex flex-col"
          >
            <div className="p-4 flex justify-end">
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-2 bg-white/10 rounded-full text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center p-4">
              <img 
                src={previewImage} 
                alt="Original" 
                className="max-w-full max-h-full object-contain rounded-lg"
                referrerPolicy="no-referrer"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Print Only Content */}
      <div className="hidden print:block fixed inset-0 bg-white z-[9999] p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto space-y-12">
          <div className="text-center border-b-2 border-gray-900 pb-6 relative">
            <div className="absolute top-0 right-0">
              {qrcodeUrl && (
                <div className="w-24 h-24">
                  <img src={qrcodeUrl} alt="QR Code" className="w-full h-full" />
                  <div className="text-xs text-center mt-1">扫描二维码批改</div>
                </div>
              )}
            </div>
            <h1 className="text-3xl font-black mb-2">错题重练本</h1>
            <div className="flex justify-center gap-8 text-sm font-bold">
              <span>学生: {selectedStudent}</span>
              <span>日期: {new Date().toLocaleDateString()}</span>
              <span>得分: ________</span>
            </div>
            {printTaskId && (
              <div className="text-xs text-gray-500 mt-2">
                任务编号: {printTaskId}
              </div>
            )}
          </div>

          <div className="space-y-16">
            {history.filter(item => selectedHistoryIds.includes(item.id)).map((item, index) => (
              <div key={item.id} className="space-y-4 break-inside-avoid">
                <div className="flex items-start gap-4">
                  <span className="w-8 h-8 flex items-center justify-center bg-gray-900 text-white rounded-lg font-bold shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 pt-1">
                    <div className="mb-8 text-[14px] leading-relaxed break-inside-avoid">
                      {(() => {
                        // 优先使用后端返回的 options 字段
                        if (item.options && item.options.length > 0) {
                          const stem = item.question || item.text.split(/(?=[A-D][\.．])/)[0];
                          const options = item.options;
                          
                          // 检查选项是否包含换行符（字数多）
                          const hasLineBreaks = options.some((opt: string) => opt.includes('\n'));
                          
                          // 计算选项的平均长度
                          const avgLength = options.reduce((sum: number, opt: string) => sum + opt.length, 0) / options.length;
                          
                          // 根据是否包含换行符和平均长度决定列数
                          let columns = 4; // 默认一行四个选项
                          if (hasLineBreaks || avgLength > 25) {
                            columns = 1; // 任何一个选项包含换行符或字数多，所有选项都一行一个
                          } else if (avgLength > 15) {
                            columns = 2; // 字数适中，一行两个选项
                          }
                          
                          return (
                            <>
                              {/* 题干 */}
                              <div className="mb-4 w-full text-[16px]">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkMath]} 
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {stem}
                                </ReactMarkdown>
                              </div>
                              
                              {/* 选项：根据内容自动调整列数 */}
                              <div className={`grid gap-2 print:grid-cols-${columns}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                                {options.map((opt: string, i: number) => (
                                  <div key={i} className="whitespace-normal">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkMath]} 
                                      rehypePlugins={[rehypeKatex]}
                                    >
                                      {opt.trim()}
                                    </ReactMarkdown>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        }
                        
                        // 兼容旧数据：从 text 中解析选项
                        const fullText = item.text || "";
                        if (!fullText) return null;
                        
                        // 拆分逻辑
                        const parts = fullText.split(/(?=[A-D][\.．])/);
                        const stem = parts[0];
                        const options = parts.slice(1);
                        
                        if (options.length > 0) {
                          // 检查选项是否包含换行符（字数多）
                          const hasLineBreaks = options.some(opt => opt.includes('\n'));
                          
                          // 计算选项的平均长度
                          const avgLength = options.reduce((sum, opt) => sum + opt.length, 0) / options.length;
                          
                          // 根据是否包含换行符和平均长度决定列数
                          let columns = 4; // 默认一行四个选项
                          if (hasLineBreaks || avgLength > 25) {
                            columns = 1; // 任何一个选项包含换行符或字数多，所有选项都一行一个
                          } else if (avgLength > 15) {
                            columns = 2; // 字数适中，一行两个选项
                          }
                          
                          return (
                            <>
                              {/* 题干 */}
                              <div className="mb-4 w-full text-[16px]">
                                <ReactMarkdown 
                                  remarkPlugins={[remarkMath]} 
                                  rehypePlugins={[rehypeKatex]}
                                >
                                  {stem}
                                </ReactMarkdown>
                              </div>
                              
                              {/* 选项：根据内容自动调整列数 */}
                              <div className={`grid gap-2 print:grid-cols-${columns}`} style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                                {options.map((opt, i) => (
                                  <div key={i} className="whitespace-normal">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkMath]} 
                                      rehypePlugins={[rehypeKatex]}
                                    >
                                      {opt.trim()}
                                    </ReactMarkdown>
                                  </div>
                                ))}
                              </div>
                            </>
                          );
                        }
                        return (
                          <div className="mb-4 w-full text-[16px]">
                            <ReactMarkdown 
                              remarkPlugins={[remarkMath]} 
                              rehypePlugins={[rehypeKatex]}
                            >
                              {fullText}
                            </ReactMarkdown>
                          </div>
                        );
                      })()}
                    </div>
                    {item.imageUrl && (
                      <div className="max-w-md border border-gray-200 rounded-lg overflow-hidden">
                        <img src={item.imageUrl} alt="Question" className="w-full" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="h-32 border-b border-dashed border-gray-300"></div>
              </div>
            ))}
          </div>

          <div className="pt-12 text-center text-gray-400 text-xs">
            由 AI 错题本自动生成
          </div>
        </div>
      </div>

      {/* Student Form Modal */}
      <AnimatePresence>
        {isAddingStudent && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddingStudent(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">
                    {editingStudent ? '编辑学生档案' : '添加学生档案'}
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Student Information</p>
                </div>
                <button 
                  onClick={() => setIsAddingStudent(false)}
                  className="w-10 h-10 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto no-scrollbar pr-1">
                {/* Avatar Selection */}
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">学生头像</label>
                  <div className="flex items-center gap-4">
                    <div className="relative group">
                      <div className="w-20 h-20 rounded-3xl overflow-hidden border-4 border-blue-50 shadow-md">
                        <img src={studentFormData.avatar} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      </div>
                      <label className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer rounded-3xl">
                        <Upload className="w-6 h-6 text-white" />
                        <input 
                          type="file" 
                          className="hidden" 
                          accept="image/*"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onloadend = () => {
                                setStudentFormData({ ...studentFormData, avatar: reader.result as string });
                              };
                              reader.readAsDataURL(file);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      {[
                        "Felix", "Aneka", "Milo", "Luna", "Oscar", "Zoe", "Jasper", "Coco"
                      ].map(seed => {
                        const url = `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}`;
                        return (
                          <button
                            key={seed}
                            onClick={() => setStudentFormData({ ...studentFormData, avatar: url })}
                            className={cn(
                              "w-10 h-10 rounded-xl overflow-hidden border-2 transition-all",
                              studentFormData.avatar === url ? "border-blue-500 scale-110 shadow-md" : "border-gray-100 opacity-60 hover:opacity-100"
                            )}
                          >
                            <img src={url} alt={seed} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">基本信息</label>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="学生姓名"
                      value={studentFormData.name}
                      onChange={(e) => setStudentFormData({...studentFormData, name: e.target.value})}
                      className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <div className="flex gap-3">
                      <select 
                        value={studentFormData.grade}
                        onChange={(e) => setStudentFormData({...studentFormData, grade: e.target.value})}
                        className="flex-1 h-12 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                      >
                        {['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级'].map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <select 
                        value={studentFormData.semester}
                        onChange={(e) => setStudentFormData({...studentFormData, semester: e.target.value})}
                        className="flex-1 h-12 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all appearance-none"
                      >
                        {['上学期', '下学期'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="space-y-2">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">家长/联系信息</label>
                  <div className="space-y-3">
                    <input 
                      type="text"
                      placeholder="家长姓名"
                      value={studentFormData.parentName}
                      onChange={(e) => setStudentFormData({...studentFormData, parentName: e.target.value})}
                      className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                    <input 
                      type="text"
                      placeholder="微信号/手机号"
                      value={studentFormData.contact}
                      onChange={(e) => setStudentFormData({...studentFormData, contact: e.target.value})}
                      className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 text-xs font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                    />
                  </div>
                </section>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={() => setIsAddingStudent(false)}
                  className="flex-1 py-4 bg-gray-50 text-gray-500 font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleSaveStudent}
                  disabled={isSavingStudent || !studentFormData.name}
                  className="flex-[2] py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-200 active:scale-95 transition-all disabled:opacity-50"
                >
                  {isSavingStudent ? '保存中...' : '确认保存'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Tags Modal */}
      <AnimatePresence>
        {isEditingTags && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 bg-black/60 z-[110] flex items-end sm:items-center justify-center"
          >
            <div className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">修改标签信息</h3>
                <button onClick={() => setIsEditingTags(false)} className="p-2 hover:bg-gray-100 rounded-full">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="space-y-4">
                <section>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">科目</label>
                  <div className="flex flex-wrap gap-2">
                    {['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'].map(s => (
                      <button
                        key={s}
                        onClick={() => setSubject(s)}
                        className={cn(
                          "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                          subject === s ? "bg-blue-600 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">年级</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['一年级', '二年级', '三年级', '四年级', '五年级', '六年级', '七年级', '八年级', '九年级', '高一', '高二', '高三'].map(g => (
                      <button
                        key={g}
                        onClick={() => setGrade(g)}
                        className={cn(
                          "px-3 py-2 rounded-xl text-sm font-medium transition-all",
                          grade === g ? "bg-blue-600 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </section>

                <section>
                  <label className="text-xs font-bold text-gray-400 uppercase mb-2 block">学期</label>
                  <div className="flex gap-2">
                    {['上学期', '下学期'].map(t => (
                      <button
                        key={t}
                        onClick={() => setTerm(t)}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-sm font-medium transition-all",
                          term === t ? "bg-blue-600 text-white shadow-md" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                        )}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </section>
              </div>

              <button
                onClick={() => setIsEditingTags(false)}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-blue-100 active:scale-95 transition-transform"
              >
                确定修改
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-6"
          >
            <div className="bg-white/90 backdrop-blur-2xl w-full max-w-xs rounded-[32px] p-6 space-y-6 shadow-2xl border border-white/20">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto shadow-inner">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">确认删除</h3>
                <p className="text-xs text-gray-400 font-medium">删除后将无法恢复，确定要删除这条错题吗？</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 py-3 text-gray-400 text-sm font-black uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-3 bg-red-500 text-white text-sm font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center uppercase tracking-widest"
                >
                  确认删除
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Student Confirmation Modal */}
      <AnimatePresence>
        {deleteStudentConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 bg-black/60 z-[130] flex items-center justify-center p-6"
          >
            <div className="bg-white/90 backdrop-blur-2xl w-full max-w-xs rounded-[32px] p-6 space-y-6 shadow-2xl border border-white/20">
              <div className="text-center space-y-2">
                <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center text-red-600 mx-auto shadow-inner">
                  <Trash2 className="w-7 h-7" />
                </div>
                <h3 className="text-xl font-black text-gray-900 tracking-tight">确认删除</h3>
                <p className="text-xs text-gray-400 font-medium">
                  删除后将无法恢复，确定要删除该学生吗？
                </p>
                <div className="bg-gray-50 rounded-xl p-3 mt-2">
                  <p className="text-sm font-bold text-gray-800">{deleteStudentConfirm.name}</p>
                  <p className="text-xs text-gray-500">{deleteStudentConfirm.grade}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteStudentConfirm(null)}
                  className="flex-1 py-3 text-gray-400 text-sm font-black uppercase tracking-widest hover:bg-gray-50 rounded-2xl transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={confirmDeleteStudent}
                  className="flex-1 py-3 bg-red-500 text-white text-sm font-black rounded-2xl shadow-lg shadow-red-100 transition-all active:scale-95 flex items-center justify-center uppercase tracking-widest"
                >
                  确认删除
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Student Picker Modal */}
      <AnimatePresence>
        {isStudentPickerOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-[150] flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-white w-full max-w-md rounded-t-[3rem] sm:rounded-[3rem] p-8 space-y-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">选择学生</h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select a student to continue</p>
                </div>
                <button 
                  onClick={() => {
                    setIsStudentPickerOpen(false);
                    setStudentSearchTerm('');
                  }} 
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text"
                  placeholder="搜索学生姓名..."
                  value={studentSearchTerm}
                  onChange={(e) => setStudentSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full h-12 bg-gray-50 border-none rounded-2xl pl-11 pr-4 text-sm font-bold focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar space-y-2">
                {students
                  .filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase()))
                  .map(s => (
                    <button
                      key={s.id}
                      onClick={() => {
                        setSelectedStudent(s.name);
                        setIsStudentPickerOpen(false);
                        setStudentSearchTerm('');
                      }}
                      className={cn(
                        "w-full p-4 rounded-2xl flex items-center justify-between transition-all group",
                        selectedStudent === s.name 
                          ? "bg-blue-600 text-white shadow-lg shadow-blue-100" 
                          : "bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-600"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl overflow-hidden border-2 border-white shadow-sm bg-gray-100 flex items-center justify-center",
                          selectedStudent === s.name ? "border-white/20" : "border-white"
                        )}>
                          {s.avatar ? (
                            <img 
                              src={s.avatar} 
                              alt={s.name} 
                              className="w-full h-full object-cover" 
                              referrerPolicy="no-referrer"
                              onError={(e) => {
                                // 如果头像加载失败，显示默认头像
                                (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(s.name)}`;
                              }}
                            />
                          ) : (
                            <span className="text-lg font-bold text-gray-400">{s.name.charAt(0)}</span>
                          )}
                        </div>
                        <div className="text-left">
                          <span className="font-black text-sm block">{s.name}</span>
                          <span className={cn(
                            "text-[9px] font-bold uppercase tracking-widest",
                            selectedStudent === s.name ? "text-blue-100" : "text-gray-400"
                          )}>{s.grade} · {s.semester}</span>
                        </div>
                      </div>
                      {selectedStudent === s.name && <Check className="w-5 h-5" />}
                    </button>
                  ))}
                {students.filter(s => s.name.toLowerCase().includes(studentSearchTerm.toLowerCase())).length === 0 && (
                  <div className="py-12 text-center space-y-3">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto">
                      <Search className="w-8 h-8 text-gray-200" />
                    </div>
                    <p className="text-sm text-gray-400 font-medium">未找到相关学生</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setIsStudentPickerOpen(false);
                  setIsAddingStudent(true);
                }}
                className="w-full py-4 bg-blue-50 text-blue-600 font-black uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:bg-blue-100 transition-colors"
              >
                <Plus className="w-5 h-5" />
                新增学生
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Question Modal */}
      <AnimatePresence>
        {editingQuestionId && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingQuestionId(null)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="relative w-full max-w-md bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-8 shadow-2xl space-y-6 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="text-xl font-black text-gray-900 tracking-tight">
                    编辑题目
                  </h3>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Edit Question</p>
                </div>
                <button 
                  onClick={() => {
                    setEditingQuestionId(null);
                    setEditedQuestionText('');
                    setEditedAnswer('');
                    setEditedExplanation('');
                  }}
                  className="w-10 h-10 bg-gray-50 text-gray-400 rounded-2xl flex items-center justify-center hover:bg-gray-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto no-scrollbar pr-1 space-y-6">
                {/* 题目文字编辑 */}
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">题目文字</label>
                  <textarea 
                    value={editedQuestionText}
                    onChange={(e) => setEditedQuestionText(e.target.value)}
                    rows={6}
                    placeholder="请输入题目内容..."
                    className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                  />
                </section>

                {/* 插图管理 */}
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">插图管理</label>
                  <div className="space-y-3">
                    {editingQuestionId && (
                      <div className="flex flex-col space-y-3">
                        {/* 现有插图 */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-600">现有插图</p>
                          <div className="grid grid-cols-2 gap-3">
                            {questions.find(q => q.id === editingQuestionId)?.hasImage && (
                              <div className="relative group">
                                <div className="aspect-square rounded-2xl overflow-hidden border-2 border-blue-50 shadow-md">
                                  <img src="https://neeko-copilot.bytedance.net/api/text2image?prompt=math%20problem%20illustration&size=512x512" alt="题目插图" className="w-full h-full object-cover" />
                                </div>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // 这里可以添加删除插图的逻辑
                                    console.log('删除插图');
                                  }}
                                  className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* 上传新插图 */}
                        <div className="space-y-2">
                          <p className="text-xs font-bold text-gray-600">上传新插图</p>
                          <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-2xl cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6">
                              <Upload className="w-8 h-8 text-gray-400 mb-2" />
                              <p className="text-xs font-medium text-gray-500">点击或拖拽文件到此处上传</p>
                              <p className="text-xs text-gray-400 mt-1">支持 JPG, PNG, GIF 格式</p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept="image/*"
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onloadend = () => {
                                    // 这里可以添加上传插图的逻辑
                                    console.log('上传插图:', reader.result);
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* 答案和解析编辑 */}
                <section className="space-y-3">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">答案与解析</label>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">答案：</label>
                      <input 
                        type="text" 
                        value={editedAnswer}
                        onChange={(e) => setEditedAnswer(e.target.value)}
                        placeholder="请输入答案..."
                        className="w-full h-12 bg-gray-50 border-none rounded-2xl px-4 text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-600 mb-1">解析：</label>
                      <textarea 
                        value={editedExplanation}
                        onChange={(e) => setEditedExplanation(e.target.value)}
                        rows={4}
                        placeholder="请输入解析..."
                        className="w-full p-4 bg-gray-50 border-none rounded-2xl text-sm font-medium focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                      />
                    </div>
                  </div>
                </section>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => {
                    setEditingQuestionId(null);
                    setEditedQuestionText('');
                    setEditedAnswer('');
                    setEditedExplanation('');
                  }}
                  className="flex-1 py-3 text-xs font-bold text-gray-700 border border-gray-200 rounded-2xl hover:bg-gray-50 transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (editingQuestionId) {
                      // 这里可以添加保存编辑的逻辑
                      console.log('保存编辑:', {
                        id: editingQuestionId,
                        text: editedQuestionText,
                        answer: editedAnswer,
                        explanation: editedExplanation
                      });
                      setEditingQuestionId(null);
                      setEditedQuestionText('');
                      setEditedAnswer('');
                      setEditedExplanation('');
                    }
                  }}
                  className="flex-1 py-3 text-xs font-bold text-white bg-blue-600 rounded-2xl hover:bg-blue-700 transition-colors"
                >
                  保存
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {error && (
        <div className="absolute bottom-24 left-6 right-6 bg-red-50 p-4 rounded-2xl flex items-center gap-3 text-red-600 border border-red-100 z-50">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}
    </div>
  );
}

// --- Question Block Component ---

interface QuestionBlockProps {
  index: number;
  question: Question;
  isActive: boolean;
  onSelect: () => void;
  onToggle: () => void;
  onUpdateText: (text: string) => void;
  onReAnalyze: () => void;
}

function QuestionBlock({ index, question, isActive, onSelect, onToggle, onUpdateText, onReAnalyze }: QuestionBlockProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tempText, setTempText] = useState(question.text);

  return (
    <motion.div 
      layout
      onClick={onSelect}
      className={cn(
        "bg-white rounded-3xl p-5 border-2 transition-all cursor-pointer relative overflow-hidden group",
        isActive ? "border-blue-500 shadow-xl shadow-blue-50" : "border-transparent hover:border-blue-100 shadow-sm",
        !question.selected && "opacity-60 grayscale-[0.5]"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className={cn(
            "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-colors",
            question.selected ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-400"
          )}>
            {index}
          </span>
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Question Block</span>
            <div className="flex items-center gap-2">
              {question.hasImage && <ImageIcon className="w-3 h-3 text-orange-400" />}
              <span className="text-xs font-bold text-gray-900">
                {question.hasImage ? "图形题" : "文字题"}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            className={cn(
              "p-2 rounded-xl transition-all active:scale-90",
              question.selected ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-300"
            )}
          >
            {question.selected ? <CheckCircle2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {isEditing ? (
          <div className="space-y-2">
            <textarea 
              value={tempText}
              onChange={(e) => setTempText(e.target.value)}
              className="w-full h-32 bg-gray-50 border-none rounded-2xl p-4 text-xs font-medium focus:ring-2 focus:ring-blue-500 transition-all"
              autoFocus
            />
            <div className="flex gap-2">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onUpdateText(tempText);
                  setIsEditing(false);
                }}
                className="flex-1 py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl"
              >
                保存修改
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(false);
                  setTempText(question.text);
                }}
                className="flex-1 py-2 bg-gray-100 text-gray-400 text-[10px] font-black uppercase tracking-widest rounded-xl"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs font-medium text-gray-700 leading-relaxed line-clamp-4">
            <ReactMarkdown 
              remarkPlugins={[remarkMath]} 
              rehypePlugins={[rehypeKatex]}
            >
              {question.text}
            </ReactMarkdown>
          </div>
        )}

        {/* Options (if available) */}
        {question.options && question.options.length > 0 && (
          <div className="grid grid-cols-2 gap-2 pt-2">
            {question.options.map((opt, i) => (
              <div key={i} className="px-3 py-2 bg-gray-50 rounded-xl text-[10px] font-bold text-gray-500 truncate">
                {opt}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className={cn(
        "mt-4 pt-4 border-t border-gray-50 flex items-center justify-between transition-opacity",
        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}>
        <div className="flex items-center gap-3">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            className="flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest"
          >
            <Edit3 className="w-3 h-3" /> 编辑文本
          </button>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onReAnalyze();
            }}
            className="flex items-center gap-1 text-[10px] font-black text-orange-500 uppercase tracking-widest"
          >
            <RefreshCw className="w-3 h-3" /> 重新识别
          </button>
        </div>
        
        <div className="flex items-center gap-1 text-[10px] font-bold text-gray-300">
          ID: {question.id.split('-')[1]}
        </div>
      </div>
    </motion.div>
  );
}

// --- Format Question Function ---\n\ninterface FormattedQuestion {\n  stem: string;\n  options: string[];\n  hasImage: boolean;\n}\n\nfunction formatQuestion(text: string, hasImage: boolean): FormattedQuestion {\n  // 提取题干（Stem）：提取 A. 选项之前的全部文字\n  const optionMatch = text.match(/([A-D][\.、\s])/);\n  const stem = optionMatch ? text.substring(0, optionMatch.index).trim() : text.trim();\n  \n  // 提取选项（Options）：利用正则表达式匹配 [A-D][\.、\s]，将选项拆分为独立的数组\n  const options: string[] = [];\n  if (optionMatch) {\n    const optionsText = text.substring(optionMatch.index);\n    const optionRegex = /([A-D][\.、\s])(.*?)(?=[A-D][\.、\s]|$)/g;\n    let match;\n    while ((match = optionRegex.exec(optionsText)) !== null) {\n      options.push(`${match[1]}${match[2].trim()}`);\n    }\n  }\n  \n  return {\n    stem,\n    options,\n    hasImage\n  };\n}\n\n// --- Question Overlay Component ---

interface QuestionOverlayProps {
  question: Question;
  isSelected: boolean;
  canvasWidth: number;
  canvasHeight: number;
  onSelect: () => void;
  onToggle: () => void;
  onBoxChange: (newBox: Box) => void;
  onReAnalyze: () => void;
}

function QuestionOverlay({ question, isSelected, canvasWidth, canvasHeight, onSelect, onToggle, onBoxChange, onReAnalyze }: QuestionOverlayProps) {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<any>(null);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  const absX = (question.box.x / 100) * canvasWidth;
  const absY = (question.box.y / 100) * canvasHeight;
  const absW = (question.box.width / 100) * canvasWidth;
  const absH = (question.box.height / 100) * canvasHeight;

  // 绘制原始文本块的红框
  const renderOriginalLines = () => {
    if (!question.originalLines || question.originalLines.length === 0) {
      return null;
    }

    return question.originalLines.map((line, index) => {
      const [x, y, w, h] = line.bbox;
      const absLineX = (x / 1000) * canvasWidth; // 假设 pageWidth 为 1000
      const absLineY = (y / 1000) * canvasHeight;
      const absLineW = (w / 1000) * canvasWidth;
      const absLineH = (h / 1000) * canvasHeight;

      console.log("Drawing box at:", { x, y, w, h });

      return (
        <Group key={`line-${index}`}>
          {/* 亮绿色的框 */}
          <Rect
            x={absLineX}
            y={absLineY}
            width={absLineW}
            height={absLineH}
            fill="transparent"
            stroke="#00FF00"
            strokeWidth={3}
            zIndex={9999}
          />
          {/* 文本标注 */}
          <KonvaText
            x={absLineX}
            y={absLineY - 15}
            text={line.text}
            fontSize={10}
            fill="#00FF00"
            zIndex={9999}
          />
        </Group>
      );
    });
  };

  return (
    <Group>
      {/* 绘制原始文本块的红框 */}
      {renderOriginalLines()}

      {/* Question Box */}
      <Rect 
        ref={shapeRef}
        x={absX}
        y={absY}
        width={absW}
        height={absH}
        fill={question.selected ? "rgba(59, 130, 246, 0.05)" : "transparent"}
        stroke={question.selected ? "#3B82F6" : "transparent"}
        strokeWidth={isSelected ? 2 : 1}
        dash={isSelected ? [] : [4, 4]}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
          if (!question.selected) {
            (e.target as any).stroke("rgba(59, 130, 246, 0.3)");
            e.target.getLayer()?.batchDraw();
          }
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
          if (!question.selected) {
            (e.target as any).stroke("transparent");
            e.target.getLayer()?.batchDraw();
          }
        }}
        cornerRadius={8}
        draggable={isSelected}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect();
          onToggle(); // Click box to toggle selection
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect();
          onToggle(); // Tap box to toggle selection
        }}
        onDragEnd={(e) => {
          const node = e.target;
          onBoxChange({
            x: (node.x() / canvasWidth) * 100,
            y: (node.y() / canvasHeight) * 100,
            width: (node.width() * node.scaleX() / canvasWidth) * 100,
            height: (node.height() * node.scaleY() / canvasHeight) * 100,
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
        onTransformEnd={(e) => {
          const node = e.target;
          onBoxChange({
            x: (node.x() / canvasWidth) * 100,
            y: (node.y() / canvasHeight) * 100,
            width: (node.width() * node.scaleX() / canvasWidth) * 100,
            height: (node.height() * node.scaleY() / canvasHeight) * 100,
          });
          node.scaleX(1);
          node.scaleY(1);
        }}
      />

      {/* Selection Toggle & Number Badge (Top-Left) */}
      <Group 
        x={absX} 
        y={absY}
        onClick={(e) => {
          e.cancelBubble = true;
          onToggle();
        }} 
        onTap={(e) => {
          e.cancelBubble = true;
          onToggle();
        }}
        onMouseEnter={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'pointer';
        }}
        onMouseLeave={(e) => {
          const container = e.target.getStage()?.container();
          if (container) container.style.cursor = 'default';
        }}
      >
        <Rect 
          width={28}
          height={28}
          fill={question.selected ? "#3B82F6" : "rgba(255, 255, 255, 0.9)"}
          stroke="#3B82F6"
          strokeWidth={2}
          cornerRadius={8}
          shadowBlur={6}
          shadowColor="rgba(59, 130, 246, 0.3)"
          offsetX={14}
          offsetY={14}
        />
        <KonvaText 
          text={question.number || "?"}
          fontSize={12}
          fontStyle="bold"
          fill={question.selected ? "white" : "#3B82F6"}
          width={28}
          height={28}
          align="center"
          verticalAlign="middle"
          offsetX={14}
          offsetY={14}
        />
      </Group>

      {/* Transformer */}
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
          rotateEnabled={false}
          anchorSize={8}
          anchorCornerRadius={4}
          anchorStroke="#3B82F6"
          anchorFill="white"
          borderStroke="#3B82F6"
        />
      )}
    </Group>
  );
}
