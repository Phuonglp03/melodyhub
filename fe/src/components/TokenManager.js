import { useEffect } from 'react';
import useTokenManager from '../hooks/useTokenManager';

/**
 * Component quản lý token tự động
 * Đặt component này ở top level của app (bên trong Provider và PersistGate)
 * 
 * Chức năng:
 * - Kiểm tra token khi app load
 * - Proactive refresh token trước khi hết hạn
 * - Refresh token khi user quay lại từ idle/tab khác
 */
const TokenManager = ({ children }) => {
  const { 
    tokenRemainingTime, 
  } = useTokenManager();

  // Log thông tin token cho debugging (có thể bỏ trong production)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const minutes = Math.floor(tokenRemainingTime / 60000);
      const seconds = Math.floor((tokenRemainingTime % 60000) / 1000);
      
      if (tokenRemainingTime > 0) {
        console.log(`[TokenManager] Token expires in: ${minutes}m ${seconds}s`);
      }
    }
  }, [tokenRemainingTime]);

  return children;
};

export default TokenManager;
