"use client";

import Link from "next/link";
import {
  ChartNoAxesCombined,
  Coins,
  FileCheck2,
  FileText,
  Landmark,
  ReceiptText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { openAssistant } from "@/lib/assistant";
import {
  type CSSProperties,
  useEffect,
  useRef,
  useState,
} from "react";
import "./landing.css";

const campuses = [
  {
    name: "IIT Delhi",
    city: "New Delhi",
    src: "/landing/universities/iit-delhi.webp",
    alt: "IIT Delhi campus",
    width: 800,
    height: 600,
  },
  {
    name: "IISc",
    city: "Bengaluru",
    src: "/landing/universities/iisc.webp",
    alt: "Indian Institute of Science campus",
    width: 900,
    height: 600,
  },
  {
    name: "JNU",
    city: "New Delhi",
    src: "/landing/universities/jnu.webp",
    alt: "Jawaharlal Nehru University campus",
    width: 800,
    height: 600,
  },
  {
    name: "AIIMS",
    city: "New Delhi",
    src: "/landing/universities/aiims.webp",
    alt: "AIIMS New Delhi campus",
    width: 900,
    height: 458,
  },
  {
    name: "BHU",
    city: "Varanasi",
    src: "/landing/universities/bhu.webp",
    alt: "Banaras Hindu University campus",
    width: 900,
    height: 506,
  },
  {
    name: "NIT Trichy",
    city: "Tiruchirappalli",
    src: "/landing/universities/nit-trichy.webp",
    alt: "NIT Trichy campus",
    width: 800,
    height: 600,
  },
] as const;

const features = [
  {
    icon: Coins,
    title: "Grant Management",
    description:
      "Register sanctions, split budget heads and track every rupee across agencies, departments and projects.",
    action: "Explore workflow",
    href: "#roles",
  },
  {
    icon: ShieldCheck,
    title: "Compliance Review",
    description:
      "Flag recorded duplicate invoices and budget-cap exceptions for human review before finance decides.",
    action: "See review aids",
    href: "#ai",
  },
  {
    icon: FileCheck2,
    title: "UC Generation",
    description:
      "Turn recorded approved expenditure into a structured UC draft for authorized review and certification.",
    action: "See UC workflow",
    href: "#ai",
  },
  {
    icon: ChartNoAxesCombined,
    title: "Anomaly Detection",
    description:
      "Record duplicate-invoice and budget-cap flags alongside manually raised anomalies for review.",
    action: "Review workflow",
    href: "#roles",
  },
] as const;

type RoleKey = "pi" | "finance" | "admin" | "auditor";

const roles: Record<
  RoleKey,
  {
    index: string;
    label: string;
    title: string;
    console: string;
    description: string;
    points: readonly string[];
    oneLabel: string;
    one: string;
    twoLabel: string;
    two: string;
    chart: string;
  }
> = {
  pi: {
    index: "Illustrative workspace 01",
    label: "Principal Investigator",
    title: "Principal Investigator",
    console: "PI workspace",
    description:
      "Know exactly what is available, what has been spent and what needs attention—without maintaining parallel spreadsheets.",
    points: [
      "Recorded budget balance by head",
      "Quick expense and bill capture",
      "UC status and deadline visibility",
    ],
    oneLabel: "Sample available funds",
    one: "₹28.4L",
    twoLabel: "Sample actions",
    two: "03",
    chart: "Monthly expenditure",
  },
  finance: {
    index: "Illustrative workspace 02",
    label: "Finance Officer",
    title: "Finance Officer",
    console: "Finance workspace",
    description:
      "Review vouchers with recorded evidence, apply institutional policy consistently and retain each decision for later review.",
    points: [
      "Structured voucher verification",
      "Recorded checks before approval",
      "Exception and objection tracking",
    ],
    oneLabel: "Sample reviewed amount",
    one: "₹8.7Cr",
    twoLabel: "Sample pending decisions",
    two: "18",
    chart: "Approvals by week",
  },
  admin: {
    index: "Illustrative workspace 03",
    label: "Research Admin",
    title: "Research Admin",
    console: "Admin workspace",
    description:
      "See institution-wide research funding, deadlines and outcomes without chasing departments for fragmented updates.",
    points: [
      "University-wide portfolio view",
      "Agency and department analytics",
      "Research outcome reporting",
    ],
    oneLabel: "Sample active grants",
    one: "146",
    twoLabel: "Sample approaching dates",
    two: "11",
    chart: "Active projects by month",
  },
  auditor: {
    index: "Illustrative workspace 04",
    label: "Auditor",
    title: "Auditor",
    console: "Audit workspace",
    description:
      "Follow the complete trail from sanction to spend, with evidence and decisions attached to every transaction.",
    points: [
      "Recorded activity history",
      "Evidence linked to transactions",
      "Objection resolution workflow",
    ],
    oneLabel: "Sample reviewed entries",
    one: "248",
    twoLabel: "Sample open objections",
    two: "07",
    chart: "Review-status trend",
  },
};

const roleOrder: RoleKey[] = ["pi", "finance", "admin", "auditor"];
const chartHeights = ["42%", "63%", "51%", "78%", "67%", "88%", "72%"];

type BarStyle = CSSProperties & { "--h": string };

function CampusGroup({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <div className="marquee-group" aria-hidden={duplicate || undefined}>
      {campuses.map((campus) => (
        <article className="uni-card" key={`${duplicate ? "copy" : "main"}-${campus.name}`}>
          {/* A plain img preserves the exact approved crop and keeps this component dependency-free. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={campus.src}
            alt={duplicate ? "" : campus.alt}
            width={campus.width}
            height={campus.height}
          />
          <div className="uni-info">
            <div>
              <small>{campus.city}</small>
              <strong>{campus.name}</strong>
            </div>
            <span className="uni-arrow" aria-hidden="true">
              ↗
            </span>
          </div>
        </article>
      ))}
    </div>
  );
}

export default function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const rolePanelRef = useRef<HTMLDivElement>(null);
  const marqueeRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState<RoleKey>("pi");
  const role = roles[activeRole];

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = menuOpen ? "hidden" : previousOverflow;

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen]);

  useEffect(() => {
    const marquee = marqueeRef.current;
    const track = marquee?.querySelector<HTMLElement>(".marquee-track");
    if (!marquee || !track) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let previousTime = performance.now();
    let dragging = false;
    let hovered = false;
    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;

    const wrapScroll = (next: number) => {
      if (reduced) return next;
      const segmentWidth = track.scrollWidth / 2;
      if (!segmentWidth) return next;

      while (next >= segmentWidth) next -= segmentWidth;
      while (next < 0) next += segmentWidth;
      return next;
    };

    const tick = (time: number) => {
      const elapsed = Math.min(time - previousTime, 50);
      previousTime = time;

      if (!dragging && !hovered && !reduced) {
        marquee.scrollLeft = wrapScroll(marquee.scrollLeft + elapsed * 0.034);
      }

      frame = window.requestAnimationFrame(tick);
    };

    const pointerDown = (event: PointerEvent) => {
      if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) return;
      dragging = true;
      pointerId = event.pointerId;
      startX = event.clientX;
      startScroll = marquee.scrollLeft;
      marquee.classList.add("is-dragging");
      marquee.setPointerCapture(event.pointerId);
    };

    const pointerMove = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      event.preventDefault();
      marquee.scrollLeft = wrapScroll(startScroll + startX - event.clientX);
    };

    const stopDragging = (event: PointerEvent) => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      pointerId = null;
      marquee.classList.remove("is-dragging");
      if (marquee.hasPointerCapture(event.pointerId)) {
        marquee.releasePointerCapture(event.pointerId);
      }
      hovered = event.pointerType === "mouse" && marquee.matches(":hover");
      previousTime = performance.now();
    };

    const pointerEnter = (event: PointerEvent) => {
      if (event.pointerType === "mouse") hovered = true;
    };
    const pointerLeave = (event: PointerEvent) => {
      if (event.pointerType === "mouse" && !dragging) hovered = false;
    };
    const keyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const amount = event.key === "ArrowRight" ? 280 : -280;
      marquee.scrollLeft = wrapScroll(marquee.scrollLeft + amount);
    };

    marquee.addEventListener("pointerdown", pointerDown);
    marquee.addEventListener("pointermove", pointerMove, { passive: false });
    marquee.addEventListener("pointerup", stopDragging);
    marquee.addEventListener("pointercancel", stopDragging);
    marquee.addEventListener("pointerenter", pointerEnter);
    marquee.addEventListener("pointerleave", pointerLeave);
    marquee.addEventListener("keydown", keyDown);
    if (!reduced) frame = window.requestAnimationFrame(tick);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      marquee.removeEventListener("pointerdown", pointerDown);
      marquee.removeEventListener("pointermove", pointerMove);
      marquee.removeEventListener("pointerup", stopDragging);
      marquee.removeEventListener("pointercancel", stopDragging);
      marquee.removeEventListener("pointerenter", pointerEnter);
      marquee.removeEventListener("pointerleave", pointerLeave);
      marquee.removeEventListener("keydown", keyDown);
      marquee.classList.remove("is-dragging");
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const cleanups: Array<() => void> = [];

    const revealItems = root.querySelectorAll<HTMLElement>(".reveal");
    if (reduced || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => item.classList.add("visible"));
    } else {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("visible");
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.13, rootMargin: "0px 0px -40px" },
      );
      revealItems.forEach((item) => observer.observe(item));
      cleanups.push(() => observer.disconnect());
    }

    const visual = root.querySelector<HTMLElement>(".hero-visual");
    const orbit = root.querySelector<HTMLElement>("#orbitStage");
    if (visual && orbit && !reduced && finePointer) {
      let frame = 0;
      let orbitX = 0;
      let orbitY = 0;

      const move = (event: PointerEvent) => {
        const rect = visual.getBoundingClientRect();
        orbitX = (event.clientX - rect.left) / rect.width - 0.5;
        orbitY = (event.clientY - rect.top) / rect.height - 0.5;
        if (!frame) {
          frame = window.requestAnimationFrame(() => {
            orbit.style.transform = `rotateY(${orbitX * 7}deg) rotateX(${-orbitY * 7}deg) translate3d(${orbitX * 5}px, ${orbitY * 5}px, 0)`;
            frame = 0;
          });
        }
      };
      const leave = () => {
        if (frame) window.cancelAnimationFrame(frame);
        frame = 0;
        orbit.style.transform = "";
      };

      visual.addEventListener("pointermove", move, { passive: true });
      visual.addEventListener("pointerleave", leave);
      cleanups.push(() => {
        visual.removeEventListener("pointermove", move);
        visual.removeEventListener("pointerleave", leave);
        if (frame) window.cancelAnimationFrame(frame);
      });
    }

    root.querySelectorAll<HTMLElement>("[data-spotlight]").forEach((card) => {
      const move = (event: PointerEvent) => {
        const rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${event.clientX - rect.left}px`);
        card.style.setProperty("--my", `${event.clientY - rect.top}px`);
      };
      card.addEventListener("pointermove", move, { passive: true });
      cleanups.push(() => card.removeEventListener("pointermove", move));
    });

    if (!reduced && finePointer) {
      root.querySelectorAll<HTMLElement>(".magnetic").forEach((button) => {
        const inner = button.querySelector<HTMLElement>("span");
        if (!inner) return;

        const move = (event: PointerEvent) => {
          const rect = button.getBoundingClientRect();
          const x = event.clientX - rect.left - rect.width / 2;
          const y = event.clientY - rect.top - rect.height / 2;
          inner.style.transform = `translate(${x * 0.12}px, ${y * 0.15}px)`;
        };
        const leave = () => {
          inner.style.transform = "";
        };

        button.addEventListener("pointermove", move, { passive: true });
        button.addEventListener("pointerleave", leave);
        cleanups.push(() => {
          button.removeEventListener("pointermove", move);
          button.removeEventListener("pointerleave", leave);
        });
      });
    }

    const dot = root.querySelector<HTMLElement>(".cursor-dot");
    const ring = root.querySelector<HTMLElement>(".cursor-ring");
    if (dot && ring && finePointer) {
      let x = window.innerWidth / 2;
      let y = window.innerHeight / 2;
      let ringX = x;
      let ringY = y;
      let cursorFrame = 0;

      const move = (event: PointerEvent) => {
        x = event.clientX;
        y = event.clientY;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      };
      const loop = () => {
        ringX += (x - ringX) * 0.17;
        ringY += (y - ringY) * 0.17;
        ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
        cursorFrame = window.requestAnimationFrame(loop);
      };

      window.addEventListener("pointermove", move, { passive: true });
      cursorFrame = window.requestAnimationFrame(loop);

      const hoverTargets = root.querySelectorAll<HTMLElement>(
        "a, button, .uni-card, .feature-card",
      );
      const enter = () => ring.classList.add("hover");
      const leave = () => ring.classList.remove("hover");
      hoverTargets.forEach((element) => {
        element.addEventListener("pointerenter", enter);
        element.addEventListener("pointerleave", leave);
      });

      cleanups.push(() => {
        window.removeEventListener("pointermove", move);
        window.cancelAnimationFrame(cursorFrame);
        hoverTargets.forEach((element) => {
          element.removeEventListener("pointerenter", enter);
          element.removeEventListener("pointerleave", leave);
        });
      });
    }

    return () => cleanups.forEach((cleanup) => cleanup());
  }, []);

  const selectRole = (key: RoleKey) => {
    if (key === activeRole) return;
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      rolePanelRef.current?.animate(
        [
          { opacity: 0.55, transform: "translateY(7px)" },
          { opacity: 1, transform: "translateY(0)" },
        ],
        { duration: 380, easing: "cubic-bezier(.22,1,.36,1)" },
      );
    }
    setActiveRole(key);
  };

  const closeMenu = () => setMenuOpen(false);
  const launchAssistant = () => {
    if (menuOpen) {
      setMenuOpen(false);
      window.setTimeout(openAssistant, 40);
      return;
    }
    openAssistant();
  };

  return (
    <div
      ref={rootRef}
      className={`sf-landing${menuOpen ? " menu-open" : ""}`}
    >
      <div className="cursor-dot" aria-hidden="true" />
      <div className="cursor-ring" aria-hidden="true" />

      <div className="nav-wrap">
        <header className="nav" aria-label="Main navigation">
          <Link className="brand" href="/" aria-label="ShodhFund home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/landing/shodhfund-logo-dark.png"
              alt="ShodhFund"
              width={785}
              height={220}
            />
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <a href="#platform">Platform</a>
            <a href="#ai">AI automation</a>
            <a href="#roles">For every role</a>
            <a href="#contact">Contact</a>
          </nav>
          <div className="nav-actions">
            <button className="nav-ai" type="button" onClick={launchAssistant}>
              <Sparkles aria-hidden="true" />
              Ask AI
            </button>
            <Link className="nav-login" href="/login">
              Log in
            </Link>
            <a className="btn btn-dark magnetic" href="#contact">
              <span>
                Request a demo <b className="arrow">↗</b>
              </span>
            </a>
            <button
              className="menu-toggle"
              type="button"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span />
            </button>
          </div>
        </header>
      </div>

      <div className="mobile-menu" aria-hidden={!menuOpen}>
        <nav>
          <a href="#platform" onClick={closeMenu}>Platform</a>
          <a href="#ai" onClick={closeMenu}>AI automation</a>
          <a href="#roles" onClick={closeMenu}>For every role</a>
          <a href="#contact" onClick={closeMenu}>Contact</a>
        </nav>
        <div className="mobile-menu-actions">
          <button className="mobile-ai-action" type="button" onClick={launchAssistant}>
            <span><Sparkles aria-hidden="true" /> Ask ShodhFund AI</span>
            <b>↗</b>
          </button>
          <div className="mobile-auth-links">
            <Link href="/login" onClick={closeMenu}>Log in</Link>
            <Link href="/select-role" onClick={closeMenu}>Open workspace</Link>
          </div>
          <a className="btn btn-lime" href="#contact" onClick={closeMenu}>
            Request a demo <b className="arrow">↗</b>
          </a>
        </div>
      </div>

      <main>
        <section className="hero" id="top">
          <div className="shell hero-grid">
            <div className="hero-copy">
              <h1 className="hero-title" aria-label="Research. Comply. Impact.">
                Research.
                <br />
                <span className="lime-word">Comply.</span>
                <br />
                <span className="impact-word">Impact.</span>
              </h1>
              <p className="hero-description">
                End-to-end platform to manage research grants, track expenditures,
                support compliance review and organize research-funding workflows.
              </p>
              <div className="hero-actions">
                <a className="btn btn-lime magnetic" href="#contact">
                  <span>
                    Request a Demo <b className="arrow">→</b>
                  </span>
                </a>
                <Link className="btn btn-ghost magnetic" href="/select-role">
                  <span>
                    Explore Platform <b className="arrow">›</b>
                  </span>
                </Link>
              </div>
              <div className="hero-trust" aria-label="Platform benefits">
                <div className="trust-item"><i className="trust-check">✓</i> Role-scoped</div>
                <div className="trust-item"><i className="trust-check">✓</i> Record-based</div>
                <div className="trust-item"><i className="trust-check">✓</i> Human-reviewed</div>
              </div>
            </div>

            <div className="hero-visual" aria-label="Connected grant lifecycle illustration">
              <div className="orbit-stage" id="orbitStage">
                <svg className="orbit-lines" viewBox="0 0 600 600" aria-hidden="true">
                  <circle cx="300" cy="300" r="242" />
                  <circle className="dash" cx="300" cy="300" r="192" />
                  <circle cx="300" cy="300" r="137" />
                  <path className="path" d="M300 58A242 242 0 1 1 299.8 58" />
                </svg>
                <div className="core">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="hero-core-mark"
                    src="/landing/shodhfund-mark-light.png"
                    alt="ShodhFund"
                    width={161}
                    height={220}
                  />
                </div>

                <div className="orbiting-nodes" aria-label="ShodhFund grant lifecycle">
                  <div className="orbit-node node-1">
                    <div className="node-content">
                      <div className="node-dot"><ReceiptText /></div>
                      <div className="node-label"><small>01</small><strong>Capture</strong></div>
                    </div>
                  </div>
                  <div className="orbit-node node-2">
                    <div className="node-content">
                      <div className="node-dot"><ShieldCheck /></div>
                      <div className="node-label"><small>02</small><strong>Compliance</strong></div>
                    </div>
                  </div>
                  <div className="orbit-node node-3">
                    <div className="node-content">
                      <div className="node-dot"><FileText /></div>
                      <div className="node-label"><small>03</small><strong>Utilization</strong></div>
                    </div>
                  </div>
                  <div className="orbit-node node-4">
                    <div className="node-content">
                      <div className="node-dot"><Landmark /></div>
                      <div className="node-label"><small>04</small><strong>Impact</strong></div>
                    </div>
                  </div>
                </div>
                <div className="orbit-caption">One connected grant lifecycle</div>
              </div>
            </div>
          </div>
        </section>

        <section className="university-strip" aria-labelledby="institution-heading">
          <div className="strip-head reveal">
            <div>
              <p>Built for India&apos;s research ecosystem</p>
              <h2 id="institution-heading">
                Made for institutions where ambitious research happens.
              </h2>
            </div>
            <span className="strip-note">Hover to pause · Drag to explore</span>
          </div>
          <div className="marquee-shell">
            <div
              className="marquee"
              ref={marqueeRef}
              role="region"
              aria-label="Featured universities. Drag horizontally or use the arrow keys to explore."
              tabIndex={0}
            >
              <div className="marquee-track">
                <CampusGroup />
                <CampusGroup duplicate />
              </div>
            </div>
          </div>
        </section>

        <section className="section lifecycle" id="platform">
          <div className="shell">
            <div className="section-top reveal">
              <div>
                <p className="kicker">The platform</p>
                <h2 className="section-heading">
                  Built for the full <em>grant lifecycle.</em>
                </h2>
              </div>
              <p className="section-copy">
                From sanction letter to Utilization Certificate—without the Excel
                graveyard or last-minute audit panic.
              </p>
            </div>

            <div className="feature-grid">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <article
                    className={`feature-card reveal${index % 2 ? " reveal-delay" : ""}`}
                    key={feature.title}
                  >
                    <div className="feature-visual" aria-hidden="true">
                      <span className="feature-number">0{index + 1}</span>
                      <span className="feature-icon-shell"><Icon /></span>
                    </div>
                    <div className="feature-copy">
                      <h3>{feature.title}</h3>
                      <p>{feature.description}</p>
                      <a className="feature-link" href={feature.href}>
                        <span>{feature.action}</span>
                        <i>↗</i>
                      </a>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section className="section ai-lab" id="ai">
          <div className="shell">
            <div className="ai-head reveal">
              <div>
                <p className="kicker">Intelligence, applied</p>
                <h2 className="section-heading">
                  Automation that <em>supports administrative work.</em>
                </h2>
              </div>
              <div className="ai-head-copy">
                <p>
                  ShodhFund combines optional document extraction, deterministic record
                  checks, scoped data queries and human review in routine workflows.
                </p>
                <div className="ai-pill-row">
                  <span className="ai-pill">Human-in-the-loop</span>
                  <span className="ai-pill">Evidence attached</span>
                  <span className="ai-pill">Recorded checks</span>
                  <span className="ai-pill">Traceable decisions</span>
                </div>
              </div>
            </div>

            <div className="ai-bento">
              <article className="ai-card ocr-card reveal" data-spotlight>
                <span className="ai-tag"><i /> Optional extraction</span>
                <h3>Bill OCR</h3>
                <p>Upload a supported bill to extract available fields, then verify every value before saving.</p>
                <div className="ocr-ui" aria-hidden="true">
                  <div className="scan-line" />
                  <div className="scan-chip">Illustrative preview</div>
                  <div className="invoice-top">
                    <span className="invoice-logo">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/landing/shodhfund-mark-light.png" alt="" width={161} height={220} />
                    </span>
                    <span className="invoice-title" />
                  </div>
                  <div className="invoice-lines"><i /><i /><i /></div>
                  <div className="invoice-total" />
                </div>
              </article>

              <article className="ai-card gfr-card reveal reveal-delay" data-spotlight>
                <span className="ai-tag"><i /> Recorded checks</span>
                <h3>Review flags</h3>
                <p>Duplicate-invoice and budget-cap checks create flags for authorized reviewers.</p>
                <div className="compliance-ring" aria-hidden="true">
                  <svg viewBox="0 0 120 120">
                    <circle className="track" cx="60" cy="60" r="50" />
                    <circle className="value" cx="60" cy="60" r="50" />
                  </svg>
                  <div className="ring-text"><strong>2</strong><small>built-in checks</small></div>
                </div>
              </article>

              <article className="ai-card uc-card reveal" data-spotlight>
                <span className="ai-tag"><i /> Auto-draft</span>
                <h3>UC Builder</h3>
                <p>Approved expense records become a structured draft that still requires authorization.</p>
                <div className="uc-doc" aria-hidden="true">
                  <div className="doc-head" />
                  <div className="doc-line" />
                  <div className="doc-line" />
                  <div className="doc-line" />
                  <div className="doc-stamp">DRAFT</div>
                </div>
              </article>

              <article className="ai-card chat-card reveal reveal-delay" data-spotlight>
                <span className="ai-tag"><i /> Example prompt</span>
                <h3>Talk to your portfolio</h3>
                <p>Ask plain-language questions across projects, funds and pending actions.</p>
                <div className="chat-window">
                  <div className="chat-bubble user">Which projects need a UC this month?</div>
                  <div className="chat-bubble ai">Sign in to query deadlines in records available to your role.</div>
                  <div className="chat-input">Ask about grants, expenses, compliance… <span className="send-dot">↑</span></div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="section roles" id="roles">
          <div className="shell">
            <div className="reveal">
              <p className="kicker">One connected workspace</p>
              <h2 className="section-heading">Purpose-built for <em>every role.</em></h2>
              <p className="section-copy">
                The same source of truth, shaped around the decisions each stakeholder needs to make.
              </p>
            </div>

            <div className="role-tabs reveal" role="tablist" aria-label="Platform roles">
              {roleOrder.map((key) => (
                <button
                  className={`role-tab${activeRole === key ? " active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={activeRole === key}
                  key={key}
                  onClick={() => selectRole(key)}
                >
                  {roles[key].label}
                </button>
              ))}
            </div>

            <div className="role-panel reveal" ref={rolePanelRef}>
              <div className="role-copy">
                <span className="role-index">{role.index}</span>
                <h3>{role.title}</h3>
                <p>{role.description}</p>
                <ul className="role-points">
                  {role.points.map((point) => <li key={point}>{point}</li>)}
                </ul>
              </div>
              <div className="role-console" aria-label="Role dashboard preview">
                <div className="console-top">
                  <div className="console-logo">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/landing/shodhfund-logo-light.png"
                      alt="ShodhFund"
                      width={785}
                      height={220}
                    />
                    <span>{role.console}</span>
                  </div>
                  <div className="console-dots"><i /><i /><i /></div>
                </div>
                <div className="console-grid">
                  <div className="metric">
                    <small>{role.oneLabel}</small>
                    <strong>{role.one}</strong>
                    <em>Illustrative trend: +12%</em>
                  </div>
                  <div className="metric">
                    <small>{role.twoLabel}</small>
                    <strong>{role.two}</strong>
                    <em>Illustrative schedule: 2 due</em>
                  </div>
                </div>
                <div className="console-chart">
                  <span className="chart-title">{role.chart}</span>
                  <div className="chart-bars">
                    {chartHeights.map((height, index) => (
                      <i key={`${height}-${index}`} style={{ "--h": height } as BarStyle} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="final-cta" id="contact">
          <div className="cta-stage" data-spotlight>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="cta-logo"
              src="/landing/shodhfund-logo-light.png"
              alt="ShodhFund"
              width={785}
              height={220}
            />
            <div className="cta-content reveal">
              <h2>Turn research funding into <span>research momentum.</span></h2>
              <div className="cta-bottom">
                <p>
                  Bring grants, expenditure, compliance and research intelligence into one
                  focused platform—built for how Indian institutions actually work.
                </p>
                <a className="btn btn-lime magnetic" href="mailto:hello@shodhfund.in">
                  <span>Start the conversation <b className="arrow">↗</b></span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="shell">
          <div className="footer-top">
            <div className="footer-intro">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="footer-brand"
                src="/landing/shodhfund-logo-dark.png"
                alt="ShodhFund"
                width={785}
                height={220}
              />
              <p className="footer-tagline">
                Research funding, compliance and impact—connected in one clear operating system.
              </p>
            </div>
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#platform">Grant management</a>
              <a href="#ai">Automation and review</a>
              <a href="#roles">Role workspaces</a>
            </div>
            <div className="footer-col">
              <h4>Company</h4>
              <a href="#contact">Contact</a>
              <Link href="/privacy">Privacy</Link>
              <Link href="/security">Security</Link>
            </div>
          </div>
          <div className="footer-bottom">
            <span>© 2026 ShodhFund. Research funding, simplified.</span>
            <details className="photo-credits">
              <summary>Campus photo credits</summary>
              <div>
                Campus photography is sourced from Wikimedia Commons: {" "}
                <a href="https://commons.wikimedia.org/wiki/File:IIT_Delhi.JPG">IIT Delhi</a>, {" "}
                <a href="https://commons.wikimedia.org/wiki/Category:Indian_Institute_of_Science">IISc</a>, {" "}
                <a href="https://commons.wikimedia.org/wiki/Category:Jawaharlal_Nehru_University">JNU</a>, {" "}
                <a href="https://commons.wikimedia.org/wiki/File:AIIMS_-New_Delhi%27s_Ward_Block.jpg">AIIMS</a>, {" "}
                <a href="https://commons.wikimedia.org/wiki/File:BHU_Main_Gate,_Banaras_Hindu_University.jpg">BHU</a> and {" "}
                <a href="https://commons.wikimedia.org/wiki/Category:National_Institute_of_Technology,_Tiruchirappalli">NIT Trichy</a>.
              </div>
            </details>
          </div>
        </div>
      </footer>
    </div>
  );
}
