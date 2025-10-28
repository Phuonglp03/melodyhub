import multer from 'multer';
import { uploadAudio, uploadImage, uploadPostMedia, deleteFromCloudinary, uploadToCloudinary } from '../config/cloudinary.js';
const jwt = require('jsonwebtoken')
const User = require('../model/User')

const middlewareController = {
    verifyToken: async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1]
            if (!token) {
                return res.status(401).json({ message: 'Token không tồn tại' })
            }

            const decoded = jwt.verify(token, process.env.JWT_ACCESS_KEY)
            if (!decoded) {
                return res.status(403).json({ message: 'Token không hợp lệ' })
            }

            // Lấy thông tin user từ token và thêm vào request
            const user = await User.findById(decoded.id)
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' })
            }

            req.userId = decoded.id
            req.user = user
            next()
        } catch (error) {
            return res.status(403).json({ message: 'Token không hợp lệ' })
        }
    },

    checkPermission: (resource, action) => (req, res, next) => {
        // TODO: Thêm logic phân quyền thực tế ở đây
        // Tạm thời cho phép tất cả request qua
        next()
    }
}

module.exports = middlewareController 
import multer from 'multer';
import { uploadAudio, uploadImage, deleteFromCloudinary } from '../config/cloudinary.js';

// Middleware để xử lý upload audio
export const handleAudioUpload = uploadAudio.single('audio');

// Middleware để xử lý upload image
export const handleImageUpload = uploadImage.single('image');

// Middleware để xử lý multiple audio uploads
export const handleMultipleAudioUpload = uploadAudio.array('audios', 5);

// Middleware để xử lý multiple image uploads
export const handleMultipleImageUpload = uploadImage.array('images', 10);

// Middleware để xử lý mixed uploads (audio + image)
export const handleMixedUpload = uploadAudio.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'image', maxCount: 1 }
]);

// Middleware để xử lý post media uploads (multiple files)
export const handlePostMediaUpload = uploadPostMedia.array('media', 10);

// Error handling middleware cho upload
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File quá lớn. Kích thước tối đa là 100MB.'
        message: 'File quá lớn. Kích thước tối đa cho audio là 100MB, cho image là 10MB.'
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        success: false,
        message: 'Quá nhiều file được upload cùng lúc.'
      });
    }
  }
  
  if (error.message.includes('Chỉ cho phép file')) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
  
  next(error);
};

// Utility function để xóa file
export { deleteFromCloudinary, uploadToCloudinary };
export { deleteFromCloudinary };

