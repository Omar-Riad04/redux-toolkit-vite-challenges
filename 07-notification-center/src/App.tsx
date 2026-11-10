
  import { useEffect, useState } from 'react';
  import { useAppDispatch, useAppSelector } from './app/store';
  import {
    generate,
    markRead,
    markUnread,
    markAllRead,
    archive,
    restore,
    deleteNotification,
    setPriorityFilter,
    setCategoryFilter,
    setStatusFilter,
    resetFilters,
    snooze,
    tick,
    dismissToast,
    toggleToastPause,
    selectFilteredNotifications,
    selectGroupedNotifications,
    selectUnreadCount,
    type Priority,
    type Category,
  } from './features/notificationsSlice';
  import './style.css';

  const formatTime = (timestamp: number) =>
    new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

  const priorityColors: Record<Priority, string> = {
    low: '#16a34a',
    medium: '#d97706',
    high: '#dc2626',
  };

  export default function App() {
    const dispatch = useAppDispatch();

    const notifications = useAppSelector(selectFilteredNotifications);
    const groupedNotifications = useAppSelector(selectGroupedNotifications);
    const unreadCount = useAppSelector(selectUnreadCount);

    const filters = useAppSelector(state => state.notifications.filters);
    const toasts = useAppSelector(state => state.notifications.toasts);
    const toastsPaused = useAppSelector(
      state => state.notifications.toastsPaused,
    );

    const [streamEnabled, setStreamEnabled] = useState(false);

    // Simulated notification stream.
    useEffect(() => {
      if (!streamEnabled) return;

      const interval = window.setInterval(() => {
        dispatch(generate());
      }, 8000);

      return () => window.clearInterval(interval);
    }, [streamEnabled, dispatch]);

    // Tick handles snooze expiration and toast expiration.
    useEffect(() => {
      const interval = window.setInterval(() => {
        dispatch(tick(Date.now()));
      }, 1000);

      return () => window.clearInterval(interval);
    }, [dispatch]);

    const handleSnooze = (id: string) => {
      dispatch(snooze({ id, until: Date.now() + 30_000 }));
    };

    const handleGenerate = () => {
      dispatch(generate());
    };

    return (
      <main className="container">
        <p className="eyebrow">Redux Toolkit · Challenge 07 · Hard</p>

        <h1>Simulated Notification Center</h1>

        <p className="subtitle">
          Listener middleware, notification lifecycle, scheduling simulation
        </p>

        <section className="panel">
          <h2>Notification overview</h2>

          <p>
            Unread notifications: <strong>{unreadCount}</strong>
          </p>

          <p>
            Showing {notifications.length} notification(s)
          </p>

          <button type="button" onClick={handleGenerate}>
            Generate notification
          </button>

          <button
            type="button"
            onClick={() => setStreamEnabled(enabled => !enabled)}
          >
            {streamEnabled ? 'Stop automatic stream' : 'Start automatic stream'}
          </button>

          <button type="button" onClick={() => dispatch(markAllRead())}>
            Mark all read
          </button>
        </section>

        <section className="panel">
          <h2>Filters</h2>

          <label htmlFor="priority-filter">Priority</label>
          <select
            id="priority-filter"
            value={filters.priority}
            onChange={event =>
              dispatch(
                setPriorityFilter(event.target.value as Priority | 'all'),
              )
            }
          >
            <option value="all">All priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>

          <label htmlFor="category-filter">Category</label>
          <select
            id="category-filter"
            value={filters.category}
            onChange={event =>
              dispatch(
                setCategoryFilter(event.target.value as Category | 'all'),
              )
            }
          >
            <option value="all">All categories</option>
            <option value="system">System</option>
            <option value="social">Social</option>
            <option value="security">Security</option>
            <option value="updates">Updates</option>
          </select>

          <label htmlFor="status-filter">Status</label>
          <select
            id="status-filter"
            value={filters.status}
            onChange={event =>
              dispatch(
                setStatusFilter(
                  event.target.value as
                    | 'all'
                    | 'read'
                    | 'unread'
                    | 'archived'
                    | 'active',
                ),
              )
            }
          >
            <option value="all">All notifications</option>
            <option value="active">Active</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
            <option value="archived">Archived</option>
          </select>

          <button type="button" onClick={() => dispatch(resetFilters())}>
            Reset filters
          </button>
        </section>

        <section className="panel">
          <h2>Notifications</h2>

          {notifications.length === 0 ? (
            <p>No notifications match your filters.</p>
          ) : (
            Object.entries(groupedNotifications).map(([day, dayNotices]) => (
              <div key={day}>
                <h3>{day}</h3>

                {dayNotices.map(notice => (
                  <article
                    key={notice.id}
                    className="panel"
                    style={{
                      marginBottom: '12px',
                      opacity: notice.read ? 0.7 : 1,
                      borderLeft: `4px solid ${priorityColors[notice.priority]}`,
                    }}
                  >
                    <div>
                      <strong>{notice.text}</strong>

                      <p>
                        {formatTime(notice.createdAt)} · {notice.category} ·{' '}
                        <span style={{ color: priorityColors[notice.priority] }}>
                          {notice.priority.toUpperCase()}
                        </span>
                      </p>

                      <p>
                        {notice.read ? 'Read' : 'Unread'} ·{' '}
                        {notice.archived ? 'Archived' : 'Active'}
                      </p>

                      {notice.snoozedUntil !== null && (
                        <p>
                          Snoozed until {formatTime(notice.snoozedUntil)}
                        </p>
                      )}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        marginTop: '12px',
                      }}
                    >
                      {notice.read ? (
                        <button
                          type="button"
                          onClick={() => dispatch(markUnread(notice.id))}
                        >
                          Mark unread
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => dispatch(markRead(notice.id))}
                        >
                          Mark read
                        </button>
                      )}

                      {!notice.archived && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleSnooze(notice.id)}
                          >
                            Snooze 30 sec
                          </button>

                          <button
                            type="button"
                            onClick={() => dispatch(archive(notice.id))}
                          >
                            Archive
                          </button>
                        </>
                      )}

                      {notice.archived && (
                        <button
                          type="button"
                          onClick={() => dispatch(restore(notice.id))}
                        >
                          Restore
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          dispatch(deleteNotification(notice.id))
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ))
          )}
        </section>

        <section className="panel">
          <h2>Toast notifications</h2>

          <button
            type="button"
            onClick={() => dispatch(toggleToastPause())}
          >
            {toastsPaused ? 'Resume toast timer' : 'Pause toast timer'}
          </button>

          {toasts.length === 0 ? (
            <p>No active toasts.</p>
          ) : (
            toasts.map(toast => (
              <div
                key={toast.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px',
                  marginTop: '10px',
                  border: '1px solid currentColor',
                  borderRadius: '8px',
                }}
              >
                <span>{toast.text}</span>

                <button
                  type="button"
                  onClick={() => dispatch(dismissToast(toast.id))}
                >
                  Dismiss
                </button>
              </div>
            ))
          )}
        </section>
      </main>
    );
  }
