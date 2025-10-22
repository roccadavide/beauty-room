import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  user: null,
  token: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    loginSuccess: (state, action) => {
      const { user, token } = action.payload;
      state.user = user;
      state.token = token;
    },

    updateUser: (state, action) => {
      state.user = action.payload;
    },

    logout: state => {
      state.user = null;
      state.token = null;
    },
  },
});

export const { loginSuccess, updateUser, logout } = authSlice.actions;
export default authSlice.reducer;
