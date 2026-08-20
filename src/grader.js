/** Grade a free-response answer on a bipolar axis via the shared LLM endpoint. */
const BASE_URL = "https://llm.elimelt.com/v1";
const MODEL = "gpt-oss:20b";
const TIMEOUT_MS = 25_000;
const ATTEMPTS = 2;

/** Fire-and-forget request so the model is loaded before the first real grade. */
export function warmUp() {
  fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
  }).catch(() => {});
}

/** Resolves to axis points, e.g. { voice: -2 }. Rejects after all attempts fail. */
export async function gradeText(quiz, question, text) {
  const grading = question.grading;
  const axis = quiz.axes.find(a => a.id === grading.axis);
  const messages = [
    { role: "system", content: "You grade one personality-quiz free response. Reply with only a JSON object, nothing else." },
    { role: "user", content: buildPrompt(question, axis, grading, text) },
  ];
  let lastError;
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const raw = await complete(messages);
      return { [grading.axis]: parseScore(raw, grading.scale) };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

function buildPrompt(question, axis, grading, text) {
  const [min, max] = grading.scale;
  const anchors = grading.anchors.map(a => `- ${JSON.stringify(a.text)} -> ${a.score}`).join("\n");
  return [
    `Axis: "${axis.left}" (${min}) to "${axis.right}" (${max}).`,
    `Criteria: ${grading.criteria}`,
    `Question shown to the user: ${JSON.stringify(question.prompt)}`,
    `Scored examples:\n${anchors}`,
    `Response to grade:\n${JSON.stringify(text)}`,
    `Reply with JSON: {"relevant": true|false, "score": <integer ${min} to ${max}>}`,
    `Set "relevant" to false and "score" to 0 when the response is empty, gibberish, or off-topic.`,
  ].join("\n\n");
}

async function complete(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) throw new Error(`grader: HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** Extract and clamp the score from a model reply. Exported for tests. */
export function parseScore(raw, [min, max]) {
  const match = String(raw).match(/\{[^{}]*\}/);
  if (!match) throw new Error("grader: no JSON in reply");
  const parsed = JSON.parse(match[0]);
  if (parsed.relevant === false) return 0;
  const score = Math.round(Number(parsed.score));
  if (!Number.isFinite(score)) throw new Error("grader: score is not a number");
  return Math.max(min, Math.min(max, score));
}
