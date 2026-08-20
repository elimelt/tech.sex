import Interview from "./Interview.jsx";

export default function App() {
  return (
    <main className="page">
      <div className="aurora" aria-hidden="true">
        <div className="blob blob-a" />
        <div className="blob blob-b" />
        <div className="blob blob-c" />
      </div>
      <div className="grid-overlay" aria-hidden="true" />
      <div className="noise" aria-hidden="true" />

      <Interview />

      <footer className="footer">
        <span>&copy; {new Date().getFullYear()} tech.sex</span>
      </footer>
    </main>
  );
}
