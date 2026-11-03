import { useState } from "react"
import { copyText } from "./clipboard"

interface ExportPanelProps {
  source: string
}

export function ExportPanel({ source }: ExportPanelProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    setStatus(await copyText(source) ? "copied" : "failed")
  }

  return (
    <section aria-label="ESP-IDF export" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">ESP-IDF</h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm text-zinc-100"
        >
          {status === "copied" ? "Copied" : status === "failed" ? "Copy failed" : "Copy"}
        </button>
      </header>
      <pre className="max-h-96 overflow-auto whitespace-pre rounded border border-zinc-800 bg-zinc-900 p-3 text-xs leading-5 text-zinc-200">
        {source}
      </pre>
    </section>
  )
}
