import { useEffect, useMemo, useState } from "react";
import { QUIZZES } from "./quizzes.js";
import { scoreQuiz } from "./scoring.js";
import { gradeText, warmUp } from "./grader.js";

function Icon({ name }) {
  const paths = {
    spark: "M12 2l1.8 6.2L20 10l-6.2 1.8L12 18l-1.8-6.2L4 10l6.2-1.8L12 2z",
    arrow: "M5 12h14m-5-5 5 5-5 5",
    back: "M19 12H5m5 5-5-5 5-5",
    refresh: "M20 11a8 8 0 10-2.3 5.7M20 5v6h-6",
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d={paths[name]} /></svg>;
}

export default function App() {
  const [active, setActive] = useState(null);
  return (
    <main>
      <header className="nav"><button className="brand" onClick={() => setActive(null)}>tech<span>.sex</span></button><div className="nav-note"><Icon name="spark" /> personality, decoded</div></header>
      {active ? <Quiz quiz={active} onExit={() => setActive(null)} /> : <Home onPick={setActive} />}
      <footer>Made for the incurably curious <span>✦</span> No sign-up. No data sold. Just you.</footer>
    </main>
  );
}

function Home({ onPick }) {
  return <>
    <section className="hero">
      <div className="eyebrow"><span /> A MIRROR, NOT A LABEL <span /></div>
      <h1>There are a lot of ways<br />to be <em>you.</em></h1>
      <p>Thoughtful little quizzes for your big, complicated inner world.<br />No wrong answers. Just interesting ones.</p>
      <div className="scribble">pick one that calls to you ↓</div>
    </section>
    <section className="quiz-grid" aria-label="Personality quizzes">
      {QUIZZES.map((quiz, i) => <button className="quiz-card" style={{"--accent": quiz.color, "--delay": `${i * 45}ms`}} key={quiz.id} onClick={() => onPick(quiz)}>
        <div className="card-top"><span className="glyph">{quiz.glyph}</span><span className="time">{quiz.minutes} MIN</span></div>
        <h2>{quiz.title}</h2><p>{quiz.description}</p>
        <div className="card-bottom"><span>{quiz.questions.length} questions</span><span className="take">TAKE QUIZ <Icon name="arrow" /></span></div>
      </button>)}
    </section>
  </>;
}

function Quiz({ quiz, onExit }) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  useEffect(() => { if (quiz.questions.some(q => q.grading)) warmUp(); }, [quiz]);
  const question = quiz.questions[index];
  const done = index === quiz.questions.length;
  const grading = done && quiz.questions.some(q => answers[q.id]?.status === "pending");
  const result = useMemo(() => done && !grading ? scoreQuiz(quiz, answers) : null, [quiz, answers, done, grading]);
  function answer(value) {
    if (question.type === "text" && question.grading) {
      setAnswers(a => ({...a, [question.id]: { text: value, status: "pending" }}));
      // Grade in the background while the user answers the remaining questions.
      // The stale-text guard drops results for answers that were edited or reset.
      gradeText(quiz, question, value).then(
        grades => setAnswers(a => a[question.id]?.text === value ? {...a, [question.id]: { text: value, status: "done", grades }} : a),
        () => setAnswers(a => a[question.id]?.text === value ? {...a, [question.id]: { text: value, status: "failed" }} : a),
      );
    } else {
      setAnswers(a => ({...a, [question.id]: value}));
    }
    setTimeout(() => setIndex(i => i + 1), 160);
  }
  if (grading) return <section className="runner" style={{"--accent": quiz.color}}>
    <div className="progress-meta"><span>{quiz.glyph} {quiz.title}</span><b>almost there</b></div>
    <div className="progress"><i style={{width: "100%"}} /></div>
    <article className="question"><span className="q-number">ONE MOMENT</span><h1>Reading your words…</h1><p>Your free responses are being scored for their themes.</p></article>
  </section>;
  if (result) return <Result quiz={quiz} result={result} restart={() => { setAnswers({}); setIndex(0); }} onExit={onExit} />;
  const selected = answers[question.id];
  return <section className="runner" style={{"--accent": quiz.color}}>
    <button className="back" onClick={index ? () => setIndex(i => i - 1) : onExit}><Icon name="back" /> {index ? "Back" : "All quizzes"}</button>
    <div className="progress-meta"><span>{quiz.glyph} {quiz.title}</span><b>{index + 1} / {quiz.questions.length}</b></div>
    <div className="progress"><i style={{width: `${((index + 1) / quiz.questions.length) * 100}%`}} /></div>
    <article className="question" key={question.id}><span className="q-number">QUESTION {String(index + 1).padStart(2, "0")}</span><h1>{question.prompt}</h1>{question.hint && <p>{question.hint}</p>}
      {question.type === "text" ? <TextAnswer question={question} onAnswer={answer} initial={selected && typeof selected === "object" ? selected.text : selected} /> : <div className="options">{question.options.map((option, i) => <button className={selected === option.value ? "selected" : ""} key={option.value} onClick={() => answer(option.value)}><span>{String.fromCharCode(65 + i)}</span>{option.label}</button>)}</div>}
    </article>
  </section>;
}

function TextAnswer({ question, onAnswer, initial = "" }) {
  const [value, setValue] = useState(initial);
  return <form className="text-answer" onSubmit={e => {e.preventDefault(); if(value.trim()) onAnswer(value.trim());}}><textarea autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder={question.placeholder || "Write whatever comes to mind…"} maxLength="600" /><div><small>{value.length}/600 · read once by our model to find its themes, never stored</small><button disabled={!value.trim()}>Continue <Icon name="arrow" /></button></div></form>;
}

function Result({ quiz, result, restart, onExit }) {
  return <section className="result" style={{"--accent": quiz.color}}><div className="result-mark">{quiz.glyph}</div><div className="eyebrow">YOUR INNER READ</div><h1>{result.title}</h1><p className="result-copy">{result.description}</p><div className="axes">{result.axes.map(axis => <div className="axis" key={axis.id}><div><span>{axis.left}</span><b>{axis.score}%</b><span>{axis.right}</span></div><div className="axis-track"><i style={{left: `${axis.score}%`}} /></div></div>)}</div><blockquote>“{result.insight}”</blockquote><div className="result-actions"><button className="primary" onClick={restart}><Icon name="refresh" /> Take it again</button><button onClick={onExit}>Explore more quizzes</button></div><small>Results are reflective, not diagnostic. Keep what resonates.</small></section>;
}
