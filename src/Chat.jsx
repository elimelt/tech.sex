import { useEffect, useRef, useState } from "react";

const API_URL = "https://llm.elimelt.com/v1/chat/completions";
const MODEL = "gemma2:2b";
const SYSTEM = {
  role: "system",
  content:
    "You are a chill, laid-back friend hanging out on tech.sex. Talk casually, like texting a buddy. Be warm and genuine, never salesy or suggestive. Keep replies short, a few sentences max.",
};

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  async function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          messages: [SYSTEM, ...next.map(({ role, content }) => ({ role, content }))],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const reply =
        data.choices?.[0]?.message?.content?.trim() || "(empty reply)";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (err) {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: `error: ${err.message}`, error: true },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="chat" aria-label="chat">
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !busy && (
          <p className="chat-empty">ask me anything</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`bubble ${m.role} ${m.error ? "error" : ""}`}
          >
            {m.content}
          </div>
        ))}
        {busy && (
          <div className="bubble assistant typing" aria-label="thinking">
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          aria-label="message"
          maxLength={2000}
        />
        <button className="chat-send" type="submit" disabled={busy || !input.trim()}>
          send
        </button>
      </form>
    </section>
  );
}
