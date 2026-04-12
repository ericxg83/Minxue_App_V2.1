import sharp from 'sharp';

async function cropImage(base64Image, box) {
  try {
    // 移除 base64 前缀
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // 获取图片信息
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width || 1000;
    const height = metadata.height || 1000;
    
    console.log('Image metadata:', { width, height });
    console.log('Box:', box);
    
    // 计算实际裁剪坐标（从百分比转换为像素）
    const x = Math.round((box.x / 100) * width);
    const y = Math.round((box.y / 100) * height);
    const cropWidth = Math.round((box.width / 100) * width);
    const cropHeight = Math.round((box.height / 100) * height);
    
    console.log('Calculated crop coordinates:', { x, y, cropWidth, cropHeight });
    
    // 确保坐标有效
    const validX = Math.max(0, x);
    const validY = Math.max(0, y);
    const validWidth = Math.min(cropWidth, width - validX);
    const validHeight = Math.min(cropHeight, height - validY);
    
    console.log('Valid crop coordinates:', { validX, validY, validWidth, validHeight });
    
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
    console.log('Crop successful, cropped image length:', croppedBase64.length);
    return croppedBase64;
  } catch (error) {
    console.error('Crop image error:', error);
    // 如果裁剪失败，返回原图
    return base64Image;
  }
}

// 测试用的 base64 图片（1x1 像素）
const testImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAMCAgMCAgMDAwMEAwMEBQgFBQQEBQoHBwYIDAoMDAsKCwsNDhIQDQ4RDgsLEBYQERMUFRUVDA8XGBYUGBIUFRT/2wBDAQMEBAUEBQkFBQkUDQsNFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBT/wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwDm68AAAAASUVORK5CYII=';

// 测试裁剪
cropImage(testImage, { x: 10, y: 10, width: 80, height: 80 })
  .then(result => {
    console.log('Test completed successfully');
  })
  .catch(error => {
    console.error('Test failed:', error);
  });
