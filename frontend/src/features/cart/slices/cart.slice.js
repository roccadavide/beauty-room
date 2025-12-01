import { createSlice } from "@reduxjs/toolkit";
import { logout } from "../../auth/slices/auth.slice"; 

const initialState = {
  items: [],
  totalQuantity: 0,
  totalPrice: 0,
};

function recalc(items) {
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * parseFloat(i.price || 0), 0);
  return { totalQuantity, totalPrice };
}

const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const payload = action.payload;
      const qtyToAdd = payload.quantity ?? 1;
      const existing = state.items.find(i => i.productId === payload.productId);

      if (existing) {
        existing.quantity += qtyToAdd;
      } else {
        state.items.push({ ...payload, quantity: qtyToAdd });
      }

      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
    },

    removeFromCart: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter(i => i.productId !== productId);

      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
    },

    updateCartQuantity: (state, action) => {
      const { productId, quantity } = action.payload;

      if (quantity <= 0) {
        state.items = state.items.filter(i => i.productId !== productId);
      } else {
        const item = state.items.find(i => i.productId === productId);
        if (item) item.quantity = quantity;
      }

      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
    },

    clearCart: state => {
      state.items = [];
      state.totalQuantity = 0;
      state.totalPrice = 0;
    },
  },

  extraReducers: builder => {
    builder.addCase(logout, state => {
      state.items = [];
      state.totalQuantity = 0;
      state.totalPrice = 0;
    });
  },
});

export const { addToCart, removeFromCart, updateCartQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;