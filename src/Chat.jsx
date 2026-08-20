import { useEffect, useRef, useState } from "react";

const API_URL = "https://llm.elimelt.com/v1/chat/completions";
const MODEL = "gpt-oss:20b";
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
    let streaming = false;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: MODEL,
          stream: true,
          messages: [SYSTEM, ...next.map(({ role, content }) => ({ role, content }))],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          const payload = line.trim().replace(/^data:\s*/, "");
          if (!payload || payload === "[DONE]" || !line.startsWith("data:"))
            continue;
          const delta = JSON.parse(payload).choices?.[0]?.delta?.content;
          if (!delta) continue;
          reply += delta;
          if (!streaming) {
            streaming = true;
            setMessages((m) => [...m, { role: "assistant", content: reply }]);
          } else {
            setMessages((m) => [
              ...m.slice(0, -1),
              { role: "assistant", content: reply },
            ]);
          }
        }
      }
      if (!streaming) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: "(empty reply)" },
        ]);
      }
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
        {busy && messages[messages.length - 1]?.role !== "assistant" && (
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
