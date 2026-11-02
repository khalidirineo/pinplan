import { useState } from "react"

interface ExportPanelProps {
  source: string
}

export function ExportPanel({ source }: ExportPanelProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle")

  async function copy() {
    try {
      await navigator.clipboard.writeText(source)
      setStatus("copied")
      return
    } catch {
      // The clipboard API is denied in some embedded browsers. Fall through.
    }
    try {
      const area = document.createElement("textarea")
      area.value = source
      area.setAttribute("readonly", "")
      area.style.position = "fixed"
      area.style.left = "-9999px"
      document.body.appendChild(area)
      area.select()
      const copied = document.execCommand("copy")
      area.remove()
      setStatus(copied ? "copied" : "failed")
    } catch {
      setStatus("failed")
    }
  }

  return (
    <section aria-label="ESP-IDF export" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-100">ESP-IDF</h2>
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded border border-zinc-700 px-2 py-1 text-xs text-zinc-100"
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
