/**
 * ==================================================================================
 * TOKEN MANAGER - QUẢN LÝ TOKEN TỰ ĐỘNG CHO MELODYHUB
 * ==================================================================================
 * 
 * VẤN ĐỀ GỐC:
 * -----------
 * Khi user đăng nhập, hệ thống cấp:
 *   - Access Token: hết hạn sau 15 phút
 *   - Refresh Token: hết hạn sau 7 ngày (lưu trong httpOnly cookie)
 * 
 * Vấn đề: Khi access token hết hạn, app KHÔNG tự động:
 *   1. Logout user ra
 *   2. Refresh lấy token mới
 * 
 * User vẫn thấy mình đang login (vì token còn trong Redux/localStorage),
 * nhưng mọi API call sẽ fail với lỗi 401.
 * 
 * ==================================================================================
 * 
 * PHÂN TÍCH CƠ CHẾ CŨ (trong api.js):
 * ------------------------------------
 * Code cũ trong api.js interceptor CHỈ xử lý REACTIVE:
 *   - Khi nhận lỗi 401 từ server → mới gọi refresh token
 *   - Không có cơ chế kiểm tra TRƯỚC khi token hết hạn
 *   - Không kiểm tra khi app load/reload
 *   - Không kiểm tra khi user quay lại từ idle
 * 
 * Luồng cũ:
 *   User đăng nhập → 15 phút sau token hết hạn → User gọi API → Lỗi 401 → 
 *   Mới refresh token → Retry request
 * 
 * Vấn đề:
 *   - Request đầu tiên sau 15 phút LUÔN fail trước
 *   - Nếu user idle lâu, trải nghiệm không tốt
 *   - Nếu refresh token cũng hết hạn (sau 7 ngày), user không được thông báo
 * 
 * ==================================================================================
 * 
 * GIẢI PHÁP MỚI (Hook này):
 * -------------------------
 * 1. PROACTIVE REFRESH: Refresh token TRƯỚC KHI hết hạn (1 phút trước)
 * 2. PERIODIC CHECK: Kiểm tra token định kỳ mỗi 30 giây
 * 3. VISIBILITY CHANGE: Kiểm tra khi user quay lại tab/window
 * 4. APP LOAD CHECK: Kiểm tra ngay khi app khởi động
 * 5. AUTO LOGOUT: Tự động logout nếu refresh token không hợp lệ
 * 
 * Luồng mới:
 *   User đăng nhập → Token Manager theo dõi → 14 phút (1 phút trước hết hạn) →
 *   Tự động refresh → User tiếp tục dùng bình thường (không bị gián đoạn)
 * 
 * ==================================================================================
 * 
 * CẤU HÌNH:
 * ---------
 * - TOKEN_REFRESH_BUFFER: 60 giây (refresh trước 1 phút)
 * - TOKEN_CHECK_INTERVAL: 30 giây (kiểm tra định kỳ)
 * - API_BASE_URL: URL của backend API
 * 
 * ==================================================================================
 * 
 * CÁCH SỬ DỤNG:
 * -------------
 * 1. Import TokenManager component vào App.js
 * 2. Wrap app với TokenManager (bên trong Provider và PersistGate)
 * 3. TokenManager sẽ tự động quản lý token
 * 
 * Ví dụ trong App.js:
 *   <Provider store={store}>
 *     <PersistGate loading={null} persistor={persistor}>
 *       <TokenManager>
 *         <AppRoutes />
 *       </TokenManager>
 *     </PersistGate>
 *   </Provider>
 * 
 * ==================================================================================
 * 
 * CÁC GIÁ TRỊ TRẢ VỀ TỪ HOOK:
 * ---------------------------
 * - isTokenExpired: boolean - Token đã hết hạn chưa
 * - isTokenExpiringSoon: boolean - Token sắp hết hạn chưa (trong 1 phút)
 * - tokenRemainingTime: number - Thời gian còn lại (milliseconds)
 * - refreshToken: function - Hàm refresh token thủ công
 * - checkAndRefreshToken: function - Hàm kiểm tra và refresh nếu cần
 * 
 * ==================================================================================
 * 
 * YÊU CẦU:
 * --------
 * - Package: jwt-decode (npm install jwt-decode)
 * - Redux store với authSlice có actions: updateTokens, logout
 * - Backend endpoint: POST /auth/refresh-token (với httpOnly cookie)
 * 
 * ==================================================================================
 */

import { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';
import { updateTokens, logout } from '../redux/authSlice';

// ==================================================================================
// CẤU HÌNH
// ==================================================================================

const API_BASE_URL = "https://api.melodyhub.website/api";

// Thời gian buffer trước khi token hết hạn để refresh (1 phút = 60000ms)
// Token 15 phút → refresh ở phút thứ 14
const TOKEN_REFRESH_BUFFER = 60 * 1000;

// Interval kiểm tra token (30 giây)
// Đảm bảo không bỏ lỡ thời điểm refresh
const TOKEN_CHECK_INTERVAL = 30 * 1000;

// ==================================================================================
// HOOK CHÍNH
// ==================================================================================

const useTokenManager = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth?.user);
  const token = user?.token;
  
  // Ref để ngăn nhiều request refresh cùng lúc
  const refreshInProgressRef = useRef(false);
  // Ref cho interval ID
  const intervalRef = useRef(null);

  // ================================================================================
  // KIỂM TRA TOKEN ĐÃ HẾT HẠN CHƯA
  // ================================================================================
  const isTokenExpired = useCallback((accessToken) => {
    if (!accessToken) return true;
    
    try {
      const decoded = jwtDecode(accessToken);
      const currentTime = Date.now() / 1000; // Convert to seconds (JWT exp is in seconds)
      
      // Token hết hạn nếu exp <= currentTime
      return decoded.exp <= currentTime;
    } catch (error) {
      console.error('[TokenManager] Error decoding token:', error);
      return true; // Nếu không decode được, coi như hết hạn
    }
  }, []);

  // ================================================================================
  // KIỂM TRA TOKEN SẮP HẾT HẠN (TRONG VÒNG BUFFER TIME)
  // ================================================================================
  const isTokenExpiringSoon = useCallback((accessToken) => {
    if (!accessToken) return true;
    
    try {
      const decoded = jwtDecode(accessToken);
      const currentTime = Date.now() / 1000;
      const bufferInSeconds = TOKEN_REFRESH_BUFFER / 1000;
      
      // Token sắp hết hạn nếu exp <= currentTime + buffer
      // Ví dụ: token hết hạn lúc 10:15, buffer 1 phút
      // → Nếu hiện tại >= 10:14 thì isExpiringSoon = true
      return decoded.exp <= (currentTime + bufferInSeconds);
    } catch (error) {
      console.error('[TokenManager] Error decoding token:', error);
      return true;
    }
  }, []);

  // ================================================================================
  // LẤY THỜI GIAN CÒN LẠI CỦA TOKEN (MILLISECONDS)
  // ================================================================================
  const getTokenRemainingTime = useCallback((accessToken) => {
    if (!accessToken) return 0;
    
    try {
      const decoded = jwtDecode(accessToken);
      const currentTime = Date.now();
      const expirationTime = decoded.exp * 1000; // Convert to milliseconds
      
      return Math.max(0, expirationTime - currentTime);
    } catch (error) {
      return 0;
    }
  }, []);

  // ================================================================================
  // THỰC HIỆN REFRESH TOKEN
  // ================================================================================
  const refreshToken = useCallback(async () => {
    // Ngăn nhiều request refresh cùng lúc (race condition)
    if (refreshInProgressRef.current) {
      console.log('[TokenManager] Refresh already in progress, skipping...');
      return false;
    }

    refreshInProgressRef.current = true;
    console.log('[TokenManager] Starting token refresh...');

    try {
      // Gọi API refresh token
      // withCredentials: true để gửi httpOnly cookie chứa refresh token
      const response = await axios.post(
        `${API_BASE_URL}/auth/refresh-token`,
        {},
        { withCredentials: true }
      );

      const { token: newToken, refreshToken: newRefreshToken, user: userData } = response.data;

      if (!newToken) {
        throw new Error('Refresh token response missing access token');
      }

      console.log('[TokenManager] Token refreshed successfully');
      
      // Cập nhật Redux store với token mới
      // Redux Persist sẽ tự động lưu vào localStorage
      dispatch(updateTokens({
        token: newToken,
        refreshToken: newRefreshToken,
        user: userData,
      }));

      return true;
    } catch (error) {
      console.error('[TokenManager] Token refresh failed:', error?.response?.data?.message || error.message);
      
      // Chỉ logout nếu refresh token không hợp lệ (401/403)
      // Không logout nếu chỉ là lỗi mạng (để user có thể retry)
      if (error.response?.status === 401 || error.response?.status === 403) {
        console.error('[TokenManager] Refresh token invalid, logging out...');
        dispatch(logout());
        localStorage.clear();
        window.location.href = '/login';
      }
      
      return false;
    } finally {
      refreshInProgressRef.current = false;
    }
  }, [dispatch]);

  // ================================================================================
  // KIỂM TRA VÀ REFRESH TOKEN NẾU CẦN
  // ================================================================================
  const checkAndRefreshToken = useCallback(async () => {
    if (!token) {
      console.log('[TokenManager] No token found, skipping check');
      return;
    }

    // Case 1: Token đã hết hạn hoàn toàn
    if (isTokenExpired(token)) {
      console.log('[TokenManager] Token has expired, attempting refresh...');
      const success = await refreshToken();
      if (!success) {
        console.log('[TokenManager] Failed to refresh expired token');
      }
      return;
    }

    // Case 2: Token sắp hết hạn (trong vòng buffer time)
    if (isTokenExpiringSoon(token)) {
      const remainingTime = getTokenRemainingTime(token);
      console.log(`[TokenManager] Token expiring soon (${Math.round(remainingTime / 1000)}s remaining), refreshing proactively...`);
      await refreshToken();
      return;
    }

    // Case 3: Token còn tốt
    const remainingTime = getTokenRemainingTime(token);
    console.log(`[TokenManager] Token is valid (${Math.round(remainingTime / 1000)}s remaining)`);
  }, [token, isTokenExpired, isTokenExpiringSoon, getTokenRemainingTime, refreshToken]);

  // ================================================================================
  // XỬ LÝ KHI TAB/WINDOW ĐƯỢC FOCUS LẠI (USER QUAY LẠI TỪ IDLE)
  // ================================================================================
  const handleVisibilityChange = useCallback(() => {
    if (document.visibilityState === 'visible' && token) {
      console.log('[TokenManager] Tab became visible, checking token...');
      checkAndRefreshToken();
    }
  }, [token, checkAndRefreshToken]);

  // ================================================================================
  // XỬ LÝ KHI WINDOW ĐƯỢC FOCUS
  // ================================================================================
  const handleFocus = useCallback(() => {
    if (token) {
      console.log('[TokenManager] Window focused, checking token...');
      checkAndRefreshToken();
    }
  }, [token, checkAndRefreshToken]);

  // ================================================================================
  // EFFECT: KIỂM TRA TOKEN KHI COMPONENT MOUNT HOẶC TOKEN THAY ĐỔI
  // ================================================================================
  useEffect(() => {
    if (token) {
      // Kiểm tra ngay khi app load
      checkAndRefreshToken();

      // Setup interval để kiểm tra định kỳ
      intervalRef.current = setInterval(() => {
        checkAndRefreshToken();
      }, TOKEN_CHECK_INTERVAL);
    }

    // Cleanup: clear interval khi unmount hoặc token thay đổi
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [token, checkAndRefreshToken]);

  // ================================================================================
  // EFFECT: LẮNG NGHE VISIBILITY CHANGE VÀ FOCUS EVENTS
  // ================================================================================
  useEffect(() => {
    // Khi user chuyển tab rồi quay lại
    document.addEventListener('visibilitychange', handleVisibilityChange);
    // Khi user click vào window
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [handleVisibilityChange, handleFocus]);

  // ================================================================================
  // TRẢ VỀ CÁC GIÁ TRỊ VÀ HÀM HỮU ÍCH
  // ================================================================================
  return {
    isTokenExpired: token ? isTokenExpired(token) : true,
    isTokenExpiringSoon: token ? isTokenExpiringSoon(token) : true,
    tokenRemainingTime: token ? getTokenRemainingTime(token) : 0,
    refreshToken,
    checkAndRefreshToken,
  };
};

export default useTokenManager;
