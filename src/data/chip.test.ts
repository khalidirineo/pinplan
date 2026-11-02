import { describe, expect, it } from "vitest"
import { listCited } from "./cited"
import { loadChip } from "./loadChip"

const chip = loadChip()

function pin(gpio: number) {
  const found = chip.pins.find((item) => item.gpio === gpio)
  if (!found) throw new Error(`missing GPIO${gpio}`)
  return found
}

function constraintIds(gpio: number): string[] {
  return pin(gpio).constraints.map((constraint) => constraint.id)
}

describe("esp32-s3-wroom-1 database", () => {
  it("loads the module and every real GPIO", () => {
    expect(chip.id).toBe("esp32-s3-wroom-1")
    expect(chip.pins).toHaveLength(45)
    const gpios = chip.pins.map((item) => item.gpio)
    expect(gpios).not.toContain(22)
    expect(gpios).not.toContain(25)
    expect(gpios[0]).toBe(0)
    expect(gpios.at(-1)).toBe(48)
  })

  it("maps ADC and touch channels from the drafted function names", () => {
    for (let gpio = 1; gpio <= 10; gpio += 1) {
      expect(pin(gpio).adc).toMatchObject({ unit: "ADC1", channel: gpio - 1 })
      expect(pin(gpio).touch).toMatchObject({ channel: gpio })
    }
    for (let gpio = 11; gpio <= 14; gpio += 1) {
      expect(pin(gpio).adc).toMatchObject({ unit: "ADC2", channel: gpio - 11 })
      expect(pin(gpio).touch).toMatchObject({ channel: gpio })
    }
    for (let gpio = 15; gpio <= 20; gpio += 1) {
      expect(pin(gpio).adc).toMatchObject({ unit: "ADC2", channel: gpio - 11 })
      expect(pin(gpio).touch).toBeNull()
    }
    expect(pin(0).adc).toBeNull()
    expect(pin(21).adc).toBeNull()
    expect(pin(21).names).toContain("USB_RCV")
    expect(pin(19).names).toEqual(
      expect.arrayContaining(["USB_D-", "USB_OTG_D-", "ADC2_CH8"]),
    )
  })

  it("records strapping, console, USB, and JTAG on the drafted pins", () => {
    expect(constraintIds(0)).toContain("strapping")
    expect(pin(0).constraints.find((item) => item.id === "strapping")?.bootLevel).toBe("high")
    expect(pin(0).names).toContain("BOOT")
    expect(pin(3).constraints.find((item) => item.id === "strapping")).toMatchObject({
      infoOnly: true,
      verified: true,
      effect: "Floating at reset. Only acts as a strap when the JTAG eFuses are burnt (all default 0).",
    })
    expect(pin(0).constraints.find((item) => item.id === "strapping")).toMatchObject({
      verified: true,
      effect: "Weak pull-up at reset. Boot level is high. 1 selects SPI boot. 0 selects joint download boot when GPIO46 is 0.",
    })
    expect(pin(45).constraints.find((item) => item.id === "strapping")).toMatchObject({
      verified: true,
      effect: "Weak pull-down at reset. The 3.3 V / 1.8 V VDD_SPI mapping is not verified.",
    })
    expect(pin(45).constraints.find((item) => item.id === "strapping")?.source).toMatch(/remains unverified/)
    expect(pin(46).constraints.find((item) => item.id === "strapping")).toMatchObject({
      verified: true,
      effect: "Weak pull-down at reset. Boot level is low. Download mode requires GPIO0 = 0 and GPIO46 = 0. GPIO46 may be either level when GPIO0 = 1.",
    })
    expect(chip.strappingTiming).toMatchObject({ holdAfterChipPuMs: 3, verified: true })
    expect(chip.datasheet.revision).toBe("v2.2")
    expect(chip.moduleDatasheet.revision).toBe("v1.8")
    for (let gpio = 11; gpio <= 20; gpio += 1) {
      expect(pin(gpio).constraints.find((item) => item.id === "adc2_wifi")).toMatchObject({
        verified: true,
        effect: "ADC2 is also used by Wi-Fi. adc_oneshot_read may fail and return ESP_ERR_TIMEOUT.",
      })
    }
    expect(pin(3).constraints.find((item) => item.id === "strapping")?.bootLevel).toBeUndefined()
    expect(pin(45).constraints.find((item) => item.id === "strapping")?.bootLevel).toBe("low")
    expect(pin(46).constraints.find((item) => item.id === "strapping")?.bootLevel).toBe("low")
    const straps = chip.pins
      .filter((item) => item.constraints.some((constraint) => constraint.id === "strapping"))
      .map((item) => item.gpio)
    expect(straps).toEqual([0, 3, 45, 46])

    expect(pin(19).constraints.find((item) => item.id === "usb")?.signal).toBe("dn")
    expect(pin(20).constraints.find((item) => item.id === "usb")?.signal).toBe("dp")
    expect(pin(43).constraints.find((item) => item.id === "uart0")?.signal).toBe("tx")
    expect(pin(44).constraints.find((item) => item.id === "uart0")?.signal).toBe("rx")
    expect(pin(39).constraints.find((item) => item.id === "jtag")?.signal).toBe("MTCK")
    expect(pin(40).constraints.find((item) => item.id === "jtag")?.signal).toBe("MTDO")
    expect(pin(41).constraints.find((item) => item.id === "jtag")?.signal).toBe("MTDI")
    expect(pin(42).constraints.find((item) => item.id === "jtag")?.signal).toBe("MTMS")
  })

  it("reserves flash and PSRAM pins the way the drafted module rules need", () => {
    expect(constraintIds(27)).toEqual(["flash_reserved"])
    expect(constraintIds(32)).toEqual(["flash_reserved"])
    expect(constraintIds(26)).toEqual(["not_exposed", "psram_reserved"])
    expect(pin(26).constraints.find((item) => item.id === "psram_reserved")?.when).toEqual({
      setting: "psram",
      in: ["quad", "octal"],
    })
    expect(constraintIds(33)).toEqual(["not_exposed", "psram_reserved"])
    expect(constraintIds(34)).toEqual(["not_exposed", "psram_reserved"])
    expect(constraintIds(35)).toEqual(["psram_reserved"])
    expect(pin(35).constraints[0]?.when).toEqual({ setting: "psram", equals: "octal" })
    expect(pin(35).modulePad).not.toBeNull()
    expect(constraintIds(38)).toEqual([])
  })

  it("keeps the WROOM-1 castellation map", () => {
    expect(chip.module.pads).toHaveLength(41)
    const exposed = Object.fromEntries(
      chip.pins.filter((item) => item.modulePad !== null).map((item) => [item.gpio, item.modulePad]),
    )
    expect(exposed).toEqual({
      0: 27, 1: 39, 2: 38, 3: 15, 4: 4, 5: 5, 6: 6, 7: 7, 8: 12, 9: 17,
      10: 18, 11: 19, 12: 20, 13: 21, 14: 22, 15: 8, 16: 9, 17: 10, 18: 11,
      19: 13, 20: 14, 21: 23, 35: 28, 36: 29, 37: 30, 38: 31, 39: 32, 40: 33,
      41: 34, 42: 35, 43: 37, 44: 36, 45: 26, 46: 16, 47: 24, 48: 25,
    })
    for (const gpio of [26, 27, 28, 29, 30, 31, 32, 33, 34]) {
      expect(pin(gpio).modulePad).toBeNull()
    }
  })

  it("copies RTC domain, reset pulls, and the no-input-only claim", () => {
    for (const item of chip.pins) {
      expect(item.inputOnly).toBe(false)
      expect(item.rtcDomain).toBe(item.gpio <= 21)
    }
    expect(pin(46).inputOnly).toBe(false)
    expect(pin(0).atReset).toBe("pull-up")
    expect(pin(3).atReset).toBeNull()
    expect(pin(45).atReset).toBe("pull-down")
    expect(pin(46).atReset).toBe("pull-down")
    expect(pin(43).atReset).toBe("pull-up")
    expect(pin(47).names).toEqual(expect.arrayContaining(["SPICLK_DIFF", "SPICLK_P"]))
    expect(pin(48).names).toEqual(expect.arrayContaining(["SPICLK_DIFF", "SPICLK_N"]))
  })

  it("stores the controller counts used by the limit rule", () => {
    expect(chip.resources.i2c.instances).toEqual([0, 1])
    expect(chip.resources.uart.instances).toEqual([0, 1, 2])
    expect(chip.resources.spi.count).toBe(2)
    expect(chip.resources.spi.instances).toEqual([2, 3])
    expect(chip.resources.spi.note).toBe("SPI2 and SPI3 only. SPI0 and SPI1 are the flash/PSRAM bus.")
    expect(chip.resources.spi.verified).toBe(false)
    expect(chip.resources.ledc.channels).toBe(8)
  })

  it("keeps every citation unverified until its path is listed here", () => {
    // After you check a fact, set verified: true in the JSON and add its path.
    const reviewed = [
      "$.strappingTiming",
      "$.pins[gpio0].constraints[0]",
      "$.pins[gpio3].constraints[0]",
      "$.pins[gpio45].constraints[0]",
      "$.pins[gpio46].constraints[0]",
      ...Array.from({ length: 10 }, (_, index) => `$.pins[gpio${11 + index}].constraints[0]`),
    ]
    const cited = listCited(chip)
    expect(cited.length).toBeGreaterThan(40)
    for (const item of cited) {
      expect(item.source.trim().length, item.path).toBeGreaterThan(0)
      expect(item.verified, item.path).toBe(reviewed.includes(item.path))
    }
  })
})
