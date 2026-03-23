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
};

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["cart"],
  version: 2,
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
