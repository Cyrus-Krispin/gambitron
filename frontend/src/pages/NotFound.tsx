import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="not-found fade-in">
      <p className="eyebrow">404</p>
      <h1>Page not found</h1>
      <p>The page may have moved, or the address may be incomplete.</p>
      <Link to="/" className="btn-ghost">Start a game</Link>
    </div>
  );
}
