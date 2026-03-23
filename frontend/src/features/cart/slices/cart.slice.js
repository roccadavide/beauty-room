import { createSlice } from "@reduxjs/toolkit";
import { logout } from "../../auth/slices/auth.slice";

function recalc(items) {
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  return { totalQuantity, totalPrice };
}

const cartSlice = createSlice({
  name: "cart",
  initialState: { items: [], totalQuantity: 0, totalPrice: 0 },
  reducers: {
    addToCart: (state, { payload }) => {
      const existing = state.items.find(i => i.id === payload.id);
      if (existing) {
        // Products: increment qty (respect stock)
        if (existing.type === "product") {
          existing.quantity = Math.min(
            existing.quantity + (payload.quantity ?? 1),
            existing.stock ?? 99
          );
        }
        // Packages/promos: don't duplicate — already present
      } else {
        state.items.push({ ...payload, quantity: payload.quantity ?? 1 });
      }
      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
    },

    removeFromCart: (state, { payload }) => {
      // payload = id (string)
      state.items = state.items.filter(i => i.id !== payload);
      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
    },

    updateCartQuantity: (state, { payload }) => {
      // payload = { id, quantity }
      const item = state.items.find(i => i.id === payload.id);
      if (item && item.type === "product") {
        if (payload.quantity <= 0) {
          state.items = state.items.filter(i => i.id !== payload.id);
        } else {
          item.quantity = Math.min(payload.quantity, item.stock ?? 99);
        }
        const { totalQuantity, totalPrice } = recalc(state.items);
        state.totalQuantity = totalQuantity;
        state.totalPrice = totalPrice;
      }
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
