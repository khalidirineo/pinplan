import type { Issue } from "../engine/types"

interface IssuesPanelProps {
  issues: Issue[]
  hasAssignments: boolean
  onSelect: (gpio: number) => void
}

const tone: Record<Issue["severity"], string> = {
  error: "border-red-900 bg-red-950/60 text-red-100",
  warning: "border-amber-900 bg-amber-950/50 text-amber-100",
  info: "border-sky-900 bg-sky-950/40 text-sky-100",
}

export function IssuesPanel({ issues, hasAssignments, onSelect }: IssuesPanelProps) {
  const counts = {
    error: issues.filter((issue) => issue.severity === "error").length,
    warning: issues.filter((issue) => issue.severity === "warning").length,
    info: issues.filter((issue) => issue.severity === "info").length,
  }

  return (
    <section aria-label="Issues" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">Issues</h2>
        <p className="text-xs text-zinc-400">
          {counts.error} errors · {counts.warning} warnings · {counts.info} info
        </p>
      </header>
      {issues.length === 0 ? (
        <p className="text-sm leading-6 text-zinc-400">
          {hasAssignments ? "No conflicts on this design." : "Assign a pin to see conflicts. A blank design has none."}
        </p>
      ) : (
        <ul className="space-y-2">
          {issues.map((issue) => (
            <li key={`${issue.ruleId}-${issue.pins.join("-")}-${issue.message}`} className={`rounded border px-3 py-2 ${tone[issue.severity]}`}>
              <p className="text-xs uppercase tracking-wide opacity-70">
                {issue.severity} · {issue.ruleId}
              </p>
              <p className="mt-1 text-sm leading-5">{issue.message}</p>
              <p className="mt-1 text-xs leading-5 opacity-80">{issue.fix}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {issue.pins.map((gpio) => (
                  <button
                    key={gpio}
                    type="button"
                    onClick={() => onSelect(gpio)}
                    className="rounded bg-black/30 px-2 py-0.5 text-xs"
                  >
                    GPIO{gpio}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
