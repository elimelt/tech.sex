export default function App() {
  return (
    <main className="page">
      <div className="glow" aria-hidden="true" />
      <h1 className="wordmark">
        tech<span className="dot">.</span>sex
      </h1>
      <p className="tagline">something is coming.</p>
      <footer className="footer">
        <span>&copy; {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
