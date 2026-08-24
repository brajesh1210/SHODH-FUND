"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FlaskConical, Landmark, ShieldCheck, Users } from "lucide-react";
import { Logo } from "@/components/Logo";
import { api } from "@/lib/api";
import { logout, rolePath } from "@/lib/session";
import type { Role, User } from "@/lib/types";

const roleInfo: Record<
  Role,
  { title: string; subtitle: string; icon: typeof FlaskConical; color: string; soft: string }
> = {
  PI: {
    title: "Principal Investigator",
    subtitle: "Manage your grants, expenses, milestones, and utilization certificates.",
    icon: FlaskConical,
    color: "#22C55E",
    soft: "#DCFCE7",
  },
  FINANCE: {
    title: "Finance Officer",
    subtitle: "Review spending, approvals, budget utilization, and UC submissions.",
    icon: Landmark,
    color: "#2563EB",
    soft: "#DBEAFE",
  },
  AUDITOR: {
    title: "Auditor",
    subtitle: "Review recorded compliance labels, anomalies, objections, and audit evidence.",
    icon: ShieldCheck,
    color: "#7C3AED",
    soft: "#EDE9FE",
  },
  ADMIN: {
    title: "Research Administrator",
    subtitle: "Oversee institution-wide users, grants, compliance, and platform records.",
    icon: Users,
    color: "#0F766E",
    soft: "#CCFBF1",
  },
};

export default function SelectRolePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>("/api/auth/me")
      .then((current) => {
        setUser(current);
      })
      .catch(() => {
        logout();
        router.replace("/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-[#F7F8F5]">
        <div className="text-center text-sm text-muted">
          <Logo size={36} priority />
          <p className="mt-4">Verifying your workspace…</p>
        </div>
      </main>
    );
  }

  const info = roleInfo[user.role];
  const Icon = info.icon;

  return (
    <main className="min-h-screen bg-[#F7F8F5] flex flex-col">
      <header className="h-20 px-5 sm:px-10 flex items-center justify-between border-b border-[#DADCD3] bg-white">
        <Logo size={34} priority />
        <div className="text-right">
          <p className="text-[12px] font-semibold text-[#0D1220]">{user.name}</p>
          <p className="text-[10px] text-muted">{user.email}</p>
        </div>
      </header>

      <section className="flex-1 grid place-items-center p-5 sm:p-8">
        <div className="w-full max-w-2xl text-center">
          <span className="eyebrow">Verified access</span>
          <h1 className="mt-4 text-3xl sm:text-5xl font-serif text-[#0D1220] tracking-tight">
            Continue to your workspace
          </h1>
          <p className="mt-3 text-sm text-muted">
            Access is determined by your authenticated account. Workspace switching is disabled for security.
          </p>

          <button
            type="button"
            onClick={() => router.replace(rolePath(user.role))}
            className="mt-9 w-full text-left rounded-3xl border border-[#DADCD3] bg-white p-6 sm:p-8 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#0D1220]"
          >
            <div className="flex items-start gap-5">
              <span
                className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
                style={{ color: info.color, background: info.soft }}
              >
                <Icon className="h-7 w-7" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-xs font-bold uppercase tracking-[0.12em]" style={{ color: info.color }}>
                  Assigned role · {user.role}
                </span>
                <strong className="mt-1 block text-xl text-[#0D1220]">{info.title}</strong>
                <span className="mt-2 block text-sm leading-6 text-muted">{info.subtitle}</span>
                <span className="mt-5 inline-flex rounded-full bg-[#0D1220] px-4 py-2 text-xs font-bold text-white">
                  Enter workspace →
                </span>
              </span>
            </div>
          </button>
        </div>
      </section>
    </main>
  );
}
