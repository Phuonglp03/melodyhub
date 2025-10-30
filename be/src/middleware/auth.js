import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { verifyToken as verifyJWT } from '../utils/jwt.js';

// Middleware xác thực token
export const verifyToken = (req, res, next) => {
  // Lấy token từ header Authorization
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Không tìm thấy access token' });
  }

  try {
    // Xác thực token
    const decoded = verifyJWT(token);
    if (!decoded) {
      return res.status(403).json({ message: 'Token không hợp lệ hoặc đã hết hạn' });
    }

    // Lưu thông tin user vào request để sử dụng ở các middleware khác
    req.userId = decoded.userId;
    req.userRole = decoded.roleId;
    
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(403).json({ message: 'Token không hợp lệ' });
  }
};

// Middleware kiểm tra quyền admin
export const isAdmin = (req, res, next) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Yêu cầu quyền admin' });
  }
  next();
};

// Middleware kiểm tra quyền user thông thường
export const isUser = (req, res, next) => {
  if (req.userRole !== 'user' && req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Yêu cầu đăng nhập' });
  }
  next();
};

// Middleware kiểm tra quyền dựa trên tài nguyên và hành động
export const checkPermission = (resource, action) => (req, res, next) => {
  // Tạm thời cho phép tất cả request qua
  next();
};

export default {
  verifyToken,
  isAdmin,
  isUser,
  checkPermission
};