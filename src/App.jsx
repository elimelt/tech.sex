import { useEffect, useRef, useState } from "react";
import { listTracks, putTrack, deleteTrack } from "./db.js";
import { generateQuiz, questionCount, DOC_LIMIT } from "./generate.js";
import { gradeAnswer } from "./grade.js";
import { scoreAttempt, bestPercent } from "./attempts.js";
import { warmUp } from "./llm.js";

export default function App() {
  const [view, setView] = useState({ name: "home" });
  const [tracks, setTracks] = useState(null);
  useEffect(() => { listTracks().then(all => setTracks(all.sort((a, b) => b.createdAt - a.createdAt))); }, []);
  function save(track) {
    putTrack(track);
    setTracks(all => {
      const rest = (all || []).filter(t => t.id !== track.id);
      return [track, ...rest].sort((a, b) => b.createdAt - a.createdAt);
    });
  }
  function remove(id) {
    deleteTrack(id);
    setTracks(all => (all || []).filter(t => t.id !== id));
    setView({ name: "home" });
  }
  const track = view.id ? (tracks || []).find(t => t.id === view.id) : null;
  return (
    <main>
      <header>
        <button className="brand" onClick={() => setView({ name: "home" })}>tech<span>.sex</span></button>
        <span className="note">doc in · quiz out</span>
      </header>
      {view.name === "home" && <Home tracks={tracks} onOpen={id => setView({ name: "track", id })} onNew={() => setView({ name: "new" })} />}
      {view.name === "new" && <NewTrack onCreate={t => { save(t); setView({ name: "track", id: t.id }); }} onCancel={() => setView({ name: "home" })} />}
      {view.name === "track" && track && <Track track={track} onStart={() => setView({ name: "run", id: track.id })} onDelete={() => remove(track.id)} onBack={() => setView({ name: "home" })} />}
      {view.name === "run" && track && <Runner track={track} onSave={save} onExit={() => setView({ name: "track", id: track.id })} />}
      <footer>Stored in this browser. Free-response answers are sent to the grader model and not kept.</footer>
    </main>
  );
}

function Home({ tracks, onOpen, onNew }) {
  return (
    <section>
      <div className="row-between">
        <h1>Tracks</h1>
        <button className="primary" onClick={onNew}>New track</button>
      </div>
      {tracks === null && <p className="muted">Loading…</p>}
      {tracks?.length === 0 && <p className="muted">Nothing here yet. Paste a document and it becomes a quiz.</p>}
      <div className="list">
        {tracks?.map(t => {
          const best = bestPercent(t);
          return (
            <button className="item" key={t.id} onClick={() => onOpen(t.id)}>
              <span>{t.title}</span>
              <span className="meta">{t.questions.length} questions · {t.attempts.length} attempt{t.attempts.length === 1 ? "" : "s"}{best !== null && ` · best ${best}%`}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function NewTrack({ onCreate, onCancel }) {
  const [title, setTitle] = useState("");
  const [doc, setDoc] = useState("");
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { warmUp(); }, []);
  const words = doc.trim().split(/\s+/).filter(Boolean).length;
  async function generate(event) {
    event.preventDefault();
    setError(null);
    setProgress({ done: 0, target: questionCount(doc), prompts: [] });
    try {
      const cleanTitle = title.trim() || "Untitled";
      const questions = await generateQuiz(cleanTitle, doc, (q, done, target) =>
        setProgress(p => ({ done, target, prompts: [...(p?.prompts || []), q.prompt] })));
      onCreate({ id: crypto.randomUUID(), title: cleanTitle, doc, createdAt: Date.now(), questions, attempts: [] });
    } catch (e) {
      setError(`Generation failed: ${e.message}. The document is still here; try again.`);
      setProgress(null);
    }
  }
  if (progress) return (
    <section>
      <h1>Generating</h1>
      <p className="muted">{progress.done}/{progress.target} questions. This model is slow; expect a minute or two.</p>
      <ol className="gen-list">{progress.prompts.map((p, i) => <li key={i}>{p}</li>)}</ol>
    </section>
  );
  return (
    <section>
      <h1>New track</h1>
      <form onSubmit={generate}>
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" aria-label="Title" />
        <textarea value={doc} onChange={e => setDoc(e.target.value.slice(0, DOC_LIMIT))} placeholder="Paste the document to learn: notes, an article, a chapter." aria-label="Document" />
        <div className="row-between">
          <span className="meta">{words} words → {questionCount(doc)} questions · sent to the model once</span>
          <span className="row">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button className="primary" disabled={words < 30}>Generate quiz</button>
          </span>
        </div>
      </form>
      {error && <p className="error">{error}</p>}
    </section>
  );
}

function Track({ track, onStart, onDelete, onBack }) {
  const best = bestPercent(track);
  return (
    <section>
      <button className="back" onClick={onBack}>← Tracks</button>
      <div className="row-between">
        <h1>{track.title}</h1>
        <button className="primary" onClick={onStart}>Start quiz</button>
      </div>
      <p className="meta">{track.questions.length} questions · created {new Date(track.createdAt).toLocaleDateString()}{best !== null && ` · best ${best}%`}</p>
      {track.attempts.length > 0 && (
        <table>
          <thead><tr><th>When</th><th>Score</th></tr></thead>
          <tbody>
            {[...track.attempts].reverse().map((a, i) => (
              <tr key={i}><td>{new Date(a.at).toLocaleString()}</td><td>{a.percent}% ({a.points}/{a.possible})</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <button className="danger" onClick={() => { if (window.confirm(`Delete "${track.title}" and its history?`)) onDelete(); }}>Delete track</button>
    </section>
  );
}

function Runner({ track, onSave, onExit }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [attempt, setAttempt] = useState(null);
  const savedRef = useRef(false);
  useEffect(() => { warmUp(); }, []);
  const questions = track.questions;
  const done = index === questions.length;
  const grading = done && questions.some(q => q.type === "text" && answers[q.id]?.pending);
  useEffect(() => {
    if (!done || grading || savedRef.current) return;
    savedRef.current = true;
    const scored = { at: Date.now(), ...scoreAttempt(questions, answers) };
    setAttempt(scored);
    onSave({ ...track, attempts: [...track.attempts, scored] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, grading]);
  function answer(value) {
    const q = questions[index];
    if (q.type === "text") {
      setAnswers(a => ({ ...a, [q.id]: { text: value, pending: true } }));
      // Graded in the background while the user keeps going; stale-text guard drops edited answers.
      gradeAnswer(q, value).then(
        grade => setAnswers(a => a[q.id]?.text === value ? { ...a, [q.id]: { text: value, grade } } : a),
        () => setAnswers(a => a[q.id]?.text === value ? { ...a, [q.id]: { text: value, grade: null } } : a),
      );
    } else {
      setAnswers(a => ({ ...a, [q.id]: value }));
    }
    setIndex(i => i + 1);
  }
  if (grading) return <section><h1>Grading…</h1><p className="muted">Free-response answers are being scored. Usually a few seconds.</p></section>;
  if (attempt) return <Results track={track} attempt={attempt} onExit={onExit} />;
  if (done) return null;
  const q = questions[index];
  const selected = answers[q.id];
  return (
    <section>
      <button className="back" onClick={index ? () => setIndex(i => i - 1) : onExit}>← {index ? "Back" : track.title}</button>
      <p className="meta">{index + 1} / {questions.length}</p>
      <h1 className="prompt">{q.prompt}</h1>
      {q.type === "text"
        ? <TextAnswer key={q.id} initial={typeof selected === "object" ? selected?.text : ""} onSubmit={answer} />
        : <div className="options">{q.options.map((label, i) => (
            <button key={i} className={selected === i ? "selected" : ""} onClick={() => answer(i)}><span>{String.fromCharCode(65 + i)}</span>{label}</button>
          ))}</div>}
    </section>
  );
}

function TextAnswer({ initial = "", onSubmit }) {
  const [value, setValue] = useState(initial);
  return (
    <form onSubmit={e => { e.preventDefault(); if (value.trim()) onSubmit(value.trim()); }}>
      <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} maxLength="1200" placeholder="Answer in your own words." />
      <div className="row-between">
        <span className="meta">{value.length}/1200</span>
        <button className="primary" disabled={!value.trim()}>Submit</button>
      </div>
    </form>
  );
}

function Results({ track, attempt, onExit }) {
  const byId = Object.fromEntries(track.questions.map(q => [q.id, q]));
  return (
    <section>
      <button className="back" onClick={onExit}>← {track.title}</button>
      <h1>{attempt.percent}%</h1>
      <p className="meta">{attempt.points}/{attempt.possible} points</p>
      <div className="review">
        {attempt.rows.map(row => {
          const q = byId[row.id];
          return (
            <article key={row.id} className={row.ungraded ? "" : row.points === row.possible ? "right" : row.points > 0 ? "partial" : "wrong"}>
              <h2>{q.prompt}</h2>
              {row.kind === "choice" ? (
                <>
                  <p>Your answer: {q.options[row.picked] ?? "—"}{row.correct ? " ✓" : ""}</p>
                  {!row.correct && <p>Correct: {q.options[q.correct]}</p>}
                  {q.why && <p className="muted">{q.why}</p>}
                </>
              ) : (
                <>
                  <p className="muted">“{row.text}”</p>
                  {row.ungraded ? <p>Grader unavailable; not counted.</p> : <p>{row.points}/2 — {row.feedback}</p>}
                </>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
