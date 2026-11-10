
import {
  createEntityAdapter,
  createSlice,
  nanoid,
  type PayloadAction,
} from '@reduxjs/toolkit';

export type Priority = 'low' | 'medium' | 'high';
export type Category = 'system' | 'social' | 'security' | 'updates';

export type Notice = {
  id: string;
  text: string;
  read: boolean;
  archived: boolean;
  createdAt: number;
  priority: Priority;
  category: Category;
  snoozedUntil: number | null;
};

export type Toast = {
  id: string;
  text: string;
  expiresAt: number;
};

export type NotificationFilters = {
  priority: Priority | 'all';
  category: Category | 'all';
  status: 'all' | 'read' | 'unread' | 'archived' | 'active';
};

const notificationsAdapter = createEntityAdapter<Notice>({
  sortComparer: (a, b) => b.createdAt - a.createdAt,
});

export const notificationExamples = [
  { text: 'Your profile was updated', priority: 'low', category: 'system' },
  { text: 'You received a new message', priority: 'medium', category: 'social' },
  { text: 'A new login was detected', priority: 'high', category: 'security' },
  { text: 'A new feature is available', priority: 'low', category: 'updates' },
  { text: 'Your account needs attention', priority: 'high', category: 'system' },
] as const;

export type NotificationsState = ReturnType<
  typeof notificationsAdapter.getInitialState
> & {
  filters: NotificationFilters;
  toasts: Toast[];
  toastsPaused: boolean;
};

const STORAGE_KEY = 'challenge07-notifications';

const defaultFilters: NotificationFilters = {
  priority: 'all',
  category: 'all',
  status: 'all',
};

function loadInitialState(): NotificationsState {
  const state = notificationsAdapter.getInitialState({
    filters: defaultFilters,
    toasts: [],
    toastsPaused: false,
  });

  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) return state;

    const parsed = JSON.parse(saved) as {
      items?: Notice[];
      filters?: NotificationFilters;
    };

    if (Array.isArray(parsed.items)) {
      notificationsAdapter.setAll(
        state,
        parsed.items.filter(
          notice =>
            notice &&
            typeof notice.id === 'string' &&
            typeof notice.text === 'string' &&
            typeof notice.createdAt === 'number',
        ),
      );
    }

    if (parsed.filters) {
      state.filters = { ...defaultFilters, ...parsed.filters };
    }
  } catch {
    // Ignore invalid or unavailable local storage data.
  }

  return state;
}

const initialState = loadInitialState();

const notificationsSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    generate: {
      prepare() {
        const example =
          notificationExamples[
            Math.floor(Math.random() * notificationExamples.length)
          ];

        return {
          payload: {
            id: nanoid(),
            text: example.text,
            priority: example.priority as Priority,
            category: example.category as Category,
            createdAt: Date.now(),
          },
        };
      },
      reducer(
        state,
        action: PayloadAction<{
          id: string;
          text: string;
          priority: Priority;
          category: Category;
          createdAt: number;
        }>,
      ) {
        const notice: Notice = {
          ...action.payload,
          read: false,
          archived: false,
          snoozedUntil: null,
        };

        // Prevent duplicate IDs.
        if (state.entities[notice.id]) return;

        notificationsAdapter.addOne(state, notice);

        state.toasts.unshift({
          id: nanoid(),
          text: notice.text,
          expiresAt: notice.createdAt + 5000,
        });
      },
    },

    markRead(state, action: PayloadAction<string>) {
      const notice = state.entities[action.payload];
      if (notice) notice.read = true;
    },

    markUnread(state, action: PayloadAction<string>) {
      const notice = state.entities[action.payload];
      if (notice) notice.read = false;
    },

    markAllRead(state) {
      Object.values(state.entities).forEach(notice => {
        if (notice && !notice.archived) notice.read = true;
      });
    },

    archive(state, action: PayloadAction<string>) {
      const notice = state.entities[action.payload];
      if (notice) notice.archived = true;
    },

    restore(state, action: PayloadAction<string>) {
      const notice = state.entities[action.payload];
      if (notice) notice.archived = false;
    },

    deleteNotification(state, action: PayloadAction<string>) {
      notificationsAdapter.removeOne(state, action.payload);
    },

    pruneOldest(state, action: PayloadAction<number>) {
      const oldest = [...state.ids]
        .map(id => state.entities[id])
        .filter((notice): notice is Notice => Boolean(notice))
        .sort((a, b) => a.createdAt - b.createdAt)
        .slice(0, action.payload)
        .map(notice => notice.id);

      notificationsAdapter.removeMany(state, oldest);
    },

    setPriorityFilter(state, action: PayloadAction<Priority | 'all'>) {
      state.filters.priority = action.payload;
    },

    setCategoryFilter(state, action: PayloadAction<Category | 'all'>) {
      state.filters.category = action.payload;
    },

    setStatusFilter(
      state,
      action: PayloadAction<NotificationFilters['status']>,
    ) {
      state.filters.status = action.payload;
    },

    resetFilters(state) {
      state.filters = { ...defaultFilters };
    },

    snooze(
      state,
      action: PayloadAction<{ id: string; until: number }>,
    ) {
      const notice = state.entities[action.payload.id];

      if (notice && !notice.archived) {
        notice.snoozedUntil = action.payload.until;
      }
    },

    tick(state, action: PayloadAction<number>) {
      Object.values(state.entities).forEach(notice => {
        if (
          notice?.snoozedUntil !== null &&
          notice?.snoozedUntil !== undefined &&
          notice.snoozedUntil <= action.payload
        ) {
          notice.snoozedUntil = null;
        }
      });

      if (!state.toastsPaused) {
        state.toasts = state.toasts.filter(
          toast => toast.expiresAt > action.payload,
        );
      }
    },

    dismissToast(state, action: PayloadAction<string>) {
      state.toasts = state.toasts.filter(
        toast => toast.id !== action.payload,
      );
    },

    toggleToastPause(state) {
      state.toastsPaused = !state.toastsPaused;
    },
  },
});

export const {
  generate,
  markRead,
  markUnread,
  markAllRead,
  archive,
  restore,
  deleteNotification,
  pruneOldest,
  setPriorityFilter,
  setCategoryFilter,
  setStatusFilter,
  resetFilters,
  snooze,
  tick,
  dismissToast,
  toggleToastPause,
} = notificationsSlice.actions;

export default notificationsSlice.reducer;

// Normalized entity selectors.
type NotificationsRootState = {
  notifications: NotificationsState;
};

export const notificationSelectors =
  notificationsAdapter.getSelectors<NotificationsRootState>(
    state => state.notifications,
  );

export const selectAllNotifications = notificationSelectors.selectAll;
export const selectNotificationById = notificationSelectors.selectById;

export const selectUnreadCount = (state: NotificationsRootState) =>
  selectAllNotifications(state).filter(
    notice => !notice.read && !notice.archived,
  ).length;

export const selectFilteredNotifications = (
  state: NotificationsRootState,
) => {
  const { priority, category, status } = state.notifications.filters;

  return selectAllNotifications(state).filter(notice => {
    if (priority !== 'all' && notice.priority !== priority) return false;
    if (category !== 'all' && notice.category !== category) return false;

    if (status === 'read' && !notice.read) return false;
    if (status === 'unread' && notice.read) return false;
    if (status === 'archived' && !notice.archived) return false;
    if (status === 'active' && notice.archived) return false;

    return true;
  });
};

export const selectGroupedNotifications = (
  state: NotificationsRootState,
) => {
  const groups: Record<string, Notice[]> = {};

  for (const notice of selectFilteredNotifications(state)) {
    const date = new Date(notice.createdAt);
    const key = date.toDateString();

    if (!groups[key]) groups[key] = [];
    groups[key].push(notice);
  }

  return groups;
};

export const NOTIFICATIONS_STORAGE_KEY = STORAGE_KEY;
