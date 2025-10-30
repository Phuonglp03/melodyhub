import { configureStore } from '@reduxjs/toolkit';
import authReducer from './features/auth/authSlice';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

// Cấu hình persist
const authPersistConfig = {
  key: 'auth',
  storage,
};

const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);

// Tạo store với Redux Toolkit
export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,
    // Thêm các reducer khác nếu cần
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // Disable serializable check for non-serializable values like functions
    }),
});

// Tạo persistor
export const persistor = persistStore(store);