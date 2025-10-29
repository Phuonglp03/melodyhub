import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const middlewareController = {
    verifyToken: async (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1]
            if (!token) {
                return res.status(401).json({ message: 'Token không tồn tại' })
            }

            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key')
            if (!decoded) {
                return res.status(403).json({ message: 'Token không hợp lệ' })
            }

            // Lấy thông tin user từ token và thêm vào request
            const user = await User.findById(decoded.userId)
            if (!user) {
                return res.status(404).json({ message: 'Không tìm thấy người dùng' })
            }

            req.userId = decoded.userId
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

export default middlewareController; 