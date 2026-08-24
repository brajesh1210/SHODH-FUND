"use client";
import { AppShell, StatusChip } from "@/components/AppShell";
import { useList } from "@/lib/useList";
import Link from "next/link";

export default function CalendarPage() {
  const { data, loading, error } = useList<{ id: string; type: string; date: string; title: string; subtitle: string; href: string }>("/api/calendar");
  if (loading) {
    return <AppShell role="PI"><div className="card p-8 text-sm text-muted">Loading calendar records…</div></AppShell>;
  }
  if (error) {
    return <AppShell role="PI"><div className="card p-8 text-sm text-red-700" role="alert">{error}</div></AppShell>;
  }
  return (
    <AppShell role="PI">
      <h1 className="text-2xl font-semibold mb-4">Grant calendar</h1>
      <p className="text-sm text-ink-2 mb-4">UC due dates and milestones from grants available to your account.</p>
      <div className="card divide-y divide-border">
        {data.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted">No calendar events are recorded for your grants.</div>}
        {data.map((e) => (
          <Link key={e.id} href={e.href} className="px-4 py-3 flex justify-between gap-4 hover:bg-surface">
            <div>
              <div className="font-medium">{e.title}</div>
              <div className="text-xs text-muted">{e.subtitle}</div>
            </div>
            <div className="text-right">
              <div className="tabular text-sm">{e.date}</div>
              <StatusChip s={e.type} />
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
