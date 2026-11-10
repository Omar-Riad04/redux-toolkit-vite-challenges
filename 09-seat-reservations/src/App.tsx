
import { useEffect, useState } from 'react';

import { useAppDispatch, useAppSelector } from './app/store';

import {
  toggleSeat,
  undoSelection,
  holdSelected,
  releaseHold,
  confirmBooking,
  tick,
  selectBestAvailable,
  clearSelection,
  selectSeatSummary,
} from './features/seatsSlice';

import './style.css';

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];

const getSeatColor = (status: string, selected: boolean) => {
  if (selected) return '#2563eb';

  switch (status) {
    case 'booked':
      return '#dc2626';
    case 'unavailable':
      return '#64748b';
    case 'held':
      return '#d97706';
    default:
      return '#16a34a';
  }
};

export default function App() {
  const dispatch = useAppDispatch();

  const { seats, selected, holdExpiresAt, bookings, maxSeats } =
    useAppSelector(state => state.seats);

  const summary = useAppSelector(selectSeatSummary);

  const [now, setNow] = useState(Date.now());

  // Simulated clock: updates every second and expires holds in Redux.
  useEffect(() => {
    const interval = window.setInterval(() => {
      const currentTime = Date.now();

      setNow(currentTime);
      dispatch(tick(currentTime));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [dispatch]);

  const remainingSeconds =
    holdExpiresAt === null
      ? 0
      : Math.max(0, Math.ceil((holdExpiresAt - now) / 1000));

  const formatCountdown = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;

    return `${String(minutes).padStart(2, '0')}:${String(
      remaining,
    ).padStart(2, '0')}`;
  };

  const getSeat = (id: string) =>
    seats.find(seat => seat.id === id);

  const handleConfirm = () => {
    dispatch(confirmBooking());
  };

  return (
    <main className="container">
      <p className="eyebrow">
        Redux Toolkit · Challenge 09 · Hard
      </p>

      <h1>Interactive Seat Reservation Simulator</h1>

      <p className="subtitle">
        Reservation invariants, allocation rules, expirations
      </p>

      <section className="panel">
        <h2>Cinema screen</h2>

        <div
          style={{
            width: '80%',
            maxWidth: '550px',
            margin: '20px auto 30px',
            padding: '12px',
            textAlign: 'center',
            borderRadius: '50% 50% 8px 8px',
            border: '2px solid currentColor',
            letterSpacing: '4px',
          }}
        >
          SCREEN
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            alignItems: 'center',
            overflowX: 'auto',
            padding: '8px',
          }}
        >
          {ROWS.map(row => (
            <div
              key={row}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <strong style={{ width: '20px' }}>{row}</strong>

              {seats
                .filter(seat => seat.row === row)
                .map(seat => {
                  const isSelected = selected.includes(seat.id);

                  return (
                    <button
                      key={seat.id}
                      type="button"
                      title={`${seat.id} - ${
                        isSelected ? 'Selected' : seat.status
                      }`}
                      aria-label={`Seat ${seat.id}, ${
                        isSelected ? 'selected' : seat.status
                      }`}
                      aria-pressed={isSelected}
                      disabled={
                        seat.status !== 'available' &&
                        !isSelected
                      }
                      onClick={() => dispatch(toggleSeat(seat.id))}
                      style={{
                        width: '38px',
                        height: '38px',
                        padding: '0',
                        border: isSelected
                          ? '3px solid #93c5fd'
                          : '1px solid transparent',
                        borderRadius: '8px 8px 4px 4px',
                        color: '#fff',
                        background: getSeatColor(
                          seat.status,
                          isSelected,
                        ),
                        cursor:
                          seat.status === 'available' || isSelected
                            ? 'pointer'
                            : 'not-allowed',
                        opacity:
                          seat.status === 'unavailable' ? 0.6 : 1,
                      }}
                    >
                      {seat.number}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            justifyContent: 'center',
            marginTop: '24px',
          }}
        >
          {[
            ['#16a34a', 'Available'],
            ['#2563eb', 'Selected'],
            ['#d97706', 'Held'],
            ['#dc2626', 'Booked'],
            ['#64748b', 'Unavailable'],
          ].map(([color, label]) => (
            <div
              key={label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <span
                style={{
                  width: '14px',
                  height: '14px',
                  borderRadius: '4px',
                  background: color,
                }}
              />
              <small>{label}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Reservation controls</h2>

        <p>
          Selected seats:{' '}
          <strong>{selected.join(', ') || 'None'}</strong>
        </p>

        <p>
          Maximum seats per booking: <strong>{maxSeats}</strong>
        </p>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            marginTop: '14px',
          }}
        >
          <button
            type="button"
            onClick={() => dispatch(selectBestAvailable(2))}
            disabled={holdExpiresAt !== null}
          >
            Best available (2 seats)
          </button>

          <button
            type="button"
            onClick={() => dispatch(undoSelection())}
            disabled={
              selected.length === 0 ||
              holdExpiresAt !== null
            }
          >
            Undo last selection
          </button>

          <button
            type="button"
            onClick={() => dispatch(clearSelection())}
            disabled={
              selected.length === 0 ||
              holdExpiresAt !== null
            }
          >
            Clear selection
          </button>
        </div>

        {holdExpiresAt === null ? (
          <button
            type="button"
            onClick={() => dispatch(holdSelected())}
            disabled={selected.length === 0}
            style={{ marginTop: '14px' }}
          >
            Hold selected seats for 2 minutes
          </button>
        ) : (
          <div style={{ marginTop: '18px' }}>
            <h3>Seats temporarily held</h3>

            <p>
              Time remaining:{' '}
              <strong>{formatCountdown(remainingSeconds)}</strong>
            </p>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '10px',
              }}
            >
              <button type="button" onClick={handleConfirm}>
                Confirm booking
              </button>

              <button
                type="button"
                onClick={() => dispatch(releaseHold())}
              >
                Release seats
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="panel">
        <h2>Booking summary</h2>

        <p>
          Selected seats: <strong>{summary.count}</strong>
        </p>

        <p>
          Seats: <strong>{summary.selected.join(', ') || 'None'}</strong>
        </p>

        <p>
          Price per seat: <strong>${summary.unitPrice}</strong>
        </p>

        <p>
          Total: <strong>${summary.total}</strong>
        </p>

        <small>
          Pricing: 1–2 seats $15 each · 3–4 seats $13 each ·
          5–6 seats $11 each.
        </small>
      </section>

      <section className="panel">
        <h2>Confirmed bookings</h2>

        {bookings.length === 0 ? (
          <p>No confirmed bookings yet.</p>
        ) : (
          bookings.map(booking => (
            <article
              key={booking.id}
              style={{
                border: '1px solid currentColor',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '12px',
              }}
            >
              <strong>Booking {booking.id}</strong>

              <p>Seats: {booking.seats.join(', ')}</p>

              <p>Price per seat: ${booking.unitPrice}</p>

              <p>Total: ${booking.total}</p>

              <small>
                {new Date(booking.createdAt).toLocaleString()}
              </small>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
