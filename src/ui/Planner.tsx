import { useEffect, useMemo, useRef, useState } from "react"
import { exportEspIdf } from "../codegen/exportIdf"
import { loadChip } from "../data/loadChip"
import { evaluate } from "../engine/evaluate"
import { defaultSettings } from "../engine/types"
import type { Assignment, ProjectSettings } from "../engine/types"
import { isEmptyDesign, parseProject, serializeProject } from "../project/document"
import { ShareError, decodeShare, encodeShare } from "../project/share"
import { AssignmentPanel } from "./AssignmentPanel"
import { ExportPanel } from "./ExportPanel"
import { IssuesPanel } from "./IssuesPanel"
import { ModuleMap } from "./ModuleMap"
import { ProjectMenu } from "./ProjectMenu"
import { VerificationNote } from "./VerificationNote"

const chip = loadChip()

function currentShareToken(): string | null {
  const token = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("d")
  return token && token.length > 0 ? token : null
}

function replaceShareToken(token: string | null) {
  const next = `${window.location.pathname}${window.location.search}${token ? `#d=${token}` : ""}`
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (current === next) return
  window.history.replaceState(null, "", next)
}

async function publishShare(chipId: string, settings: ProjectSettings, assignments: Assignment[]): Promise<string> {
  if (isEmptyDesign(settings, assignments)) {
    replaceShareToken(null)
  } else {
    const token = await encodeShare(serializeProject(chipId, settings, assignments, false))
    replaceShareToken(token)
  }
  return window.location.href
}

export function Planner() {
  const [settings, setSettings] = useState<ProjectSettings>(defaultSettings)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [selectedGpio, setSelectedGpio] = useState<number | null>(null)
  const [linkStatus, setLinkStatus] = useState<{ kind: "error"; text: string } | null>(null)
  const shareReady = useRef(false)

  const issues = useMemo(
    () => evaluate(chip, assignments, settings),
    [assignments, settings],
  )
  const exported = useMemo(
    () => exportEspIdf(chip, assignments, settings, issues),
    [assignments, settings, issues],
  )
  const selectedPin = chip.pins.find((pin) => pin.gpio === selectedGpio) ?? null
  const selectedAssignment = assignments.find((assignment) => assignment.gpio === selectedGpio)

  useEffect(() => {
    let cancelled = false
    async function loadFromHash() {
      const token = currentShareToken()
      if (token) {
        try {
          const text = await decodeShare(token)
          if (cancelled) return
          const parsed = parseProject(text, chip.id)
          if (cancelled) return
          if (parsed.ok) {
            setSettings(parsed.settings)
            setAssignments(parsed.assignments)
            setSelectedGpio(parsed.assignments[0]?.gpio ?? null)
          } else {
            setLinkStatus({ kind: "error", text: parsed.error })
          }
        } catch (error) {
          if (!cancelled) {
            const text = error instanceof ShareError ? error.message : "This link could not be read."
            setLinkStatus({ kind: "error", text })
          }
        }
      }
      if (!cancelled) shareReady.current = true
    }
    void loadFromHash()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!shareReady.current) return
    let cancelled = false
    void (async () => {
      try {
        if (isEmptyDesign(settings, assignments)) {
          if (!cancelled) replaceShareToken(null)
          return
        }
        const token = await encodeShare(serializeProject(chip.id, settings, assignments, false))
        if (!cancelled) replaceShareToken(token)
      } catch (error) {
        if (!cancelled) {
          const text = error instanceof ShareError ? error.message : "This design could not be written to the link."
          setLinkStatus({ kind: "error", text })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [settings, assignments])

  function updateSettings(patch: Partial<ProjectSettings>) {
    setLinkStatus(null)
    setSettings((current) => ({ ...current, ...patch }))
  }

  function applyDesign(nextSettings: ProjectSettings, nextAssignments: Assignment[]) {
    setLinkStatus(null)
    setSettings(nextSettings)
    setAssignments(nextAssignments)
    setSelectedGpio((current) => (
      nextAssignments.some((assignment) => assignment.gpio === current) ? current : (nextAssignments[0]?.gpio ?? null)
    ))
  }

  function upsert(assignment: Assignment) {
    setLinkStatus(null)
    setAssignments((current) => {
      const rest = current.filter((item) => item.gpio !== assignment.gpio)
      return [...rest, assignment]
    })
    setSelectedGpio(assignment.gpio)
  }

  function clear(gpio: number) {
    setLinkStatus(null)
    setAssignments((current) => current.filter((item) => item.gpio !== gpio))
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-zinc-100">
      <header className="border-b border-zinc-800 px-4 py-4">
        <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="text-lg font-semibold tracking-tight">PinPlan</h1>
            <p className="mt-1 text-sm text-zinc-400">{chip.name}</p>
            <p className="mt-1 text-sm leading-6 text-zinc-400">Click a pad, assign a function, then read the issues.</p>
          </div>
          <ProjectMenu
            chipId={chip.id}
            settings={settings}
            assignments={assignments}
            notice={linkStatus}
            onLoad={applyDesign}
            onCopyLink={() => publishShare(chip.id, settings, assignments)}
          />
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
      <main className="mx-auto max-w-6xl space-y-4 p-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-4">
            <ModuleMap
              chip={chip}
              assignments={assignments}
              issues={issues}
              selectedGpio={selectedGpio}
              onSelect={setSelectedGpio}
            />
            <IssuesPanel issues={issues} hasAssignments={assignments.length > 0} onSelect={setSelectedGpio} />
            <ExportPanel source={exported} />
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start">
            <AssignmentPanel
              chip={chip}
              pin={selectedPin}
              assignment={selectedAssignment}
              onChange={upsert}
              onClear={clear}
            />
          </div>
        </div>
        <VerificationNote chip={chip} />
      </main>
    </div>
  )
}
