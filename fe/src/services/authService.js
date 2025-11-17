import axios from "axios";

const API_URL = "http://localhost:9999/api/auth";

// Tạo instance axios mặc định
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Cho phép gửi cookie với mỗi request
});

// Thêm interceptor để tự động thêm token vào header
api.interceptors.request.use(
  (config) => {
    const user = JSON.parse(localStorage.getItem("user"));
    if (user?.token) {
      config.headers.Authorization = `Bearer ${user.token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Thêm interceptor để xử lý lỗi 401 và refresh token
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Nếu lỗi 401 và chưa thử refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Gọi API để refresh token
        const response = await axios.post(
          `${API_URL}/refresh-token`,
          {},
          { withCredentials: true }
        );

        const { token, user } = response.data;

        // Lưu token mới vào localStorage
        localStorage.setItem("user", JSON.stringify({ ...user, token }));

        // Thử lại request ban đầu với token mới
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshError) {
        // Nếu refresh token thất bại, đăng xuất người dùng
        localStorage.removeItem("user");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Các hàm xử lý đăng nhập, đăng ký, đăng xuất
export const login = async (email, password) => {
  try {
    const response = await api.post("/login", { email, password });

    if (!response.data) {
      throw new Error("Không nhận được phản hồi từ máy chủ");
    }

    console.log("Login response:", response.data);

    // Xử lý dữ liệu trả về
    const { token, user, refreshToken } = response.data;

    if (token && user) {
      // Tạo đối tượng userData để lưu vào localStorage
      const userData = {
        token,
        refreshToken,
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
        },
      };

      // Lưu vào localStorage
      localStorage.setItem("user", JSON.stringify(userData));

      // Thiết lập header Authorization
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      return {
        success: true,
        data: userData,
        message: "Đăng nhập thành công!",
      };
    }

    throw new Error("Đăng nhập thất bại: Dữ liệu không hợp lệ");
  } catch (error) {
    console.error("Login error:", error);

    // Nếu lỗi từ server
    if (error.response?.data) {
      // Nếu lỗi chưa xác thực email
      if (
        error.response.status === 403 &&
        error.response.data.requiresVerification
      ) {
        return {
          success: false,
          requiresVerification: true,
          email: error.response.data.email,
          message: error.response.data.message,
        };
      }
      throw new Error(error.response.data.message || "Đăng nhập thất bại");
    }

    // Nếu lỗi mạng hoặc lỗi khác
    throw new Error(error.message || "Lỗi kết nối máy chủ");
  }
};

export const register = async (userData) => {
  try {
    const response = await api.post("/register", userData, {
      withCredentials: true,
    });

    if (!response.data) {
      throw new Error("Không nhận được phản hồi từ máy chủ");
    }

    console.log("Register response:", response.data);

    // If registration requires email verification
    if (response.data.requiresVerification) {
      return {
        success: true,
        requiresVerification: true,
        email: response.data.email,
        message: response.data.message,
      };
    }

    // If registration includes tokens (for auto-login)
    if (response.data.token && response.data.refreshToken) {
      const { token, refreshToken, user } = response.data;

      // Store user data in localStorage
      const userDataToStore = {
        token,
        refreshToken,
        user: {
          id: user._id || user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
        },
      };

      localStorage.setItem("user", JSON.stringify(userDataToStore));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      return {
        success: true,
        data: userDataToStore,
        message: "Đăng ký và đăng nhập thành công!",
      };
    }

    return response.data;
  } catch (error) {
    console.error("Register error:", error);
    const errorMessage = error.response?.data?.message || "Đăng ký thất bại";
    throw new Error(errorMessage);
  }
};

export const logout = async () => {
  try {
    // Gọi API để xóa refresh token ở phía server
    await api.post("/logout", {}, { withCredentials: true });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    // Xóa dữ liệu người dùng khỏi localStorage
    localStorage.removeItem("user");

    // Xóa cookie refreshToken bằng cách đặt hết hạn ngay lập tức
    document.cookie =
      "refreshToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";

    // Chuyển hướng về trang đăng nhập
    window.location.href = "/login";
  }
};

export const refreshAccessToken = async () => {
  try {
    const response = await axios.post(
      `${API_URL}/refresh-token`,
      {},
      { withCredentials: true }
    );

    const { token, user } = response.data || {};
    if (!token) {
      throw new Error("Không nhận được token mới");
    }

    const storedUser = JSON.parse(localStorage.getItem("user")) || {};
    const updatedUser = {
      ...storedUser,
      token,
      user: user
        ? {
            ...(storedUser.user || {}),
            id: user._id || user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            roleId: user.roleId,
            verifiedEmail: user.verifiedEmail,
          }
        : storedUser.user,
    };

    localStorage.setItem("user", JSON.stringify(updatedUser));
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    return token;
  } catch (error) {
    console.error("Refresh token error:", error);
    localStorage.removeItem("user");
    throw error;
  }
};

export const verifyEmail = async (email, otp) => {
  try {
    const response = await api.post("/verify-email", { email, otp });

    if (response.data.token) {
      // Save user data and token to localStorage
      const { token, user } = response.data;
      const userData = {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          displayName: user.displayName,
          roleId: user.roleId,
          verifiedEmail: user.verifiedEmail,
        },
      };

      localStorage.setItem("user", JSON.stringify(userData));
      api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      return {
        success: true,
        message: "Email verified successfully!",
        user: userData.user,
      };
    }

    return response.data;
  } catch (error) {
    console.error("Email verification error:", error);
    const errorMessage =
      error.response?.data?.message || "Xác thực email thất bại";
    throw new Error(errorMessage);
  }
};

export const resendOTP = async (email) => {
  try {
    const response = await api.post("/resend-otp", { email });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Gửi lại OTP thất bại" };
  }
};

export const forgotPassword = async (email) => {
  try {
    const response = await api.post("/forgot-password", { email });
    return response.data;
  } catch (error) {
    throw (
      error.response?.data || {
        message: "Gửi yêu cầu đặt lại mật khẩu thất bại",
      }
    );
  }
};

export const resetPassword = async (token, email, newPassword) => {
  try {
    const response = await api.post("/reset-password", {
      token,
      email,
      newPassword,
    });
    return response.data;
  } catch (error) {
    throw error.response?.data || { message: "Đặt lại mật khẩu thất bại" };
  }
};

// Google login
export const loginWithGoogle = async (token) => {
  try {
    const response = await api.post("/google", { token });

    if (response.data.success) {
      // Lưu thông tin user và token vào localStorage
      const { token, user } = response.data;
      localStorage.setItem("user", JSON.stringify({ ...user, token }));

      return {
        success: true,
        user,
      };
    }

    return {
      success: false,
      message: response.data.message || "Đăng nhập không thành công",
    };
  } catch (error) {
    console.error("Lỗi đăng nhập bằng Google:", error);
    return {
      success: false,
      message:
        error.response?.data?.message ||
        "Đã xảy ra lỗi khi đăng nhập bằng Google",
    };
  }
};

// Lấy thông tin user hiện tại
export const getCurrentUser = () => {
  const user = localStorage.getItem("user");
  return user ? JSON.parse(user) : null;
};

// Kiểm tra xem người dùng đã đăng nhập chưa
export const isAuthenticated = () => {
  return !!getCurrentUser();
};

// Kiểm tra xem người dùng có phải là admin không
export const isAdmin = () => {
  const user = getCurrentUser();
  return user?.roleId === "admin";
};
