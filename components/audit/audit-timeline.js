import { formatActivityDate } from "@/lib/utils";

export function AuditTimeline({ entries }) {
  if (!entries.length) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 py-12 text-center text-sm text-slate-500">
        No activity recorded for this monthly target plan yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {entries.map((entry) => (
        <div
          key={entry.id}
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-semibold text-slate-900">{entry.userName}</p>
            {entry.role && <p className="text-sm text-slate-500">{entry.role}</p>}
          </div>
          <p className="mt-2 text-slate-800">{entry.headline}</p>
          {entry.subline && <p className="mt-1 text-sm text-slate-600">{entry.subline}</p>}
          {entry.comment && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              &ldquo;{entry.comment}&rdquo;
            </p>
          )}
          <p className="mt-3 text-sm text-slate-500">{formatActivityDate(entry.timestamp)}</p>
        </div>
      ))}
    </div>
  );
}
