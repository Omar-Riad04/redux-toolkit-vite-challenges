import { createSlice } from '@reduxjs/toolkit';
type Role = 'admin' | 'editor' | 'viewer';
type SessionState = { user: { id: string; role: Role } | null; minutesRemaining: number };
const initialState: SessionState = { user: null, minutesRemaining: 15 };

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    loginAsViewer(state) { state.user = { id: 'demo-viewer', role: 'viewer' }; state.minutesRemaining = 15; },
    logout(state) { state.user = null; },
    // TODO: Implement the remaining requirements in README.md
  },
});
export const { loginAsViewer, logout } = sessionSlice.actions;
export default sessionSlice.reducer;
