import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DirectChatTransport, ToolLoopAgent } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { listChats, saveChat, deleteChat } from "./db.js";

const MODEL = "gpt-oss:20b";
const SYSTEM =
  "You are a chill, laid-back friend hanging out on tech.sex. Talk casually, like texting a buddy. Be warm and genuine, never salesy or suggestive. Keep replies short, a few sentences max.";

const provider = createOpenAICompatible({
  name: "ollama",
  baseURL: "https://llm.elimelt.com/v1",
});

const transport = new DirectChatTransport({
  agent: new ToolLoopAgent({
    model: provider.chatModel(MODEL),
    instructions: SYSTEM,
  }),
});

function titleFrom(messages) {
  const first = messages.find((m) => m.role === "user");
  const text = first?.parts?.find((p) => p.type === "text")?.text ?? "";
  return text.slice(0, 42) || "untitled";
}

export default function Chat() {
  const [chats, setChats] = useState([]);
  const [activeId, setActiveId] = useState(null);

  useEffect(() => {
    listChats()
      .then((all) => {
        setChats(all);
        setActiveId(all[0]?.id ?? crypto.randomUUID());
      })
      .catch(() => setActiveId(crypto.randomUUID()));
  }, []);

  if (!activeId) return null;

  const active = chats.find((c) => c.id === activeId);

  return (
    <ChatSession
      key={activeId}
      chatId={activeId}
      initialMessages={active?.messages ?? []}
      chats={chats}
      onSwitch={setActiveId}
      onNew={() => setActiveId(crypto.randomUUID())}
      onDelete={async () => {
        await deleteChat(activeId).catch(() => {});
        const rest = chats.filter((c) => c.id !== activeId);
        setChats(rest);
        setActiveId(rest[0]?.id ?? crypto.randomUUID());
      }}
      onPersist={(rec) =>
        setChats((cs) => [rec, ...cs.filter((c) => c.id !== rec.id)])
      }
    />
  );
}

function ChatSession({
  chatId,
  initialMessages,
  chats,
  onSwitch,
  onNew,
  onDelete,
  onPersist,
}) {
  const { messages, sendMessage, status, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  useEffect(() => {
    if (messages.length === 0) return;
    const t = setTimeout(() => {
      const rec = {
        id: chatId,
        title: titleFrom(messages),
        updatedAt: Date.now(),
        messages,
      };
      saveChat(rec).catch(() => {});
      onPersist(rec);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, chatId]);

  function send(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  const inList = chats.some((c) => c.id === chatId);

  return (
    <section className="chat" aria-label="chat">
      <div className="chat-header">
        <select
          className="chat-select"
          value={chatId}
          onChange={(e) => onSwitch(e.target.value)}
          aria-label="conversation"
        >
          {!inList && <option value={chatId}>new chat</option>}
          {chats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="chat-icon-btn"
          onClick={onNew}
          title="new chat"
        >
          +
        </button>
        <button
          type="button"
          className="chat-icon-btn"
          onClick={onDelete}
          title="delete chat"
        >
          &times;
        </button>
      </div>
      <div className="chat-scroll" ref={scrollRef}>
        {messages.length === 0 && !busy && (
          <p className="chat-empty">ask me anything</p>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.parts.map((p, i) => {
              if (p.type === "reasoning" && p.text.trim()) {
                return (
                  <details key={i} className="reasoning">
                    <summary>reasoning</summary>
                    <div className="reasoning-body">{p.text}</div>
                  </details>
                );
              }
              if (p.type === "text") {
                return <span key={i}>{p.text}</span>;
              }
              return null;
            })}
          </div>
        ))}
        {status === "submitted" && (
          <div className="bubble assistant typing" aria-label="thinking">
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
          name="message"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="say something..."
          aria-label="message"
          maxLength={2000}
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
