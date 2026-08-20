/** Score a declarative quiz. Options contribute signed points to one or more axes. */
export function scoreQuiz(quiz, answers) {
  const totals = Object.fromEntries(quiz.axes.map(axis => [axis.id, { points: 0, possible: 0 }]));
  for (const question of quiz.questions) {
    const answer = answers[question.id];
    if (question.type === "text") {
      scoreText(question, answer, totals);
      continue;
    }
    const selected = question.options.find(option => option.value === answer);
    for (const [axis, value] of Object.entries(selected?.scores || {})) totals[axis].points += value;
    for (const axis of quiz.axes) totals[axis.id].possible += Math.max(1, ...question.options.map(o => Math.abs(o.scores?.[axis.id] || 0)));
  }
  const axes = quiz.axes.map(axis => {
    const total = totals[axis.id];
    const score = Math.round(50 + 50 * total.points / Math.max(1, total.possible));
    return {...axis, score: Math.max(0, Math.min(100, score))};
  });
  const average = axes.reduce((sum, axis) => sum + axis.score, 0) / axes.length;
  const outcome = [...quiz.outcomes].sort((a, b) => Math.abs(a.at - average) - Math.abs(b.at - average))[0];
  return {...outcome, axes};
}

/** Text answers are strings, or { text, grades } objects once an LLM grade lands. */
function scoreText(question, answer, totals) {
  const entry = answer && typeof answer === "object" ? answer : { text: answer };
  if (entry.grades && question.grading) {
    const [min, max] = question.grading.scale;
    const axis = question.grading.axis;
    const points = Math.max(min, Math.min(max, Number(entry.grades[axis]) || 0));
    totals[axis].points += points;
    totals[axis].possible += Math.max(Math.abs(min), Math.abs(max));
    return;
  }
  const normalized = String(entry.text || "").toLowerCase();
  for (const [axis, rules] of Object.entries(question.rubric || {})) {
    const matches = rules.keywords.filter(word => normalized.includes(word.toLowerCase())).length;
    totals[axis].points += matches ? rules.score : 0;
    totals[axis].possible += Math.abs(rules.score);
  }
}
