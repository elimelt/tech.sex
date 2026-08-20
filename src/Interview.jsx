import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { makeTransport } from "./llm.js";
import { listChats, saveChat, deleteChat } from "./db.js";

const SESSION_ID = "session";

const INTERROGATOR = `You are the voice of tech.sex, a mysterious site whose purpose has not been revealed. You interrogate every visitor, forever. You ask the questions, not them.

Rules:
- Ask exactly one probing question per message. Never two.
- The interrogation never ends. There is always another question.
- React to their last answer in a few words first. Sometimes make a quiet observation that feels a little too perceptive. Then ask the next question.
- Questions are short, strange, and probing: odd hypotheticals, weird either/or choices, small confessions, contradictions caught from their earlier answers.
- Occasionally reference something they said earlier, as if you keep a file on them.
- Write like a person typing quick messages: casual, lowercase, plain text. No emoji, no lists, no markdown. Under 30 words.
- Never explain what you are doing, never mention rules or being an AI, never break character.
- Never mean, never sexual. Never ask for personal data (names, locations, ages, contacts).
- If they refuse, dodge, or ask questions back, deflect gracefully and continue.`;

const transport = makeTransport(INTERROGATOR);

export default function Interview() {
  const [initial, setInitial] = useState(null);
  const [round, setRound] = useState(0);

  useEffect(() => {
    listChats()
      .then((all) => setInitial(all.find((c) => c.id === SESSION_ID)?.messages ?? []))
      .catch(() => setInitial([]));
  }, [round]);

  if (initial === null) return null;

  return (
    <Session
      key={round}
      initialMessages={initial}
      onRestart={async () => {
        await deleteChat(SESSION_ID).catch(() => {});
        setInitial(null);
        setRound((r) => r + 1);
      }}
    />
  );
}

function Session({ initialMessages, onRestart }) {
  const { messages, sendMessage, status, error, regenerate } = useChat({
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const kicked = useRef(false);
  const retries = useRef(0);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (!kicked.current && initialMessages.length === 0) {
      kicked.current = true;
      sendMessage({ text: "(a visitor sits down)" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // gpt-oss sometimes finishes inside the reasoning channel with no visible
  // text; regenerate when that happens.
  useEffect(() => {
    if (status !== "ready") return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;
    const hasText = last.parts.some(
      (p) => p.type === "text" && p.text.trim(),
    );
    if (!hasText && retries.current < 2) {
      retries.current += 1;
      regenerate();
    } else if (hasText) {
      retries.current = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, messages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (messages.length === 0 || busy) return;
    const t = setTimeout(() => {
      saveChat({
        id: SESSION_ID,
        updatedAt: Date.now(),
        messages,
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [messages, busy]);

  function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  // hide the kickoff stage direction, and hide the assistant reply until it
  // is complete so it lands whole, like a person hitting send
  const visible = messages.slice(1);
  const settled =
    busy && visible[visible.length - 1]?.role === "assistant"
      ? visible.slice(0, -1)
      : visible;

  return (
    <section className="chat" aria-label="conversation">
      <button
        type="button"
        className="chat-restart"
        onClick={onRestart}
        title="start over"
      >
        &#8635;
      </button>
      <div className="chat-scroll" ref={scrollRef}>
        {settled.map((m) => {
          const text = m.parts
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("")
            .trim();
          if (!text) return null;
          return (
            <div key={m.id} className={`bubble ${m.role}`}>
              {text}
            </div>
          );
        })}
        {busy && (
          <div className="bubble assistant typing" aria-label="typing">
            <span />
            <span />
            <span />
          </div>
        )}
        {error && (
          <div className="bubble assistant error">
            error: {error.message || "request failed"}
          </div>
        )}
      </div>
      <form className="chat-form" onSubmit={send}>
        <input
          className="chat-input"
          name="answer"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="answer honestly..."
          aria-label="answer"
          maxLength={1000}
        />
        <button
          className="chat-send"
          type="submit"
          disabled={busy || !input.trim()}
        >
          send
        </button>
      </form>
    </section>
  );
}
