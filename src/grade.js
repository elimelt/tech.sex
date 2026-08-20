/** Grade one free-response answer against its rubric. */
import { complete } from "./llm.js";

const ATTEMPTS = 2;

export function buildGradePrompt(question, answer) {
  return [
    { role: "system", content: "You grade one quiz answer. Reply with only a JSON object, nothing else." },
    { role: "user", content: [
      `Question: ${question.prompt}`,
      `A correct answer must cover: ${question.rubric}`,
      `Student answer:\n${JSON.stringify(answer)}`,
      `Reply with JSON: {"score": 0|1|2, "feedback": "one sentence"}`,
      `score 2 = covers the rubric, 1 = partially covers it, 0 = wrong, empty, or off-topic. Feedback states what was right or missing, addressed to the student.`,
    ].join("\n\n") },
  ];
}

/** Extract and clamp a grade from a model reply. Exported for tests. */
export function parseGrade(raw) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) throw new Error("grade: no JSON in reply");
  const parsed = JSON.parse(match[0]);
  const score = Math.round(Number(parsed.score));
  if (!Number.isFinite(score)) throw new Error("grade: score is not a number");
  return { score: Math.max(0, Math.min(2, score)), feedback: typeof parsed.feedback === "string" ? parsed.feedback.trim() : "" };
}

/** Resolves to { score, feedback }. Rejects after all attempts fail. */
export async function gradeAnswer(question, answer) {
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      return parseGrade(await complete(buildGradePrompt(question, answer)));
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
