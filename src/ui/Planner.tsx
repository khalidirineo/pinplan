import { useMemo, useState } from "react"
import { loadChip } from "../data/loadChip"
import { evaluate } from "../engine/evaluate"
import { defaultSettings } from "../engine/types"
import type { Assignment, ProjectSettings } from "../engine/types"
import { AssignmentPanel } from "./AssignmentPanel"
import { IssuesPanel } from "./IssuesPanel"
import { ModuleMap } from "./ModuleMap"

const chip = loadChip()

export function Planner() {
  const [settings, setSettings] = useState<ProjectSettings>(defaultSettings)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedGpio, setSelectedGpio] = useState<number | null>(null)

  const issues = useMemo(
    () => evaluate(chip, assignments, settings),
    [assignments, settings],
  )
  const selectedPin = chip.pins.find((pin) => pin.gpio === selectedGpio) ?? null
  const selectedAssignment = assignments.find((assignment) => assignment.gpio === selectedGpio)

  function updateSettings(patch: Partial<ProjectSettings>) {
    setSettings((current) => ({ ...current, ...patch }))
  }

  function upsert(assignment: Assignment) {
    setAssignments((current) => {
      const rest = current.filter((item) => item.gpio !== assignment.gpio)
      return [...rest, assignment]
    })
    setSelectedGpio(assignment.gpio)
  }

  function clear(gpio: number) {
    setAssignments((current) => current.filter((item) => item.gpio !== gpio))
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">PinPlan</h1>
            <p className="text-xs text-zinc-400">{chip.name}</p>
          </div>
          <fieldset className="flex flex-wrap items-center gap-4 text-sm">
            <legend className="sr-only">Project settings</legend>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.wifiEnabled}
                onChange={(event) => updateSettings({ wifiEnabled: event.target.checked })}
              />
              Wi-Fi
            </label>
            <label className="flex items-center gap-2">
              PSRAM
              <select
                aria-label="PSRAM"
                value={settings.psram}
                onChange={(event) => updateSettings({ psram: event.target.value as ProjectSettings["psram"] })}
                className="rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm"
              >
                <option value="none">none</option>
                <option value="quad">quad</option>
                <option value="octal">octal</option>
              </select>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={settings.nativeUsb}
                onChange={(event) => updateSettings({ nativeUsb: event.target.checked })}
              />
              Native USB
            </label>
          </fieldset>
        </div>
      </header>
      <main className="mx-auto grid max-w-6xl gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <ModuleMap
            chip={chip}
            assignments={assignments}
            issues={issues}
            selectedGpio={selectedGpio}
            onSelect={setSelectedGpio}
          />
          <IssuesPanel issues={issues} onSelect={setSelectedGpio} />
        </div>
        <AssignmentPanel
          chip={chip}
          pin={selectedPin}
          assignment={selectedAssignment}
          onChange={upsert}
          onClear={clear}
        />
      </main>
    </div>
  )
}
