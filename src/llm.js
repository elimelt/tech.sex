/** Client for the keyless OpenAI-compatible endpoint. No credentials in this static app. */
const BASE_URL = "https://llm.elimelt.com/v1";
const MODEL = "gpt-oss:20b";

/** Fire-and-forget request so the model is loaded before the first real call. */
export function warmUp() {
  fetch(`${BASE_URL}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: MODEL, messages: [{ role: "user", content: "hi" }], max_tokens: 1 }),
  }).catch(() => {});
}

/** One-shot completion. Returns the message content. */
export async function complete(messages, { timeoutMs = 30_000, json = true } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
        ...(json ? { response_format: { type: "json_object" } } : {}),
      }),
    });
    if (!response.ok) throw new Error(`llm: HTTP ${response.status}`);
    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "";
  } finally {
    clearTimeout(timer);
  }
}

/** Streaming completion. Yields content deltas. Aborts after `idleMs` without progress. */
export async function* streamContent(messages, { idleMs = 60_000 } = {}) {
  const controller = new AbortController();
  let timer = setTimeout(() => controller.abort(), idleMs);
  const bump = () => { clearTimeout(timer); timer = setTimeout(() => controller.abort(), idleMs); };
  try {
    const response = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({ model: MODEL, messages, temperature: 0, reasoning_effort: "low", stream: true }),
    });
    if (!response.ok) throw new Error(`llm: HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bump();
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (!data || data === "[DONE]") continue;
        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
