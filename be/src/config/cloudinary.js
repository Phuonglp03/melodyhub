import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

// Cấu hình Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Cấu hình storage cho audio files
const audioStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'melodyhub/audio',
    resource_type: 'video', // Cloudinary sử dụng 'video' cho audio files
    allowed_formats: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'aiff'],
    transformation: [
      { quality: 'auto' },
      { format: 'mp3' }, // Convert tất cả audio về mp3 để tối ưu
      { audio_codec: 'mp3' },
      { audio_quality: 'high' }
    ]
  }
});
const projectStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'melodyhub/audio',
    resource_type: 'video', // Cloudinary sử dụng 'video' cho audio files
    allowed_formats: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'wma', 'aiff'],
    transformation: [
      { quality: 'auto' },
      { format: 'mp3' }, // Convert tất cả audio về mp3 để tối ưu
      { audio_codec: 'mp3' },
      { audio_quality: 'high' }
    ]
  }
});

// // Cấu hình storage cho images (nếu cần)
// const imageStorage = new CloudinaryStorage({
//   cloudinary: cloudinary,
//   params: {
//     folder: 'melodyhub/images',
//     resource_type: 'image',
//     allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
//     transformation: [
//       { quality: 'auto' },
//       { fetch_format: 'auto' }
//     ]
//   }
// });

// Multer upload middleware cho audio
export const uploadAudio = multer({
  storage: audioStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit cho audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/x-ms-wma',
      'audio/aiff'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép file âm thanh (mp3, wav, m4a, aac, ogg, flac, wma, aiff)'), false);
    }
  }
});

export const uploadProjectAudio = multer({
  storage: projectStorage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit cho audio files
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'audio/mpeg',
      'audio/wav',
      'audio/mp4',
      'audio/aac',
      'audio/ogg',
      'audio/flac',
      'audio/x-ms-wma',
      'audio/aiff'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ cho phép file âm thanh (mp3, wav, m4a, aac, ogg, flac, wma, aiff)'), false);
    }
  }
});

// Multer upload middleware cho images
// export const uploadImage = multer({
//   storage: imageStorage,
//   limits: {
//     fileSize: 10 * 1024 * 1024, // 10MB limit cho images
//   },
//   fileFilter: (req, file, cb) => {
//     const allowedMimes = [
//       'image/jpeg',
//       'image/jpg',
//       'image/png',
//       'image/gif',
//       'image/webp'
//     ];
    
//     if (allowedMimes.includes(file.mimetype)) {
//       cb(null, true);
//     } else {
//       cb(new Error('Chỉ cho phép file hình ảnh (jpg, jpeg, png, gif, webp)'), false);
//     }
//   }
// });

// Utility function để xóa file từ Cloudinary
export const deleteFromCloudinary = async (publicId, resourceType = 'video') => {
  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType
    });
    return result;
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

// Utility function để lấy URL của file
export const getCloudinaryUrl = (publicId, options = {}) => {
  return cloudinary.url(publicId, {
    resource_type: 'video',
    ...options
  });
};

export default cloudinary;
