import React, { useState } from 'react';
import { store, useAppDispatch, useAppSelector } from './app/store';
import {
  addTask, editTask, deleteTask, moveTask, undo, redo,
  setFilter, clearFilters, dismissFeedback,
  selectVisibleColumns, selectLabels, selectFiltersActive,
  COLUMNS, COLUMN_TITLES, PRIORITIES, ASSIGNEES, MAX_HISTORY,
  type ColumnId, type Priority, type Task, type VisibleCard,
} from './features/boardSlice';
import './style.css';

const input: React.CSSProperties = {
  padding: 8, background: '#2d3950', border: '1px solid #344056', color: '#e9eefa', borderRadius: 6,
};
const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', fontSize: 12, gap: 2 };
const small: React.CSSProperties = { padding: '5px 10px', fontSize: 13, borderRadius: 8 };
const tiny: React.CSSProperties = { padding: '3px 8px', fontSize: 12, borderRadius: 6 };
const note: React.CSSProperties = { fontSize: 13, opacity: 0.8 };

const PRIORITY_COLOR: Record<Priority, string> = { low: '#6bdc8f', medium: '#ffc107', high: '#ff6b6b' };

const toDraft = (t: Task) => ({
  title: t.title,
  assignee: t.assignee ?? '',
  priority: t.priority,
  dueDate: t.dueDate ?? '',
  labels: t.labels.join(', '),
});

function CardView({ card, col, size, canReorder }: {
  card: VisibleCard; col: ColumnId; size: number; canReorder: boolean;
}) {
  const dispatch = useAppDispatch();
  const { task, index, overdue } = card;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => toDraft(task));
  const colIdx = COLUMNS.indexOf(col);

  const save = () => {
    dispatch(editTask({
      id: task.id,
      changes: {
        title: draft.title,
        assignee: draft.assignee || null,
        priority: draft.priority,
        dueDate: draft.dueDate || null,
        labels: draft.labels.split(','),
      },
    }));
    // editTask always sets or clears feedback, so this reflects this edit's result
    if (store.getState().board.feedback?.kind !== 'error') setEditing(false);
  };

  const card_: React.CSSProperties = {
    background: '#101625', border: `1px solid ${overdue ? '#ff6b6b' : '#344056'}`,
    borderRadius: 10, padding: 10, marginBottom: 8,
  };

  if (editing) {
    return (
      <div style={card_}>
        <div style={{ display: 'grid', gap: 6 }}>
          <input style={input} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} aria-label="Title" />
          <select style={input} value={draft.assignee} onChange={e => setDraft(d => ({ ...d, assignee: e.target.value }))} aria-label="Assignee">
            <option value="">Unassigned</option>
            {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          <select style={input} value={draft.priority} onChange={e => setDraft(d => ({ ...d, priority: e.target.value as Priority }))} aria-label="Priority">
            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <input style={input} type="date" value={draft.dueDate} onChange={e => setDraft(d => ({ ...d, dueDate: e.target.value }))} aria-label="Due date" />
          <input style={input} placeholder="labels, comma separated" value={draft.labels} onChange={e => setDraft(d => ({ ...d, labels: e.target.value }))} aria-label="Labels" />
          <div style={row}>
            <button style={tiny} onClick={save}>Save</button>
            <button style={tiny} onClick={() => { setDraft(toDraft(task)); setEditing(false); }}>Cancel</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={card_}>
      <strong>{task.title}</strong>
      <div style={{ fontSize: 12, margin: '6px 0' }}>
        <span style={{ color: PRIORITY_COLOR[task.priority], fontWeight: 700 }}>{task.priority}</span>
        {' · '}{task.assignee ?? 'unassigned'}
      </div>
      {task.dueDate && (
        <div style={{ fontSize: 12, color: overdue ? '#ff6b6b' : undefined }}>
          Due {task.dueDate}{overdue ? ' (overdue)' : ''}
        </div>
      )}
      {task.labels.length > 0 && (
        <div style={{ fontSize: 12, opacity: 0.8 }}>{task.labels.map(l => `#${l}`).join(' ')}</div>
      )}
      <div style={{ ...row, marginTop: 8, marginBottom: 0, gap: 4 }}>
        <button
          style={tiny} aria-label={`Move ${task.title} left`} disabled={colIdx === 0}
          onClick={() => dispatch(moveTask({ id: task.id, toColumn: COLUMNS[colIdx - 1], toIndex: index }))}
        >◀</button>
        <button
          style={tiny} aria-label={`Move ${task.title} right`} disabled={colIdx === COLUMNS.length - 1}
          onClick={() => dispatch(moveTask({ id: task.id, toColumn: COLUMNS[colIdx + 1], toIndex: index }))}
        >▶</button>
        <button
          style={tiny} aria-label={`Move ${task.title} up`} disabled={!canReorder || index === 0}
          title={canReorder ? '' : 'Clear filters to reorder'}
          onClick={() => dispatch(moveTask({ id: task.id, toColumn: col, toIndex: index - 1 }))}
        >▲</button>
        <button
          style={tiny} aria-label={`Move ${task.title} down`} disabled={!canReorder || index === size - 1}
          title={canReorder ? '' : 'Clear filters to reorder'}
          onClick={() => dispatch(moveTask({ id: task.id, toColumn: col, toIndex: index + 1 }))}
        >▼</button>
        <button style={tiny} onClick={() => { setDraft(toDraft(task)); setEditing(true); }}>Edit</button>
        <button style={{ ...tiny, background: '#ff6b6b' }} onClick={() => dispatch(deleteTask(task.id))}>Delete</button>
      </div>
    </div>
  );
}

export default function App() {
  const dispatch = useAppDispatch();
  const feedback = useAppSelector(s => s.board.feedback);
  const filters = useAppSelector(s => s.board.filters);
  const undoCount = useAppSelector(s => s.board.past.length);
  const redoCount = useAppSelector(s => s.board.future.length);
  const visible = useAppSelector(selectVisibleColumns);
  const columns = useAppSelector(s => s.board.present.columns);
  const labels = useAppSelector(selectLabels);
  const filtersActive = useAppSelector(selectFiltersActive);

  const emptyForm = { title: '', assignee: '', priority: 'medium' as Priority, dueDate: '', labels: '' };
  const [form, setForm] = useState(emptyForm);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const before = store.getState().board.present.tasks.ids.length;
    dispatch(addTask({
      title: form.title,
      assignee: form.assignee || null,
      priority: form.priority,
      dueDate: form.dueDate || null,
      labels: form.labels.split(','),
    }));
    if (store.getState().board.present.tasks.ids.length > before) setForm(emptyForm);
  };

  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 04 · Hard</p>
      <h1>Kanban Board & Time Travel</h1>
      <p className="subtitle">createEntityAdapter, task ordering, undo/redo</p>

      {feedback && (
        <div
          role={feedback.kind === 'error' ? 'alert' : 'status'}
          style={{
            background: feedback.kind === 'error' ? '#4a1d1d' : '#1d4a2b',
            color: '#fff', padding: '10px 15px', borderRadius: 6, marginBottom: 20,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8,
          }}
        >
          <span>{feedback.text}</span>
          <button style={small} onClick={() => dispatch(dismissFeedback())}>Dismiss</button>
        </div>
      )}

      <section className="panel">
        <h2>Time travel</h2>
        <div style={row}>
          <button disabled={undoCount === 0} onClick={() => dispatch(undo())}>Undo ({undoCount})</button>
          <button disabled={redoCount === 0} onClick={() => dispatch(redo())}>Redo ({redoCount})</button>
        </div>
        <p style={note}>
          Keeps the last {MAX_HISTORY} board states. Adding, editing, deleting and moving tasks are undoable. A new edit clears redo. Filters are not.
        </p>
      </section>

      <section className="panel">
        <h2>Add task</h2>
        <form onSubmit={handleAdd} style={{ ...row, alignItems: 'flex-end' }}>
          <label style={field}>
            Title
            <input style={input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          </label>
          <label style={field}>
            Assignee
            <select style={input} value={form.assignee} onChange={e => setForm(f => ({ ...f, assignee: e.target.value }))}>
              <option value="">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label style={field}>
            Priority
            <select style={input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as Priority }))}>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label style={field}>
            Due date
            <input style={input} type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
          </label>
          <label style={field}>
            Labels (comma separated)
            <input style={input} value={form.labels} onChange={e => setForm(f => ({ ...f, labels: e.target.value }))} />
          </label>
          <button type="submit">Add to Todo</button>
        </form>
        <p style={note}>Try an empty title to see validation.</p>
      </section>

      <section className="panel">
        <h2>Filters</h2>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <label style={field}>
            Assignee
            <select style={input} value={filters.assignee} onChange={e => dispatch(setFilter({ assignee: e.target.value }))}>
              <option value="all">All</option>
              <option value="unassigned">Unassigned</option>
              {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
          <label style={field}>
            Priority
            <select style={input} value={filters.priority} onChange={e => dispatch(setFilter({ priority: e.target.value as 'all' | Priority }))}>
              <option value="all">All</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <label style={field}>
            Label
            <select style={input} value={filters.label} onChange={e => dispatch(setFilter({ label: e.target.value }))}>
              <option value="all">All</option>
              {labels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </label>
          <label>
            <input type="checkbox" checked={filters.overdueOnly} onChange={e => dispatch(setFilter({ overdueOnly: e.target.checked }))} /> Overdue only
          </label>
          <button style={small} disabled={!filtersActive} onClick={() => dispatch(clearFilters())}>Clear filters</button>
        </div>
        {filtersActive && <p style={note}>Filters active. Reordering (▲ ▼) is disabled so positions stay unambiguous.</p>}
      </section>

      <section className="panel">
        <h2>Board</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
          {COLUMNS.map(col => (
            <div key={col}>
              <h3 style={{ marginTop: 0 }}>
                {COLUMN_TITLES[col]} <span style={{ fontWeight: 400, opacity: 0.7 }}>({visible[col].length}/{columns[col].length})</span>
              </h3>
              {visible[col].length === 0 ? (
                <p style={note}>{columns[col].length === 0 ? 'Empty' : 'No tasks match the filters'}</p>
              ) : (
                visible[col].map(card => (
                  <CardView
                    key={card.task.id}
                    card={card}
                    col={col}
                    size={columns[col].length}
                    canReorder={!filtersActive}
                  />
                ))
              )}
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}