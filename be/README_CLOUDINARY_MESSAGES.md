# Lưu tin nhắn vào Cloudinary (Free Tier)

## Tổng quan

Hệ thống sử dụng **hybrid approach** để tối ưu dung lượng MongoDB:

- **Tin nhắn ngắn (< 500 ký tự)**: Lưu trực tiếp trong MongoDB
- **Tin nhắn dài (>= 500 ký tự)**: Upload lên Cloudinary, chỉ lưu URL trong MongoDB

## Cách hoạt động

### 1. Khi gửi tin nhắn:

```javascript
// User gửi: "Tin nhắn dài dài dài..." (600 chars)
// → Upload lên Cloudinary
// → MongoDB chỉ lưu:
{
  textStorageId: "https://res.cloudinary.com/xxx/raw/upload/...",
  textStorageType: "cloudinary",
  textPreview: "Tin nhắn dài dài dài...", // 100 ký tự đầu
  text: null // Không lưu full text
}
```

### 2. Khi đọc tin nhắn:

```javascript
// Nếu textStorageType === 'cloudinary'
// → Download full text từ Cloudinary URL
// → Trả về cho client
```

## Cloudinary Free Tier

### Giới hạn:
- ✅ **25GB storage** - Đủ cho hàng triệu tin nhắn
- ✅ **25GB bandwidth/tháng** - Cần tính toán cẩn thận
- ✅ **Không giới hạn số files**

### Ước tính:
- 1 triệu tin nhắn dài × 500 bytes = **500MB** (chỉ 2% free tier)
- Bandwidth: 1000 user × 100 tin/ngày × 500 bytes = **50MB/ngày** = **1.5GB/tháng** (6% free tier)

→ **Vẫn còn rất nhiều dung lượng!**

## Cấu hình

### Environment Variables (đã có sẵn):
```env
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Tùy chỉnh threshold:
Sửa trong `be/src/services/messageStorageService.js`:
```javascript
const TEXT_THRESHOLD = 500; // Thay đổi số ký tự threshold
```

## Files đã tạo/sửa

1. **`be/src/services/messageStorageService.js`**
   - `uploadMessageText()` - Upload text lên Cloudinary
   - `downloadMessageText()` - Download text từ Cloudinary
   - `deleteMessageText()` - Xóa text từ Cloudinary (optional)

2. **`be/src/models/DirectMessage.js`**
   - Thêm fields: `textStorageId`, `textStorageType`, `textPreview`
   - `text` field: chỉ lưu nếu tin ngắn

3. **`be/src/controllers/dmController.js`**
   - `sendMessage()` - Upload text trước khi lưu
   - `listMessages()` - Download text khi đọc

4. **`be/src/config/socket.js`**
   - Socket handler cũng dùng storage service

## Lợi ích

### Tiết kiệm MongoDB:
- **Trước**: 1 triệu tin × 200 bytes = 200MB trong MongoDB
- **Sau**: 
  - Tin ngắn (70%): 700k × 200 bytes = 140MB
  - Tin dài (30%): 300k × 50 bytes (metadata) = 15MB
  - **Tổng: 155MB** (tiết kiệm 22.5%)

### Thực tế:
- Nếu 50% tin dài: tiết kiệm **~50%** dung lượng MongoDB
- Cloudinary free tier đủ cho rất nhiều tin nhắn

## Lưu ý

1. **Bandwidth**: Mỗi lần đọc tin nhắn dài = 1 lần download từ Cloudinary
   - Nếu nhiều user đọc cùng lúc → có thể hết bandwidth
   - Giải pháp: Cache ở FE hoặc BE

2. **Latency**: Download từ Cloudinary có thể chậm hơn đọc từ MongoDB
   - Thường < 200ms, chấp nhận được

3. **Fallback**: Nếu Cloudinary fail → tự động fallback về MongoDB

4. **Backward compatible**: Tin nhắn cũ vẫn hoạt động bình thường

