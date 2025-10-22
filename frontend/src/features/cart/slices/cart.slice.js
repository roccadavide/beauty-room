import { createSlice } from "@reduxjs/toolkit";

const savedCart = localStorage.getItem("cart");
const initialState = savedCart
  ? JSON.parse(savedCart)
  : {
      items: [],
      totalQuantity: 0,
      totalPrice: 0,
    };

function recalc(items) {
  const totalQuantity = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.quantity * parseFloat(i.price || 0), 0);
  return { totalQuantity, totalPrice };
}

function saveToLocalStorage(state) {
  localStorage.setItem("cart", JSON.stringify(state));
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
      saveToLocalStorage(state);
    },

    removeFromCart: (state, action) => {
      const productId = action.payload;
      state.items = state.items.filter(i => i.productId !== productId);

      const { totalQuantity, totalPrice } = recalc(state.items);
      state.totalQuantity = totalQuantity;
      state.totalPrice = totalPrice;
      saveToLocalStorage(state);
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
      saveToLocalStorage(state);
    },

    clearCart: state => {
      state.items = [];
      state.totalQuantity = 0;
      state.totalPrice = 0;
      saveToLocalStorage(state);
    },
  },
});

export const { addToCart, removeFromCart, updateCartQuantity, clearCart } = cartSlice.actions;
export default cartSlice.reducer;
