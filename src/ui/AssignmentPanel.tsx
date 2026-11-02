import type { Chip, Pin } from "../data/types"
import type { Assignment, FunctionName } from "../engine/types"

const FUNCTIONS: FunctionName[] = ["gpio", "adc", "ledc", "i2c", "spi", "uart"]
const SIGNALS = {
  i2c: ["sda", "scl"],
  spi: ["mosi", "miso", "sck", "cs"],
  uart: ["tx", "rx"],
} as const

interface AssignmentPanelProps {
  chip: Chip
  pin: Pin | null
  assignment: Assignment | undefined
  onChange: (assignment: Assignment) => void
  onClear: (gpio: number) => void
}

export function AssignmentPanel({ chip, pin, assignment, onChange, onClear }: AssignmentPanelProps) {
  return (
    <section aria-label="Pin assignment" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      {pin === null ? (
        <p className="text-sm leading-6 text-zinc-400">Select a GPIO on the module to assign a function.</p>
      ) : (
        <PinForm chip={chip} pin={pin} assignment={assignment} onChange={onChange} onClear={onClear} />
      )}
    </section>
  )
}

function PinForm({
  chip,
  pin,
  assignment,
  onChange,
  onClear,
}: {
  chip: Chip
  pin: Pin
  assignment: Assignment | undefined
  onChange: (assignment: Assignment) => void
  onClear: (gpio: number) => void
}) {
  const current = assignment ?? blank(pin.gpio, chip)

  function commit(next: Assignment) {
    onChange(clean(next))
  }

  return (
    <div className="space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-zinc-100">GPIO{pin.gpio}</h2>
        <p className="mt-1 text-xs leading-5 text-zinc-400">
          Pad {pin.modulePad ?? "—"} · {pin.names.join(" · ")}
        </p>
      </header>

      {pin.constraints.length > 0 ? (
        <ul className="space-y-2">
          {pin.constraints.map((constraint) => (
            <li key={constraint.id} className="rounded border border-zinc-800 bg-zinc-900 px-2 py-1.5 text-xs leading-5 text-zinc-300">
              {constraint.effect}
            </li>
          ))}
        </ul>
      ) : null}

      {assignment === undefined ? (
        <button
          type="button"
          onClick={() => commit(blank(pin.gpio, chip))}
          className="w-full rounded bg-zinc-100 px-3 py-2 text-sm font-medium text-zinc-950"
        >
          Assign GPIO{pin.gpio}
        </button>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <label className="block text-xs text-zinc-400">
            Label
            <input
              value={current.label ?? ""}
              onChange={(event) => commit({ ...current, label: event.target.value })}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            />
          </label>

          <label className="block text-xs text-zinc-400">
            Function
            <select
              aria-label="Function"
              value={current.function}
              onChange={(event) => commit(withFunction(pin.gpio, current, event.target.value as FunctionName, chip))}
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            >
              {FUNCTIONS.map((fn) => (
                <option key={fn} value={fn}>
                  {fn}
                </option>
              ))}
            </select>
          </label>

          {current.function === "gpio" ? (
            <label className="block text-xs text-zinc-400">
              Direction
              <select
                aria-label="Direction"
                value={current.direction ?? "output"}
                onChange={(event) =>
                  commit({
                    ...current,
                    direction: event.target.value as "input" | "output",
                    role: event.target.value === "output" ? undefined : current.role,
                  })
                }
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              >
                <option value="output">output</option>
                <option value="input">input</option>
              </select>
            </label>
          ) : null}

          {current.function === "ledc" ? (
            <label className="block text-xs text-zinc-400">
              LEDC channel
              <select
                aria-label="LEDC channel"
                value={current.channel ?? 0}
                onChange={(event) => commit({ ...current, channel: Number(event.target.value) })}
                className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
              >
                {Array.from({ length: chip.resources.ledc.channels }, (_, channel) => (
                  <option key={channel} value={channel}>
                    {channel}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {current.function === "i2c" || current.function === "spi" || current.function === "uart" ? (
            <>
              <label className="block text-xs text-zinc-400">
                Instance
                <select
                  aria-label="Instance"
                  value={current.instance ?? chip.resources[current.function].instances[0]}
                  onChange={(event) => commit({ ...current, instance: Number(event.target.value) })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                >
                  {chip.resources[current.function].instances.map((instance) => (
                    <option key={instance} value={instance}>
                      {current.function.toUpperCase()}
                      {instance}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-zinc-400">
                Signal
                <select
                  aria-label="Signal"
                  value={current.signal ?? SIGNALS[current.function][0]}
                  onChange={(event) => commit({ ...current, signal: event.target.value })}
                  className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
                >
                  {SIGNALS[current.function].map((signal) => (
                    <option key={signal} value={signal}>
                      {signal.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          {current.function === "adc" && pin.adc === null ? (
            <p className="text-xs leading-5 text-red-300">This GPIO has no ADC channel.</p>
          ) : null}
          {current.function === "adc" && pin.adc ? (
            <p className="text-xs text-zinc-400">
              {pin.adc.unit} channel {pin.adc.channel}
            </p>
          ) : null}

          <label className="block text-xs text-zinc-400">
            External pull at reset
            <select
              aria-label="External pull at reset"
              value={current.externalPull ?? ""}
              onChange={(event) =>
                commit({
                  ...current,
                  externalPull: event.target.value === "" ? undefined : (event.target.value as "up" | "down"),
                })
              }
              className="mt-1 w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
            >
              <option value="">none</option>
              <option value="up">pull-up</option>
              <option value="down">pull-down</option>
            </select>
          </label>

          {current.function === "gpio" && current.direction === "input" ? (
            <label className="flex items-center gap-2 text-sm text-zinc-200">
              <input
                type="checkbox"
                checked={current.role === "button"}
                onChange={(event) => commit({ ...current, role: event.target.checked ? "button" : undefined })}
              />
              Button to ground
            </label>
          ) : null}

          <button
            type="button"
            onClick={() => onClear(pin.gpio)}
            className="w-full rounded border border-zinc-700 px-3 py-2 text-sm text-zinc-200"
          >
            Clear GPIO{pin.gpio}
          </button>
        </form>
      )}
    </div>
  )
}

function blank(gpio: number, chip: Chip): Assignment {
  return withFunction(gpio, undefined, "gpio", chip)
}

function withFunction(gpio: number, current: Assignment | undefined, fn: FunctionName, chip: Chip): Assignment {
  const id = current?.id ?? `gpio-${gpio}`
  const label = current?.label
  const externalPull = current?.externalPull
  if (fn === "gpio") return { id, gpio, function: "gpio", direction: "output", label, externalPull }
  if (fn === "adc") return { id, gpio, function: "adc", label, externalPull }
  if (fn === "ledc") return { id, gpio, function: "ledc", channel: current?.channel ?? 0, label, externalPull }
  const instance = chip.resources[fn].instances[0] ?? 0
  const signal = current?.function === fn ? current.signal : SIGNALS[fn][0]
  return { id, gpio, function: fn, instance, signal, label, externalPull }
}

function clean(assignment: Assignment): Assignment {
  const next: Assignment = { id: assignment.id, gpio: assignment.gpio, function: assignment.function }
  if (assignment.label?.trim()) next.label = assignment.label.trim()
  if (assignment.direction) next.direction = assignment.direction
  if (assignment.instance !== undefined) next.instance = assignment.instance
  if (assignment.signal) next.signal = assignment.signal
  if (assignment.channel !== undefined) next.channel = assignment.channel
  if (assignment.externalPull) next.externalPull = assignment.externalPull
  if (assignment.role) next.role = assignment.role
  return next
}
