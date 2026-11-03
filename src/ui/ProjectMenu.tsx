import { useRef, useState } from "react"
import type { Assignment, ProjectSettings } from "../engine/types"
import { parseProject, serializeProject } from "../project/document"
import { copyText } from "./clipboard"

const MAX_FILE_BYTES = 100_000

interface ProjectMenuProps {
  chipId: string
  settings: ProjectSettings
  assignments: Assignment[]
  notice: { kind: "ok" | "error"; text: string } | null
  onLoad: (settings: ProjectSettings, assignments: Assignment[]) => void
  onCopyLink: () => Promise<string>
}

export function ProjectMenu({ chipId, settings, assignments, notice, onLoad, onCopyLink }: ProjectMenuProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null)

  function save() {
    const text = serializeProject(chipId, settings, assignments)
    const blob = new Blob([text], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `pinplan-${chipId}.json`
    link.click()
    URL.revokeObjectURL(url)
    setStatus({ kind: "ok", text: "Saved JSON." })
  }

  async function load(file: File | undefined) {
    if (!file) return
    if (file.size > MAX_FILE_BYTES) {
      setStatus({ kind: "error", text: "This file is too large to load." })
      return
    }
    const parsed = parseProject(await file.text(), chipId)
    if (!parsed.ok) {
      setStatus({ kind: "error", text: parsed.error })
      return
    }
    onLoad(parsed.settings, parsed.assignments)
    setStatus({ kind: "ok", text: "Loaded design." })
  }

  async function copyLink() {
    const href = await onCopyLink()
    const copied = await copyText(href)
    setStatus(copied
      ? { kind: "ok", text: "Link copied." }
      : { kind: "error", text: "Copy failed. The address bar has the link." })
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={save} className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100">
          Save JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100"
        >
          Load JSON
        </button>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100"
        >
          Copy link
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          aria-label="Load JSON file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ""
            void load(file)
          }}
        />
      </div>
      {(status ?? notice) && (
        <p role="status" className={`text-sm ${(status ?? notice)?.kind === "error" ? "text-amber-300" : "text-zinc-400"}`}>
          {(status ?? notice)?.text}
        </p>
      )}
    </div>
  )
}
