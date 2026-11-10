import { configureStore } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { TypedUseSelectorHook } from 'react-redux';
import feedReducer, { selectSnapshot, STORAGE_KEY } from '../features/feedSlice';

export const store = configureStore({
  reducer: { feed: feedReducer },
});

// Persist posts, comments and the current user (not undo history, filters or sort).
// selectSnapshot is memoized, so filter changes don't trigger a write.
let lastSaved: unknown = selectSnapshot(store.getState());
store.subscribe(() => {
  const snapshot = selectSnapshot(store.getState());
  if (snapshot === lastSaved) return;
  lastSaved = snapshot;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* storage full or blocked */
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;