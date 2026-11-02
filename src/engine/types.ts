import type { Chip } from "../data/types"

export type FunctionName = "gpio" | "adc" | "ledc" | "i2c" | "spi" | "uart"

export interface Assignment {
  id: string
  gpio: number
  function: FunctionName
  direction?: "input" | "output"
  /** I2C 0–1, UART 0–2, SPI 2–3. The numbers are the hardware instance ids. */
  instance?: number
  /** i2c: sda|scl. spi: mosi|miso|sck|cs. uart: tx|rx. */
  signal?: string
  /** LEDC channel, 0–7. */
  channel?: number
  label?: string
  /** Resistor that is already on the net at reset, before firmware runs. */
  externalPull?: "up" | "down"
  /** A button can be held while reset is released. */
  role?: "button"
}

export interface ProjectSettings {
  wifiEnabled: boolean
  psram: "none" | "quad" | "octal"
  nativeUsb: boolean
}

export const defaultSettings: ProjectSettings = {
  wifiEnabled: true,
  psram: "none",
  nativeUsb: false,
}

export interface Issue {
  severity: "error" | "warning" | "info"
  pins: number[]
  ruleId: string
  message: string
  fix: string
}

export interface EvalContext {
  chip: Chip
  assignments: Assignment[]
  settings: ProjectSettings
}

export type Rule = (ctx: EvalContext) => Issue[]
