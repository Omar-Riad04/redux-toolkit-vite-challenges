
import {
  createEntityAdapter,
  createSelector,
  createSlice,
  nanoid,
  type PayloadAction,
} from '@reduxjs/toolkit';
import type { RootState } from '../app/store';

export const NOTES_STORAGE_KEY = 'challenge10-offline-notes';
export const MAX_REVISIONS = 10;

export type Note = {
  id: string;
  title: string;
  text: string;
  revision: number;
  pinned: boolean;
  archived: boolean;
  tags: string[];
  updatedAt: number;
};

export type NoteRevision = {
  id: string;
  noteId: string;
  title: string;
  text: string;
  revision: number;
  createdAt: number;
};

export type ArchivedNote = Note;

export type QueueItem = {
  noteId: string;
  operation: 'upsert' | 'delete';
  snapshot: Note | null;
  baseArchiveRevision: number | null;
  queuedAt: number;
};

export type NoteConflict = {
  noteId: string;
  local: Note | null;
  archive: Note | null;
  detectedAt: number;
};

const notesAdapter = createEntityAdapter<Note>();

type NotesState = ReturnType<typeof notesAdapter.getInitialState> & {
  revisions: Record<string, NoteRevision[]>;
  archive: Record<string, ArchivedNote>;
  saveQueue: Record<string, QueueItem>;
  conflicts: Record<string, NoteConflict>;
};

const createSeedNote = (): Note => ({
  id: 'n1',
  title: 'Welcome',
  text: 'Build a local-first note manager.',
  revision: 1,
  pinned: true,
  archived: false,
  tags: ['getting-started'],
  updatedAt: Date.now(),
});

function loadPersistedState(): NotesState {
  const fallback = notesAdapter.getInitialState({
    revisions: {
      n1: [{
        id: 'r1',
        noteId: 'n1',
        title: 'Welcome',
        text: 'Build a local-first note manager.',
        revision: 1,
        createdAt: Date.now(),
      }],
    },
    archive: {},
    saveQueue: {},
    conflicts: {},
  });

  if (typeof localStorage === 'undefined') {
    return notesAdapter.addOne(fallback, createSeedNote());
  }

  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) {
      return notesAdapter.addOne(fallback, createSeedNote());
    }

    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return notesAdapter.addOne(fallback, createSeedNote());
    }

    const value = parsed as Partial<NotesState>;

    if (
      !Array.isArray(value.ids) ||
      !value.entities ||
      typeof value.entities !== 'object'
    ) {
      return notesAdapter.addOne(fallback, createSeedNote());
    }

    const validNotes = value.ids
      .map(id => value.entities?.[id as string])
      .filter((note): note is Note =>
        !!note &&
        typeof note.id === 'string' &&
        typeof note.title === 'string' &&
        typeof note.text === 'string' &&
        typeof note.revision === 'number' &&
        typeof note.pinned === 'boolean' &&
        typeof note.archived === 'boolean' &&
        Array.isArray(note.tags) &&
        typeof note.updatedAt === 'number'
      );

    const state = notesAdapter.setAll(
      notesAdapter.getInitialState({
        revisions: value.revisions && typeof value.revisions === 'object'
          ? value.revisions
          : {},
        archive: value.archive && typeof value.archive === 'object'
          ? value.archive
          : {},
        saveQueue: value.saveQueue && typeof value.saveQueue === 'object'
          ? value.saveQueue
          : {},
        conflicts: value.conflicts && typeof value.conflicts === 'object'
          ? value.conflicts
          : {},
      }),
      validNotes
    );

    return state;
  } catch {
    return notesAdapter.addOne(fallback, createSeedNote());
  }
}

const initialState = loadPersistedState();

function makeRevision(note: Note): NoteRevision {
  return {
    id: nanoid(),
    noteId: note.id,
    title: note.title,
    text: note.text,
    revision: note.revision,
    createdAt: note.updatedAt,
  };
}

function saveRevision(state: NotesState, note: Note) {
  const history = state.revisions[note.id] ?? [];
  state.revisions[note.id] = [
    makeRevision(note),
    ...history,
  ].slice(0, MAX_REVISIONS);
}

function queueNote(state: NotesState, note: Note) {
  const previous = state.saveQueue[note.id];

  state.saveQueue[note.id] = {
    noteId: note.id,
    operation: 'upsert',
    snapshot: { ...note, tags: [...note.tags] },
    baseArchiveRevision: previous
      ? previous.baseArchiveRevision
      : state.archive[note.id]?.revision ?? null,
    queuedAt: Date.now(),
  };

  // If the note already has a conflict, keep its local side up to date.
  if (state.conflicts[note.id]) {
    state.conflicts[note.id].local = { ...note, tags: [...note.tags] };
  }
}

function updateNote(
  state: NotesState,
  id: string,
  changes: Partial<Pick<Note, 'title' | 'text' | 'tags'>>
) {
  const note = state.entities[id];
  if (!note) return;

  const updated: Note = {
    ...note,
    ...changes,
    tags: changes.tags ? [...changes.tags] : [...note.tags],
    revision: note.revision + 1,
    updatedAt: Date.now(),
  };

  notesAdapter.setOne(state, updated);
  saveRevision(state, updated);
  queueNote(state, updated);
}

export const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    createNote: {
      prepare() {
        const id = nanoid();
        const now = Date.now();

        return {
          payload: {
            id,
            title: 'Untitled note',
            text: '',
            revision: 1,
            pinned: false,
            archived: false,
            tags: [],
            updatedAt: now,
          } satisfies Note,
        };
      },
      reducer(state, action: PayloadAction<Note>) {
        notesAdapter.addOne(state, action.payload);
        saveRevision(state, action.payload);
        queueNote(state, action.payload);
      },
    },

    editNote(
      state,
      action: PayloadAction<{
        id: string;
        title?: string;
        text?: string;
        tags?: string[];
      }>
    ) {
      const { id, ...changes } = action.payload;
      updateNote(state, id, changes);
    },

    togglePin(state, action: PayloadAction<string>) {
      const note = state.entities[action.payload];
      if (!note) return;

      note.pinned = !note.pinned;
      note.updatedAt = Date.now();
      note.revision += 1;
      saveRevision(state, note);
      queueNote(state, note);
    },

    toggleArchive(state, action: PayloadAction<string>) {
      const note = state.entities[action.payload];
      if (!note) return;

      note.archived = !note.archived;
      note.updatedAt = Date.now();
      note.revision += 1;
      saveRevision(state, note);
      queueNote(state, note);
    },

    deleteNote(state, action: PayloadAction<string>) {
      const id = action.payload;
      const previous = state.saveQueue[id];

      state.saveQueue[id] = {
        noteId: id,
        operation: 'delete',
        snapshot: null,
        baseArchiveRevision: previous
          ? previous.baseArchiveRevision
          : state.archive[id]?.revision ?? null,
        queuedAt: Date.now(),
      };

      notesAdapter.removeOne(state, id);
      delete state.revisions[id];

      if (state.conflicts[id]) {
        state.conflicts[id].local = null;
      }
    },

    restoreRevision(
      state,
      action: PayloadAction<{ noteId: string; revisionId: string }>
    ) {
      const { noteId, revisionId } = action.payload;
      const revision = state.revisions[noteId]?.find(
        item => item.id === revisionId
      );

      if (!revision || !state.entities[noteId]) return;

      updateNote(state, noteId, {
        title: revision.title,
        text: revision.text,
      });
    },

    syncToLocalArchive(state) {
      Object.values(state.saveQueue).forEach(item => {
        const archiveCopy = state.archive[item.noteId];
        const currentArchiveRevision = archiveCopy?.revision ?? null;

        if (currentArchiveRevision !== item.baseArchiveRevision) {
          state.conflicts[item.noteId] = {
            noteId: item.noteId,
            local: item.snapshot
              ? { ...item.snapshot, tags: [...item.snapshot.tags] }
              : null,
            archive: archiveCopy
              ? { ...archiveCopy, tags: [...archiveCopy.tags] }
              : null,
            detectedAt: Date.now(),
          };
          return;
        }

        if (item.operation === 'delete') {
          delete state.archive[item.noteId];
        } else if (item.snapshot) {
          state.archive[item.noteId] = {
            ...item.snapshot,
            revision: (archiveCopy?.revision ?? 0) + 1,
            tags: [...item.snapshot.tags],
            updatedAt: Date.now(),
          };
        }

        delete state.saveQueue[item.noteId];
        delete state.conflicts[item.noteId];
      });
    },

    // This edits only the archive copy, simulating another device/user.
    editArchivedCopy(
      state,
      action: PayloadAction<{
        id: string;
        title?: string;
        text?: string;
      }>
    ) {
      const note = state.archive[action.payload.id];
      if (!note) return;

      if (action.payload.title !== undefined) {
        note.title = action.payload.title;
      }
      if (action.payload.text !== undefined) {
        note.text = action.payload.text;
      }

      note.revision += 1;
      note.updatedAt = Date.now();
    },

    keepLocalVersion(state, action: PayloadAction<string>) {
      const id = action.payload;
      const conflict = state.conflicts[id];
      if (!conflict) return;

      if (conflict.local) {
        state.archive[id] = {
          ...conflict.local,
          revision: (conflict.archive?.revision ?? 0) + 1,
          tags: [...conflict.local.tags],
          updatedAt: Date.now(),
        };
      } else {
        delete state.archive[id];
      }

      delete state.conflicts[id];
      delete state.saveQueue[id];
    },

    keepArchiveVersion(state, action: PayloadAction<string>) {
      const id = action.payload;
      const conflict = state.conflicts[id];
      if (!conflict) return;

      if (conflict.archive) {
        const restored: Note = {
          ...conflict.archive,
          tags: [...conflict.archive.tags],
          updatedAt: Date.now(),
        };

        notesAdapter.setOne(state, restored);
        saveRevision(state, restored);
      } else {
        notesAdapter.removeOne(state, id);
        delete state.revisions[id];
      }

      delete state.conflicts[id];
      delete state.saveQueue[id];
    },

    mergeConflict(
      state,
      action: PayloadAction<{ id: string; text: string }>
    ) {
      const { id, text } = action.payload;
      const conflict = state.conflicts[id];
      if (!conflict) return;

      // If the local note was deleted, the archive copy supplies its metadata.
      const base = conflict.local ?? conflict.archive;
      if (!base) return;

      const merged: Note = {
        ...base,
        text,
        revision: Math.max(
          conflict.local?.revision ?? 0,
          conflict.archive?.revision ?? 0
        ) + 1,
        updatedAt: Date.now(),
        tags: [...base.tags],
      };

      notesAdapter.setOne(state, merged);
      saveRevision(state, merged);

      state.archive[id] = {
        ...merged,
        revision: Math.max(
          conflict.local?.revision ?? 0,
          conflict.archive?.revision ?? 0
        ) + 1,
        tags: [...merged.tags],
      };

      delete state.conflicts[id];
      delete state.saveQueue[id];
    },

    importNotes(state, action: PayloadAction<unknown>) {
      const input = action.payload as {
        version?: unknown;
        notes?: unknown;
      };

      if (
        !input ||
        input.version !== 1 ||
        !Array.isArray(input.notes)
      ) {
        return;
      }

      const validNotes = input.notes.filter((note): note is Note => {
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

      if (validNotes.length !== input.notes.length) return;

      validNotes.forEach(note => {
        const imported: Note = {
          ...note,
          tags: [...note.tags],
        };

        notesAdapter.setOne(state, imported);
        saveRevision(state, imported);
        queueNote(state, imported);
      });
    },

    clearAllNotes(state) {
      notesAdapter.removeAll(state);
      state.revisions = {};
      state.archive = {};
      state.saveQueue = {};
      state.conflicts = {};
    },
  },
});

export const {
  createNote,
  editNote,
  togglePin,
  toggleArchive,
  deleteNote,
  restoreRevision,
  syncToLocalArchive,
  editArchivedCopy,
  keepLocalVersion,
  keepArchiveVersion,
  mergeConflict,
  importNotes,
  clearAllNotes,
} = notesSlice.actions;

export default notesSlice.reducer;

const adapterSelectors = notesAdapter.getSelectors<RootState>(
  state => state.notes
);

export const selectAllNotes = adapterSelectors.selectAll;
export const selectNoteById = adapterSelectors.selectById;

export const selectActiveNotes = createSelector(
  [selectAllNotes],
  notes => notes.filter(note => !note.archived)
);

export const selectPinnedNotes = createSelector(
  [selectActiveNotes],
  notes => notes.filter(note => note.pinned)
);

export const selectSaveQueue = (state: RootState) =>
  Object.values(state.notes.saveQueue);

export const selectConflicts = (state: RootState) =>
  Object.values(state.notes.conflicts);

export const selectNoteSummary = createSelector(
  [
    selectAllNotes,
    (state: RootState) => state.notes.saveQueue,
    (state: RootState) => state.notes.archive,
    (state: RootState) => state.notes.conflicts,
  ],
  (notes, queue, archive, conflicts) => ({
    total: notes.length,
    queued: Object.keys(queue).length,
    archived: Object.keys(archive).length,
    conflicts: Object.keys(conflicts).length,
  })
);

export const selectSearchResults = createSelector(
  [
    selectAllNotes,
    (_state: RootState, query: string) => query,
  ],
  (notes, query) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return notes;

    return notes.filter(note =>
      `${note.title} ${note.text} ${note.tags.join(' ')}`
        .toLowerCase()
        .includes(normalized)
    );
  }
);
