
import { createSlice, nanoid, type PayloadAction } from '@reduxjs/toolkit';

export type SeatStatus = 'available' | 'unavailable' | 'held' | 'booked';

export type Seat = {
  id: string;
  row: string;
  number: number;
  status: SeatStatus;
};

export type Booking = {
  id: string;
  seats: string[];
  createdAt: number;
  unitPrice: number;
  total: number;
};

export type SeatState = {
  seats: Seat[];
  selected: string[];
  selectionHistory: string[][];
  maxSeats: number;
  holdExpiresAt: number | null;
  bookings: Booking[];
};

export const SEATS_STORAGE_KEY = 'challenge09-confirmed-bookings';

export const HOLD_DURATION = 2 * 60 * 1000;

const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];
const SEATS_PER_ROW = 10;

function createSeats(bookings: Booking[] = []): Seat[] {
  const bookedIds = new Set(bookings.flatMap(booking => booking.seats));

  return ROWS.flatMap(row =>
    Array.from({ length: SEATS_PER_ROW }, (_, index) => {
      const number = index + 1;
      const id = `${row}${number}`;

      let status: SeatStatus = 'available';

      if (id === 'A3' || id === 'B4' || bookedIds.has(id)) {
        status = 'booked';
      }

      if (id === 'A1' || id === 'C7') {
        status = 'unavailable';
      }

      return { id, row, number, status };
    }),
  );
}

function isValidSeatId(id: string) {
  return /^[A-F](10|[1-9])$/.test(id);
}

function isAdjacent(seatIds: string[]) {
  if (seatIds.length === 0) return true;

  const sorted = [...seatIds].sort((a, b) => {
    const rowA = a.charAt(0);
    const rowB = b.charAt(0);

    if (rowA !== rowB) return rowA.localeCompare(rowB);

    return Number(a.slice(1)) - Number(b.slice(1));
  });

  const row = sorted[0].charAt(0);

  if (sorted.some(id => id.charAt(0) !== row)) return false;

  const numbers = sorted.map(id => Number(id.slice(1)));

  for (let i = 1; i < numbers.length; i++) {
    if (numbers[i] !== numbers[i - 1] + 1) return false;
  }

  return true;
}

export function getUnitPrice(count: number) {
  if (count >= 5) return 11;
  if (count >= 3) return 13;
  return 15;
}

export function loadBookings(): Booking[] {
  try {
    if (typeof localStorage === 'undefined') return [];

    const saved = localStorage.getItem(SEATS_STORAGE_KEY);

    if (!saved) return [];

    const parsed: unknown = JSON.parse(saved);

    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (booking): booking is Booking =>
        booking &&
        typeof booking.id === 'string' &&
        typeof booking.createdAt === 'number' &&
        Array.isArray(booking.seats) &&
        booking.seats.length >= 1 &&
        booking.seats.every(
          (id: unknown) =>
            typeof id === 'string' && isValidSeatId(id),
        ) &&
        typeof booking.unitPrice === 'number' &&
        typeof booking.total === 'number',
    );
  } catch {
    return [];
  }
}

function createInitialState(): SeatState {
  const bookings = loadBookings();

  return {
    seats: createSeats(bookings),
    selected: [],
    selectionHistory: [],
    maxSeats: 6,
    holdExpiresAt: null,
    bookings,
  };
}

function pushHistory(state: SeatState) {
  state.selectionHistory.push([...state.selected]);

  // Keep the undo history small.
  if (state.selectionHistory.length > 20) {
    state.selectionHistory.shift();
  }
}

const seatsSlice = createSlice({
  name: 'seats',
  initialState: createInitialState(),

  reducers: {
    toggleSeat(state, action: PayloadAction<string>) {
      const id = action.payload;
      const seat = state.seats.find(item => item.id === id);

      if (!seat || seat.status !== 'available') return;
      if (state.holdExpiresAt !== null) return;

      if (state.selected.includes(id)) {
        // Only allow removing an endpoint, preserving adjacency.
        const sorted = [...state.selected].sort(
          (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
        );

        if (id !== sorted[0] && id !== sorted[sorted.length - 1]) {
          return;
        }

        pushHistory(state);
        state.selected = state.selected.filter(item => item !== id);
        return;
      }

      if (state.selected.length >= state.maxSeats) return;

      const nextSelection = [...state.selected, id];

      if (!isAdjacent(nextSelection)) return;

      pushHistory(state);
      state.selected = nextSelection.sort(
        (a, b) => Number(a.slice(1)) - Number(b.slice(1)),
      );
    },

    undoSelection(state) {
      if (state.holdExpiresAt !== null) return;

      const previous = state.selectionHistory.pop();

      if (previous) {
        state.selected = previous;
      }
    },

    holdSelected: {
      prepare() {
        const now = Date.now();

        return {
          payload: {
            now,
            expiresAt: now + HOLD_DURATION,
          },
        };
      },

      reducer(
        state,
        action: PayloadAction<{ now: number; expiresAt: number }>,
      ) {
        if (
          state.selected.length === 0 ||
          state.holdExpiresAt !== null
        ) {
          return;
        }

        if (state.selected.length > state.maxSeats) return;
        if (!isAdjacent(state.selected)) return;

        const selectedSeats = state.seats.filter(seat =>
          state.selected.includes(seat.id),
        );

        if (
          selectedSeats.length !== state.selected.length ||
          selectedSeats.some(seat => seat.status !== 'available')
        ) {
          return;
        }

        selectedSeats.forEach(seat => {
          seat.status = 'held';
        });

        state.holdExpiresAt = action.payload.expiresAt;
        state.selectionHistory = [];
      },
    },

    releaseHold(state) {
      if (state.holdExpiresAt === null) return;

      state.seats.forEach(seat => {
        if (state.selected.includes(seat.id) && seat.status === 'held') {
          seat.status = 'available';
        }
      });

      state.selected = [];
      state.selectionHistory = [];
      state.holdExpiresAt = null;
    },

    confirmBooking: {
      prepare() {
        return {
          payload: {
            id: nanoid(),
            createdAt: Date.now(),
          },
        };
      },

      reducer(
        state,
        action: PayloadAction<{ id: string; createdAt: number }>,
      ) {
        if (
          state.holdExpiresAt === null ||
          state.holdExpiresAt <= action.payload.createdAt ||
          state.selected.length === 0
        ) {
          return;
        }

        const selectedSeats = state.seats.filter(seat =>
          state.selected.includes(seat.id),
        );

        if (
          selectedSeats.length !== state.selected.length ||
          selectedSeats.some(seat => seat.status !== 'held') ||
          !isAdjacent(state.selected)
        ) {
          return;
        }

        const unitPrice = getUnitPrice(state.selected.length);

        const booking: Booking = {
          id: action.payload.id,
          seats: [...state.selected],
          createdAt: action.payload.createdAt,
          unitPrice,
          total: unitPrice * state.selected.length,
        };

        selectedSeats.forEach(seat => {
          seat.status = 'booked';
        });

        state.bookings.unshift(booking);
        state.selected = [];
        state.selectionHistory = [];
        state.holdExpiresAt = null;
      },
    },

    tick(state, action: PayloadAction<number>) {
      if (
        state.holdExpiresAt !== null &&
        action.payload >= state.holdExpiresAt
      ) {
        state.seats.forEach(seat => {
          if (
            state.selected.includes(seat.id) &&
            seat.status === 'held'
          ) {
            seat.status = 'available';
          }
        });

        state.selected = [];
        state.selectionHistory = [];
        state.holdExpiresAt = null;
      }
    },

    selectBestAvailable(state, action: PayloadAction<number>) {
      if (state.holdExpiresAt !== null) return;

      const count = Math.min(
        Math.max(action.payload, 1),
        state.maxSeats,
      );

      const candidates: string[][] = [];

      for (const row of ROWS) {
        for (
          let start = 1;
          start <= SEATS_PER_ROW - count + 1;
          start++
        ) {
          const block = Array.from(
            { length: count },
            (_, index) => `${row}${start + index}`,
          );

          const allAvailable = block.every(id =>
            state.seats.some(
              seat => seat.id === id && seat.status === 'available',
            ),
          );

          if (allAvailable) candidates.push(block);
        }
      }

      if (candidates.length === 0) return;

      // Closest block midpoint to the center of the row (5.5).
      // Ties: alphabetical row, then lowest starting seat.
      candidates.sort((a, b) => {
        const midpointA =
          (Number(a[0].slice(1)) + Number(a[a.length - 1].slice(1))) / 2;

        const midpointB =
          (Number(b[0].slice(1)) + Number(b[b.length - 1].slice(1))) / 2;

        const distanceA = Math.abs(midpointA - 5.5);
        const distanceB = Math.abs(midpointB - 5.5);

        if (distanceA !== distanceB) {
          return distanceA - distanceB;
        }

        if (a[0].charAt(0) !== b[0].charAt(0)) {
          return a[0].charAt(0).localeCompare(b[0].charAt(0));
        }

        return Number(a[0].slice(1)) - Number(b[0].slice(1));
      });

      pushHistory(state);
      state.selected = candidates[0];
    },

    clearSelection(state) {
      if (state.holdExpiresAt !== null) return;

      state.selected = [];
      state.selectionHistory = [];
    },
  },
});

export const {
  toggleSeat,
  undoSelection,
  holdSelected,
  releaseHold,
  confirmBooking,
  tick,
  selectBestAvailable,
  clearSelection,
} = seatsSlice.actions;

export default seatsSlice.reducer;

type SeatsRootState = {
  seats: SeatState;
};

export const selectSeatSummary = (state: SeatsRootState) => {
  const count = state.seats.selected.length;
  const unitPrice = getUnitPrice(count);

  return {
    count,
    unitPrice,
    total: count * unitPrice,
    selected: state.seats.selected,
    holdExpiresAt: state.seats.holdExpiresAt,
  };
};

export const selectAvailableCount = (state: SeatsRootState) =>
  state.seats.seats.filter(seat => seat.status === 'available').length;

export const selectBookedCount = (state: SeatsRootState) =>
  state.seats.seats.filter(seat => seat.status === 'booked').length;
