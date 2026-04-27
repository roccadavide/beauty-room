import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  loaded: false,
  loading: false,
  filter: "ALL", // 'ALL' | 'SERVICE' | 'PRODUCT' | 'PROMOTION' | 'PACKAGE'
};

const wishlistSlice = createSlice({
  name: "wishlist",
  initialState,
  reducers: {
    setItems: (state, action) => {
      state.items = action.payload;
      state.loaded = true;
      state.loading = false;
    },
    addItem: (state, action) => {
      // Evita duplicati
      const exists = state.items.some(i => i.id === action.payload.id);
      if (!exists) state.items.unshift(action.payload);
    },
    removeItem: (state, action) => {
      // action.payload: { itemType, itemId }
      state.items = state.items.filter(
        i => !(i.itemType === action.payload.itemType && i.itemId === action.payload.itemId)
      );
    },
    setFilter: (state, action) => {
      state.filter = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setLoaded: (state, action) => {
      state.loaded = action.payload;
    },
    clearWishlist: state => {
      state.items = [];
      state.loaded = false;
      state.loading = false;
      state.filter = "ALL";
    },
  },
});

export const { setItems, addItem, removeItem, setFilter, setLoading, setLoaded, clearWishlist } =
  wishlistSlice.actions;

export default wishlistSlice.reducer;
