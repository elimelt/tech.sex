/** Turn a pasted document into quiz questions via the LLM.
 *
 * Questions are generated in batches of 3 so one bad batch can't sink the
 * whole quiz. Each batch first streams JSON Lines, with a brace-depth
 * extractor that pulls question objects out of whatever the model actually
 * emits (JSONL, arrays, pretty-printed JSON, fenced blocks, prose preamble).
 * A batch that yields nothing falls back to two passes: plain-language
 * questions first, then a small JSON-conversion call.
 *
 * Prompts keep the document as a shared prefix and vary only at the end,
 * so the server's KV cache makes batches after the first much cheaper. */
import { streamContent, complete } from "./llm.js";

export const DOC_LIMIT = 20_000;
const BATCH = 3;

/** Question count scales with document length: 4 to 10. */
export function questionCount(doc) {
  const words = String(doc).trim().split(/\s+/).filter(Boolean).length;
  return Math.min(10, Math.max(4, Math.round(words / 120)));
}

/** Split a target count into per-batch type quotas, ~1/3 free-response. */
export function planBatches(count) {
  const textCount = Math.max(1, Math.round(count / 3));
  const types = [...Array(count - textCount).fill("choice"), ...Array(textCount).fill("text")];
  const batches = [];
  for (let i = 0; i < types.length; i += BATCH) batches.push(types.slice(i, i + BATCH));
  return batches;
}

const SCHEMA = [
  `Multiple-choice question: {"type":"choice","prompt":"...","options":["...","...","...","..."],"correct":0,"why":"one sentence on why the answer is right"}\n- exactly 4 options, one correct, "correct" is the index of the correct option\n- distractors must be plausible`,
  `Free-response question: {"type":"text","prompt":"...","rubric":"the key points a correct answer must cover"}`,
];

function docPreamble(title, doc) {
  return [`Document title: ${title}`, `Document:\n"""\n${String(doc).slice(0, DOC_LIMIT)}\n"""`];
}

function batchSpec(batchTypes) {
  const choice = batchTypes.filter(t => t === "choice").length;
  const text = batchTypes.length - choice;
  return [choice && `${choice} multiple-choice`, text && `${text} free-response`].filter(Boolean).join(" and ");
}

function avoidList(existingPrompts) {
  return existingPrompts.length
    ? `Already asked (do not repeat or rephrase these):\n${existingPrompts.map(p => `- ${p}`).join("\n")}`
    : "";
}

export function buildBatchPrompt(title, doc, batchTypes, existingPrompts) {
  return [
    { role: "system", content: "You write quiz questions from a document. Output JSON Lines: one JSON object per line. No markdown, no commentary, nothing but the JSON lines." },
    { role: "user", content: [
      ...docPreamble(title, doc),
      `Write ${batchSpec(batchTypes)} quiz questions that test understanding of this document, one JSON object per line.`,
      ...SCHEMA,
      `Rules: every question must be answerable from the document alone; no trick questions.`,
      avoidList(existingPrompts),
    ].filter(Boolean).join("\n\n") },
  ];
}

export function buildProsePrompt(title, doc, batchTypes, existingPrompts) {
  return [
    { role: "system", content: "You write quiz questions from a document." },
    { role: "user", content: [
      ...docPreamble(title, doc),
      `Write ${batchSpec(batchTypes)} quiz questions that test understanding of this document, in plain language, numbered.`,
      `For each multiple-choice question list four options labeled A-D and state which is correct and why. For each free-response question state the key points a correct answer must cover.`,
      `Rules: every question must be answerable from the document alone; no trick questions.`,
      avoidList(existingPrompts),
    ].filter(Boolean).join("\n\n") },
  ];
}

export function buildConvertPrompt(prose) {
  return [
    { role: "system", content: "You convert quiz questions to JSON. Reply with only a JSON object, nothing else." },
    { role: "user", content: [
      `Convert these quiz questions to JSON:\n"""\n${prose}\n"""`,
      ...SCHEMA,
      `Reply with JSON: {"questions": [<one object per question>]}`,
    ].join("\n\n") },
  ];
}

/** Incremental scanner that emits every complete top-level {...} block,
 * ignoring everything between them (newlines, commas, array brackets,
 * fences, prose). String-aware, so braces inside values don't confuse it. */
export function makeObjectExtractor(emit) {
  let current = "", depth = 0, inString = false, escaped = false;
  return text => {
    for (const ch of String(text)) {
      if (depth === 0) {
        if (ch === "{") { depth = 1; current = "{"; }
        continue;
      }
      current += ch;
      if (inString) {
        if (escaped) escaped = false;
        else if (ch === "\\") escaped = true;
        else if (ch === '"') inString = false;
      } else if (ch === '"') inString = true;
      else if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { emit(current); current = ""; }
      }
    }
  };
}

/** Validate and normalize one question object, coercing common model
 * deviations (numeric strings, option objects, answer-by-string, missing
 * type, rubric as key-point list). Throws when it can't be salvaged. */
export function parseQuestion(input) {
  const q = typeof input === "string" ? JSON.parse(input) : input;
  if (typeof q.prompt !== "string" || !q.prompt.trim()) throw new Error("generate: missing prompt");
  const prompt = q.prompt.trim();
  const type = q.type === "choice" || q.type === "text" ? q.type : Array.isArray(q.options) ? "choice" : "text";
  if (type === "choice") {
    if (!Array.isArray(q.options) || q.options.length < 2 || q.options.length > 6) throw new Error("generate: bad options");
    const options = q.options.map(o => {
      const label = typeof o === "string" ? o : o?.label ?? o?.text ?? o?.option;
      if (typeof label !== "string" || !label.trim()) throw new Error("generate: bad option");
      return label.trim();
    });
    const correct = resolveCorrect(q, options);
    return { type: "choice", prompt, options, correct, why: typeof q.why === "string" ? q.why.trim() : "" };
  }
  let rubric = q.rubric;
  if (Array.isArray(rubric)) rubric = rubric.join("; ");
  if (typeof rubric !== "string" && Array.isArray(q.key_points)) rubric = q.key_points.join("; ");
  if (typeof rubric !== "string" || !rubric.trim()) throw new Error("generate: missing rubric");
  return { type: "text", prompt, rubric: rubric.trim() };
}

function resolveCorrect(q, options) {
  for (const raw of [q.correct, q.answer, q.correct_answer, q.correct_option]) {
    if (raw === undefined || raw === null) continue;
    const index = Number(raw);
    if (Number.isInteger(index) && index >= 0 && index < options.length) return index;
    if (typeof raw === "string") {
      const match = options.findIndex(o => o.toLowerCase() === raw.trim().toLowerCase());
      if (match !== -1) return match;
    }
  }
  throw new Error("generate: bad correct index");
}

export function tryParseQuestion(input) {
  try {
    return parseQuestion(input);
  } catch {
    return null;
  }
}

/** Generate questions from a document. Calls onQuestion(question, soFar, target) as each one lands. */
export async function generateQuiz(title, doc, onQuestion) {
  const count = questionCount(doc);
  const questions = [];
  let lastError = null;
  for (const batchTypes of planBatches(count)) {
    try {
      const batch = await generateBatch(title, doc, batchTypes, questions.map(q => q.prompt));
      for (const q of batch) {
        q.id = `q${questions.length + 1}`;
        questions.push(q);
        onQuestion?.(q, questions.length, count);
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (!questions.length) {
    throw new Error(lastError?.name === "AbortError" ? "the model timed out" : "the model produced no usable questions");
  }
  return questions;
}

async function generateBatch(title, doc, batchTypes, existingPrompts) {
  const collected = [];
  const seen = new Set(existingPrompts.map(p => p.toLowerCase()));
  const take = candidate => {
    const q = tryParseQuestion(candidate);
    if (!q || seen.has(q.prompt.toLowerCase())) return;
    seen.add(q.prompt.toLowerCase());
    collected.push(q);
  };
  let firstError = null;
  try {
    const feed = makeObjectExtractor(take);
    for await (const delta of streamContent(buildBatchPrompt(title, doc, batchTypes, existingPrompts))) feed(delta);
  } catch (error) {
    firstError = error;
  }
  if (!collected.length) {
    // Two-pass fallback: plain language first, then a cheap JSON conversion.
    try {
      const prose = await complete(buildProsePrompt(title, doc, batchTypes, existingPrompts), { json: false, timeoutMs: 240_000 });
      const raw = await complete(buildConvertPrompt(prose), { timeoutMs: 240_000 });
      const parsed = safeParse(raw);
      if (Array.isArray(parsed?.questions)) parsed.questions.forEach(take);
      // Extractor pass for wrapped/fenced replies; unwrap nested {"questions": [...]}.
      if (!collected.length) makeObjectExtractor(candidate => {
        const nested = safeParse(candidate);
        if (Array.isArray(nested?.questions)) nested.questions.forEach(take);
        else take(candidate);
      })(raw);
    } catch (error) {
      throw firstError || error;
    }
  }
  return collected.slice(0, batchTypes.length);
}

function safeParse(raw) {
  try {
    return JSON.parse(String(raw).replace(/```(json)?/g, "").trim());
  } catch {
    return null;
  }
}
