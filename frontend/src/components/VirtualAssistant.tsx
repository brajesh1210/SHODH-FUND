"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Database, RotateCcw, Sparkles, X } from "lucide-react";
import { Logo } from "./Logo";
import { OPEN_ASSISTANT_EVENT } from "@/lib/assistant";
import styles from "./VirtualAssistant.module.css";

type AssistantMode = "live-ai" | "built-in-guidance" | "record-data" | "unavailable";

type RecordLink = {
  type: string;
  id: string;
  label: string;
  href: string;
};

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  mode?: AssistantMode;
  source?: string;
  model?: string | null;
  recordAnswer?: string;
  links?: RecordLink[];
  retryText?: string;
}

const suggestions = [
  {
    label: "GFR compliance",
    prompt: "What are the key GFR compliance checks for research grant expenses?",
  },
  {
    label: "Utilization certificate",
    prompt: "How do I prepare a Utilization Certificate in ShodhFund?",
  },
  {
    label: "Expense workflow",
    prompt: "Explain the expense verification workflow for a research grant.",
  },
  {
    label: "Grant management",
    prompt: "How can ShodhFund help me manage an active research grant?",
  },
] as const;

function pageContext(pathname: string) {
  if (pathname === "/") return "Public ShodhFund landing page";
  if (pathname === "/login") return "Login page";
  if (pathname === "/select-role") return "Role selection page";
  if (pathname.includes("/dashboard/pi")) return "Principal Investigator dashboard";
  if (pathname.includes("/dashboard/finance")) return "Finance Officer dashboard";
  if (pathname.includes("/dashboard/admin")) return "Research Admin dashboard";
  if (pathname.includes("/dashboard/auditor")) return "Auditor dashboard";
  if (pathname.includes("/grants")) return "Grant details";
  if (pathname.includes("/expenses")) return "Expense management";
  return "ShodhFund application";
}

function provenanceLabel(message: Message) {
  if (message.mode === "live-ai") return `Live AI${message.model ? ` · ${message.model}` : ""}`;
  if (message.mode === "built-in-guidance") return "Built-in guidance · no live AI response";
  if (message.mode === "record-data") return "Authorized ShodhFund records";
  if (message.mode === "unavailable") return "Assistant unavailable";
  return "ShodhFund assistant";
}

export default function VirtualAssistant() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const canAskRecords = pathname.includes("/dashboard/") || pathname.startsWith("/grants/");

  const closeAssistant = useCallback(() => {
    setIsOpen(false);
    window.setTimeout(() => lastFocusedRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    const open = () => {
      lastFocusedRef.current = document.activeElement as HTMLElement | null;
      setIsOpen(true);
      window.setTimeout(() => textareaRef.current?.focus(), 50);
    };

    window.addEventListener(OPEN_ASSISTANT_EVENT, open);
    return () => window.removeEventListener(OPEN_ASSISTANT_EVENT, open);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAssistant, isOpen]);

  useEffect(() => {
    if (isOpen && (messages.length || isLoading)) {
      messagesEndRef.current?.scrollIntoView({ block: "end" });
    }
  }, [isLoading, isOpen, messages]);

  const resetTextareaHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    resetTextareaHeight();
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const prepareQuestion = (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return null;
    const userMessage: Message = { id: Date.now(), role: "user", content: question };
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setIsLoading(true);
    resetTextareaHeight();
    return { question, history };
  };

  const finishRequest = () => {
    setIsLoading(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const sendMessage = async (text?: string) => {
    const prepared = prepareQuestion(text);
    if (!prepared) return;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prepared.question,
          page: pageContext(pathname),
          history: prepared.history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessages((current) => [
          ...current,
          {
            id: Date.now() + 1,
            role: "assistant",
            mode: "unavailable",
            content: data?.message || data?.error || "Live AI and built-in guidance are unavailable.",
            retryText: prepared.question,
          },
        ]);
        return;
      }

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          mode: data.mode === "live-ai" ? "live-ai" : "built-in-guidance",
          source: data.source,
          model: data.model,
          content: data.answer || data.reply || "I could not generate a response. Please try again.",
          recordAnswer: data.records?.answer,
          links: data.records?.links,
        },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          mode: "unavailable",
          content: "The assistant could not reach the server. Check your connection and try again.",
          retryText: prepared.question,
        },
      ]);
    } finally {
      finishRequest();
    }
  };

  const askRecords = async () => {
    const prepared = prepareQuestion();
    if (!prepared) return;

    try {
      const response = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prepared.question }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "The record query is unavailable.");

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          mode: "record-data",
          source: data.source,
          content: data.answer,
          links: data.links,
        },
      ]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          mode: "unavailable",
          content: error instanceof Error ? error.message : "The record query is unavailable.",
        },
      ]);
    } finally {
      finishRequest();
    }
  };

  const handleTextareaInput = (event: React.FormEvent<HTMLTextAreaElement>) => {
    const target = event.currentTarget;
    target.style.height = "auto";
    target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
  };

  if (!isOpen) return null;

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shodhfund-ai-title"
      ref={dialogRef}
    >
      <section className={styles.chatShell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandMark}><Logo light markOnly size={24} priority /></span>
            <div>
              <h2 id="shodhfund-ai-title">ShodhFund AI</h2>
              <p>Grant and compliance assistant</p>
            </div>
          </div>

          <div className={styles.headerActions}>
            {messages.length > 0 && (
              <button type="button" onClick={clearChat} className={styles.resetButton}>
                <RotateCcw aria-hidden="true" />
                <span>New chat</span>
              </button>
            )}
            <button type="button" onClick={closeAssistant} className={styles.closeButton} aria-label="Close ShodhFund AI">
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className={styles.suggestions} aria-label="Suggested questions">
          {suggestions.map((suggestion) => (
            <button type="button" key={suggestion.label} onClick={() => sendMessage(suggestion.prompt)} disabled={isLoading}>
              {suggestion.label}
            </button>
          ))}
        </nav>

        <div className={styles.conversation}>
          {messages.length === 0 && !isLoading ? (
            <div className={styles.emptyState}>
              <Sparkles aria-hidden="true" />
              <h1>How can I help?</h1>
              <p>Choose live or built-in guidance, or query authenticated records directly.</p>
            </div>
          ) : (
            <div className={styles.messageList} aria-live="polite">
              {messages.map((message) => (
                <article
                  key={message.id}
                  className={`${styles.messageRow} ${message.role === "user" ? styles.userMessage : styles.assistantMessage}`}
                >
                  <div className={`${styles.messageBubble} ${message.mode === "unavailable" ? styles.errorMessage : ""}`}>
                    <strong>{message.role === "assistant" ? "ShodhFund AI" : "You"}</strong>
                    {message.role === "assistant" && (
                      <span className={styles.provenance}>{provenanceLabel(message)}</span>
                    )}
                    <p>{message.content}</p>
                    {message.recordAnswer && message.recordAnswer !== message.content && (
                      <div className={styles.recordData}>
                        <b>Authoritative record result</b>
                        <p>{message.recordAnswer}</p>
                      </div>
                    )}
                    {message.links && message.links.length > 0 && (
                      <div className={styles.recordLinks} aria-label="Authoritative record links">
                        {message.links.slice(0, 6).map((link) => (
                          <Link key={`${link.type}-${link.id}-${link.href}`} href={link.href} onClick={closeAssistant}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                    {message.retryText && (
                      <button type="button" className={styles.retryButton} onClick={() => sendMessage(message.retryText)} disabled={isLoading}>
                        <RotateCcw aria-hidden="true" /> Retry
                      </button>
                    )}
                  </div>
                </article>
              ))}

              {isLoading && (
                <article className={`${styles.messageRow} ${styles.assistantMessage}`} aria-label="ShodhFund AI is generating a response">
                  <div className={`${styles.messageBubble} ${styles.loadingMessage}`}>
                    <strong>ShodhFund AI</strong>
                    <p>Preparing response…</p>
                  </div>
                </article>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <footer className={styles.composerArea}>
          <div className={styles.composer}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onInput={handleTextareaInput}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message ShodhFund AI"
              aria-label="Message ShodhFund AI"
              rows={1}
              disabled={isLoading}
            />
            <button type="button" onClick={() => sendMessage()} disabled={!input.trim() || isLoading} aria-label="Send message">
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
          <div className={styles.composerNote}>
            <span>AI may be inaccurate and cannot approve or change records. Verify important decisions.</span>
            {canAskRecords && (
              <button type="button" onClick={askRecords} disabled={!input.trim() || isLoading}>
                <Database aria-hidden="true" /> Ask Records
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}
