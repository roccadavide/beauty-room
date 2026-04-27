import { combineReducers } from "@reduxjs/toolkit";

import authReducer from "../features/auth/slices/auth.slice";
import cartReducer from "../features/cart/slices/cart.slice";
import wishlistReducer from "../features/wishlist/wishlistSlice";

const rootReducer = combineReducers({
  auth: authReducer,
  cart: cartReducer,
  wishlist: wishlistReducer,
});

export default rootReducer;
