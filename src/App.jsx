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

      <section className="hero">
        <h1 className="wordmark">
          tech<span className="dot">.</span>sex
        </h1>
        <p className="tagline">
          something is coming<span className="cursor" />
        </p>
      </section>

      <footer className="footer">
        <span>&copy; {new Date().getFullYear()} tech.sex</span>
      </footer>
    </main>
  );
}
