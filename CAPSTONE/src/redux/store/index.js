import { combineReducers } from "redux";
import { configureStore } from "@reduxjs/toolkit";

import authReducer from "../reducers/authReducer";
import cartReducer from "../reducers/cartReducer";

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
});

const store = configureStore({
  reducer: rootReducer,
});

export default store;
