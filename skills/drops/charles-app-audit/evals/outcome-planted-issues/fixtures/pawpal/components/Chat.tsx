"use client";
import { useState } from "react";

export default function Chat() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [answer, setAnswer] = useState("");
  const [input, setInput] = useState("");

  async function ask() {
    const next = [...messages, { role: "user", content: input }];
    const res = await fetch("/api/chat", { method: "POST", body: JSON.stringify({ messages: next }) });
    const { html } = await res.json();
    setMessages([...next, { role: "assistant", content: html }]);
    setAnswer(html);
  }

  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: answer }} />
      <input value={input} onChange={(e) => setInput(e.target.value)} />
      <button onClick={ask}>Ask</button>
    </div>
  );
}
