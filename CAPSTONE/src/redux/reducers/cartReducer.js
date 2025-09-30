// cartReducer.js
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

export default function cartReducer(state = initialState, action) {
  switch (action.type) {
    case "ADD_TO_CART": {
      const payload = action.payload;
      const qtyToAdd = payload.quantity ?? 1;
      const exists = state.items.find(i => i.productId === payload.productId);

      let items;
      if (exists) {
        items = state.items.map(i => (i.productId === payload.productId ? { ...i, quantity: i.quantity + qtyToAdd } : i));
      } else {
        items = [...state.items, { ...payload, quantity: qtyToAdd }];
      }

      return { ...state, ...recalc(items), items };
    }

    case "REMOVE_FROM_CART": {
      const productId = action.payload;
      const items = state.items.filter(i => i.productId !== productId);
      return { ...state, ...recalc(items), items };
    }

    case "UPDATE_CART_QUANTITY": {
      const { productId, quantity } = action.payload;
      if (quantity <= 0) {
        const items = state.items.filter(i => i.productId !== productId);
        return { ...state, ...recalc(items), items };
      }
      const items = state.items.map(i => (i.productId === productId ? { ...i, quantity } : i));
      return { ...state, ...recalc(items), items };
    }

    case "CLEAR_CART":
      return { ...initialState };

    default:
      return state;
  }
}
