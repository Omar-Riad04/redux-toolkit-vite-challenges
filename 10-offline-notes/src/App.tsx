
import { useEffect, useMemo, useState } from 'react';
import {
  createNote,
  deleteNote,
  editArchivedCopy,
  editNote,
  importNotes,
  keepArchiveVersion,
  keepLocalVersion,
  mergeConflict,
  restoreRevision,
  selectAllNotes,
  selectConflicts,
  selectNoteSummary,
  selectSearchResults,
  selectSaveQueue,
  syncToLocalArchive,
  toggleArchive,
  togglePin,
  type Note,
} from './features/notesSlice';
import { useAppDispatch, useAppSelector } from './app/store';
import './style.css';

export default function App() {
  const dispatch = useAppDispatch();

  const allNotes = useAppSelector(selectAllNotes);
  const queue = useAppSelector(selectSaveQueue);
  const conflicts = useAppSelector(selectConflicts);
  const summary = useAppSelector(selectNoteSummary);

  const [selectedId, setSelectedId] = useState<string | null>(
    allNotes[0]?.id ?? null
  );
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [textDraft, setTextDraft] = useState('');
  const [tagsDraft, setTagsDraft] = useState('');
  const [mergeDrafts, setMergeDrafts] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');

  const selected = useAppSelector(state =>
    selectedId ? state.notes.entities[selectedId] : undefined
  );

  const selectedArchive = useAppSelector(state =>
    selectedId ? state.notes.archive[selectedId] : undefined
  );

  const revisions = useAppSelector(state =>
    selectedId ? state.notes.revisions[selectedId] ?? [] : []
  );

  const searchResults = useAppSelector(state =>
    selectSearchResults(state, search)
  );

  const visibleNotes = useMemo(
    () =>
      searchResults
        .filter(note => showArchived || !note.archived)
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return Number(b.pinned) - Number(a.pinned);
          return b.updatedAt - a.updatedAt;
        }),
    [searchResults, showArchived]
  );

  useEffect(() => {
    if (selected) {
      setTitleDraft(selected.title);
      setTextDraft(selected.text);
      setTagsDraft(selected.tags.join(', '));
    } else {
      setTitleDraft('');
      setTextDraft('');
      setTagsDraft('');
    }
  }, [selected?.id, selected?.revision]);

  function handleCreateNote() {
    const action = dispatch(createNote());
    setSelectedId(action.payload.id);
    setShowArchived(false);
    setMessage('New note created. It is waiting in the local save queue.');
  }

  function handleSave() {
    if (!selected) return;

    const tags = [
      ...new Set(
        tagsDraft
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean)
      ),
    ];

    dispatch(
      editNote({
        id: selected.id,
        title: titleDraft.trim() || 'Untitled note',
        text: textDraft,
        tags,
      })
    );

    setMessage('Changes saved locally and added to the queue.');
  }

  function handleExport() {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      notes: allNotes,
    };

    const blob = new Blob(
      [JSON.stringify(payload, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'offline-notes-export.json';
    link.click();
    URL.revokeObjectURL(url);

    setMessage('Notes exported as JSON.');
  }

  async function handleImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const parsed: unknown = JSON.parse(content);

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        (parsed as { version?: unknown }).version !== 1 ||
        !Array.isArray((parsed as { notes?: unknown }).notes)
      ) {
        setMessage('Import rejected: invalid JSON export format.');
        return;
      }

      const notes = (parsed as { notes: unknown[] }).notes;
      const valid = notes.every(note => {
        if (!note || typeof note !== 'object') return false;

        const value = note as Record<string, unknown>;

        return (
          typeof value.id === 'string' &&
          typeof value.title === 'string' &&
          typeof value.text === 'string' &&
          typeof value.revision === 'number' &&
          typeof value.pinned === 'boolean' &&
          typeof value.archived === 'boolean' &&
          Array.isArray(value.tags) &&
          value.tags.every(tag => typeof tag === 'string') &&
          typeof value.updatedAt === 'number'
        );
      });

      if (!valid) {
        setMessage('Import rejected: one or more notes have invalid fields.');
        return;
      }

      dispatch(importNotes(parsed));
      setMessage(`${notes.length} note(s) imported and queued locally.`);
    } catch {
      setMessage('Import failed: the selected file is not valid JSON.');
    } finally {
      event.target.value = '';
    }
  }

  function handleSimulateArchiveEdit(note: Note) {
    if (!selectedArchive) {
      setMessage('Sync this note to the archive before simulating an archive edit.');
      return;
    }

    dispatch(
      editArchivedCopy({
        id: note.id,
        text: `${selectedArchive.text}\n\n[Edited separately in the local archive]`,
      })
    );

    setMessage('Archive copy edited separately. Edit the local note and sync to create a conflict.');
  }

  const isDirty =
    !!selected &&
    (
      titleDraft !== selected.title ||
      textDraft !== selected.text ||
      tagsDraft !== selected.tags.join(', ')
    );

  return (
    <main className="container" style={{ maxWidth: 1200, margin: '0 auto', padding: 24 }}>
      <p className="eyebrow">Redux Toolkit · Challenge 10 · Hard+</p>
      <h1>Offline Notes &amp; Version History</h1>
      <p className="subtitle">
        Everything is stored locally. Syncing copies notes to a simulated local archive.
      </p>

      <section className="panel" style={panelStyle}>
        <h2>Local status</h2>
        <div style={statsStyle}>
          <Stat label="Notes" value={summary.total} />
          <Stat label="Queued changes" value={summary.queued} />
          <Stat label="Archive copies" value={summary.archived} />
          <Stat label="Conflicts" value={summary.conflicts} />
        </div>

        <div style={toolbarStyle}>
          <button onClick={() => dispatch(syncToLocalArchive())}>
            Sync to local archive
          </button>
          <button onClick={handleExport}>Export JSON</button>
          <label style={fileLabelStyle}>
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              onChange={handleImport}
              style={{ display: 'none' }}
            />
          </label>
        </div>

        <p style={{ fontSize: 13, opacity: 0.75 }}>
          Sync processes the local queue only. No server or network connection is used.
        </p>

        {message && (
          <p role="status" style={{ marginBottom: 0 }}>
            {message}
          </p>
        )}
      </section>

      <div style={layoutStyle}>
        <section className="panel" style={sidebarStyle}>
          <div style={toolbarStyle}>
            <h2 style={{ margin: 0 }}>Your notes</h2>
            <button onClick={handleCreateNote}>+ New note</button>
          </div>

          <input
            aria-label="Search notes"
            placeholder="Search title, text, or tags..."
            value={search}
            onChange={event => setSearch(event.target.value)}
            style={inputStyle}
          />

          <label style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0' }}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={event => setShowArchived(event.target.checked)}
            />
            Show archived notes
          </label>

          <div style={{ display: 'grid', gap: 8 }}>
            {visibleNotes.map(note => {
              const queued = !!queue.find(item => item.noteId === note.id);
              const conflicted = conflicts.some(item => item.noteId === note.id);

              return (
                <button
                  key={note.id}
                  onClick={() => setSelectedId(note.id)}
                  style={{
                    ...noteButtonStyle,
                    borderColor: selectedId === note.id ? '#5b8def' : '#ccc',
                    background: selectedId === note.id ? '#edf3ff' : 'white',
                    color: '#222',
                    textAlign: 'left',
                  }}
                >
                  <strong>
                    {note.pinned ? '📌 ' : ''}
                    {note.title || 'Untitled note'}
                  </strong>
                  <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>
                    {note.text.slice(0, 65) || 'Empty note'}
                  </span>
                  <span style={{ display: 'block', fontSize: 11, marginTop: 6 }}>
                    {note.archived ? 'Archived' : 'Active'}
                    {' · '}
                    {queued ? 'Unsynced' : 'Saved to archive'}
                    {conflicted ? ' · Conflict' : ''}
                  </span>
                </button>
              );
            })}

            {visibleNotes.length === 0 && (
              <p>No matching notes.</p>
            )}
          </div>
        </section>

        <section className="panel" style={editorStyle}>
          {selected ? (
            <>
              <div style={toolbarStyle}>
                <h2 style={{ margin: 0 }}>Edit note</h2>
                <span style={{ fontSize: 12 }}>
                  Revision {selected.revision}
                </span>
              </div>

              <label style={labelStyle}>
                Title
                <input
                  value={titleDraft}
                  onChange={event => setTitleDraft(event.target.value)}
                  style={inputStyle}
                />
              </label>

              <label style={labelStyle}>
                Note text
                <textarea
                  value={textDraft}
                  onChange={event => setTextDraft(event.target.value)}
                  rows={10}
                  style={{ ...inputStyle, resize: 'vertical' }}
                />
              </label>

              <label style={labelStyle}>
                Tags (comma-separated)
                <input
                  value={tagsDraft}
                  onChange={event => setTagsDraft(event.target.value)}
                  placeholder="work, ideas, personal"
                  style={inputStyle}
                />
              </label>

              <div style={toolbarStyle}>
                <button onClick={handleSave} disabled={!isDirty}>
                  Save changes locally
                </button>
                <button onClick={() => dispatch(togglePin(selected.id))}>
                  {selected.pinned ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => dispatch(toggleArchive(selected.id))}>
                  {selected.archived ? 'Unarchive' : 'Archive'}
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('Delete this note? It will be removed from the archive on the next successful sync.')) {
                      dispatch(deleteNote(selected.id));
                      setSelectedId(null);
                    }
                  }}
                >
                  Delete
                </button>
              </div>

              <p style={{ fontSize: 12, opacity: 0.75 }}>
                {isDirty
                  ? 'Unsaved editor changes — click Save changes locally.'
                  : queue.some(item => item.noteId === selected.id)
                    ? 'Saved in Redux and queued for local archive sync.'
                    : 'No pending local changes.'}
              </p>

              <hr />

              <h3>Revision history</h3>
              {revisions.length === 0 ? (
                <p>No revisions yet.</p>
              ) : (
                <div style={{ display: 'grid', gap: 8 }}>
                  {revisions.map(revision => (
                    <div key={revision.id} style={historyItemStyle}>
                      <div>
                        <strong>Revision {revision.revision}</strong>
                        <div style={{ fontSize: 12, opacity: 0.7 }}>
                          {new Date(revision.createdAt).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 13 }}>
                          {revision.title} — {revision.text.slice(0, 70)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          dispatch(
                            restoreRevision({
                              noteId: selected.id,
                              revisionId: revision.id,
                            })
                          );
                          setMessage(`Restored revision ${revision.revision} as a new revision.`);
                        }}
                      >
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <hr />

              <h3>Archive copy</h3>
              {selectedArchive ? (
                <>
                  <p>
                    Archive revision: {selectedArchive.revision}
                  </p>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedArchive.text || 'Empty archive copy'}
                  </p>
                  <button onClick={() => handleSimulateArchiveEdit(selected)}>
                    Simulate separate archive edit
                  </button>
                </>
              ) : (
                <p>This note has not been synced to the archive yet.</p>
              )}
            </>
          ) : (
            <div>
              <h2>Select a note</h2>
              <p>Choose a note from the list or create a new one.</p>
            </div>
          )}
        </section>
      </div>

      <section className="panel" style={panelStyle}>
        <h2>Conflict resolution</h2>

        {conflicts.length === 0 ? (
          <p>No conflicts. Edit an archive copy separately, edit the local note, and sync to simulate one.</p>
        ) : (
          <div style={{ display: 'grid', gap: 20 }}>
            {conflicts.map(conflict => (
              <div key={conflict.noteId} style={conflictStyle}>
                <h3>Conflict: {conflict.local?.title ?? conflict.archive?.title ?? conflict.noteId}</h3>

                <div style={comparisonStyle}>
                  <div>
                    <strong>Local version</strong>
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {conflict.local?.text ?? 'This note was deleted locally.'}
                    </p>
                  </div>
                  <div>
                    <strong>Archive version</strong>
                    <p style={{ whiteSpace: 'pre-wrap' }}>
                      {conflict.archive?.text ?? 'No archive copy exists.'}
                    </p>
                  </div>
                </div>

                <div style={toolbarStyle}>
                  <button onClick={() => dispatch(keepLocalVersion(conflict.noteId))}>
                    Keep local
                  </button>
                  <button onClick={() => dispatch(keepArchiveVersion(conflict.noteId))}>
                    Keep archive
                  </button>
                </div>

                <label style={labelStyle}>
                  Merge text
                  <textarea
                    rows={5}
                    value={
                      mergeDrafts[conflict.noteId] ??
                      conflict.local?.text ??
                      conflict.archive?.text ??
                      ''
                    }
                    onChange={event =>
                      setMergeDrafts(current => ({
                        ...current,
                        [conflict.noteId]: event.target.value,
                      }))
                    }
                    style={inputStyle}
                  />
                </label>

                <button
                  onClick={() => {
                    const mergedText =
                      mergeDrafts[conflict.noteId] ??
                      conflict.local?.text ??
                      conflict.archive?.text ??
                      '';

                    dispatch(
                      mergeConflict({
                        id: conflict.noteId,
                        text: mergedText,
                      })
                    );

                    setMessage('Conflict resolved using the merged text.');
                  }}
                >
                  Save merged version
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="panel" style={panelStyle}>
        <h2>Local save queue</h2>
        {queue.length === 0 ? (
          <p>Queue is empty.</p>
        ) : (
          <ul>
            {queue.map(item => (
              <li key={item.noteId}>
                {item.noteId} — {item.operation} — queued{' '}
                {new Date(item.queuedAt).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div style={statStyle}>
      <strong style={{ fontSize: 24 }}>{value}</strong>
      <span style={{ fontSize: 12 }}>{label}</span>
    </div>
  );
}

const panelStyle = {
  background: 'black',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: 18,
  marginBottom: 18,
};

const statsStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: 10,
  margin: '14px 0',
};

const statStyle = {
  display: 'grid',
  gap: 4,
  padding: 12,
  background: 'black',
  borderRadius: 8,
};

const toolbarStyle = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  alignItems: 'center',
  gap: 8,
  margin: '12px 0',
};

const layoutStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 0.8fr) minmax(0, 1.7fr)',
  gap: 18,
  alignItems: 'start',
};

const sidebarStyle = {
  background: 'black',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: 16,
  minWidth: 0,
};

const editorStyle = {
  background: 'black',
  border: '1px solid #ddd',
  borderRadius: 10,
  padding: 18,
  minWidth: 0,
};

const noteButtonStyle = {
  border: '1px solid #ccc',
  borderRadius: 8,
  padding: 12,
  cursor: 'pointer',
  width: '100%',
};

const inputStyle = {
  display: 'block',
  width: '100%',
  boxSizing: 'border-box' as const,
  padding: 10,
  border: '1px solid #bbb',
  borderRadius: 6,
  marginTop: 6,
  font: 'inherit',
};

const labelStyle = {
  display: 'block',
  margin: '14px 0',
  fontWeight: 600,
};

const fileLabelStyle = {
  display: 'inline-block',
  padding: '7px 12px',
  border: '1px solid #aaa',
  borderRadius: 6,
  cursor: 'pointer',
};

const historyItemStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  flexWrap: 'wrap' as const,
  gap: 10,
  padding: 10,
  border: '1px solid #ddd',
  borderRadius: 8,
};

const conflictStyle = {
  border: '1px solid #d99',
  borderRadius: 8,
  padding: 14,
};

const comparisonStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 12,
};
