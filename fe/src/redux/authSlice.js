import { createSlice } from "@reduxjs/toolkit";
import { mockAuthState } from "../services/user/mockData";

const authSlice = createSlice({
  name: "auth",
  initialState: mockAuthState, // Use mock auth state
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
    },
    setAuth: (state, action) => {
      state.isAuthenticated = action.payload.isAuthenticated;
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
    },
    logout: (state) => {
      state.isAuthenticated = false;
      state.user = null;
      state.token = null;
      state.refreshToken = null;
    },
  },
});

export const { setUser, setAuth, logout } = authSlice.actions;
export default authSlice.reducer;
