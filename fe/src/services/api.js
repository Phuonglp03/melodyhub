import axios from "axios";
import { store } from "../redux/store";
import { logout, updateTokens } from "../redux/authSlice";

// const API_BASE_URL = "https://api.melodyhub.website/api";
const API_BASE_URL = "http://localhost:9999/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // Important for sending cookies (refreshToken)
});

// Request interceptor: Add token to headers
api.interceptors.request.use(
  (config) => {
    // Get token from Redux persist store
    const state = store.getState();
    const token = state.auth?.user?.token;

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Log request (optional, remove in production)
    console.log("[API]", config.method?.toUpperCase(), config.url);

    // Handle FormData
    if (config.data instanceof FormData) {
      delete config.headers["Content-Type"];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401/403 and refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // List of auth endpoints that should NOT trigger token refresh
    const authEndpoints = [
      "/auth/login",
      "/auth/register",
      "/auth/verify-email",
      "/auth/resend-otp",
      "/auth/forgot-password",
      "/auth/reset-password",
      "/auth/refresh-token",
      "/auth/google",
    ];
    const isAuthEndpoint = authEndpoints.some((endpoint) =>
      originalRequest.url?.includes(endpoint)
    );

    // Check if 403 is due to account locked
    const isAccountLocked = 
      error.response?.status === 403 && 
      error.response?.data?.message?.includes('Tài khoản của bạn đã bị khóa');

    // Check if 403 is due to permission denied (not token expired)
    const isPermissionDenied = 
      error.response?.status === 403 && 
      !isAccountLocked &&
      (error.response?.data?.message?.includes('Không có quyền') || 
       error.response?.data?.message?.includes('permission') ||
       error.response?.data?.message?.includes('Yêu cầu quyền'));

    // If account is locked, logout immediately
    if (isAccountLocked) {
      console.error("[API] Account is locked, logging out...");
      store.dispatch(logout());
      localStorage.clear();
      window.location.href = "/login";
      return Promise.reject(new Error(error.response?.data?.message || "Tài khoản của bạn đã bị khóa"));
    }

    // If 401 (Unauthorized) or 403 (Forbidden - token expired) and haven't retried yet
    // Don't refresh token if it's a permission denied error
    const shouldRefreshToken =
      (error.response?.status === 401 || (error.response?.status === 403 && !isPermissionDenied && !isAccountLocked)) &&
      !originalRequest._retry &&
      !isAuthEndpoint; // Don't retry for auth endpoints

    if (shouldRefreshToken) {
      originalRequest._retry = true;

      try {
        console.log("[API] Token expired, refreshing...");

        // Call refresh token endpoint
        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          {},
          { withCredentials: true }
        );

        const { token, refreshToken, user } = response.data;

        console.log("[API] Token refreshed successfully");

        // ✅ Update Redux store immediately (this is the key!)
        store.dispatch(
          updateTokens({
            token,
            refreshToken,
            user,
          })
        );

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        console.error("[API] Refresh token failed, logging out...");

        // Clear everything and redirect to login
        store.dispatch(logout());
        localStorage.clear();
        window.location.href = "/login";

        return Promise.reject(refreshError);
      }
    }

    // Handle permission denied errors - don't logout, just reject
    if (isPermissionDenied) {
      const message = error?.response?.data?.message || "Không có quyền truy cập";
      console.warn("[API] Permission denied:", message);
      return Promise.reject(new Error(message));
    }

    // Handle other errors
    const message =
      error?.response?.data?.message || error.message || "Request error";
    return Promise.reject(new Error(message));
  }
);

export default api;
