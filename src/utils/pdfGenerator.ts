import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { PassThrough } from 'stream';

interface Question {
  id: string;
  text: string;
  number: string;
}

interface PrintTask {
  id: string;
  questions: Question[];
  student: string;
}

/**
 * 生成PDF
 */
export async function generatePDF(task: PrintTask): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      // 创建PDF文档
      const doc = new PDFDocument({
        size: 'A4',
        margin: {
          top: 80,
          right: 60,
          bottom: 80,
          left: 60
        }
      });

      // 创建流来捕获PDF数据
      const stream = new PassThrough();
      const chunks: Buffer[] = [];

      stream.on('data', (chunk) => chunks.push(chunk));
      stream.on('end', () => {
        const buffer = Buffer.concat(chunks);
        resolve(buffer);
      });

      doc.pipe(stream);

      // 生成二维码
      const qrCodeContent = `http://localhost:3001/correct?taskId=${task.id}`;
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeContent, {
        width: 100,
        margin: 1
      });

      // 提取base64数据
      const qrCodeBase64 = qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const qrCodeBuffer = Buffer.from(qrCodeBase64, 'base64');

      // 添加页眉（二维码）
      doc.save();
      doc.translate(495, 20);
      doc.image(qrCodeBuffer, 0, 0, { width: 50, height: 50 });
      doc.restore();

      // 添加标题
      doc.fontSize(20);
      doc.text('错题本', { align: 'center' });
      doc.moveDown(0.5);

      // 添加学生信息
      doc.fontSize(12);
      doc.text(`学生：${task.student}`, { align: 'center' });
      doc.moveDown(2);

      // 添加题目
      task.questions.forEach((question, index) => {
        // 题目编号
        doc.fontSize(14);
        doc.font('Helvetica-Bold');
        doc.text(`第 ${question.number} 题`, { align: 'left' });
        doc.font('Helvetica');
        doc.moveDown(0.5);

        // 题目内容
        doc.fontSize(12);
        
        // 使用结构化数据
        const stem = question.question || question.text;
        const options = question.options || [];
        
        // 渲染题干
        doc.text(stem, { align: 'left' });
        doc.moveDown(0.5);
        
        // 渲染选项（横向排列）
        if (options.length > 0) {
          const optionWidth = 495 / options.length; // 平均分配宽度
          const startX = doc.x;
          const startY = doc.y;

          options.forEach((option, index) => {
            doc.text(
              option.trim(),
              startX + optionWidth * index,
              startY,
              {
                width: optionWidth - 10,
                align: 'left'
              }
            );
          });

          // 手动控制换行
          doc.y = startY + doc.currentLineHeight() * 2; // 增加高度以适应可能的换行
          doc.moveDown(0.5);
        } else {
          // 没有选项的题目，直接渲染全文
          doc.text(question.text, { align: 'left' });
          doc.moveDown(1);
        }

        // 答案空白区域
        doc.moveDown(3);
        doc.lineWidth(1);
        doc.strokeColor('#ddd');
        doc.dash(5, { space: 5 });
        doc.moveTo(55, doc.y);
        doc.lineTo(555, doc.y);
        doc.stroke();
        doc.undash();
        doc.moveDown(2);

        // 分页
        if (index < task.questions.length - 1 && doc.y > 700) {
          doc.addPage();
        }
      });

      // 添加页脚
      doc.pageNumber = 1;
      doc.footer = (currentPage, pageCount) => {
        doc.fontSize(10);
        doc.text(`第 ${currentPage} 页`, 300, 800, { align: 'center' });
      };

      // 结束PDF生成
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * 格式化题目文本，确保显示正确
 */
function formatQuestionText(text: string): string {
  // 替换换行符
  let formatted = text.replace(/\n/g, '\n');
  
  // 处理图片标签：在图片标签前后插入换行符
  formatted = formatted.replace(/(<img[^>]*>)/g, '\n$1\n');
  
  // 处理 [图片] 占位符：在前后插入换行符
  formatted = formatted.replace(/(\[图片\])/g, '\n$1\n');
  
  return formatted;
}
