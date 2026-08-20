/** Pure scoring for one quiz attempt.
 * answers[qid] is an option index for choice questions,
 * or { text, grade: { score, feedback } | null } for text questions
 * (grade null means the grader failed; the question is excluded from the total). */
export function scoreAttempt(questions, answers) {
  const rows = questions.map(question => {
    if (question.type === "choice") {
      const picked = answers[question.id];
      const correct = picked === question.correct;
      return { id: question.id, kind: "choice", picked, correct, points: correct ? 2 : 0, possible: 2 };
    }
    const entry = answers[question.id] && typeof answers[question.id] === "object" ? answers[question.id] : { text: "" };
    if (!entry.grade) return { id: question.id, kind: "text", text: entry.text || "", points: 0, possible: 0, ungraded: true };
    return { id: question.id, kind: "text", text: entry.text || "", points: entry.grade.score, possible: 2, feedback: entry.grade.feedback };
  });
  const points = rows.reduce((sum, row) => sum + row.points, 0);
  const possible = rows.reduce((sum, row) => sum + row.possible, 0);
  return { rows, points, possible, percent: possible ? Math.round(100 * points / possible) : 0 };
}

export function bestPercent(track) {
  return track.attempts.length ? Math.max(...track.attempts.map(a => a.percent)) : null;
}
