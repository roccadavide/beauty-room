import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  token: null,
  isLoading: false,
  error: null,
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
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
      state.isLoading = false;
      state.error = null;
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
      state.token = null;
      state.isLoading = false;
      state.error = null;
    },
  },
});

export const { loginStart, loginSuccess, loginFailure, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
