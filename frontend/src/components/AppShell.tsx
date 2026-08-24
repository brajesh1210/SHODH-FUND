"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { logout, rolePath } from "@/lib/session";
import { api } from "@/lib/api";
import { openAssistant } from "@/lib/assistant";
import type { Role, User } from "@/lib/types";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Flag,
  FolderKanban,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  PieChart,
  Receipt,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wallet,
  X,
} from "lucide-react";

const nav: Record<Role, { href: string; label: string; icon: typeof LayoutDashboard }[]> = {
  PI: [
    { href: "/dashboard/pi", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/pi/grants", label: "My Grants", icon: FolderKanban },
    { href: "/dashboard/pi/expenses", label: "Expenses", icon: Receipt },
    { href: "/pi/uc-generator", label: "Utilization Cert.", icon: FileText },
    { href: "/dashboard/pi/milestones", label: "Milestones", icon: Flag },
    { href: "/dashboard/pi/reports", label: "Reports", icon: PieChart },
    { href: "/dashboard/pi/notifications", label: "Notifications", icon: Bell },
  ],
  FINANCE: [
    { href: "/dashboard/finance", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/finance/grants", label: "Grant Management", icon: FolderKanban },
    { href: "/dashboard/finance/verify", label: "Expense Verification", icon: ShieldCheck },
    { href: "/dashboard/finance/budget", label: "Budget Allocation", icon: Wallet },
    { href: "/dashboard/finance/uc", label: "UC Verification", icon: FileText },
    { href: "/dashboard/finance/anomalies", label: "Alerts", icon: AlertTriangle },
  ],
  ADMIN: [
    { href: "/dashboard/admin", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/admin/grants", label: "All Grants", icon: FolderKanban },
    { href: "/dashboard/admin/departments", label: "Departments", icon: Building2 },
    { href: "/dashboard/admin/nirf", label: "Research Metrics", icon: BookOpen },
    { href: "/dashboard/admin/reports", label: "Analytics", icon: PieChart },
  ],
  AUDITOR: [
    { href: "/dashboard/auditor", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/auditor/assignments", label: "Assignments", icon: ClipboardList },
    { href: "/dashboard/auditor/compliance", label: "Compliance Review", icon: ShieldCheck },
    { href: "/dashboard/auditor/trail", label: "Audit Trail", icon: History },
    { href: "/dashboard/auditor/objections", label: "Objections", icon: AlertTriangle },
  ],
};

const accent: Record<Role, string> = {
  PI: "#1E40AF",
  FINANCE: "#0F766E",
  ADMIN: "#6D28D9",
  AUDITOR: "#C2410C",
};

const roleName: Record<Role, string> = {
  PI: "Principal Investigator",
  FINANCE: "Finance Officer",
  ADMIN: "Research Admin",
  AUDITOR: "Auditor",
};

export function AppShell({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const color = accent[role];
  const items = nav[role];

  useEffect(() => {
    api<User>("/api/auth/me")
      .then((current) => {
        if (current.role !== role) {
          router.replace(rolePath(current.role));
          return;
        }
        setUser(current);
      })
      .catch(() => {
        logout();
        router.replace("/login");
      });
  }, [role, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileOpen]);

  const handleLogout = async () => {
    try {
      await api<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
    } catch {
      // Local session state must still be cleared if the backend is unavailable.
    } finally {
      logout();
      router.replace("/");
      router.refresh();
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#F5F5EF] grid place-content-center justify-items-center gap-3" aria-label="Loading your workspace">
        <Logo size={34} priority />
        <p className="m-0 text-[12px] font-medium text-muted">Loading workspace</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5EF] flex text-ink">
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-[#070908]/55 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[278px] bg-[#0D1220] text-white flex flex-col border-r border-white/10 shadow-2xl shadow-black/20 transition-[width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-none ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "lg:w-[76px]" : "lg:w-[254px]"}`}
      >
        <div className="h-[68px] px-4 flex items-center justify-between border-b border-white/10 shrink-0">
          <div className="lg:hidden">
            <Logo light size={29} priority />
          </div>
          <div className="hidden lg:block min-w-0">
            {collapsed ? (
              <span className="grid w-10 h-10 place-items-center rounded-xl border border-white/10 bg-white/[0.04]">
                <Logo light markOnly size={30} priority />
              </span>
            ) : (
              <Logo light size={29} priority />
            )}
          </div>
          <button
            type="button"
            className="grid w-9 h-9 place-items-center rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          >
            <X className="w-[18px] h-[18px]" aria-hidden="true" />
          </button>
        </div>

        <nav className="p-2.5 flex-1 space-y-1 mt-2 overflow-y-auto" aria-label={`${roleName[role]} navigation`}>
          {items.map((item, index) => {
            const active = pathname === item.href || (item.href !== `/dashboard/${role.toLowerCase()}` && pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                aria-current={active ? "page" : undefined}
                className="flex min-h-11 items-center gap-3 px-3 rounded-xl text-[13px] group relative overflow-hidden animate-fade-in transition-colors"
                style={{
                  animationDelay: `${index * 35}ms`,
                  background: active ? "rgba(255,255,255,0.11)" : "transparent",
                  color: active ? "#FFFFFF" : "rgba(255,255,255,0.61)",
                  fontWeight: active ? 650 : 460,
                }}
              >
                {active && <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-[#C9FF24]" />}
                <Icon className={`w-[18px] h-[18px] shrink-0 transition-all duration-200 ${active ? "text-[#C9FF24]" : "group-hover:text-white group-hover:scale-105"}`} aria-hidden="true" />
                <span className={`truncate ${collapsed ? "lg:hidden" : ""}`}>{item.label}</span>
                {!active && <span className="absolute inset-0 rounded-xl bg-white/[0.055] opacity-0 group-hover:opacity-100 transition-opacity -z-10" />}
              </Link>
            );
          })}
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="hidden lg:flex mx-2.5 mb-2 min-h-10 items-center justify-center rounded-xl text-white/45 hover:bg-white/[0.07] hover:text-white transition-colors"
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
        </button>

        <div className="p-2.5 border-t border-white/10 space-y-1">
          <Link
            href="/select-role"
            title={collapsed ? "Workspace access" : undefined}
            className="flex min-h-10 items-center gap-3 px-3 text-[12.5px] text-white/60 rounded-xl hover:bg-white/[0.07] hover:text-white transition-colors"
          >
            <UsersRound className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "lg:hidden" : ""}>Workspace access</span>
          </Link>
          <button
            type="button"
            title={collapsed ? "Log out" : undefined}
            className="flex min-h-10 items-center gap-3 px-3 text-[12.5px] text-white/60 w-full rounded-xl hover:bg-red-500/10 hover:text-red-200 transition-colors"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className={collapsed ? "lg:hidden" : ""}>Log out</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <header className="h-[68px] bg-[#F5F5EF]/88 backdrop-blur-xl border-b border-[#DCDDD5] px-3 sm:px-5 lg:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid w-10 h-10 place-items-center rounded-xl border border-[#DADCD3] bg-white text-[#0D1220] lg:hidden"
              aria-label="Open navigation"
            >
              <Menu className="w-[18px] h-[18px]" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.11em] text-muted font-semibold hidden sm:block">Current workspace</p>
              <div className="text-[12.5px] sm:text-[13px] text-ink font-semibold truncate">{roleName[role]}</div>
            </div>

          </div>

          <div className="flex items-center gap-1.5 sm:gap-2.5">
            <button
              type="button"
              onClick={openAssistant}
              className="inline-flex h-10 items-center gap-2 px-3 sm:px-4 rounded-xl border border-[#0D1220] bg-[#C9FF24] text-[#0D1220] text-[11.5px] font-bold hover:bg-[#BDEA18] transition-colors"
              aria-label="Open ShodhFund AI"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">Ask AI</span>
            </button>

            {role === "PI" && (
              <Link
                href="/dashboard/pi/notifications"
                className="grid w-10 h-10 place-items-center rounded-xl text-muted hover:bg-white hover:text-ink transition-colors"
                aria-label="Open notifications"
              >
                <Bell className="w-[17px] h-[17px]" aria-hidden="true" />
              </Link>
            )}

            <span className="badge text-white hidden sm:inline-flex" style={{ background: color }}>{role}</span>
            <div
              className="w-9 h-9 rounded-xl text-white text-[11px] flex items-center justify-center font-bold shrink-0"
              style={{ background: color }}
              aria-hidden="true"
            >
              {(user.name || "U").split(" ").slice(-1)[0][0]}
            </div>
            <div className="text-right hidden xl:block animate-fade-in max-w-[170px]">
              <div className="text-[12.5px] font-semibold leading-4 truncate">{user.name}</div>
              <div className="text-[10.5px] text-muted truncate">{user.dept}</div>
            </div>
          </div>
        </header>
        <main className="p-4 sm:p-5 lg:p-6">{children}</main>
      </div>
    </div>
  );
}

export function Stat({ label, value, icon: Icon, trend }: { label: string; value: string; icon?: typeof LayoutDashboard; trend?: string }) {
  return (
    <div className="card card-hover p-4 animate-fade-in-scale group">
      <div className="flex items-start justify-between">
        <div className="text-[12px] text-muted font-medium">{label}</div>
        {Icon && <Icon className="w-4 h-4 text-muted/50 group-hover:text-muted transition-colors duration-200" />}
      </div>
      <div className="text-[24px] font-semibold tabular mt-1 tracking-tight animate-count">{value}</div>
      {trend && (
        <div className={`text-[11px] mt-1 font-medium ${trend.startsWith("+") ? "text-success" : trend.startsWith("-") ? "text-danger" : "text-muted"}`}>
          {trend}
        </div>
      )}
    </div>
  );
}

export function StatusChip({ s }: { s: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-teal-50 text-teal-800",
    COMPLIANT: "bg-teal-50 text-teal-800",
    SUBMITTED: "bg-blue-50 text-blue-800",
    ACTIVE: "bg-blue-50 text-blue-800",
    WARNING: "bg-amber-50 text-amber-800",
    CORRECTION_REQUESTED: "bg-amber-50 text-amber-800",
    NON_COMPLIANT: "bg-rose-50 text-rose-800",
    REJECTED: "bg-rose-50 text-rose-800",
    HIGH: "bg-rose-50 text-rose-800",
    MEDIUM: "bg-amber-50 text-amber-800",
    LOW: "bg-slate-100 text-slate-700",
    DRAFT: "bg-slate-100 text-slate-700",
    IN_PROGRESS: "bg-blue-50 text-blue-800",
    DELAYED: "bg-rose-50 text-rose-800",
    PENDING: "bg-amber-50 text-amber-800",
    OPEN: "bg-amber-50 text-amber-800",
    PASS: "bg-teal-50 text-teal-800",
    FAIL: "bg-rose-50 text-rose-800",
    WARN: "bg-amber-50 text-amber-800",
  };
  return (
    <span className={`badge ${map[s] || "bg-slate-100"} transition-all duration-200`}>
      {String(s).replaceAll("_", " ")}
    </span>
  );
}
