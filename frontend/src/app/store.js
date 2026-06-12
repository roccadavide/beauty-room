import { configureStore } from "@reduxjs/toolkit";
import storage from "redux-persist/lib/storage";
import { persistReducer, persistStore, createMigrate } from "redux-persist";
import rootReducer from "./rootReducer";

const migrations = {
  1: state => ({
    ...state,
    cart: {
      items: state.cart?.items ?? [],
      totalQuantity: state.cart?.totalQuantity ?? 0,
      totalPrice: state.cart?.totalPrice ?? 0,
    },
  }),
  // v2: cart items now use `id` as primary key; map old productId-keyed items
  2: state => ({
    ...state,
    cart: {
      items: (state.cart?.items ?? []).map(item => ({
        ...item,
        id: item.id ?? item.productId,
        type: item.type ?? "product",
      })),
      totalQuantity: state.cart?.totalQuantity ?? 0,
      totalPrice: state.cart?.totalPrice ?? 0,
    },
  }),
  // v3: add image:null fallback for service items saved before image field was added
  3: state => ({
    ...state,
    cart: {
      items: (state.cart?.items ?? []).map(item => ({
        ...item,
        image: item.image ?? null,
      })),
      totalQuantity: state.cart?.totalQuantity ?? 0,
      totalPrice: state.cart?.totalPrice ?? 0,
    },
  }),
  // v4: service cart ids became composite `service-${serviceId}-${optionId}` (multiple options of the
  // same service per cart). Pre-v4 items lack a reliable serviceOptionId → reusing them would send
  // optionId=null at checkout and undercharge (the bug just fixed). CLEAR the cart so every item after
  // the deploy carries its option. Money-safe over rewriting old ids.
  4: state => ({ ...state, cart: { ...state?.cart, items: [], totalQuantity: 0, totalPrice: 0 } }),
};

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["cart"],
  version: 4,
  migrate: createMigrate(migrations, { debug: false }),
};

const persistedReducer = persistReducer(persistConfig, rootReducer);

export const store = configureStore({
  reducer: persistedReducer,
  middleware: getDefaultMiddleware =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
  devTools: import.meta.env.MODE !== "production",
});

export const persistor = persistStore(store);

export default store;
