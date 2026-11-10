import React, { useMemo, useState } from 'react';
import { store, useAppDispatch, useAppSelector } from './app/store';
import {
  toggleLike, toggleBookmark, addComment, editComment, deleteComment, undo, redo,
  setCurrentUser, setFilter, clearFilters, setCommentSort, dismissFeedback,
  selectVisiblePosts, selectAllComments, selectCurrentUserId, selectFiltersActive,
  buildThread, canEditComment, canDeleteComment,
  USERS, USER_IDS, MAX_HISTORY, MAX_COMMENT,
  type PostView, type ThreadNode, type SortOrder, type UserId,
} from './features/feedSlice';
import './style.css';

const input: React.CSSProperties = {
  padding: 8, background: '#2d3950', border: '1px solid #344056', color: '#e9eefa', borderRadius: 6,
};
const row: React.CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', fontSize: 12, gap: 2 };
const small: React.CSSProperties = { padding: '5px 10px', fontSize: 13, borderRadius: 8 };
const tiny: React.CSSProperties = { padding: '3px 8px', fontSize: 12, borderRadius: 6 };
const note: React.CSSProperties = { fontSize: 13, opacity: 0.8 };

function CommentRow({ node, post, me }: { node: ThreadNode; post: PostView['post']; me: UserId }) {
  const dispatch = useAppDispatch();
  const { comment, depth } = node;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState('');

  const mayEdit = canEditComment(me, comment);
  const mayDelete = canDeleteComment(me, comment, post);
  const failed = () => store.getState().feed.feedback?.kind === 'error';

  const saveEdit = () => {
    dispatch(editComment({ id: comment.id, text: draft }));
    if (!failed()) setEditing(false);
  };
  const sendReply = () => {
    dispatch(addComment({ postId: post.id, parentId: comment.id, text: reply }));
    if (!failed()) { setReply(''); setReplying(false); }
  };

  return (
    <div style={{ marginLeft: depth * 20, borderLeft: '2px solid #344056', paddingLeft: 10, marginBottom: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.8 }}>
        <strong>{USERS[comment.authorId]}</strong>
        {comment.authorId === post.authorId && ' (post author)'}
        {comment.editedAt !== null && ' · edited'}
      </div>

      {editing ? (
        <div style={row}>
          <input style={{ ...input, flex: 1 }} value={draft} onChange={e => setDraft(e.target.value)} aria-label="Edit comment" />
          <button style={tiny} onClick={saveEdit}>Save</button>
          <button style={tiny} onClick={() => { setDraft(comment.text); setEditing(false); }}>Cancel</button>
        </div>
      ) : (
        <div style={{ margin: '4px 0' }}>{comment.text}</div>
      )}

      {!editing && (
        <div style={{ ...row, gap: 4, marginBottom: 0 }}>
          <button style={tiny} onClick={() => setReplying(r => !r)}>Reply</button>
          {mayEdit
            ? <button style={tiny} onClick={() => { setDraft(comment.text); setEditing(true); }}>Edit</button>
            : <button style={{ ...tiny, opacity: 0.6 }} title="Not your comment. This dispatches anyway to show the rejection." onClick={() => dispatch(editComment({ id: comment.id, text: comment.text + '!' }))}>Try edit</button>}
          {mayDelete
            ? <button style={{ ...tiny, background: '#ff6b6b' }} onClick={() => dispatch(deleteComment(comment.id))}>Delete</button>
            : <button style={{ ...tiny, opacity: 0.6 }} title="Only the comment's author or the post's author can delete" onClick={() => dispatch(deleteComment(comment.id))}>Try delete</button>}
        </div>
      )}

      {replying && (
        <div style={{ ...row, marginTop: 6 }}>
          <input style={{ ...input, flex: 1 }} placeholder={`Reply as ${USERS[me]}`} value={reply} onChange={e => setReply(e.target.value)} aria-label="Reply" />
          <button style={tiny} onClick={sendReply}>Send</button>
        </div>
      )}
    </div>
  );
}

function PostCard({ view, me }: { view: PostView; me: UserId }) {
  const dispatch = useAppDispatch();
  const comments = useAppSelector(selectAllComments);
  const sort = useAppSelector(s => s.feed.commentSort[view.post.id] ?? 'oldest') as SortOrder;
  const [text, setText] = useState('');

  const thread = useMemo(() => buildThread(comments, view.post.id, sort), [comments, view.post.id, sort]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    dispatch(addComment({ postId: view.post.id, text }));
    if (store.getState().feed.feedback?.kind !== 'error') setText('');
  };

  return (
    <div style={{ background: '#101625', border: '1px solid #344056', borderRadius: 12, padding: 14, marginBottom: 14 }}>
      <div style={{ fontSize: 13, opacity: 0.8 }}>{view.authorName}</div>
      <p style={{ margin: '6px 0 10px' }}>{view.post.text}</p>

      <div style={row}>
        <button style={{ ...small, outline: view.likedByMe ? '2px solid #fff' : undefined }} onClick={() => dispatch(toggleLike(view.post.id))}>
          {view.likedByMe ? '♥ Liked' : '♡ Like'} ({view.likeCount})
        </button>
        <button style={{ ...small, outline: view.savedByMe ? '2px solid #fff' : undefined }} onClick={() => dispatch(toggleBookmark(view.post.id))}>
          {view.savedByMe ? '★ Saved' : '☆ Save'}
        </button>
        <span style={note}>{view.commentCount} comment(s)</span>
      </div>

      <div style={row}>
        <strong style={{ fontSize: 13 }}>Comments</strong>
        <label style={{ fontSize: 12 }}>
          Sort{' '}
          <select style={{ ...input, padding: 4 }} value={sort} onChange={e => dispatch(setCommentSort({ postId: view.post.id, sort: e.target.value as SortOrder }))}>
            <option value="oldest">Oldest first</option>
            <option value="newest">Newest first</option>
          </select>
        </label>
      </div>

      {thread.length === 0 && <p style={note}>No comments yet.</p>}
      {thread.map(n => <CommentRow key={n.comment.id} node={n} post={view.post} me={me} />)}

      <form onSubmit={submit} style={{ ...row, marginTop: 8 }}>
        <input
          style={{ ...input, flex: 1 }}
          placeholder={`Comment as ${USERS[me]}`}
          value={text}
          maxLength={MAX_COMMENT + 50}
          onChange={e => setText(e.target.value)}
          aria-label="New comment"
        />
        <button type="submit" style={small}>Comment</button>
      </form>
    </div>
  );
}

export default function App() {
  const dispatch = useAppDispatch();
  const feedback = useAppSelector(s => s.feed.feedback);
  const me = useAppSelector(selectCurrentUserId);
  const filters = useAppSelector(s => s.feed.filters);
  const past = useAppSelector(s => s.feed.past);
  const futureCount = useAppSelector(s => s.feed.future.length);
  const posts = useAppSelector(selectVisiblePosts);
  const filtersActive = useAppSelector(selectFiltersActive);

  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 05 · Hard</p>
      <h1>Social Feed & Undoable Interactions</h1>
      <p className="subtitle">Entity normalization, reaction rules, local operation journal</p>

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
        <h2>Acting as</h2>
        <div style={row}>
          {USER_IDS.map(u => (
            <button key={u} style={{ ...small, outline: u === me ? '2px solid #fff' : undefined }} onClick={() => dispatch(setCurrentUser(u))}>
              {USERS[u]}
            </button>
          ))}
        </div>
        <p style={note}>
          Likes, bookmarks and comments belong to this user. Switch users to see one-reaction-per-user and
          comment ownership rules. Switching is not undoable.
        </p>
      </section>

      <section className="panel">
        <h2>Operation journal</h2>
        <div style={row}>
          <button disabled={past.length === 0} onClick={() => dispatch(undo())}>Undo ({past.length})</button>
          <button disabled={futureCount === 0} onClick={() => dispatch(redo())}>Redo ({futureCount})</button>
        </div>
        <p style={note}>Keeps the last {MAX_HISTORY} edits. A new edit clears redo. Filters and user switches are not edits.</p>
        {past.length === 0 ? (
          <p style={note}>No edits yet.</p>
        ) : (
          <ol reversed style={{ fontSize: 13, paddingLeft: 20 }}>
            {[...past].reverse().slice(0, 8).map((e, i) => <li key={past.length - i}>{e.label}</li>)}
          </ol>
        )}
      </section>

      <section className="panel">
        <h2>Filters</h2>
        <div style={{ ...row, alignItems: 'flex-end' }}>
          <label style={field}>
            Keyword
            <input style={input} placeholder="text or author" value={filters.keyword} onChange={e => dispatch(setFilter({ keyword: e.target.value }))} />
          </label>
          <label style={field}>
            Author
            <select style={input} value={filters.author} onChange={e => dispatch(setFilter({ author: e.target.value as 'all' | UserId }))}>
              <option value="all">All</option>
              {USER_IDS.map(u => <option key={u} value={u}>{USERS[u]}</option>)}
            </select>
          </label>
          <label><input type="checkbox" checked={filters.saved} onChange={e => dispatch(setFilter({ saved: e.target.checked }))} /> Saved</label>
          <label><input type="checkbox" checked={filters.liked} onChange={e => dispatch(setFilter({ liked: e.target.checked }))} /> Liked</label>
          <button style={small} disabled={!filtersActive} onClick={() => dispatch(clearFilters())}>Clear filters</button>
        </div>
        <p style={note}>"Saved" and "Liked" refer to the user you're acting as.</p>
      </section>

      <section className="panel">
        <h2>Feed ({posts.length})</h2>
        {posts.length === 0 ? <p>No posts match your filters.</p> : posts.map(v => <PostCard key={v.post.id} view={v} me={me} />)}
      </section>
    </main>
  );
}