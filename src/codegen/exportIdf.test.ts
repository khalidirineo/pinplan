import { describe, expect, it } from "vitest"
import { loadChip } from "../data/loadChip"
import { evaluate } from "../engine/evaluate"
import { defaultSettings, type Assignment, type ProjectSettings } from "../engine/types"
import { exportEspIdf } from "./exportIdf"

const chip = loadChip()

function source(assignments: Assignment[], settings: ProjectSettings = defaultSettings): string {
  return exportEspIdf(chip, assignments, settings, evaluate(chip, assignments, settings))
}

function assign(partial: Omit<Assignment, "id"> & { id?: string }): Assignment {
  return { id: partial.id ?? `gpio-${partial.gpio}`, ...partial }
}

describe("ESP-IDF export", () => {
  it("emits an empty init when nothing is assigned", () => {
    expect(source([])).toMatchSnapshot()
  })

  it("checks adc_oneshot_read for ESP_ERR_TIMEOUT on ADC2 and not on ADC1", () => {
    const code = source([
      assign({ gpio: 1, function: "adc", label: "battery" }),
      assign({ gpio: 11, function: "adc", label: "sensor" }),
    ])
    const adc2 = code.slice(code.indexOf("esp_err_t pinplan_adc_read_gpio11"))
    expect(adc2).toContain("adc_oneshot_read(pinplan_adc2, ADC_CHANNEL_0, raw)")
    expect(adc2.indexOf("if (err == ESP_ERR_TIMEOUT)")).toBeLessThan(adc2.indexOf("ESP_ERROR_CHECK"))
    const adc1 = code.match(/esp_err_t pinplan_adc_read_gpio1\(int \*raw\)\r?\n\{[\s\S]*?\n\}/)?.[0] ?? ""
    expect(adc1).toContain("adc_oneshot_read(pinplan_adc1, ADC_CHANNEL_0, raw)")
    expect(adc1).not.toContain("ESP_ERR_TIMEOUT")
    expect(code).toMatchSnapshot()
  })

  it("initializes the other peripherals and still exports when the design has an error", () => {
    const code = source(
      [
        assign({ gpio: 4, function: "gpio", direction: "output", label: "led" }),
        assign({ gpio: 5, function: "gpio", direction: "input", role: "button" }),
        assign({ gpio: 8, function: "i2c", instance: 0, signal: "sda" }),
        assign({ gpio: 9, function: "i2c", instance: 0, signal: "scl" }),
        assign({ gpio: 10, function: "spi", instance: 2, signal: "mosi" }),
        assign({ gpio: 11, function: "spi", instance: 2, signal: "miso" }),
        assign({ gpio: 12, function: "spi", instance: 2, signal: "sck" }),
        assign({ gpio: 13, function: "spi", instance: 2, signal: "cs" }),
        assign({ gpio: 14, function: "spi", instance: 2, signal: "cs" }),
        assign({ gpio: 16, function: "uart", instance: 1, signal: "tx" }),
        assign({ gpio: 17, function: "uart", instance: 1, signal: "rx" }),
        assign({ gpio: 18, function: "ledc", channel: 0 }),
        assign({ gpio: 19, function: "gpio", direction: "input" }),
        assign({ gpio: 21, function: "spi", instance: 3, signal: "sck" }),
      ],
      { ...defaultSettings, nativeUsb: true },
    )
    for (const line of code.split("\n")) {
      if (line.includes("/*") || line.trimStart().startsWith("*")) expect(line.length).toBeLessThanOrEqual(80)
    }
    expect(code).toContain("[error] usb-pins")
    expect(code).toContain("This design still has conflicts")
    expect(code).toContain("SPI2_HOST")
    expect(code).toContain("SPI3_HOST")
    expect(code).not.toContain("SPI0_HOST")
    expect(code).toContain("i2c_new_master_bus")
    expect(code).toContain("uart_set_pin(UART_NUM_1, GPIO_NUM_16, GPIO_NUM_17")
    expect(code).toContain("LEDC_CHANNEL_0")
    expect(code).toContain("spi_bus_add_device")
    expect(code).toMatchSnapshot()
  })

  it("does not initialize an I2C bus that is missing a pin", () => {
    const code = source([assign({ gpio: 4, function: "i2c", instance: 0, signal: "sda" })])
    expect(code).toContain("missing SCL")
    expect(code).not.toContain("i2c_new_master_bus")
  })

  it("refuses SPI0 and a bus with no SCK", () => {
    const code = source([
      assign({ gpio: 4, function: "spi", instance: 0, signal: "mosi" }),
      assign({ gpio: 6, function: "spi", instance: 2, signal: "mosi" }),
    ])
    expect(code).toContain("not SPI2 or SPI3")
    expect(code).toContain("no SCK pin")
    expect(code).not.toContain("spi_bus_initialize")
  })
})
