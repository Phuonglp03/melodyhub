import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { 
  login as loginService, 
  register as registerService, 
  logout as logoutService, 
  getCurrentUser as getCurrentUserService,
  loginWithGoogle as loginWithGoogleService
} from '../../../services/authService';

// Lấy thông tin user từ localStorage khi khởi tạo
const user = JSON.parse(localStorage.getItem('user'));

const initialState = {
  user: user || null,
  isError: false,
  isSuccess: false,
  isLoading: false,
  message: '',
  requiresVerification: false,
  verificationEmail: '',
};

// Đăng ký người dùng mới
export const register = createAsyncThunk(
  'auth/register',
  async (userData, thunkAPI) => {
    try {
      return await registerService(userData);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Đăng nhập
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, thunkAPI) => {
    try {
      const response = await loginService(credentials.email, credentials.password);
      
      // If login requires email verification
      if (response.requiresVerification) {
        return { requiresVerification: true, ...response };
      }
      
      // If login is successful
      if (response.success) {
        return response.data;
      }
      
      return thunkAPI.rejectWithValue(response.message || 'Đăng nhập thất bại');
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Google Login
export const googleLogin = createAsyncThunk(
  'auth/googleLogin',
  async (token, thunkAPI) => {
    try {
      return await loginWithGoogleService(token);
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

// Đăng xuất
export const logout = createAsyncThunk('auth/logout', async () => {
  await logoutService();
});

// Làm mới thông tin người dùng
export const refreshUser = createAsyncThunk(
  'auth/refresh',
  async (_, thunkAPI) => {
    try {
      const user = getCurrentUserService();
      if (!user) {
        return thunkAPI.rejectWithValue('Không tìm thấy thông tin đăng nhập');
      }
      return user;
    } catch (error) {
      const message =
        (error.response &&
          error.response.data &&
          error.response.data.message) ||
        error.message ||
        error.toString();
      return thunkAPI.rejectWithValue(message);
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    reset: (state) => {
      state.isLoading = false;
      state.isSuccess = false;
      state.isError = false;
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        
        // Log để debug
        console.log('Registration payload:', action.payload);
        
        // Xử lý dữ liệu trả về từ đăng ký
        if (action.payload.token) {
          // Nếu có token, lưu thông tin user vào state
          state.user = {
            ...(action.payload.user || {
              id: action.payload.id,
              email: action.payload.email,
              username: action.payload.username,
              displayName: action.payload.displayName,
              verifiedEmail: action.payload.verifiedEmail,
              roleId: action.payload.roleId
            }),
            token: action.payload.token,
            refreshToken: action.payload.refreshToken
          };
        } else {
          // Nếu không có token, vẫn lưu thông tin user nếu có
          state.user = action.payload.user || action.payload;
        }
        
        state.message = action.payload.message || 'Đăng ký thành công';
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.isError = false;
        state.message = '';
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.isError = false;
        state.message = action.payload?.message || 'Đăng nhập thành công';
        
        if (action.payload?.user) {
          state.user = action.payload.user;
        } else if (action.payload?.data?.user) {
          state.user = action.payload.data.user;
        }
        
        // Handle email verification required
        if (action.payload?.requiresVerification) {
          state.requiresVerification = true;
          state.verificationEmail = action.payload.email;
        }
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload || 'Đăng nhập thất bại';
        state.user = null;
      })
      .addCase(googleLogin.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(googleLogin.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isSuccess = true;
        state.user = action.payload.user;
      })
      .addCase(googleLogin.rejected, (state, action) => {
        state.isLoading = false;
        state.isError = true;
        state.message = action.payload;
        state.user = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
      })
      .addCase(refreshUser.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { reset } = authSlice.actions;

export default authSlice.reducer;
