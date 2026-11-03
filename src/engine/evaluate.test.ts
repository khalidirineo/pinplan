import { describe, expect, it } from "vitest"
import { loadChip } from "../data/loadChip"
import { evaluate } from "./evaluate"
import { ruleIds, rules } from "./rules"
import type { Assignment, Issue, ProjectSettings } from "./types"
import { adc2WifiRuleId } from "./rules/adc2Wifi"
import { adcCapabilityRuleId } from "./rules/adcCapability"
import { assignmentShapeRuleId } from "./rules/assignmentShape"
import { duplicatePinRuleId } from "./rules/duplicatePin"
import { duplicateSignalRuleId } from "./rules/duplicateSignal"
import { flashReservedRuleId } from "./rules/flashReserved"
import { i2cPullupsRuleId } from "./rules/i2cPullups"
import { jtagPinsRuleId } from "./rules/jtagPins"
import { notExposedRuleId } from "./rules/notExposed"
import { peripheralLimitRuleId } from "./rules/peripheralLimit"
import { psramReservedRuleId } from "./rules/psramReserved"
import { strappingRuleId } from "./rules/strapping"
import { uart0ConsoleRuleId } from "./rules/uart0Console"
import { unknownPinRuleId } from "./rules/unknownPin"
import { usbPinsRuleId } from "./rules/usbPins"

const chip = loadChip()
const quiet: ProjectSettings = { wifiEnabled: false, psram: "none", nativeUsb: false }

function assign(partial: Partial<Assignment> & Pick<Assignment, "gpio" | "function">): Assignment {
  return {
    id: `${partial.function}-${partial.gpio}`,
    ...partial,
  }
}

function issuesFor(assignments: Assignment[], override: Partial<ProjectSettings> = {}): Issue[] {
  return evaluate(chip, assignments, { ...quiet, ...override })
}

function ofRule(issues: Issue[], ruleId: string): Issue[] {
  return issues.filter((issue) => issue.ruleId === ruleId)
}

function only(ruleId: string, assignments: Assignment[], override: Partial<ProjectSettings> = {}): Issue[] {
  const all = issuesFor(assignments, override)
  const others = all.filter((issue) => issue.ruleId !== ruleId)
  expect(others, JSON.stringify(others, null, 2)).toEqual([])
  return all
}

describe("rule registry", () => {
  it("registers each rule once", () => {
    expect(rules).toHaveLength(ruleIds.length)
    expect(new Set(ruleIds).size).toBe(ruleIds.length)
  })

  it("returns nothing for an empty design, including the Wi-Fi-on default", () => {
    expect(evaluate(chip, [], { wifiEnabled: true, psram: "octal", nativeUsb: true })).toEqual([])
  })

  it("sorts errors ahead of warnings and info", () => {
    const issues = issuesFor(
      [
        assign({ gpio: 11, function: "adc" }),
        assign({ gpio: 27, function: "gpio", direction: "output" }),
      ],
      { wifiEnabled: true },
    )
    const ranks = issues.map((issue) => ({ error: 0, warning: 1, info: 2 })[issue.severity])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(issues[0]?.ruleId).toBe(flashReservedRuleId)
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0)
      expect(issue.fix.length).toBeGreaterThan(0)
      expect(issue.pins.length).toBeGreaterThan(0)
    }
  })
})

describe("duplicate pin", () => {
  it("errors when one GPIO is used twice", () => {
    const [issue] = only(duplicatePinRuleId, [
      assign({ id: "led", gpio: 4, function: "gpio", direction: "output", label: "led" }),
      assign({ id: "sense", gpio: 4, function: "adc", label: "sense" }),
    ])
    expect(issue?.severity).toBe("error")
    expect(issue?.pins).toEqual([4])
    expect(issue?.message).toContain("led")
  })
})

describe("unknown pin and assignment shape", () => {
  it("errors for a GPIO the chip does not have", () => {
    const [issue] = only(unknownPinRuleId, [assign({ gpio: 22, function: "gpio", direction: "input" })])
    expect(issue?.severity).toBe("error")
    expect(issue?.pins).toEqual([22])
  })

  it("errors when a bus assignment is incomplete", () => {
    const bad = { id: "x", gpio: 4, function: "i2c" } as Assignment
    const [issue] = only(assignmentShapeRuleId, [bad])
    expect(issue?.severity).toBe("error")
    expect(issue?.message).toContain("signal")
  })
})

describe("adc capability", () => {
  it("errors when ADC is assigned to a pin with no channel", () => {
    const [issue] = only(adcCapabilityRuleId, [assign({ gpio: 21, function: "adc" })])
    expect(issue?.severity).toBe("error")
    expect(issue?.fix).toContain("GPIO1")
  })
})

describe("flash, exposed pads, and PSRAM", () => {
  it("always errors on the internal flash bus", () => {
    const [issue] = only(flashReservedRuleId, [assign({ gpio: 27, function: "gpio", direction: "output" })])
    expect(issue?.severity).toBe("error")
    expect(issue?.message).toMatch(/flash/i)
    const octal = only(flashReservedRuleId, [assign({ gpio: 32, function: "gpio", direction: "input" })], {
      psram: "octal",
    })
    expect(octal).toHaveLength(1)
  })

  it("errors on GPIO26 and GPIO33 because the module does not bond them out", () => {
    const [hidden] = only(notExposedRuleId, [assign({ gpio: 26, function: "gpio", direction: "input" })])
    expect(hidden?.severity).toBe("error")
    const [alsoHidden] = only(notExposedRuleId, [assign({ gpio: 33, function: "gpio", direction: "input" })])
    expect(alsoHidden?.ruleId).toBe(notExposedRuleId)
  })

  it("reserves GPIO26 only when PSRAM is quad or octal, and still reports it as not exposed", () => {
    const quad = issuesFor([assign({ gpio: 26, function: "gpio", direction: "input" })], { psram: "quad" })
    expect(ofRule(quad, notExposedRuleId)).toHaveLength(1)
    expect(ofRule(quad, psramReservedRuleId)).toHaveLength(1)
    const octal = issuesFor([assign({ gpio: 26, function: "gpio", direction: "input" })], { psram: "octal" })
    expect(ofRule(octal, psramReservedRuleId)).toHaveLength(1)
  })

  it("reserves GPIO35-37 only for octal PSRAM", () => {
    const assigned = [assign({ gpio: 35, function: "gpio", direction: "output" })]
    expect(issuesFor(assigned, { psram: "none" })).toEqual([])
    expect(issuesFor(assigned, { psram: "quad" })).toEqual([])
    const [issue] = only(psramReservedRuleId, assigned, { psram: "octal" })
    expect(issue?.severity).toBe("error")
    expect(issue?.message).toMatch(/octal/i)
  })

  it("adds the octal reservation on GPIO33 without dropping the not-exposed error", () => {
    const issues = issuesFor([assign({ gpio: 33, function: "gpio", direction: "input" })], { psram: "octal" })
    expect(ofRule(issues, notExposedRuleId)).toHaveLength(1)
    expect(ofRule(issues, psramReservedRuleId)).toHaveLength(1)
  })
})

describe("usb pins", () => {
  it("errors only while native USB is enabled", () => {
    const assigned = [assign({ gpio: 19, function: "gpio", direction: "input" })]
    expect(issuesFor(assigned)).toEqual([])
    const [issue] = only(usbPinsRuleId, assigned, { nativeUsb: true })
    expect(issue?.severity).toBe("error")
    expect(issue?.message).toContain("D-")
    const plus = only(usbPinsRuleId, [assign({ gpio: 20, function: "gpio", direction: "output" })], {
      nativeUsb: true,
    })
    expect(plus[0]?.message).toContain("D+")
  })
})

describe("adc2 and wifi", () => {
  it("warns that an ADC2 read can fail, and points at ADC1", () => {
    const assigned = [assign({ gpio: 11, function: "adc" })]
    expect(issuesFor(assigned, { wifiEnabled: false })).toEqual([])
    const [issue] = only(adc2WifiRuleId, assigned, { wifiEnabled: true })
    expect(issue?.severity).toBe("warning")
    expect(issue?.message).toContain("ESP_ERR_TIMEOUT")
    expect(issue?.fix).toContain("ADC1")
    expect(issue?.fix).toContain("GPIO1")
    expect(issue?.fix.endsWith("GPIO3 (strapping)).")).toBe(true)
    expect(issue?.fix.indexOf("GPIO2")).toBeLessThan(issue?.fix.indexOf("GPIO3 (strapping)"))
  })

  it("suggests only free ADC1 pins, with a strap marked and listed last", () => {
    const [issue] = only(adc2WifiRuleId, [
      assign({ gpio: 11, function: "adc" }),
      assign({ gpio: 1, function: "gpio", direction: "output" }),
    ], { wifiEnabled: true })
    const listed = issue?.fix.match(/\((.*)\)\.$/)?.[1]?.split(", ") ?? []
    expect(listed).not.toContain("GPIO1")
    expect(listed.at(-1)).toBe("GPIO3 (strapping)")
    expect(listed[0]).toBe("GPIO2")
  })

  it("says so when every ADC1 pin is already assigned", () => {
    const taken = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((gpio) =>
      assign({ gpio, function: "gpio", direction: "output" }),
    )
    const issues = issuesFor([assign({ gpio: 11, function: "adc" }), ...taken], { wifiEnabled: true })
    expect(ofRule(issues, adc2WifiRuleId)[0]?.fix).toBe("No ADC1 pin is free.")
  })

  it("does not warn for ADC1, or for an ADC2 pin used as GPIO", () => {
    expect(issuesFor([assign({ gpio: 1, function: "adc" })], { wifiEnabled: true })).toEqual([])
    expect(
      issuesFor([assign({ gpio: 11, function: "gpio", direction: "input" })], { wifiEnabled: true }),
    ).toEqual([])
  })

  it("reports USB and ADC2 together when both apply", () => {
    const issues = issuesFor([assign({ gpio: 19, function: "adc" })], {
      wifiEnabled: true,
      nativeUsb: true,
    })
    expect(ofRule(issues, adc2WifiRuleId).map((issue) => issue.severity)).toEqual(["warning"])
    expect(ofRule(issues, usbPinsRuleId).map((issue) => issue.severity)).toEqual(["error"])
  })
})

describe("strapping", () => {
  it("explains every strapping pin even when the assignment does not drive it", () => {
    for (const gpio of [0, 3, 45, 46]) {
      const [issue] = only(strappingRuleId, [assign({ gpio, function: "gpio", direction: "input" })])
      expect(issue?.severity).toBe("info")
      expect(issue?.message).toMatch(/strapping/i)
    }
  })

  it("keeps GPIO3 at info because it straps only when the JTAG eFuses are burnt", () => {
    const driven = [
      assign({ gpio: 3, function: "gpio", direction: "output" }),
      assign({ gpio: 3, function: "gpio", direction: "input", externalPull: "up", role: "button" }),
    ]
    for (const assignment of driven) {
      const [issue] = only(strappingRuleId, [assignment])
      expect(issue?.severity).toBe("info")
      expect(issue?.message).toContain("JTAG eFuses")
      expect(issue?.message).toContain("all default 0")
      expect(issue?.message).toContain("No internal pull resistors")
      expect(issue?.message).toContain("external circuit must hold a defined level")
      expect(issue?.message).not.toContain("3 ms")
    }
  })

  it("warns for outputs, buttons, and the other driving functions", () => {
    for (const gpio of [0, 45, 46]) {
      const [issue] = only(strappingRuleId, [assign({ gpio, function: "gpio", direction: "output" })])
      expect(issue?.severity).toBe("warning")
      expect(issue?.message).toContain("3 ms")
      expect(issue?.message).toContain("CHIP_PU")
      expect(issue?.message).toContain("t_H")
      if (gpio === 45) expect(issue?.message).toContain("R8V/R16V")
    }
    const button = only(strappingRuleId, [
      assign({ gpio: 0, function: "gpio", direction: "input", role: "button" }),
    ])
    expect(button[0]?.severity).toBe("warning")
    expect(button[0]?.message).toMatch(/button/i)
    expect(only(strappingRuleId, [assign({ gpio: 0, function: "ledc", channel: 0 })])[0]?.severity).toBe("warning")
    expect(
      only(strappingRuleId, [assign({ gpio: 0, function: "uart", instance: 1, signal: "tx" })])[0]?.severity,
    ).toBe("warning")
    expect(
      only(strappingRuleId, [assign({ gpio: 0, function: "spi", instance: 2, signal: "mosi" })])[0]?.severity,
    ).toBe("warning")
    expect(
      only(strappingRuleId, [assign({ gpio: 0, function: "spi", instance: 2, signal: "miso" })])[0]?.severity,
    ).toBe("info")
    expect(
      only(strappingRuleId, [assign({ gpio: 0, function: "uart", instance: 1, signal: "rx" })])[0]?.severity,
    ).toBe("info")
  })

  it("warns only when an external pull opposes the recorded boot level", () => {
    const downOnGpio0 = only(strappingRuleId, [
      assign({ gpio: 0, function: "gpio", direction: "input", externalPull: "down" }),
    ])
    expect(downOnGpio0[0]?.severity).toBe("warning")
    expect(downOnGpio0[0]?.message).toMatch(/Download Mode|download/i)

    const upOnGpio0 = only(strappingRuleId, [
      assign({ gpio: 0, function: "gpio", direction: "input", externalPull: "up" }),
    ])
    expect(upOnGpio0[0]?.severity).toBe("info")

    const upOnGpio45 = only(strappingRuleId, [
      assign({ gpio: 45, function: "gpio", direction: "input", externalPull: "up" }),
    ])
    expect(upOnGpio45[0]?.severity).toBe("warning")
    expect(upOnGpio45[0]?.message).toContain("module datasheet")

    const downOnGpio45 = only(strappingRuleId, [
      assign({ gpio: 45, function: "gpio", direction: "input", externalPull: "down" }),
    ])
    expect(downOnGpio45[0]?.severity).toBe("info")
    expect(downOnGpio45[0]?.message).toContain("R8V/R16V")
    expect(downOnGpio45[0]?.message).toContain("module datasheet")
  })

  it("treats I2C pull-ups as a high level at reset", () => {
    const safe = issuesFor([assign({ gpio: 0, function: "i2c", instance: 0, signal: "sda" })])
    expect(ofRule(safe, strappingRuleId)[0]?.severity).toBe("info")
    expect(ofRule(safe, i2cPullupsRuleId)).toHaveLength(1)

    const fights = issuesFor([assign({ gpio: 45, function: "i2c", instance: 0, signal: "scl" })])
    expect(ofRule(fights, strappingRuleId)[0]?.severity).toBe("warning")
    expect(ofRule(fights, strappingRuleId)[0]?.message).toMatch(/pull-up/i)
  })
})

describe("uart0 console and jtag", () => {
  it("warns when the console pins are reassigned, not when they stay UART0", () => {
    expect(
      issuesFor([
        assign({ gpio: 43, function: "uart", instance: 0, signal: "tx" }),
        assign({ gpio: 44, function: "uart", instance: 0, signal: "rx" }),
      ]),
    ).toEqual([])
    const [swapped] = only(uart0ConsoleRuleId, [
      assign({ gpio: 43, function: "uart", instance: 0, signal: "rx" }),
    ])
    expect(swapped?.severity).toBe("warning")
    const [reused] = only(uart0ConsoleRuleId, [assign({ gpio: 44, function: "gpio", direction: "input" })])
    expect(reused?.severity).toBe("warning")
    expect(reused?.message).toMatch(/ROM|console/i)
  })

  it("notes JTAG reuse as info", () => {
    const [issue] = only(jtagPinsRuleId, [assign({ gpio: 39, function: "gpio", direction: "input" })])
    expect(issue?.severity).toBe("info")
    expect(issue?.message).toContain("MTCK")
  })
})

describe("peripheral limits", () => {
  it("allows the legal I2C, UART, SPI, and LEDC instances and rejects the next one", () => {
    expect(
      issuesFor([
        assign({ gpio: 4, function: "i2c", instance: 0, signal: "sda" }),
        assign({ gpio: 5, function: "i2c", instance: 0, signal: "scl" }),
        assign({ gpio: 6, function: "i2c", instance: 1, signal: "sda" }),
        assign({ gpio: 7, function: "i2c", instance: 1, signal: "scl" }),
      ]).every((issue) => issue.severity === "info"),
    ).toBe(true)

    const extraI2c = issuesFor([assign({ gpio: 4, function: "i2c", instance: 2, signal: "sda" })])
    const [i2c] = ofRule(extraI2c, peripheralLimitRuleId)
    expect(i2c?.message).toContain("I2C0")
    expect(i2c?.message).toContain("I2C1")
    expect(ofRule(extraI2c, i2cPullupsRuleId)).toHaveLength(1)

    expect(
      issuesFor([
        assign({ gpio: 4, function: "uart", instance: 1, signal: "tx" }),
        assign({ gpio: 5, function: "uart", instance: 1, signal: "rx" }),
        assign({ gpio: 6, function: "spi", instance: 2, signal: "mosi" }),
        assign({ gpio: 7, function: "spi", instance: 3, signal: "sck" }),
      ]),
    ).toEqual([])

    expect(
      only(peripheralLimitRuleId, [assign({ gpio: 4, function: "spi", instance: 0, signal: "mosi" })]),
    ).toHaveLength(1)
    expect(
      only(peripheralLimitRuleId, [assign({ gpio: 4, function: "spi", instance: 1, signal: "mosi" })]),
    ).toHaveLength(1)
    expect(
      only(peripheralLimitRuleId, [assign({ gpio: 4, function: "uart", instance: 3, signal: "tx" })]),
    ).toHaveLength(1)

    const channels = Array.from({ length: 8 }, (_, channel) =>
      assign({ id: `pwm-${channel}`, gpio: channel + 4, function: "ledc", channel }),
    )
    expect(issuesFor(channels)).toEqual([])
    const [ledc] = only(peripheralLimitRuleId, [assign({ gpio: 9, function: "ledc", channel: 8 })])
    expect(ledc?.message).toContain("0–7")
  })

  it("routes a matrix peripheral onto an ordinary GPIO", () => {
    expect(
      issuesFor([
        assign({ gpio: 4, function: "uart", instance: 1, signal: "tx" }),
        assign({ gpio: 5, function: "uart", instance: 1, signal: "rx" }),
      ]),
    ).toEqual([])
  })
})

describe("duplicate signals", () => {
  it("errors when one controller signal is used twice, except SPI chip-select", () => {
    const [mosi] = only(duplicateSignalRuleId, [
      assign({ id: "a", gpio: 12, function: "spi", instance: 2, signal: "mosi" }),
      assign({ id: "b", gpio: 4, function: "spi", instance: 2, signal: "mosi" }),
    ])
    expect(mosi?.pins).toEqual([4, 12])

    expect(
      issuesFor([
        assign({ id: "cs0", gpio: 4, function: "spi", instance: 2, signal: "cs" }),
        assign({ id: "cs1", gpio: 5, function: "spi", instance: 2, signal: "cs" }),
      ]),
    ).toEqual([])

    const [channel] = only(duplicateSignalRuleId, [
      assign({ id: "a", gpio: 4, function: "ledc", channel: 1 }),
      assign({ id: "b", gpio: 5, function: "ledc", channel: 1 }),
    ])
    expect(channel?.message).toContain("LEDC channel 1")
  })
})

describe("i2c pull-ups", () => {
  it("reminds once per bus", () => {
    const issues = issuesFor([
      assign({ gpio: 8, function: "i2c", instance: 0, signal: "sda" }),
      assign({ gpio: 9, function: "i2c", instance: 0, signal: "scl" }),
    ])
    expect(issues).toHaveLength(1)
    expect(issues[0]?.severity).toBe("info")
    expect(issues[0]?.ruleId).toBe(i2cPullupsRuleId)
    expect(issues[0]?.pins).toEqual([8, 9])
    expect(issues[0]?.message).toContain("usually too weak for I2C, especially at 400 kHz")
    expect(issues[0]?.fix).toBe("Add external pull-ups from SDA and SCL to 3V3, sized for bus speed and capacitance.")
    expect(`${issues[0]?.message} ${issues[0]?.fix}`).not.toMatch(/\d+(\.\d+)?\s*k(?!Hz)/i)
    const note = chip.notes.find((item) => item.id === "i2c-pullups")
    expect(note?.verified).toBe(false)
    expect(note?.text).toBe(
      "Internal GPIO pull-ups are usually too weak for I2C, especially at 400 kHz. Add external pull-ups from SDA and SCL to 3V3, sized for bus speed and capacitance.",
    )
  })
})
