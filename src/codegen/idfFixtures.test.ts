import { describe, expect, it } from "vitest"
import { loadChip } from "../data/loadChip"
import { evaluate } from "../engine/evaluate"
import { exportEspIdf } from "./exportIdf"
import { idfFixtures } from "./idfFixtures"

const chip = loadChip()

function source(name: string): string {
  const fixture = idfFixtures.find((item) => item.name === name)
  if (!fixture) throw new Error(`missing fixture ${name}`)
  return exportEspIdf(chip, fixture.assignments, fixture.settings, evaluate(chip, fixture.assignments, fixture.settings))
}

describe("ESP-IDF compile fixtures", () => {
  it("covers the example and every function, including both ADC units", () => {
    expect(idfFixtures.map((fixture) => fixture.name)).toEqual([
      "example",
      "gpio",
      "adc1",
      "adc2",
      "ledc",
      "i2c",
      "spi",
      "uart",
    ])
    expect(source("example")).toContain("Label: Battery.")
    expect(source("example")).toContain("adc_oneshot_read(pinplan_adc2")
    expect(source("gpio")).toContain("gpio_config")
    expect(source("adc1")).toContain("ADC_UNIT_1")
    expect(source("adc1")).not.toContain("ESP_ERR_TIMEOUT")
    expect(source("adc2")).toContain("ADC_UNIT_2")
    expect(source("adc2")).toContain("ESP_ERR_TIMEOUT")
    expect(source("ledc")).toContain("ledc_channel_config")
    expect(source("i2c")).toContain("i2c_new_master_bus")
    expect(source("spi")).toContain("spi_bus_initialize")
    expect(source("uart")).toContain("uart_set_pin")
  })
})
