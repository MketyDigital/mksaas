export function azureFoundryInputItems(messages: Array<{ role: string; content: unknown }>) {
  return messages.filter((message) => message.role !== "system").map((message) => ({
    role: message.role === "assistant" ? "assistant" : "user",
    content: Array.isArray(message.content) ? message.content : String(message.content || ""),
  }));
}
