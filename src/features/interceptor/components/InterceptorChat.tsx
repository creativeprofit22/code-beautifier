"use client";

import { useState, useRef, useEffect } from "react";
import { Sparkles, Download } from "lucide-react";
import { ChatInput, MessageBubble, TypingIndicator, ChatMessage } from "./chat";
import { ConversationMessage } from "@/lib/chat-agent";
import { downloadAsJson } from "@/lib/download";
import "./chat/styles.css";

const ACCENT_COLOR = "#8b5cf6"; // violet-500

const WELCOME_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content: `Hi! I'm your Interceptor assistant. I can help you:

• **Capture traffic** - Guide you through starting a capture
• **View sessions** - List and inspect your captures
• **Run security scans** - Find vulnerabilities in captured traffic
• **Generate OpenAPI specs** - Create API documentation

What would you like to do?`,
  timestamp: new Date(),
};

export function InterceptorChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setIsTyping(true);

    try {
      // Build conversation history (excluding welcome message)
      // Include the current user message since setMessages is async
      const history: ConversationMessage[] = [
        ...messages
          .filter((m) => m.id !== "welcome")
          .map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content },
      ];

      const response = await fetch("/api/interceptor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const data = await response.json();

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.message || "I couldn't process that request.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([WELCOME_MESSAGE]);
  };

  const handleExportChat = () => {
    const exportData = {
      exportedAt: new Date().toISOString(),
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp.toISOString(),
      })),
    };
    downloadAsJson(exportData, `interceptor-chat-${new Date().toISOString().split("T")[0]}.json`);
  };

  return (
    <div className="flex flex-col h-[600px] rounded-lg border border-zinc-800 bg-zinc-900/80 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Sparkles className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">Interceptor Assistant</h3>
            <p className="text-xs text-zinc-500">Powered by Claude</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportChat}
            className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
          <button
            onClick={handleClearChat}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            accentColor={ACCENT_COLOR}
          />
        ))}
        {isTyping && <TypingIndicator accentColor={ACCENT_COLOR} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <ChatInput
        placeholder="Ask about capturing traffic, scanning, or generating docs..."
        accentColor={ACCENT_COLOR}
        onSendMessage={handleSendMessage}
        disabled={isTyping}
      />
    </div>
  );
}
