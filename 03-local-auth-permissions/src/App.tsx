import { useAppDispatch, useAppSelector } from './app/store';
import { loginAsViewer, logout } from './features/sessionSlice';
import './style.css';

export default function App() {
  const dispatch = useAppDispatch();
  return (
    <main className="container">
      <p className="eyebrow">Redux Toolkit · Challenge 03 · Hard</p>
      <h1>Local Roles & Permissions Simulator</h1>
      <p className="subtitle">State machines, role selectors, listener middleware, session expiry simulation</p>
      <section className="panel">
        <h2>Starter state</h2>
        <p>Active user: {useAppSelector(s => s.session.user?.role ?? "none")}</p>
        <button onClick={() => dispatch(loginAsViewer())}>Try a sample action</button>
      </section>
      <section className="panel">
        <h2>Your assignment</h2>
        <p>Open <code>README.md</code> and implement the listed requirements. This is an intentionally incomplete starter, not a finished solution.</p>
        <p>All app data is local. No external API is required.</p>
      </section>
    </main>
  );
}
