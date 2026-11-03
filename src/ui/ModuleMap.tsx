import type { Chip, ModulePad } from "../data/types"
import type { Assignment, Issue } from "../engine/types"
import { shortAssignment, worstSeverity } from "./format"

interface ModuleMapProps {
  chip: Chip
  assignments: Assignment[]
  issues: Issue[]
  selectedGpio: number | null
  onSelect: (gpio: number) => void
}

export function ModuleMap({ chip, assignments, issues, selectedGpio, onSelect }: ModuleMapProps) {
  const bySide = {
    left: chip.module.pads.filter((pad) => pad.side === "left"),
    right: chip.module.pads.filter((pad) => pad.side === "right"),
    bottom: chip.module.pads.filter((pad) => pad.side === "bottom"),
    center: chip.module.pads.filter((pad) => pad.side === "center"),
  }

  return (
    <section aria-label="ESP32-S3-WROOM-1 module" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm text-zinc-400">
        <Legend swatch="bg-red-900 ring-red-500" label="Error" />
        <Legend swatch="bg-amber-900 ring-amber-500" label="Warning" />
        <Legend swatch="bg-sky-950 ring-sky-500" label="Info" />
        <Legend swatch="bg-emerald-950 ring-emerald-600" label="Assigned" />
      </div>
      <div className="w-full">
        <div className="flex h-16 items-end justify-center rounded-t-md border border-b-0 border-zinc-700 bg-gradient-to-b from-zinc-800 to-zinc-900 px-3 pb-2">
          <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Antenna keep-out</p>
        </div>
        <div className="flex items-stretch border-x border-zinc-700 bg-zinc-900">
          <ol className="flex w-[4.75rem] flex-col">
            {bySide.left.map((pad) => (
              <li key={pad.number} className="min-h-8 flex-1">
                <PadButton
                  pad={pad}
                  assignment={assignmentFor(assignments, pad.gpio)}
                  severity={severityFor(issues, pad.gpio)}
                  selected={pad.gpio !== undefined && pad.gpio === selectedGpio}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ol>
          <div className="relative mx-1 min-h-[28rem] flex-1 border-x border-zinc-700 bg-[#141816]">
            <div className="absolute inset-5 rounded-sm bg-gradient-to-b from-zinc-300 via-zinc-400 to-zinc-500 shadow-inner" />
            <p className="absolute left-1/2 top-8 -translate-x-1/2 text-center text-[11px] font-semibold tracking-wide text-zinc-800">
              {chip.module.name}
            </p>
            {bySide.center.map((pad) => (
              <p key={pad.number} className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-zinc-500">
                Pad {pad.number} {pad.name ?? ""}
              </p>
            ))}
          </div>
          <ol className="flex w-[4.75rem] flex-col">
            {bySide.right.map((pad) => (
              <li key={pad.number} className="min-h-8 flex-1">
                <PadButton
                  pad={pad}
                  assignment={assignmentFor(assignments, pad.gpio)}
                  severity={severityFor(issues, pad.gpio)}
                  selected={pad.gpio !== undefined && pad.gpio === selectedGpio}
                  onSelect={onSelect}
                />
              </li>
            ))}
          </ol>
        </div>
        <ol className="grid grid-cols-12 gap-1 border border-t-0 border-zinc-700 bg-zinc-900 p-1">
          {bySide.bottom.map((pad) => (
            <li key={pad.number}>
              <PadButton
                pad={pad}
                assignment={assignmentFor(assignments, pad.gpio)}
                severity={severityFor(issues, pad.gpio)}
                selected={pad.gpio !== undefined && pad.gpio === selectedGpio}
                onSelect={onSelect}
                compact
              />
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function assignmentFor(assignments: Assignment[], gpio: number | undefined): Assignment | undefined {
  if (gpio === undefined) return undefined
  return assignments.find((assignment) => assignment.gpio === gpio)
}

function severityFor(issues: Issue[], gpio: number | undefined): Issue["severity"] | null {
  if (gpio === undefined) return null
  return worstSeverity(issues.filter((issue) => issue.pins.includes(gpio)))
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-sm ring-1 ${swatch}`} />
      {label}
    </span>
  )
}

function PadButton({
  pad,
  assignment,
  severity,
  selected,
  onSelect,
  compact = false,
}: {
  pad: ModulePad
  assignment: Assignment | undefined
  severity: Issue["severity"] | null
  selected: boolean
  onSelect: (gpio: number) => void
  compact?: boolean
}) {
  const gpio = pad.gpio
  const name = gpio !== undefined ? String(gpio) : (pad.name ?? "—")
  const tone =
    severity === "error"
      ? "border-red-500 bg-red-950 text-red-100"
      : severity === "warning"
        ? "border-amber-500 bg-amber-950 text-amber-100"
        : severity === "info"
          ? "border-sky-500 bg-sky-950 text-sky-100"
          : assignment
            ? "border-emerald-700 bg-emerald-950 text-emerald-100"
            : "border-zinc-700 bg-zinc-900 text-zinc-200"
  const selectedRing = selected ? "ring-2 ring-white ring-offset-1 ring-offset-zinc-950" : ""

  if (gpio === undefined) {
    return (
      <div
        className={`flex h-full w-full flex-col items-center justify-center border border-zinc-800 bg-zinc-950 text-zinc-500 ${compact ? "py-1" : ""}`}
      >
        <span className="text-[11px] leading-none">{pad.number}</span>
        <span className="text-xs font-medium leading-tight">{name}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      aria-label={`Pad ${pad.number}, GPIO${gpio}${assignment ? `, ${shortAssignment(assignment)}` : ""}`}
      onClick={() => onSelect(gpio)}
      className={`flex h-full w-full flex-col items-center justify-center border text-left ${tone} ${selectedRing} ${compact ? "py-1" : ""}`}
    >
      <span className="text-[11px] leading-none text-zinc-400">{pad.number}</span>
      <span className={`font-semibold leading-tight ${compact ? "text-xs" : "text-sm"}`}>{name}</span>
      {assignment && !compact ? (
        <span className="text-[11px] leading-none text-current/80">{shortAssignment(assignment)}</span>
      ) : null}
    </button>
  )
}
