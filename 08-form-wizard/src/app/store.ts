
import { configureStore } from '@reduxjs/toolkit';
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux';

import reducer, {
  saveCheckoutState,
} from '../features/checkoutSlice';

export const store = configureStore({
  reducer: {
    checkout: reducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();

export const useAppSelector: TypedUseSelectorHook<RootState> =
  useSelector;

// Persist draft and order history whenever Redux state changes.
store.subscribe(() => {
  saveCheckoutState(store.getState().checkout);
});
