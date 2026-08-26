"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ArrowUp, Database, RotateCcw, X } from "lucide-react";
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
  links?: RecordLink[];
  retryText?: string;
}

const suggestions = [
  { label: "GFR compliance", prompt: "What are the key GFR compliance checks for research grant expenses?" },
  { label: "Utilization certificate", prompt: "How do I prepare a Utilization Certificate in ShodhFund?" },
  { label: "Expense workflow", prompt: "Explain the expense verification workflow for a research grant." },
  { label: "Grant management", prompt: "How can ShodhFund help me manage an active research grant?" },
] as const;

function pageContext(pathname: string) {
  if (pathname === "/") return "Public ShodhFund landing page";
  if (pathname === "/login") return "Login page";
  if (pathname === "/register") return "Registration page";
  if (pathname === "/forgot-password") return "Password recovery";
  if (pathname === "/select-role") return "Role selection";
  if (pathname.includes("/dashboard/pi")) return "Principal Investigator dashboard";
  if (pathname.includes("/dashboard/finance")) return "Finance Officer dashboard";
  if (pathname.includes("/dashboard/admin")) return "Research Admin dashboard";
  if (pathname.includes("/dashboard/auditor")) return "Auditor dashboard";
  return "ShodhFund application";
}

function Loader() {
  return (
    <div className={styles.loader} aria-label="Thinking">
      <span className={styles.loaderLogo}>
        <Logo markOnly size={18} priority />
      </span>
      <span className={styles.loaderDots} aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className={styles.loaderText}>ShodhFund AI Bot is thinking…</span>
    </div>
  );
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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAssistant();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')
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
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAssistant, isOpen]);

  useEffect(() => {
    if (isOpen) messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [isLoading, isOpen, messages]);

  const resetHeight = () => {
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const clearChat = () => {
    setMessages([]);
    setInput("");
    setIsLoading(false);
    resetHeight();
  };

  const prepare = (text?: string) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return null;
    const userMessage: Message = { id: Date.now(), role: "user", content: question };
    setMessages((m) => [...m, userMessage]);
    setInput("");
    setIsLoading(true);
    resetHeight();
    return { question, history: [...messages, userMessage] };
  };

  const finish = () => setIsLoading(false);

  const sendMessage = async (text?: string) => {
    const prepared = prepare(text);
    if (!prepared) return;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: prepared.question,
          page: pageContext(pathname),
          history: prepared.history.map(({ role, content }) => ({ role, content })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((cur) => [
          ...cur,
          { id: Date.now() + 1, role: "assistant", mode: "unavailable", content: data?.message || data?.error || "Assistant unavailable.", retryText: prepared.question },
        ]);
        return;
      }
      setMessages((cur) => [
        ...cur,
        {
          id: Date.now() + 1,
          role: "assistant",
          mode: data.mode,
          content: data.answer || data.reply || "I could not generate a response.",
          links: data.records?.links || data.links,
        },
      ]);
    } catch {
      setMessages((cur) => [
        ...cur,
        { id: Date.now() + 1, role: "assistant", mode: "unavailable", content: "Could not reach ShodhFund AI Bot.", retryText: prepared.question },
      ]);
    } finally {
      finish();
    }
  };

  const askRecords = async () => {
    const prepared = prepare();
    if (!prepared) return;
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prepared.question }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Record query unavailable.");
      setMessages((cur) => [...cur, { id: Date.now() + 1, role: "assistant", mode: "record-data", content: data.answer, links: data.links }]);
    } catch (e) {
      setMessages((cur) => [...cur, { id: Date.now() + 1, role: "assistant", mode: "unavailable", content: e instanceof Error ? e.message : "Record query unavailable." }]);
    } finally {
      finish();
    }
  };

  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const t = e.currentTarget;
    t.style.height = "auto";
    t.style.height = `${Math.min(t.scrollHeight, 120)}px`;
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="shodhfund-ai-title" ref={dialogRef}>
      <section className={styles.chatShell}>
        <header className={styles.header}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>
              <Logo markOnly size={22} priority />
            </span>
            <div>
              <h2 id="shodhfund-ai-title">ShodhFund AI Bot</h2>
              <p>Research funding assistant</p>
            </div>
          </div>
          <div className={styles.headerActions}>
            {messages.length > 0 && (
              <button type="button" onClick={clearChat} className={styles.resetButton}>
                <RotateCcw aria-hidden="true" /> New chat
              </button>
            )}
            <button type="button" onClick={closeAssistant} className={styles.closeButton} aria-label="Close">
              <X aria-hidden="true" />
            </button>
          </div>
        </header>

        <nav className={styles.suggestions} aria-label="Suggestions">
          {suggestions.map((s) => (
            <button key={s.label} type="button" onClick={() => sendMessage(s.prompt)} disabled={isLoading}>
              {s.label}
            </button>
          ))}
        </nav>

        <div className={styles.conversation}>
          {messages.length === 0 && !isLoading ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyLogo}>
                <Logo markOnly size={32} priority />
              </span>
              <h1>Ask ShodhFund</h1>
              <p>Your messages appear on the left, bot replies on the right. Fast, light, with ShodhFund logo.</p>
            </div>
          ) : (
            <div className={styles.messageList} aria-live="polite">
              {messages.map((m) => (
                <article key={m.id} className={`${styles.messageRow} ${m.role === "user" ? styles.userMessage : styles.assistantMessage}`}>
                  {m.role === "assistant" && (
                    <span className={styles.avatar} aria-hidden="true">
                      <Logo markOnly size={16} priority />
                    </span>
                  )}
                  <div className={`${styles.messageBubble} ${m.mode === "unavailable" ? styles.errorMessage : ""}`}>
                    <strong>{m.role === "assistant" ? "ShodhFund AI Bot" : "You"}</strong>
                    <p>{m.content}</p>
                    {m.links && m.links.length > 0 && (
                      <div className={styles.recordLinks}>
                        {m.links.slice(0, 6).map((link) => (
                          <Link key={`${link.type}-${link.id}-${link.href}`} href={link.href} onClick={closeAssistant}>
                            {link.label}
                          </Link>
                        ))}
                      </div>
                    )}
                    {m.retryText && (
                      <button type="button" className={styles.retryButton} onClick={() => sendMessage(m.retryText)} disabled={isLoading}>
                        <RotateCcw aria-hidden="true" /> Retry
                      </button>
                    )}
                  </div>
                </article>
              ))}
              {isLoading && (
                <article className={`${styles.messageRow} ${styles.assistantMessage}`}>
                  <span className={styles.avatar} aria-hidden="true">
                    <Logo markOnly size={16} priority />
                  </span>
                  <div className={`${styles.messageBubble} ${styles.loadingMessage}`}>
                    <strong>ShodhFund AI Bot</strong>
                    <Loader />
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
              onChange={(e) => setInput(e.target.value)}
              onInput={onInput}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Ask about your grants, expenses, UCs..."
              aria-label="Message ShodhFund AI Bot"
              rows={1}
              disabled={isLoading}
            />
            <button type="button" onClick={() => sendMessage()} disabled={!input.trim() || isLoading} aria-label="Send">
              <ArrowUp aria-hidden="true" />
            </button>
          </div>
          <div className={styles.composerNote}>
            <span>ShodhFund AI Bot may be inaccurate. Verify financial decisions.</span>
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
