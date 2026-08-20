import { DirectChatTransport, ToolLoopAgent } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const MODEL = "gpt-oss:20b";

const provider = createOpenAICompatible({
  name: "ollama",
  baseURL: "https://llm.elimelt.com/v1",
});

export function makeTransport(instructions) {
  return new DirectChatTransport({
    agent: new ToolLoopAgent({
      model: provider.chatModel(MODEL),
      instructions,
    }),
  });
}
