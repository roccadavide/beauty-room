import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  accessToken: null,
  isLoading: false,
  error: null,
  initialized: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginStart: state => {
      state.isLoading = true;
      state.error = null;
    },

    loginSuccess: (state, action) => {
      const { user, accessToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.isLoading = false;
      state.error = null;
      state.initialized = true;
    },

    loginFailure: (state, action) => {
      state.isLoading = false;
      state.error = action.payload;
    },

    updateUser: (state, action) => {
      state.user = action.payload;
    },

    logout: state => {
      state.user = null;
      state.accessToken = null;
      state.isLoading = false;
      state.error = null;
      state.initialized = true;
    },

    authInitialized: state => {
      state.initialized = true;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, updateUser, logout, authInitialized } = authSlice.actions;
export default authSlice.reducer;
