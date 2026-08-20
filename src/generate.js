/** Turn a pasted document into quiz questions via the LLM, streamed as JSON Lines. */
import { streamContent } from "./llm.js";

export const DOC_LIMIT = 20_000;

/** Question count scales with document length: 4 to 10. */
export function questionCount(doc) {
  const words = String(doc).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(10, Math.max(4, Math.round(words / 120)));
}

export function buildQuizPrompt(title, doc, count) {
  const textCount = Math.max(1, Math.round(count / 3));
  const choiceCount = count - textCount;
  return [
    { role: "system", content: "You write quiz questions from a document. Output JSON Lines: one JSON object per line. No markdown, no commentary, nothing but the JSON lines." },
    { role: "user", content: [
      `Document title: ${title}`,
      `Document:\n"""\n${String(doc).slice(0, DOC_LIMIT)}\n"""`,
      `Write ${count} quiz questions that test understanding of this document: ${choiceCount} multiple-choice and ${textCount} free-response, in any order.`,
      `Multiple-choice line:\n{"type":"choice","prompt":"...","options":["...","...","...","..."],"correct":0,"why":"one sentence on why the answer is right"}\n- exactly 4 options, one correct, "correct" is the index of the correct option\n- distractors must be plausible`,
      `Free-response line:\n{"type":"text","prompt":"...","rubric":"the key points a correct answer must cover"}`,
      `Rules: every question must be answerable from the document alone; cover different parts of the document; no trick questions.`,
    ].join("\n\n") },
  ];
}

/** Parse and validate one JSONL question line. Throws on invalid shape. */
export function parseQuestion(line) {
  const q = JSON.parse(line);
  if (typeof q.prompt !== "string" || !q.prompt.trim()) throw new Error("generate: missing prompt");
  if (q.type === "choice") {
    if (!Array.isArray(q.options) || q.options.length !== 4 || !q.options.every(o => typeof o === "string" && o.trim())) throw new Error("generate: bad options");
    const correct = Number(q.correct);
    if (!Number.isInteger(correct) || correct < 0 || correct > 3) throw new Error("generate: bad correct index");
    return { type: "choice", prompt: q.prompt.trim(), options: q.options.map(o => o.trim()), correct, why: typeof q.why === "string" ? q.why.trim() : "" };
  }
  if (q.type === "text") {
    if (typeof q.rubric !== "string" || !q.rubric.trim()) throw new Error("generate: missing rubric");
    return { type: "text", prompt: q.prompt.trim(), rubric: q.rubric.trim() };
  }
  throw new Error("generate: unknown type");
}

/** Lenient wrapper for streamed lines: returns null for junk instead of throwing. */
export function tryParseQuestion(line) {
  const cleaned = String(line).replace(/```(json)?/g, "").trim();
  if (!cleaned.startsWith("{")) return null;
  try {
    return parseQuestion(cleaned);
  } catch {
    return null;
  }
}

/** Generate questions from a document. Calls onQuestion(question, soFar, target) as each one lands. */
export async function generateQuiz(title, doc, onQuestion) {
  const count = questionCount(doc);
  const questions = [];
  const take = line => {
    const q = tryParseQuestion(line);
    if (!q) return;
    q.id = `q${questions.length + 1}`;
    questions.push(q);
    onQuestion?.(q, questions.length, count);
  };
  let buffer = "";
  for await (const delta of streamContent(buildQuizPrompt(title, doc, count))) {
    buffer += delta;
    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      take(buffer.slice(0, newline));
      buffer = buffer.slice(newline + 1);
    }
  }
  take(buffer);
  if (!questions.length) throw new Error("generate: the model produced no usable questions");
  return questions;
}
