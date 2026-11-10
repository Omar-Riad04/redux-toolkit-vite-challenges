import {
  createSlice,
  createEntityAdapter,
  createSelector,
  nanoid,
  current,
  type PayloadAction,
} from '@reduxjs/toolkit';

// ---------- Types & constants ----------
export const COLUMNS = ['todo', 'inProgress', 'review', 'done'] as const;
export type ColumnId = (typeof COLUMNS)[number];
export const COLUMN_TITLES: Record<ColumnId, string> = {
  todo: 'Todo',
  inProgress: 'In Progress',
  review: 'Review',
  done: 'Done',
};

export const PRIORITIES = ['low', 'medium', 'high'] as const;
export type Priority = (typeof PRIORITIES)[number];
export const ASSIGNEES = ['Alice', 'Bob', 'Carol'] as const;

export const MAX_HISTORY = 20;
export const STORAGE_KEY = 'kanban_state';
export const SCHEMA_VERSION = 1;

export interface Task {
  id: string;
  title: string;
  assignee: string | null;
  priority: Priority;
  dueDate: string | null; // YYYY-MM-DD
  labels: string[];
}

export type TaskInput = Omit<Task, 'id'>;

const tasksAdapter = createEntityAdapter<Task>();
type TasksState = ReturnType<typeof tasksAdapter.getInitialState>;

/** Everything undo/redo covers. */
export interface BoardData {
  tasks: TasksState; // normalized entities
  columns: Record<ColumnId, string[]>; // ordered task ids
}

export interface Filters {
  assignee: string; // 'all' | 'unassigned' | a name
  priority: 'all' | Priority;
  label: string; // 'all' | a label
  overdueOnly: boolean;
}

export interface Feedback {
  kind: 'error' | 'success';
  text: string;
}

export interface BoardState {
  past: BoardData[]; // oldest first, capped at MAX_HISTORY
  present: BoardData;
  future: BoardData[];
  filters: Filters;
  feedback: Feedback | null;
}

export interface Snapshot {
  version: number;
  tasks: Task[];
  columns: Record<ColumnId, string[]>;
}

// ---------- Validation helpers ----------
const emptyColumns = (): Record<ColumnId, string[]> => ({
  todo: [],
  inProgress: [],
  review: [],
  done: [],
});

const isDate = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const normLabels = (labels: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const l of labels) {
    const t = l.trim().toLowerCase();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  return out;
};

type FieldResult = { ok: true; value: TaskInput } | { ok: false; error: string };
const fail = (error: string): FieldResult => ({ ok: false, error });

/** Shared by reducers and by the localStorage parser. */
export function checkFields(f: TaskInput): FieldResult {
  const title = typeof f.title === 'string' ? f.title.trim() : '';
  if (!title) return fail('Title is required.');
  if (title.length > 100) return fail('Title must be 100 characters or fewer.');
  if (f.assignee !== null && !(ASSIGNEES as readonly string[]).includes(f.assignee)) {
    return fail('Unknown assignee.');
  }
  if (!(PRIORITIES as readonly string[]).includes(f.priority)) return fail('Priority must be low, medium or high.');
  if (f.dueDate !== null && !isDate(f.dueDate)) return fail('Due date must be a real date (YYYY-MM-DD).');
  if (!Array.isArray(f.labels) || f.labels.some(l => typeof l !== 'string')) return fail('Labels must be text.');
  return {
    ok: true,
    value: { title, assignee: f.assignee, priority: f.priority, dueDate: f.dueDate, labels: normLabels(f.labels) },
  };
}

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** A task is overdue when its due date has passed and it isn't in Done. */
const isOverdue = (t: Task, col: ColumnId, today: string) =>
  t.dueDate !== null && t.dueDate < today && col !== 'done';

// ---------- Persistence parsing (validates orphan IDs) ----------
export type ParseResult =
  | { ok: true; data: BoardData; repairs: string[] }
  | { ok: false; error: string };

export function parseBoard(raw: string | null): ParseResult {
  if (!raw) return { ok: false, error: 'Empty input' };
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: 'Not valid JSON' };
  }
  if (!parsed || typeof parsed !== 'object' || parsed.version !== SCHEMA_VERSION) {
    return { ok: false, error: 'Unsupported or missing version' };
  }
  if (!Array.isArray(parsed.tasks) || !parsed.columns || typeof parsed.columns !== 'object') {
    return { ok: false, error: 'Missing tasks or columns' };
  }

  const repairs: string[] = [];
  const tasks: Task[] = [];
  const known = new Set<string>();

  for (const t of parsed.tasks) {
    if (!t || typeof t.id !== 'string' || !t.id || known.has(t.id)) {
      repairs.push('Dropped a task with a missing or duplicate id');
      continue;
    }
    const r = checkFields({
      title: t.title,
      assignee: t.assignee ?? null,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      labels: t.labels ?? [],
    });
    if (!r.ok) {
      repairs.push(`Dropped task "${t.id}": ${r.error}`);
      continue;
    }
    known.add(t.id);
    tasks.push({ id: t.id, ...r.value });
  }

  const columns = emptyColumns();
  const placed = new Set<string>();
  for (const col of COLUMNS) {
    const ids: unknown[] = Array.isArray(parsed.columns[col]) ? parsed.columns[col] : [];
    for (const id of ids) {
      if (typeof id !== 'string' || !known.has(id)) {
        repairs.push(`Removed orphan id "${String(id)}" from ${col}`);
      } else if (placed.has(id)) {
        repairs.push(`Removed duplicate id "${id}" from ${col}`);
      } else {
        placed.add(id);
        columns[col].push(id);
      }
    }
  }
  for (const t of tasks) {
    if (!placed.has(t.id)) {
      columns.todo.push(t.id);
      repairs.push(`Task "${t.id}" was in no column; moved to Todo`);
    }
  }

  return {
    ok: true,
    data: { tasks: tasksAdapter.setAll(tasksAdapter.getInitialState(), tasks), columns },
    repairs,
  };
}

// ---------- Initial state ----------
const defaultFilters: Filters = { assignee: 'all', priority: 'all', label: 'all', overdueOnly: false };

const seedTasks: Task[] = [
  { id: 't1', title: 'Set up normalized entities', assignee: 'Alice', priority: 'high', dueDate: '2020-01-15', labels: ['setup'] },
  { id: 't2', title: 'Design column model', assignee: 'Bob', priority: 'medium', dueDate: '2099-12-31', labels: ['design'] },
  { id: 't3', title: 'Write reducers', assignee: 'Alice', priority: 'medium', dueDate: null, labels: ['dev'] },
  { id: 't4', title: 'Build the UI', assignee: 'Carol', priority: 'high', dueDate: '2099-06-01', labels: ['dev', 'ui'] },
  { id: 't5', title: 'Review undo/redo', assignee: 'Bob', priority: 'low', dueDate: '2020-02-01', labels: ['review'] },
  { id: 't6', title: 'Read the README', assignee: 'Carol', priority: 'low', dueDate: '2020-01-01', labels: ['setup'] },
];

const fromData = (data: BoardData): BoardState => ({
  past: [],
  present: data,
  future: [],
  filters: { ...defaultFilters },
  feedback: null,
});

/** Pure and exported so tests don't depend on localStorage. */
export const seedState = (): BoardState =>
  fromData({
    tasks: tasksAdapter.setAll(tasksAdapter.getInitialState(), seedTasks),
    columns: { todo: ['t1', 't2', 't3'], inProgress: ['t4'], review: ['t5'], done: ['t6'] },
  });

const loadInitialState = (): BoardState => {
  try {
    const result = parseBoard(localStorage.getItem(STORAGE_KEY));
    if (result.ok) {
      const s = fromData(result.data);
      if (result.repairs.length > 0) {
        s.feedback = {
          kind: 'success',
          text: `Restored saved board with ${result.repairs.length} repair(s): ${result.repairs.join('; ')}`,
        };
      }
      return s;
    }
  } catch {
    /* localStorage unavailable */
  }
  return seedState();
};

// ---------- History helper ----------
/** Call BEFORE mutating `present`. Snapshots it, caps the history and clears redo. */
const record = (s: BoardState) => {
  s.past.push(current(s.present));
  if (s.past.length > MAX_HISTORY) s.past.splice(0, s.past.length - MAX_HISTORY);
  s.future = [];
};

const setError = (s: BoardState, text: string) => {
  s.feedback = { kind: 'error', text };
};

const sameFields = (a: TaskInput, b: TaskInput) =>
  a.title === b.title &&
  a.assignee === b.assignee &&
  a.priority === b.priority &&
  a.dueDate === b.dueDate &&
  JSON.stringify(a.labels) === JSON.stringify(b.labels);

// ---------- Slice ----------
export const boardSlice = createSlice({
  name: 'board',
  initialState: loadInitialState(),
  reducers: {
    addTask: {
      reducer(s, action: PayloadAction<TaskInput & { id: string }>) {
        const { id, ...fields } = action.payload;
        const r = checkFields(fields);
        if (!r.ok) {
          setError(s, r.error);
          return;
        }
        record(s);
        tasksAdapter.addOne(s.present.tasks, { id, ...r.value });
        s.present.columns.todo.push(id);
        s.feedback = null;
      },
      prepare: (input: TaskInput) => ({ payload: { ...input, id: nanoid() } }),
    },

    editTask: (s, action: PayloadAction<{ id: string; changes: Partial<TaskInput> }>) => {
      const t = s.present.tasks.entities[action.payload.id];
      if (!t) {
        setError(s, 'Task not found.');
        return;
      }
      const merged: TaskInput = {
        title: t.title,
        assignee: t.assignee,
        priority: t.priority,
        dueDate: t.dueDate,
        labels: [...t.labels],
        ...action.payload.changes,
      };
      const r = checkFields(merged);
      if (!r.ok) {
        setError(s, r.error);
        return;
      }
      s.feedback = null;
      if (sameFields(r.value, t)) return; // nothing changed, so no history entry
      record(s);
      tasksAdapter.updateOne(s.present.tasks, { id: t.id, changes: r.value });
    },

    deleteTask: (s, action: PayloadAction<string>) => {
      const id = action.payload;
      if (!s.present.tasks.entities[id]) {
        setError(s, 'Task not found.');
        return;
      }
      record(s);
      tasksAdapter.removeOne(s.present.tasks, id);
      for (const col of COLUMNS) {
        s.present.columns[col] = s.present.columns[col].filter(x => x !== id);
      }
      s.feedback = null;
    },

    /**
     * Moves a task to `toIndex` of `toColumn`. Used for both cross-column moves and
     * in-column reordering. `toIndex` is the position in the destination list after
     * the task has been taken out of its old spot, clamped to the valid range.
     * Every other task keeps its relative order.
     */
    moveTask: (s, action: PayloadAction<{ id: string; toColumn: ColumnId; toIndex: number }>) => {
      const { id, toColumn, toIndex } = action.payload;
      const cols = s.present.columns;
      if (!s.present.tasks.entities[id]) {
        setError(s, 'Task not found.');
        return;
      }
      if (!(COLUMNS as readonly string[]).includes(toColumn)) {
        setError(s, 'Unknown column.');
        return;
      }
      if (!Number.isFinite(toIndex)) {
        setError(s, 'Invalid position.');
        return;
      }
      const from = COLUMNS.find(c => cols[c].includes(id));
      if (!from) {
        setError(s, 'Task is not in any column.');
        return;
      }
      const fromIdx = cols[from].indexOf(id);
      const destLen = from === toColumn ? cols[from].length - 1 : cols[toColumn].length;
      const idx = Math.max(0, Math.min(Math.floor(toIndex), destLen));
      s.feedback = null;
      if (from === toColumn && idx === fromIdx) return; // no-op, so no history entry

      record(s);
      cols[from].splice(fromIdx, 1);
      cols[toColumn].splice(idx, 0, id);
    },

    undo: s => {
      const prev = s.past.pop();
      if (!prev) return;
      s.future.push(current(s.present));
      s.present = prev;
      s.feedback = null;
    },

    redo: s => {
      const next = s.future.pop();
      if (!next) return;
      s.past.push(current(s.present));
      if (s.past.length > MAX_HISTORY) s.past.splice(0, s.past.length - MAX_HISTORY);
      s.present = next;
      s.feedback = null;
    },

    // Filters are view state, so they never enter the undo history.
    setFilter: (s, action: PayloadAction<Partial<Filters>>) => {
      s.filters = { ...s.filters, ...action.payload };
    },
    clearFilters: s => {
      s.filters = { ...defaultFilters };
    },
    dismissFeedback: s => {
      s.feedback = null;
    },
  },
});

export const {
  addTask, editTask, deleteTask, moveTask, undo, redo,
  setFilter, clearFilters, dismissFeedback,
} = boardSlice.actions;

// ---------- Selectors ----------
type Root = { board: BoardState };

const taskSelectors = tasksAdapter.getSelectors((s: Root) => s.board.present.tasks);
export const selectAllTasks = taskSelectors.selectAll;
const selectEntities = taskSelectors.selectEntities;
const selectColumns = (s: Root) => s.board.present.columns;
const selectFilters = (s: Root) => s.board.filters;

export interface VisibleCard {
  task: Task;
  index: number; // position in the FULL (unfiltered) column
  overdue: boolean;
}

/**
 * Columns after filtering. Overdue is computed against today's date when the selector
 * recomputes, so a board left open past midnight updates on the next change.
 */
export const selectVisibleColumns = createSelector(
  [selectEntities, selectColumns, selectFilters],
  (entities, columns, f) => {
    const today = todayISO();
    const out = {} as Record<ColumnId, VisibleCard[]>;
    for (const col of COLUMNS) {
      out[col] = [];
      columns[col].forEach((id, index) => {
        const task = entities[id];
        if (!task) return; // orphan id: never rendered
        const overdue = isOverdue(task, col, today);
        if (f.assignee === 'unassigned' ? task.assignee !== null : f.assignee !== 'all' && task.assignee !== f.assignee) return;
        if (f.priority !== 'all' && task.priority !== f.priority) return;
        if (f.label !== 'all' && !task.labels.includes(f.label)) return;
        if (f.overdueOnly && !overdue) return;
        out[col].push({ task, index, overdue });
      });
    }
    return out;
  }
);

export const selectLabels = createSelector([selectAllTasks], tasks =>
  Array.from(new Set(tasks.flatMap(t => t.labels))).sort((a, b) => a.localeCompare(b))
);

export const selectFiltersActive = createSelector(
  [selectFilters],
  f => f.assignee !== 'all' || f.priority !== 'all' || f.label !== 'all' || f.overdueOnly
);

export const selectSnapshot = createSelector(
  [selectAllTasks, selectColumns],
  (tasks, columns): Snapshot => ({ version: SCHEMA_VERSION, tasks, columns })
);

export default boardSlice.reducer;