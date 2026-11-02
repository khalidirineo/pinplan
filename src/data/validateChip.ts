import type {
  Chip,
  ConstraintId,
  PadSide,
  PsramSetting,
} from "./types"

const CONSTRAINT_IDS: readonly ConstraintId[] = [
  "strapping",
  "adc2_wifi",
  "flash_reserved",
  "not_exposed",
  "psram_reserved",
  "usb",
  "uart0",
  "jtag",
]

const PAD_SIDES: readonly PadSide[] = ["left", "bottom", "right", "center"]
const PSRAM: readonly PsramSetting[] = ["none", "quad", "octal"]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function fail(path: string, message: string): never {
  throw new Error(`esp32s3.json ${path}: ${message}`)
}

function requireString(value: unknown, path: string): string {
  if (typeof value !== "string" || value.trim() === "") fail(path, "expected a non-empty string")
  return value
}

function requireCited(value: unknown, path: string): void {
  if (!isRecord(value)) fail(path, "expected an object")
  requireString(value.source, `${path}.source`)
  if (typeof value.verified !== "boolean") fail(`${path}.verified`, "expected a boolean")
}

function requireWhen(value: unknown, path: string): void {
  if (value === undefined || value === "always") return
  if (!isRecord(value)) fail(path, "expected a when-clause")
  const hasIn = "in" in value
  const hasEquals = "equals" in value
  if (hasIn === hasEquals) fail(path, "when must set exactly one of equals or in")
  if (value.setting === "psram") {
    if (hasEquals && !PSRAM.includes(value.equals as PsramSetting)) {
      fail(path, "bad psram equals")
    }
    if (hasIn) {
      if (!Array.isArray(value.in) || value.in.length === 0) fail(path, "psram in must be a non-empty array")
      for (const item of value.in) {
        if (!PSRAM.includes(item as PsramSetting)) fail(path, "bad psram in value")
      }
    }
    return
  }
  if (value.setting === "wifiEnabled" || value.setting === "nativeUsb") {
    if (!hasEquals || typeof value.equals !== "boolean") fail(path, "expected equals: boolean")
    return
  }
  fail(path, "unknown setting")
}

export function validateChip(input: unknown): Chip {
  if (!isRecord(input)) fail("$", "expected an object")
  requireString(input.id, "$.id")
  requireString(input.name, "$.name")
  requireString(input.family, "$.family")
  for (const key of ["datasheet", "moduleDatasheet", "trm"] as const) {
    const doc = input[key]
    if (!isRecord(doc)) fail(`$.${key}`, "expected an object")
    requireString(doc.title, `$.${key}.title`)
    requireString(doc.url, `$.${key}.url`)
    requireString(doc.revision, `$.${key}.revision`)
  }

  if (!isRecord(input.resources)) fail("$.resources", "expected an object")
  for (const key of ["i2c", "uart", "spi"] as const) {
    const resource = input.resources[key]
    requireCited(resource, `$.resources.${key}`)
    if (!isRecord(resource)) fail(`$.resources.${key}`, "expected an object")
    if (typeof resource.count !== "number" || resource.count < 1) {
      fail(`$.resources.${key}.count`, "expected a positive count")
    }
    if (!Array.isArray(resource.instances) || resource.instances.length !== resource.count) {
      fail(`$.resources.${key}.instances`, "instances length must equal count")
    }
    for (const instance of resource.instances) {
      if (!Number.isInteger(instance)) fail(`$.resources.${key}.instances`, "expected integers")
    }
  }
  requireCited(input.resources.ledc, "$.resources.ledc")
  if (!isRecord(input.resources.ledc) || !Number.isInteger(input.resources.ledc.channels)) {
    fail("$.resources.ledc.channels", "expected an integer")
  }

  requireCited(input.gpioMatrix, "$.gpioMatrix")
  requireCited(input.strappingTiming, "$.strappingTiming")
  if (
    !isRecord(input.strappingTiming) ||
    !Number.isInteger(input.strappingTiming.holdAfterChipPuMs) ||
    (input.strappingTiming.holdAfterChipPuMs as number) < 1
  ) {
    fail("$.strappingTiming.holdAfterChipPuMs", "expected a positive integer")
  }
  if (!isRecord(input.module)) fail("$.module", "expected an object")
  requireString(input.module.name, "$.module.name")
  requireString(input.module.padOrder, "$.module.padOrder")
  requireCited(input.module.padSource, "$.module.padSource")
  if (!Array.isArray(input.module.pads)) fail("$.module.pads", "expected an array")

  if (!Array.isArray(input.notes)) fail("$.notes", "expected an array")
  for (const note of input.notes) {
    requireCited(note, "$.notes")
    if (!isRecord(note)) fail("$.notes", "expected an object")
    requireString(note.id, "$.notes.id")
    requireString(note.text, "$.notes.text")
  }

  if (!Array.isArray(input.pins) || input.pins.length === 0) fail("$.pins", "expected pins")

  const gpios = new Set<number>()
  const padByGpio = new Map<number, number>()
  for (const pad of input.module.pads) {
    if (!isRecord(pad)) fail("$.module.pads", "expected an object")
    if (!Number.isInteger(pad.number)) fail("$.module.pads.number", "expected an integer")
    if (!PAD_SIDES.includes(pad.side as PadSide)) fail("$.module.pads.side", "bad side")
    if (pad.gpio !== undefined) {
      if (!Number.isInteger(pad.gpio)) fail("$.module.pads.gpio", "expected an integer")
      if (padByGpio.has(pad.gpio as number)) fail("$.module.pads", `duplicate pad gpio ${pad.gpio}`)
      padByGpio.set(pad.gpio as number, pad.number as number)
    }
  }

  for (const pin of input.pins) {
    if (!isRecord(pin)) fail("$.pins", "expected an object")
    if (!Number.isInteger(pin.gpio)) fail("$.pins.gpio", "expected an integer")
    if (gpios.has(pin.gpio as number)) fail("$.pins", `duplicate gpio ${pin.gpio}`)
    gpios.add(pin.gpio as number)
    if (!Array.isArray(pin.names) || pin.names.length === 0) fail(`gpio${pin.gpio}.names`, "expected names")
    const expectedPad = padByGpio.get(pin.gpio as number) ?? null
    if (pin.modulePad !== expectedPad) {
      fail(`gpio${pin.gpio}.modulePad`, `expected ${String(expectedPad)}, got ${String(pin.modulePad)}`)
    }
    if (typeof pin.rtcDomain !== "boolean") fail(`gpio${pin.gpio}.rtcDomain`, "expected a boolean")
    if (typeof pin.inputOnly !== "boolean") fail(`gpio${pin.gpio}.inputOnly`, "expected a boolean")
    if (pin.atReset !== null && pin.atReset !== "pull-up" && pin.atReset !== "pull-down") {
      fail(`gpio${pin.gpio}.atReset`, "expected pull-up, pull-down, or null")
    }
    if (pin.adc !== null) {
      requireCited(pin.adc, `gpio${pin.gpio}.adc`)
      if (!isRecord(pin.adc) || (pin.adc.unit !== "ADC1" && pin.adc.unit !== "ADC2")) {
        fail(`gpio${pin.gpio}.adc.unit`, "expected ADC1 or ADC2")
      }
      if (!Number.isInteger(pin.adc.channel)) fail(`gpio${pin.gpio}.adc.channel`, "expected an integer")
    }
    if (pin.touch !== null) {
      requireCited(pin.touch, `gpio${pin.gpio}.touch`)
      if (!isRecord(pin.touch) || !Number.isInteger(pin.touch.channel)) {
        fail(`gpio${pin.gpio}.touch.channel`, "expected an integer")
      }
    }
    if (!Array.isArray(pin.constraints)) fail(`gpio${pin.gpio}.constraints`, "expected an array")
    const seen = new Set<string>()
    for (const constraint of pin.constraints) {
      requireCited(constraint, `gpio${pin.gpio}.constraints`)
      if (!isRecord(constraint)) fail(`gpio${pin.gpio}.constraints`, "expected an object")
      if (!CONSTRAINT_IDS.includes(constraint.id as ConstraintId)) {
        fail(`gpio${pin.gpio}.constraints.id`, `unknown id ${String(constraint.id)}`)
      }
      if (seen.has(constraint.id as string)) {
        fail(`gpio${pin.gpio}.constraints`, `duplicate ${String(constraint.id)}`)
      }
      seen.add(constraint.id as string)
      requireString(constraint.effect, `gpio${pin.gpio}.constraints.effect`)
      requireWhen(constraint.when, `gpio${pin.gpio}.constraints.when`)
      if (
        constraint.bootLevel !== undefined &&
        constraint.bootLevel !== "high" &&
        constraint.bootLevel !== "low"
      ) {
        fail(`gpio${pin.gpio}.constraints.bootLevel`, "expected high or low")
      }
      if (constraint.infoOnly !== undefined && typeof constraint.infoOnly !== "boolean") {
        fail(`gpio${pin.gpio}.constraints.infoOnly`, "expected a boolean")
      }
    }
  }

  return input as unknown as Chip
}
