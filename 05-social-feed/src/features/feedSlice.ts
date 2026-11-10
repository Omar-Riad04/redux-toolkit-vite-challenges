import {
  createSlice,
  createEntityAdapter,
  createSelector,
  nanoid,
  current,
  type PayloadAction,
} from '@reduxjs/toolkit';

// ---------- Types & constants ----------
export const USERS = { demo: 'Demo User', alice: 'Alice', bob: 'Bob' } as const;
export type UserId = keyof typeof USERS;
export const USER_IDS = Object.keys(USERS) as UserId[];
const isUser = (v: unknown): v is UserId =>
  typeof v === 'string' && Object.prototype.hasOwnProperty.call(USERS, v);

export const MAX_HISTORY = 20;
export const MAX_COMMENT = 280;
export const STORAGE_KEY = 'feed_state';
export const SCHEMA_VERSION = 1;

export type SortOrder = 'oldest' | 'newest';

export interface Post {
  id: string;
  authorId: UserId;
  text: string;
  likedBy: UserId[]; // a set: one reaction per user per post
  bookmarkedBy: UserId[];
}

export interface Comment {
  id: string;
  postId: string;
  parentId: string | null; // bonus: nested replies
  authorId: UserId;
  text: string;
  createdAt: number;
  editedAt: number | null;
}

const postsAdapter = createEntityAdapter<Post>();
const commentsAdapter = createEntityAdapter<Comment>();
type PostsState = ReturnType<typeof postsAdapter.getInitialState>;
type CommentsState = ReturnType<typeof commentsAdapter.getInitialState>;

/** Everything undo/redo covers. */
export interface FeedData {
  posts: PostsState;
  comments: CommentsState;
}

export interface JournalEntry {
  label: string;
  data: FeedData;
}

export interface Filters {
  saved: boolean; // bookmarked by the current user
  liked: boolean; // liked by the current user
  author: 'all' | UserId;
  keyword: string;
}

export interface Feedback {
  kind: 'error' | 'success';
  text: string;
}

export interface FeedState {
  past: JournalEntry[]; // oldest first, capped at MAX_HISTORY
  present: FeedData;
  future: JournalEntry[];
  currentUserId: UserId; // view state, not undoable
  filters: Filters;
  commentSort: Record<string, SortOrder>; // per post, view state
  feedback: Feedback | null;
}

export interface Snapshot {
  version: number;
  posts: Post[];
  comments: Comment[];
  currentUserId: UserId;
}

// ---------- Ownership rules ----------
/** Only the comment's author may edit it. */
export const canEditComment = (userId: UserId, c: Comment) => c.authorId === userId;
/** The comment's author, or the author of the post it is on, may delete it. */
export const canDeleteComment = (userId: UserId, c: Comment, post: Post | undefined) =>
  c.authorId === userId || post?.authorId === userId;

// ---------- Validation ----------
type TextResult = { ok: true; value: string } | { ok: false; error: string };
const checkText = (text: unknown): TextResult => {
  const t = typeof text === 'string' ? text.trim() : '';
  if (!t) return { ok: false, error: 'Comment cannot be empty.' };
  if (t.length > MAX_COMMENT) return { ok: false, error: `Comment must be ${MAX_COMMENT} characters or fewer.` };
  return { ok: true, value: t };
};

const cleanUsers = (v: unknown): UserId[] =>
  Array.isArray(v) ? Array.from(new Set(v.filter(isUser))) : [];

export type ParseResult =
  | { ok: true; data: FeedData; currentUserId: UserId; repairs: string[] }
  | { ok: false; error: string };

export function parseFeed(raw: string | null): ParseResult {
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
  if (!Array.isArray(parsed.posts) || !Array.isArray(parsed.comments)) {
    return { ok: false, error: 'Missing posts or comments' };
  }

  const repairs: string[] = [];
  const posts: Post[] = [];
  const postIds = new Set<string>();

  for (const p of parsed.posts) {
    if (!p || typeof p.id !== 'string' || !p.id || postIds.has(p.id)) {
      repairs.push('Dropped a post with a missing or duplicate id');
      continue;
    }
    if (!isUser(p.authorId) || typeof p.text !== 'string' || !p.text.trim()) {
      repairs.push(`Dropped invalid post "${p.id}"`);
      continue;
    }
    const likedBy = cleanUsers(p.likedBy);
    const bookmarkedBy = cleanUsers(p.bookmarkedBy);
    const rawLen = (a: unknown) => (Array.isArray(a) ? a.length : 0);
    if (likedBy.length !== rawLen(p.likedBy) || bookmarkedBy.length !== rawLen(p.bookmarkedBy)) {
      repairs.push(`Cleaned duplicate or unknown reactions on post "${p.id}"`);
    }
    postIds.add(p.id);
    posts.push({ id: p.id, authorId: p.authorId, text: p.text.trim(), likedBy, bookmarkedBy });
  }

  const comments: Comment[] = [];
  const byId = new Map<string, Comment>();
  for (const c of parsed.comments) {
    if (!c || typeof c.id !== 'string' || !c.id || byId.has(c.id)) {
      repairs.push('Dropped a comment with a missing or duplicate id');
      continue;
    }
    const text = checkText(c.text);
    if (!isUser(c.authorId) || !text.ok) {
      repairs.push(`Dropped invalid comment "${c.id}"`);
      continue;
    }
    if (typeof c.postId !== 'string' || !postIds.has(c.postId)) {
      repairs.push(`Dropped orphan comment "${c.id}" (unknown post)`);
      continue;
    }
    const parentId: string | null = c.parentId ?? null;
    if (parentId !== null) {
      const parent = byId.get(parentId);
      if (!parent || parent.postId !== c.postId) {
        repairs.push(`Dropped orphan reply "${c.id}" (missing parent)`);
        continue;
      }
    }
    const comment: Comment = {
      id: c.id,
      postId: c.postId,
      parentId,
      authorId: c.authorId,
      text: text.value,
      createdAt: Number.isFinite(c.createdAt) ? c.createdAt : 0,
      editedAt: Number.isFinite(c.editedAt) ? c.editedAt : null,
    };
    byId.set(comment.id, comment);
    comments.push(comment);
  }

  return {
    ok: true,
    data: {
      posts: postsAdapter.setAll(postsAdapter.getInitialState(), posts),
      comments: commentsAdapter.setAll(commentsAdapter.getInitialState(), comments),
    },
    currentUserId: isUser(parsed.currentUserId) ? parsed.currentUserId : 'demo',
    repairs,
  };
}

// ---------- Initial state ----------
const defaultFilters: Filters = { saved: false, liked: false, author: 'all', keyword: '' };

const seedPosts: Post[] = [
  { id: 'p1', authorId: 'demo', text: 'Redux Toolkit challenge!', likedBy: ['alice', 'bob'], bookmarkedBy: [] },
  { id: 'p2', authorId: 'alice', text: 'Normalized state makes undo easy.', likedBy: [], bookmarkedBy: ['demo'] },
  { id: 'p3', authorId: 'bob', text: 'Selectors keep derived data honest.', likedBy: ['demo'], bookmarkedBy: [] },
];
const seedComments: Comment[] = [
  { id: 'c1', postId: 'p1', parentId: null, authorId: 'alice', text: 'Nice start!', createdAt: 1, editedAt: null },
  { id: 'c2', postId: 'p1', parentId: 'c1', authorId: 'demo', text: 'Thanks!', createdAt: 2, editedAt: null },
  { id: 'c3', postId: 'p2', parentId: null, authorId: 'bob', text: 'Agreed.', createdAt: 3, editedAt: null },
];

const fromData = (data: FeedData, currentUserId: UserId = 'demo'): FeedState => ({
  past: [],
  present: data,
  future: [],
  currentUserId,
  filters: { ...defaultFilters },
  commentSort: {},
  feedback: null,
});

/** Pure and exported so tests don't depend on localStorage. */
export const seedState = (): FeedState =>
  fromData({
    posts: postsAdapter.setAll(postsAdapter.getInitialState(), seedPosts),
    comments: commentsAdapter.setAll(commentsAdapter.getInitialState(), seedComments),
  });

const loadInitialState = (): FeedState => {
  try {
    const r = parseFeed(localStorage.getItem(STORAGE_KEY));
    if (r.ok) {
      const s = fromData(r.data, r.currentUserId);
      if (r.repairs.length > 0) {
        s.feedback = {
          kind: 'success',
          text: `Restored saved feed with ${r.repairs.length} repair(s): ${r.repairs.join('; ')}`,
        };
      }
      return s;
    }
  } catch {
    /* localStorage unavailable */
  }
  return seedState();
};

// ---------- Journal helper ----------
/** Call BEFORE mutating `present`. Snapshots it, caps the journal and clears redo. */
const record = (s: FeedState, label: string) => {
  s.past.push({ label, data: current(s.present) });
  if (s.past.length > MAX_HISTORY) s.past.splice(0, s.past.length - MAX_HISTORY);
  s.future = [];
};

const setError = (s: FeedState, text: string) => {
  s.feedback = { kind: 'error', text };
};

const allComments = commentsAdapter.getSelectors();

// ---------- Slice ----------
export const feedSlice = createSlice({
  name: 'feed',
  initialState: loadInitialState(),
  reducers: {
    toggleLike: (s, action: PayloadAction<string>) => {
      const post = s.present.posts.entities[action.payload];
      if (!post) return setError(s, 'Post not found.');
      const me = s.currentUserId;
      const had = post.likedBy.includes(me);
      record(s, `${USERS[me]} ${had ? 'unliked' : 'liked'} a post`);
      const p = s.present.posts.entities[action.payload]!;
      p.likedBy = had ? p.likedBy.filter(u => u !== me) : [...p.likedBy, me];
      s.feedback = null;
    },

    toggleBookmark: (s, action: PayloadAction<string>) => {
      const post = s.present.posts.entities[action.payload];
      if (!post) return setError(s, 'Post not found.');
      const me = s.currentUserId;
      const had = post.bookmarkedBy.includes(me);
      record(s, `${USERS[me]} ${had ? 'removed a bookmark' : 'bookmarked a post'}`);
      const p = s.present.posts.entities[action.payload]!;
      p.bookmarkedBy = had ? p.bookmarkedBy.filter(u => u !== me) : [...p.bookmarkedBy, me];
      s.feedback = null;
    },

    addComment: {
      reducer(
        s,
        action: PayloadAction<{ id: string; createdAt: number; postId: string; parentId: string | null; text: string }>
      ) {
        const { id, createdAt, postId, parentId } = action.payload;
        if (!s.present.posts.entities[postId]) return setError(s, 'Post not found.');
        if (parentId !== null) {
          const parent = s.present.comments.entities[parentId];
          if (!parent || parent.postId !== postId) return setError(s, 'Cannot reply: parent comment not found on this post.');
        }
        const text = checkText(action.payload.text);
        if (!text.ok) return setError(s, text.error);

        record(s, `${USERS[s.currentUserId]} ${parentId ? 'replied' : 'commented'}`);
        commentsAdapter.addOne(s.present.comments, {
          id, postId, parentId, authorId: s.currentUserId, text: text.value, createdAt, editedAt: null,
        });
        s.feedback = null;
      },
      prepare: (input: { postId: string; parentId?: string | null; text: string }) => ({
        payload: {
          id: nanoid(),
          createdAt: Date.now(),
          postId: input.postId,
          parentId: input.parentId ?? null,
          text: input.text,
        },
      }),
    },

    editComment: {
      reducer(s, action: PayloadAction<{ id: string; text: string; editedAt: number }>) {
        const c = s.present.comments.entities[action.payload.id];
        if (!c) return setError(s, 'Comment not found.');
        if (!canEditComment(s.currentUserId, c)) {
          return setError(s, `${USERS[s.currentUserId]} cannot edit ${USERS[c.authorId]}'s comment.`);
        }
        const text = checkText(action.payload.text);
        if (!text.ok) return setError(s, text.error);
        s.feedback = null;
        if (text.value === c.text) return; // nothing changed, so no journal entry

        record(s, `${USERS[s.currentUserId]} edited a comment`);
        commentsAdapter.updateOne(s.present.comments, {
          id: c.id,
          changes: { text: text.value, editedAt: action.payload.editedAt },
        });
      },
      prepare: (input: { id: string; text: string }) => ({
        payload: { ...input, editedAt: Date.now() },
      }),
    },

    /** Deletes the comment and every reply beneath it. */
    deleteComment: (s, action: PayloadAction<string>) => {
      const c = s.present.comments.entities[action.payload];
      if (!c) return setError(s, 'Comment not found.');
      const post = s.present.posts.entities[c.postId];
      if (!canDeleteComment(s.currentUserId, c, post)) {
        return setError(s, `${USERS[s.currentUserId]} cannot delete this comment.`);
      }
      record(s, `${USERS[s.currentUserId]} deleted a comment`);

      const doomed = new Set([c.id]);
      const list = allComments.selectAll(s.present.comments);
      let grew = true;
      while (grew) {
        grew = false;
        for (const x of list) {
          if (x.parentId && doomed.has(x.parentId) && !doomed.has(x.id)) {
            doomed.add(x.id);
            grew = true;
          }
        }
      }
      commentsAdapter.removeMany(s.present.comments, Array.from(doomed));
      s.feedback = null;
    },

    undo: s => {
      const entry = s.past.pop();
      if (!entry) return;
      s.future.push({ label: entry.label, data: current(s.present) });
      s.present = entry.data;
      s.feedback = null;
    },

    redo: s => {
      const entry = s.future.pop();
      if (!entry) return;
      s.past.push({ label: entry.label, data: current(s.present) });
      if (s.past.length > MAX_HISTORY) s.past.splice(0, s.past.length - MAX_HISTORY);
      s.present = entry.data;
      s.feedback = null;
    },

    // ---- View state: never enters the journal ----
    setCurrentUser: (s, action: PayloadAction<UserId>) => {
      if (!isUser(action.payload)) return setError(s, 'Unknown user.');
      s.currentUserId = action.payload;
      s.feedback = null;
    },
    setFilter: (s, action: PayloadAction<Partial<Filters>>) => {
      s.filters = { ...s.filters, ...action.payload };
    },
    clearFilters: s => {
      s.filters = { ...defaultFilters };
    },
    setCommentSort: (s, action: PayloadAction<{ postId: string; sort: SortOrder }>) => {
      s.commentSort[action.payload.postId] = action.payload.sort;
    },
    dismissFeedback: s => {
      s.feedback = null;
    },
  },
});

export const {
  toggleLike, toggleBookmark, addComment, editComment, deleteComment, undo, redo,
  setCurrentUser, setFilter, clearFilters, setCommentSort, dismissFeedback,
} = feedSlice.actions;

// ---------- Selectors ----------
type Root = { feed: FeedState };

const postSelectors = postsAdapter.getSelectors((s: Root) => s.feed.present.posts);
const commentSelectors = commentsAdapter.getSelectors((s: Root) => s.feed.present.comments);
export const selectAllPosts = postSelectors.selectAll;
export const selectAllComments = commentSelectors.selectAll;
export const selectCurrentUserId = (s: Root) => s.feed.currentUserId;
const selectFilters = (s: Root) => s.feed.filters;

export interface PostView {
  post: Post;
  authorName: string;
  likeCount: number; // derived
  likedByMe: boolean;
  savedByMe: boolean;
  commentCount: number;
}

export const selectPostViews = createSelector(
  [selectAllPosts, selectAllComments, selectCurrentUserId],
  (posts, comments, me) => {
    const counts = new Map<string, number>();
    for (const c of comments) counts.set(c.postId, (counts.get(c.postId) ?? 0) + 1);
    return posts.map<PostView>(post => ({
      post,
      authorName: USERS[post.authorId],
      likeCount: post.likedBy.length,
      likedByMe: post.likedBy.includes(me),
      savedByMe: post.bookmarkedBy.includes(me),
      commentCount: counts.get(post.id) ?? 0,
    }));
  }
);

export const selectVisiblePosts = createSelector([selectPostViews, selectFilters], (views, f) => {
  const q = f.keyword.trim().toLowerCase();
  return views.filter(v => {
    if (f.saved && !v.savedByMe) return false;
    if (f.liked && !v.likedByMe) return false;
    if (f.author !== 'all' && v.post.authorId !== f.author) return false;
    if (q && !v.post.text.toLowerCase().includes(q) && !v.authorName.toLowerCase().includes(q)) return false;
    return true;
  });
});

export const selectFiltersActive = createSelector(
  [selectFilters],
  f => f.saved || f.liked || f.author !== 'all' || f.keyword.trim() !== ''
);

export const selectSnapshot = createSelector(
  [selectAllPosts, selectAllComments, selectCurrentUserId],
  (posts, comments, currentUserId): Snapshot => ({ version: SCHEMA_VERSION, posts, comments, currentUserId })
);

// ---------- Threads (bonus: nested replies + per-post sort) ----------
export interface ThreadNode {
  comment: Comment;
  depth: number;
}

/** Flattens one post's comments in display order. Sort applies to top-level comments; replies are oldest-first. */
export function buildThread(comments: Comment[], postId: string, sort: SortOrder): ThreadNode[] {
  const kids = new Map<string | null, Comment[]>();
  for (const c of comments) {
    if (c.postId !== postId) continue;
    kids.set(c.parentId, [...(kids.get(c.parentId) ?? []), c]);
  }
  const out: ThreadNode[] = [];
  const walk = (parent: string | null, depth: number) => {
    let list = kids.get(parent) ?? [];
    if (depth === 0 && sort === 'newest') list = [...list].reverse();
    for (const c of list) {
      out.push({ comment: c, depth });
      walk(c.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

export default feedSlice.reducer;