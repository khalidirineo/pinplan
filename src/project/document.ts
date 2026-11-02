import type { Assignment, FunctionName, ProjectSettings } from "../engine/types"
import { defaultSettings } from "../engine/types"

const FUNCTIONS: readonly FunctionName[] = ["gpio", "adc", "ledc", "i2c", "spi", "uart"]
const BUS_SIGNALS = {
  i2c: ["sda", "scl"],
  spi: ["mosi", "miso", "sck", "cs"],
  uart: ["tx", "rx"],
} as const

const DOCUMENT_KEYS = ["chip", "settings", "assignments"]
const SETTINGS_KEYS = ["wifiEnabled", "psram", "nativeUsb"]
const ASSIGNMENT_KEYS = ["id", "gpio", "function", "direction", "instance", "signal", "channel", "label", "externalPull", "role"]

export interface ProjectDocument {
  chip: string
  settings: ProjectSettings
  assignments: Assignment[]
}

export type ParseResult =
  | { ok: true; settings: ProjectSettings; assignments: Assignment[] }
  | { ok: false; error: string }

export function isEmptyDesign(settings: ProjectSettings, assignments: Assignment[]): boolean {
  return assignments.length === 0
    && settings.wifiEnabled === defaultSettings.wifiEnabled
    && settings.psram === defaultSettings.psram
    && settings.nativeUsb === defaultSettings.nativeUsb
}

export function projectDocument(chipId: string, settings: ProjectSettings, assignments: Assignment[]): ProjectDocument {
  return {
    chip: chipId,
    settings: {
      wifiEnabled: settings.wifiEnabled,
      psram: settings.psram,
      nativeUsb: settings.nativeUsb,
    },
    assignments: [...assignments]
      .sort((left, right) => left.gpio - right.gpio || left.id.localeCompare(right.id))
      .map(cleanAssignment),
  }
}

export function serializeProject(chipId: string, settings: ProjectSettings, assignments: Assignment[], pretty = true): string {
  const json = JSON.stringify(projectDocument(chipId, settings, assignments), null, pretty ? 2 : undefined)
  return pretty ? `${json}\n` : json
}

export function parseProject(text: string, expectedChip: string): ParseResult {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    return { ok: false, error: "This file is not JSON." }
  }
  if (!isRecord(value)) return { ok: false, error: "A PinPlan file must be a JSON object." }
  const extra = unknownKey(value, DOCUMENT_KEYS)
  if (extra) return { ok: false, error: `Unknown field "${extra}".` }
  if (value.chip !== expectedChip) {
    const got = typeof value.chip === "string" && value.chip.trim() !== "" ? value.chip : "an unknown chip"
    return { ok: false, error: `This file is for ${got}. This planner opens ${expectedChip}.` }
  }
  const settings = parseSettings(value.settings)
  if (typeof settings === "string") return { ok: false, error: settings }
  if (!Array.isArray(value.assignments)) return { ok: false, error: "Assignments must be a list." }

  const assignments: Assignment[] = []
  const gpios = new Set<number>()
  const ids = new Set<string>()
  for (let index = 0; index < value.assignments.length; index += 1) {
    const parsed = parseAssignment(value.assignments[index], index)
    if (typeof parsed === "string") return { ok: false, error: parsed }
    if (gpios.has(parsed.gpio)) return { ok: false, error: `GPIO ${parsed.gpio} is assigned more than once.` }
    if (ids.has(parsed.id)) return { ok: false, error: `Assignment id "${parsed.id}" is used more than once.` }
    gpios.add(parsed.gpio)
    ids.add(parsed.id)
    assignments.push(parsed)
  }
  return { ok: true, settings, assignments }
}

function cleanAssignment(raw: Assignment): Assignment {
  const assignment: Assignment = { id: raw.id, gpio: raw.gpio, function: raw.function }
  if (raw.direction) assignment.direction = raw.direction
  if (raw.instance !== undefined) assignment.instance = raw.instance
  if (raw.signal) assignment.signal = raw.signal
  if (raw.channel !== undefined) assignment.channel = raw.channel
  const label = raw.label?.trim()
  if (label) assignment.label = label
  if (raw.externalPull) assignment.externalPull = raw.externalPull
  if (raw.role) assignment.role = raw.role
  return assignment
}

function parseSettings(value: unknown): ProjectSettings | string {
  if (!isRecord(value)) return "Settings must be an object."
  const extra = unknownKey(value, SETTINGS_KEYS)
  if (extra) return `Unknown settings field "${extra}".`
  if (typeof value.wifiEnabled !== "boolean") return "wifiEnabled must be true or false."
  if (value.psram !== "none" && value.psram !== "quad" && value.psram !== "octal") {
    return "psram must be none, quad, or octal."
  }
  if (typeof value.nativeUsb !== "boolean") return "nativeUsb must be true or false."
  return {
    wifiEnabled: value.wifiEnabled,
    psram: value.psram,
    nativeUsb: value.nativeUsb,
  }
}

function parseAssignment(value: unknown, index: number): Assignment | string {
  const where = `Assignment ${index + 1}`
  if (!isRecord(value)) return `${where} must be an object.`
  const extra = unknownKey(value, ASSIGNMENT_KEYS)
  if (extra) return `${where} has unknown field "${extra}".`
  if (typeof value.id !== "string" || value.id.trim() === "") return `${where} needs an id.`
  if (!Number.isInteger(value.gpio)) return `${where} needs an integer GPIO.`
  if (typeof value.function !== "string" || !FUNCTIONS.includes(value.function as FunctionName)) {
    return `${where} has an unknown function.`
  }

  const fn = value.function as FunctionName
  const assignment: Assignment = { id: value.id, gpio: value.gpio as number, function: fn }
  if (fn === "gpio") {
    if (value.direction !== "input" && value.direction !== "output") return `${where} needs direction input or output.`
    assignment.direction = value.direction
  } else if (value.direction !== undefined) {
    return `${where} sets direction on a non-GPIO function.`
  }

  if (fn === "ledc") {
    if (!Number.isInteger(value.channel)) return `${where} needs an integer LEDC channel.`
    assignment.channel = value.channel as number
  } else if (value.channel !== undefined) {
    return `${where} sets a channel on a non-LEDC function.`
  }

  if (fn === "i2c" || fn === "spi" || fn === "uart") {
    if (!Number.isInteger(value.instance)) return `${where} needs an integer instance.`
    const allowed: readonly string[] = BUS_SIGNALS[fn]
    if (typeof value.signal !== "string" || !allowed.includes(value.signal)) {
      return `${where} needs a signal of ${allowed.join(", ")}.`
    }
    assignment.instance = value.instance as number
    assignment.signal = value.signal
  } else if (value.instance !== undefined || value.signal !== undefined) {
    return `${where} sets instance or signal on a function that has neither.`
  }

  if (value.externalPull !== undefined) {
    if (value.externalPull !== "up" && value.externalPull !== "down") return `${where} has an unknown externalPull.`
    assignment.externalPull = value.externalPull
  }
  if (value.role !== undefined) {
    if (value.role !== "button") return `${where} has an unknown role.`
    assignment.role = "button"
  }
  if (value.label !== undefined) {
    if (typeof value.label !== "string") return `${where} has a label that is not text.`
    const label = value.label.trim()
    if (label) assignment.label = label
  }
  return assignment
}

function unknownKey(value: Record<string, unknown>, allowed: readonly string[]): string | undefined {
  return Object.keys(value).find((key) => !allowed.includes(key))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
