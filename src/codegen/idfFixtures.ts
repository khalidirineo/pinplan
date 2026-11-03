import type { Assignment, ProjectSettings } from "../engine/types"
import { defaultSettings } from "../engine/types"
import { exampleAssignments, exampleSettings } from "../project/example"

export interface IdfFixture {
  name: string
  assignments: Assignment[]
  settings: ProjectSettings
}

function pin(assignment: Assignment): Assignment {
  return assignment
}

/** Designs compiled by the ESP-IDF CI job. Generated from this list, not checked in. */
export const idfFixtures: IdfFixture[] = [
  { name: "example", assignments: exampleAssignments, settings: exampleSettings },
  {
    name: "gpio",
    assignments: [pin({ id: "gpio-4", gpio: 4, function: "gpio", direction: "output", label: "LED" })],
    settings: defaultSettings,
  },
  {
    name: "adc1",
    assignments: [pin({ id: "gpio-1", gpio: 1, function: "adc", label: "ADC1" })],
    settings: defaultSettings,
  },
  {
    name: "adc2",
    assignments: [pin({ id: "gpio-11", gpio: 11, function: "adc", label: "ADC2" })],
    settings: { ...defaultSettings, wifiEnabled: true },
  },
  {
    name: "ledc",
    assignments: [pin({ id: "gpio-12", gpio: 12, function: "ledc", channel: 0, label: "PWM" })],
    settings: defaultSettings,
  },
  {
    name: "i2c",
    assignments: [
      pin({ id: "gpio-8", gpio: 8, function: "i2c", instance: 0, signal: "sda" }),
      pin({ id: "gpio-9", gpio: 9, function: "i2c", instance: 0, signal: "scl" }),
    ],
    settings: defaultSettings,
  },
  {
    name: "spi",
    assignments: [
      pin({ id: "gpio-10", gpio: 10, function: "spi", instance: 2, signal: "mosi" }),
      pin({ id: "gpio-13", gpio: 13, function: "spi", instance: 2, signal: "miso" }),
      pin({ id: "gpio-14", gpio: 14, function: "spi", instance: 2, signal: "sck" }),
      pin({ id: "gpio-21", gpio: 21, function: "spi", instance: 2, signal: "cs" }),
    ],
    settings: defaultSettings,
  },
  {
    name: "uart",
    assignments: [
      pin({ id: "gpio-16", gpio: 16, function: "uart", instance: 1, signal: "tx" }),
      pin({ id: "gpio-17", gpio: 17, function: "uart", instance: 1, signal: "rx" }),
    ],
    settings: defaultSettings,
  },
]
