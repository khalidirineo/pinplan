import type { Assignment, ProjectSettings } from "../engine/types"

/** Shown first so the battery ADC, and its Wi-Fi warning, is the open pin. */
export const exampleFocusGpio = 11

export const exampleSettings: ProjectSettings = {
  wifiEnabled: true,
  psram: "none",
  nativeUsb: false,
}

export const exampleAssignments: Assignment[] = [
  { id: "gpio-4", gpio: 4, function: "gpio", direction: "output", label: "LED" },
  { id: "gpio-5", gpio: 5, function: "gpio", direction: "input", role: "button", label: "Button" },
  { id: "gpio-8", gpio: 8, function: "i2c", instance: 0, signal: "sda", label: "Sensor" },
  { id: "gpio-9", gpio: 9, function: "i2c", instance: 0, signal: "scl", label: "Sensor" },
  { id: "gpio-11", gpio: 11, function: "adc", label: "Battery" },
  { id: "gpio-0", gpio: 0, function: "gpio", direction: "input", label: "Boot" },
]
