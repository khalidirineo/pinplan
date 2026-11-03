/**
 * One-shot draft of src/data/chips/esp32s3.json from the local reference clone.
 * Do not re-run this over a file you have started to verify.
 * The JSON is the source of truth after this script has been run once.
 *
 *   node scripts/draft-esp32s3.mjs
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const yamlPath = path.join(root, "reference/vendor/esp-gpio-tool/targets/esp32s3.yaml")
const readmePath = path.join(root, "reference/vendor/esp-gpio-tool/README.md")
const outPath = path.join(root, "src/data/chips/esp32s3.json")

const yaml = fs.readFileSync(yamlPath, "utf8")
const readme = fs.readFileSync(readmePath, "utf8")
const commit = readme.match(/Vendored from commit: `([0-9a-f]+)`/)?.[1]
if (!commit) throw new Error("could not read esp-gpio-tool commit from the vendored README")
const short = commit.slice(0, 12)
const tool = `esp-gpio-tool targets/esp32s3.yaml @ ${short}`

function section(name, next) {
  const start = yaml.split(new RegExp(`^${name}:\\r?\\n`, "m"))
  if (start.length < 2) throw new Error(`missing section ${name}`)
  return start[1].split(new RegExp(`^${next}:\\r?\\n`, "m"))[0]
}

const peripheral = section("peripheral", "gpio")
const gpioText = section("gpio", "soc")

function restAfter(name) {
  const parts = yaml.split(new RegExp(`^${name}:\\r?\\n`, "m"))
  if (parts.length < 2) throw new Error(`missing section ${name}`)
  return parts[1]
}

const socText = restAfter("soc")

function parseInner(inner) {
  const rtc = /(?:^|,\s*)rtc:\s*true/.test(inner)
  const at = inner.match(/at_reset:\s*(PUP|PDOWN)/)
  const fn = inner.match(/functions:\s*\[([^\]]*)\]/)
  const functions = fn && fn[1].trim() ? fn[1].split(",").map((s) => s.trim()).filter(Boolean) : []
  let strapping = null
  const sm = inner.match(/strapping:\s*([\s\S]*)$/)
  if (sm) strapping = sm[1].replace(/,\s*at_reset:\s*(PUP|PDOWN)\s*$/, "").trim()
  return {
    rtc,
    atReset: at ? (at[1] === "PUP" ? "pull-up" : "pull-down") : null,
    functions,
    strapping,
  }
}

const gpios = new Map()
for (const line of gpioText.split(/\r?\n/)) {
  if (!line.trim()) continue
  const match = line.match(/^  (\d+):\s*\{(.*)\}\s*$/)
  if (!match) throw new Error(`unparsed gpio line: ${line}`)
  gpios.set(Number(match[1]), parseInner(match[2]))
}

const expectedGpios = []
for (let n = 0; n <= 48; n += 1) if (n < 22 || n > 25) expectedGpios.push(n)
const actualGpios = [...gpios.keys()].sort((a, b) => a - b)
if (JSON.stringify(actualGpios) !== JSON.stringify(expectedGpios)) {
  throw new Error(`gpio set mismatch: ${actualGpios.join(",")}`)
}

function reserved(name) {
  const match = socText.match(new RegExp(`^  ${name}:\\s*\\{[^}]*reserved_pins:\\s*\\[([^\\]]*)\\]`, "m"))
  if (!match) throw new Error(`missing reserved_pins for ${name}`)
  if (!match[1].trim()) return []
  return match[1].split(",").map((s) => Number(s.trim()))
}

const sets = {
  fn8: reserved("ESP32-S3FN8"),
  r2: reserved("ESP32-S3R2"),
  fh4r2: reserved("ESP32-S3FH4R2"),
  r8: reserved("ESP32-S3R8"),
  r8v: reserved("ESP32-S3R8V"),
  r16v: reserved("ESP32-S3R16V"),
  picoR8: reserved("ESP32-S3-PICO-1-N8R8"),
  picoR2: reserved("ESP32-S3-PICO-1-N8R2"),
  bare: reserved("ESP32-S3"),
}
if (JSON.stringify(sets.r8) !== JSON.stringify(sets.r8v) || JSON.stringify(sets.r8) !== JSON.stringify(sets.r16v)) {
  throw new Error("octal reserved_pins lists disagree")
}
if (sets.bare.length !== 0) throw new Error("bare ESP32-S3 reserved_pins was not empty")

function blockNumber(name, field) {
  const block = peripheral.match(
    new RegExp(`(?:^|\\r?\\n)  ${name}:[^\\n]*\\r?\\n([\\s\\S]*?)(?=\\r?\\n  [A-Z]|$)`),
  )
  if (!block) throw new Error(`missing block ${name}`)
  const match = block[1].match(new RegExp(`^    ${field}:\\s*(\\d+)`, "m"))
  if (!match) throw new Error(`missing peripheral.${name}.${field}`)
  return Number(match[1])
}

const i2cCount = blockNumber("I2C", "count")
const uartCount = blockNumber("UART", "count")
const spiCountRaw = blockNumber("SPI", "count")
const ledcChannels = blockNumber("LEDC", "channels")
const ledcCount = blockNumber("LEDC", "count")
if (i2cCount !== 2 || uartCount !== 3 || ledcChannels !== 8 || ledcCount !== 1) {
  throw new Error(`unexpected peripheral counts i2c=${i2cCount} uart=${uartCount} ledc=${ledcChannels}/${ledcCount}`)
}

const pads = [
  { number: 1, side: "left", name: "GND" },
  { number: 2, side: "left", name: "3V3" },
  { number: 3, side: "left", name: "EN" },
  { number: 4, side: "left", gpio: 4 },
  { number: 5, side: "left", gpio: 5 },
  { number: 6, side: "left", gpio: 6 },
  { number: 7, side: "left", gpio: 7 },
  { number: 8, side: "left", gpio: 15 },
  { number: 9, side: "left", gpio: 16 },
  { number: 10, side: "left", gpio: 17 },
  { number: 11, side: "left", gpio: 18 },
  { number: 12, side: "left", gpio: 8 },
  { number: 13, side: "left", gpio: 19 },
  { number: 14, side: "left", gpio: 20 },
  { number: 15, side: "bottom", gpio: 3 },
  { number: 16, side: "bottom", gpio: 46 },
  { number: 17, side: "bottom", gpio: 9 },
  { number: 18, side: "bottom", gpio: 10 },
  { number: 19, side: "bottom", gpio: 11 },
  { number: 20, side: "bottom", gpio: 12 },
  { number: 21, side: "bottom", gpio: 13 },
  { number: 22, side: "bottom", gpio: 14 },
  { number: 23, side: "bottom", gpio: 21 },
  { number: 24, side: "bottom", gpio: 47 },
  { number: 25, side: "bottom", gpio: 48 },
  { number: 26, side: "bottom", gpio: 45 },
  { number: 40, side: "right", name: "GND" },
  { number: 39, side: "right", gpio: 1 },
  { number: 38, side: "right", gpio: 2 },
  { number: 37, side: "right", gpio: 43 },
  { number: 36, side: "right", gpio: 44 },
  { number: 35, side: "right", gpio: 42 },
  { number: 34, side: "right", gpio: 41 },
  { number: 33, side: "right", gpio: 40 },
  { number: 32, side: "right", gpio: 39 },
  { number: 31, side: "right", gpio: 38 },
  { number: 30, side: "right", gpio: 37 },
  { number: 29, side: "right", gpio: 36 },
  { number: 28, side: "right", gpio: 35 },
  { number: 27, side: "right", gpio: 0 },
  { number: 41, side: "center", name: "GND" },
]

const padOf = new Map()
for (const pad of pads) {
  if (pad.gpio !== undefined) padOf.set(pad.gpio, pad.number)
}

const unchecked = "Section not checked against the PDF while drafting this file."
const adcSource = `${tool}: ADC1_CH0–ADC1_CH9 are listed on GPIO1–GPIO10, and ADC2_CH0–ADC2_CH9 on GPIO11–GPIO20. Confirm against the ESP32-S3 Series Datasheet ADC pin table. ${unchecked}`
const touchSource = `${tool}: TOUCH1–TOUCH14 are listed on GPIO1–GPIO14. Confirm against the ESP32-S3 Series Datasheet touch pin table. ${unchecked}`
const adc2Effect = "ADC2 is also used by Wi-Fi. adc_oneshot_read may fail and return ESP_ERR_TIMEOUT."
const adc2Source = "ESP-IDF docs/en/api-reference/peripherals/adc/adc_oneshot.rst (master), Hardware Limitations: \"ADC2 is also used by Wi-Fi. adc_oneshot_read has provided protection between the Wi-Fi driver and ADC oneshot mode driver.\" adc_oneshot_read may fail and return ESP_ERR_TIMEOUT. This citation is that timeout behavior only."
const usbSource = `${tool}: GPIO19 functions include USB_D- and USB_OTG_D-; GPIO20 functions include USB_D+ and USB_OTG_D+. Confirm these are the native USB PHY pins in the ESP32-S3 Series Datasheet and the WROOM-1 datasheet. ${unchecked}`
const uartSource = `${tool}: GPIO43 function U0TXD (at_reset PUP), GPIO44 function U0RXD (at_reset PUP). Treated as the default UART0 console. Confirm in the ESP32-S3 Series Datasheet and the ROM boot console description. ${unchecked}`
const jtagSource = `${tool}: MTCK, MTDO, MTDI, and MTMS are listed on GPIO39, GPIO40, GPIO41, and GPIO42. USB_D-/USB_D+ are separate functions on GPIO19/GPIO20. Confirm pad JTAG versus USB Serial/JTAG in the TRM. ${unchecked}`
const flashSource = `${tool} soc.ESP32-S3FN8.reserved_pins is [27, 28, 29, 30, 31, 32] (comment: quad flash). Functions are SPIHD, SPIWP, SPICS0, SPICLK, SPIQ, SPID on GPIO27–GPIO32. None of these GPIOs appear on the WROOM-1 castellation map. The octal lists reserve most of this bus but omit GPIO27; the module still does not bring it out. Confirm in the ESP32-S3-WROOM-1 datasheet. ${unchecked}`
const notExposedSource = `${tool} plus the WROOM-1 pad map. GPIO26 (SPICS1), GPIO33 (FSPIHD/SUBSPIHD/SPIIO4), and GPIO34 (FSPICS0/SUBSPICS0/SPIIO5) have no castellation. GPIO26 is in the quad-PSRAM (R2) and octal-PSRAM (R8/R8V/R16V) reserved_pins. GPIO33 and GPIO34 are in the octal lists only. None of the three are in ESP32-S3FN8 reserved_pins. Confirm bonding in the module datasheet. ${unchecked}`
const psramPadSource = `${tool} soc reserved_pins for ESP32-S3R8, ESP32-S3R8V, and ESP32-S3R16V includes GPIO35, GPIO36, and GPIO37. Those entries are commented as octal PSRAM. The same GPIOs are not in ESP32-S3FN8 or ESP32-S3R2 reserved_pins, and they are castellations on the WROOM-1 pad map. esp32pin's OSPI note says they are unavailable on N8R8/N16R8-class modules and free otherwise. Confirm in the ESP32-S3-WROOM-1 datasheet. ${unchecked}`
const psram26Source = `${tool} reserved_pins includes GPIO26 for ESP32-S3R2 (comment: quad PSRAM) and for ESP32-S3R8/R8V/R16V (comment: octal PSRAM). Function on the GPIO is SPICS1. It is not a WROOM-1 castellation. Confirm which module SKUs use this net. ${unchecked}`
const psram33Source = `${tool} octal-PSRAM reserved_pins (ESP32-S3R8, R8V, R16V) include GPIO33 and GPIO34. The quad-flash (FN8) and quad-PSRAM (R2) lists do not. These GPIOs are also not WROOM-1 castellations. Confirm in the module datasheet. ${unchecked}`

const octalPads = sets.r8.filter((n) => padOf.has(n))
const pins = []
for (const gpio of expectedGpios) {
  const parsed = gpios.get(gpio)
  const names = [`GPIO${gpio}`, ...parsed.functions]
  if (gpio === 0) names.push("BOOT")
  if (gpio === 47) names.push("SPICLK_P", "SUBSPICLK_P_DIFF")
  if (gpio === 48) names.push("SPICLK_N", "SUBSPICLK_N_DIFF")

  let adc = null
  const adcName = parsed.functions.find((fn) => /^ADC[12]_CH\d+$/.test(fn))
  if (gpio >= 1 && gpio <= 20) {
    if (!adcName) throw new Error(`missing ADC function on GPIO${gpio}`)
    const unit = adcName.startsWith("ADC1") ? "ADC1" : "ADC2"
    const channel = Number(adcName.split("CH")[1])
    const expectUnit = gpio <= 10 ? "ADC1" : "ADC2"
    const expectChannel = gpio <= 10 ? gpio - 1 : gpio - 11
    if (unit !== expectUnit || channel !== expectChannel) {
      throw new Error(`ADC map mismatch on GPIO${gpio}: ${adcName}`)
    }
    adc = { unit, channel, source: adcSource, verified: false }
  } else if (adcName) {
    throw new Error(`unexpected ADC function on GPIO${gpio}: ${adcName}`)
  }

  let touch = null
  const touchName = parsed.functions.find((fn) => /^TOUCH\d+$/.test(fn))
  if (touchName) {
    const channel = Number(touchName.slice(5))
    if (channel !== gpio) throw new Error(`touch channel mismatch on GPIO${gpio}: ${touchName}`)
    touch = { channel, source: touchSource, verified: false }
  }
  if ((gpio >= 1 && gpio <= 14) !== Boolean(touch)) {
    throw new Error(`touch presence mismatch on GPIO${gpio}`)
  }

  const expectRtc = gpio <= 21
  if (parsed.rtc !== expectRtc) throw new Error(`rtc flag mismatch on GPIO${gpio}`)

  const constraints = []
  if (parsed.strapping) {
    let bootLevel
    let effect
    let source
    if (gpio === 0) {
      bootLevel = "high"
      effect = "Weak pull-up at reset. Boot level is high. 1 selects SPI boot. 0 selects joint download boot when GPIO46 is 0."
      source = "ESP32-S3 Series Datasheet v2.2, Section 3, Table 3-1 and Table 3-3. ESP32-S3-WROOM-1 Datasheet v1.8, Section 4. GPIO0 has a weak pull-up at reset and a high boot level. 1 selects SPI boot. 0 selects joint download boot when GPIO46 is 0."
    } else if (gpio === 3) {
      effect = "Floating at reset. No internal pull resistors; when used as a strap, an external circuit must hold a defined level. Only acts as a strap when the JTAG eFuses are burnt (all default 0)."
      source = "ESP32-S3 Series Datasheet v2.2, Section 3.4: GPIO3 has no internal pull resistors, and when it is used as a strap an external circuit must hold a defined level. Table 3-1 lists GPIO3 as floating. It acts as a strap only when the JTAG eFuses are burnt; those eFuses default to 0."
    } else if (gpio === 45) {
      bootLevel = "low"
      effect = "Weak pull-down at reset, so the default bit is 0. With EFUSE_VDD_SPI_FORCE left at 0, GPIO45 = 0 selects 3.3 V from VDD3P3_RTC via R_SPI, and GPIO45 = 1 selects 1.8 V from the flash voltage regulator. If EFUSE_VDD_SPI_FORCE is 1, GPIO45 is ignored and EFUSE_VDD_SPI_TIEH selects the voltage: 1 is 3.3 V, 0 is 1.8 V."
      source = "ESP32-S3 Series Datasheet v2.2, Section 3.2, Table 3-4 (VDD_SPI Voltage Control), and Table 3-1 (GPIO45 weak pull-down, default bit value 0). The eFuse parameters in Table 3-4 default to 0, and the bold default row is 3.3 V from VDD3P3_RTC via R_SPI."
    } else if (gpio === 46) {
      bootLevel = "low"
      effect = "Weak pull-down at reset. Boot level is low. Download mode requires GPIO0 = 0 and GPIO46 = 0. GPIO46 may be either level when GPIO0 = 1."
      source = "ESP32-S3 Series Datasheet v2.2, Section 3, Table 3-1 and Table 3-3. ESP32-S3-WROOM-1 Datasheet v1.8, Section 4. GPIO46 has a weak pull-down at reset and a low boot level. Download mode requires GPIO0 = 0 and GPIO46 = 0. When GPIO0 = 1, GPIO46 may be either level."
    } else {
      throw new Error(`unexpected strapping GPIO${gpio}`)
    }
    constraints.push({
      id: "strapping",
      ...(bootLevel ? { bootLevel } : {}),
      ...(gpio === 3 ? { infoOnly: true } : {}),
      effect,
      source,
      verified: true,
    })
  }

  if (adc?.unit === "ADC2") {
    constraints.push({
      id: "adc2_wifi",
      when: { setting: "wifiEnabled", equals: true },
      effect: adc2Effect,
      source: adc2Source,
      verified: true,
    })
  }

  if (parsed.functions.includes("USB_D-") || parsed.functions.includes("USB_D+")) {
    const signal = parsed.functions.includes("USB_D-") ? "dn" : "dp"
    if (signal === "dn" && gpio !== 19) throw new Error("USB D- not on GPIO19")
    if (signal === "dp" && gpio !== 20) throw new Error("USB D+ not on GPIO20")
    constraints.push({
      id: "usb",
      when: { setting: "nativeUsb", equals: true },
      signal,
      effect: signal === "dn"
        ? "USB D- (USB_D- / USB_OTG_D-). With native USB enabled this pad belongs to the USB PHY."
        : "USB D+ (USB_D+ / USB_OTG_D+). With native USB enabled this pad belongs to the USB PHY.",
      source: usbSource,
      verified: false,
    })
  }

  for (const signal of ["MTCK", "MTDO", "MTDI", "MTMS"]) {
    if (!parsed.functions.includes(signal)) continue
    const expected = { MTCK: 39, MTDO: 40, MTDI: 41, MTMS: 42 }[signal]
    if (gpio !== expected) throw new Error(`${signal} expected on GPIO${expected}, found GPIO${gpio}`)
    constraints.push({
      id: "jtag",
      signal,
      effect: `Pad JTAG ${signal}. Assigning another function uses the pad for that function instead. The YAML lists USB D-/D+ as different functions on GPIO19/GPIO20.`,
      source: jtagSource,
      verified: false,
    })
  }

  if (parsed.functions.includes("U0TXD") || parsed.functions.includes("U0RXD")) {
    const signal = parsed.functions.includes("U0TXD") ? "tx" : "rx"
    if (signal === "tx" && gpio !== 43) throw new Error("U0TXD not on GPIO43")
    if (signal === "rx" && gpio !== 44) throw new Error("U0RXD not on GPIO44")
    constraints.push({
      id: "uart0",
      signal,
      effect: signal === "tx"
        ? "Default UART0 TX (U0TXD), internal pull-up at reset. The ROM bootloader uses this pin as the console."
        : "Default UART0 RX (U0RXD), internal pull-up at reset. The ROM bootloader uses this pin as the console.",
      source: uartSource,
      verified: false,
    })
  }

  const onModule = padOf.has(gpio)
  if (sets.fn8.includes(gpio)) {
    if (onModule) throw new Error(`FN8 reserved GPIO${gpio} is on a module pad`)
    constraints.push({
      id: "flash_reserved",
      signal: parsed.functions[0] ?? "SPI",
      effect: `Reserved for the in-module SPI flash (${parsed.functions.join(", ") || "SPI"}) and not bonded out on the ESP32-S3-WROOM-1.`,
      source: flashSource,
      verified: false,
    })
  } else if (!onModule) {
    constraints.push({
      id: "not_exposed",
      signal: parsed.functions[0] ?? "",
      effect: `GPIO${gpio} (${parsed.functions.join(", ") || "no alternate function listed"}) is not bonded out on the ESP32-S3-WROOM-1.`,
      source: notExposedSource,
      verified: false,
    })
  }

  if (gpio === 35 || gpio === 36 || gpio === 37) {
    if (!sets.r8.includes(gpio) || sets.fn8.includes(gpio) || sets.r2.includes(gpio)) {
      throw new Error(`octal pad assumption failed for GPIO${gpio}`)
    }
    constraints.push({
      id: "psram_reserved",
      when: { setting: "psram", equals: "octal" },
      effect: `Used by octal PSRAM when the PSRAM setting is octal. Functions listed on this GPIO: ${parsed.functions.join(", ")}. The quad-flash and quad-PSRAM reserved lists do not include it, and it is a module pad.`,
      source: psramPadSource,
      verified: false,
    })
  }
  if (gpio === 26) {
    constraints.push({
      id: "psram_reserved",
      when: { setting: "psram", in: ["quad", "octal"] },
      effect: "SPICS1. Reserved on quad-PSRAM and octal-PSRAM dies, and not bonded out on the WROOM-1.",
      source: psram26Source,
      verified: false,
    })
  }
  if (gpio === 33 || gpio === 34) {
    if (!sets.r8.includes(gpio)) throw new Error(`GPIO${gpio} missing from octal reserved list`)
    constraints.push({
      id: "psram_reserved",
      when: { setting: "psram", equals: "octal" },
      effect: `Inside the octal-PSRAM die (${parsed.functions.join(", ")}) and not bonded out on the WROOM-1. Quad settings do not reserve it in the YAML, but the module still has no pad.`,
      source: psram33Source,
      verified: false,
    })
  }

  if (!parsed.strapping && ![0, 3, 45, 46].includes(gpio) && constraints.some((c) => c.id === "strapping")) {
    throw new Error("strapping constraint without strapping text")
  }

  pins.push({
    gpio,
    names,
    modulePad: padOf.get(gpio) ?? null,
    rtcDomain: parsed.rtc,
    inputOnly: false,
    atReset: parsed.atReset,
    adc,
    touch,
    constraints,
  })
}

const strapGpios = pins.filter((pin) => pin.constraints.some((c) => c.id === "strapping")).map((pin) => pin.gpio)
if (JSON.stringify(strapGpios) !== JSON.stringify([0, 3, 45, 46])) {
  throw new Error(`strapping set ${strapGpios.join(",")}`)
}
if (JSON.stringify(octalPads) !== JSON.stringify([35, 36, 37])) {
  throw new Error(`octal pads ${octalPads.join(",")}`)
}

const pullUp = pins.filter((pin) => pin.atReset === "pull-up").map((pin) => pin.gpio)
const pullDown = pins.filter((pin) => pin.atReset === "pull-down").map((pin) => pin.gpio)
if (JSON.stringify(pullUp) !== JSON.stringify([0, 26, 27, 28, 29, 30, 31, 32, 43, 44])) {
  throw new Error(`pull-up set changed: ${pullUp.join(",")}`)
}
if (JSON.stringify(pullDown) !== JSON.stringify([45, 46])) {
  throw new Error(`pull-down set changed: ${pullDown.join(",")}`)
}

const fmt = (arr) => arr.join(", ")
const chip = {
  id: "esp32-s3-wroom-1",
  name: "ESP32-S3-WROOM-1",
  family: "ESP32-S3",
  datasheet: {
    title: "ESP32-S3 Series Datasheet",
    url: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf",
    revision: "v2.2",
  },
  moduleDatasheet: {
    title: "ESP32-S3-WROOM-1 & WROOM-1U Datasheet",
    url: "https://www.espressif.com/sites/default/files/documentation/esp32-s3-wroom-1_wroom-1u_datasheet_en.pdf",
    revision: "v1.8",
  },
  trm: {
    title: "ESP32-S3 Technical Reference Manual",
    url: "https://www.espressif.com/sites/default/files/documentation/esp32-s3_technical_reference_manual_en.pdf",
    revision: "not checked",
  },
  resources: {
    i2c: {
      count: i2cCount,
      instances: [0, 1],
      note: "Instance 0 is I2C0 and instance 1 is I2C1.",
      source: `${tool} peripheral.I2C.count = ${i2cCount}. universal_pins lists I2C{n}_SCL and I2C{n}_SDA, so the signals are GPIO-matrix routed. Confirm the controller count in the TRM. ${unchecked}`,
      verified: false,
    },
    uart: {
      count: uartCount,
      instances: [0, 1, 2],
      note: "Instance numbers match UART0, UART1, and UART2. UART0 defaults to GPIO43/GPIO44.",
      source: `${tool} peripheral.UART.count = ${uartCount}. Confirm in the TRM. ${unchecked}`,
      verified: false,
    },
    spi: {
      count: 2,
      instances: [2, 3],
      note: "SPI2 and SPI3 only. SPI0 and SPI1 are the flash/PSRAM bus.",
      source: `User-controller count is 2 (instances 2 and 3). SPI0 and SPI1 are the flash/PSRAM bus and are not assignable. ${tool} peripheral.SPI.count is ${spiCountRaw} and a comment lists SPI0–SPI3; that field is not the user-controller count. Confirm in the ESP32-S3 TRM SPI chapter. ${unchecked}`,
      verified: false,
    },
    ledc: {
      channels: ledcChannels,
      source: `${tool} peripheral.LEDC.channels = ${ledcChannels} and count = ${ledcCount}. Timer count is not in that block and is not encoded. Confirm channel and timer counts in the TRM LEDC chapter. ${unchecked}`,
      verified: false,
    },
  },
  gpioMatrix: {
    routable: ["gpio", "ledc", "i2c", "spi", "uart"],
    fixed: ["adc", "touch", "usb"],
    source: `${tool} marks I2C, extra UART signals, user SPI signals, and LEDC as universal_pins (GPIO-matrix signals in that file). ADC, touch, and USB D+/D- are fixed assigned_pins. JTAG and the default UART0 pins are fixed pads that the rules still allow you to reassign. Confirm in the TRM GPIO-matrix chapter. ${unchecked}`,
    verified: false,
  },
  strappingTiming: {
    holdAfterChipPuMs: 3,
    source: "ESP32-S3 Series Datasheet v2.2, Section 3, Table 3-2, parameter t_H. A strapping pin must hold its level for at least 3 ms after CHIP_PU goes high.",
    verified: true,
  },
  module: {
    name: "ESP32-S3-WROOM-1",
    padOrder: "Pads are listed in visual order: left top to bottom, bottom left to right, right top to bottom, then the center ground pad. Pin 41 is GND in the KiCad symbol (grouped with pads 1 and 40) but is not in the castellation arrays, so it is recorded as a center pad.",
    padSource: {
      source: `Transcribed from esp32pin (MIT, Copyright 2026 Felix Kunz) src/data/chips/generated.ts symbols S3_WROOM_1_LAYOUT and S3_WROOM_1_SYMBOL, which were generated from Espressif KiCad libraries (Apache-2.0). Confirm every pad against the ESP32-S3-WROOM-1 datasheet module pinout. ${unchecked}`,
      verified: false,
    },
    pads,
  },
  notes: [
    {
      id: "provenance-esp-gpio-tool",
      text: `Alternate function names, RTC-domain flags, at-reset pulls, strapping text, peripheral counts, and per-die reserved GPIO lists were transcribed from ${tool} (Apache-2.0). The YAML is not copied into this repo. Strapping pins GPIO0, GPIO3, GPIO45, and GPIO46, plus the ADC2 Wi-Fi timeout, were checked later. The rest of this transcription has not been checked against the datasheet PDF.`,
      source: `https://github.com/espressif/esp-gpio-tool commit ${commit}. ${unchecked}`,
      verified: false,
    },
    {
      id: "provenance-pad-map",
      text: "WROOM-1 pad numbers were transcribed from ESP32 Pinout Studio's generated layout, not redrawn from the module datasheet.",
      source: `esp32pin src/data/chips/generated.ts S3_WROOM_1_LAYOUT / S3_WROOM_1_SYMBOL (MIT). Upstream of that file is Espressif's KiCad libraries (Apache-2.0). ${unchecked}`,
      verified: false,
    },
    {
      id: "document-urls",
      text: "Datasheet and module datasheet URLs are the usual Espressif documentation links. Series datasheet revision v2.2 and WROOM-1 datasheet revision v1.8 were recorded when the strapping tables were checked. The TRM URL is recorded and its revision is still not checked.",
      source: "Revision numbers came from the strapping review. The URLs were not re-fetched, and the TRM revision is still open.",
      verified: false,
    },
    {
      id: "reserved-pin-sets",
      text: [
        "Reserved-pin sets copied from the YAML soc: block. WROOM-1 rules use the pad map plus FN8 (always-on flash bus), R2 (quad PSRAM, GPIO26), and R8 (octal PSRAM, including GPIO35–37).",
        `ESP32-S3FN8 [${fmt(sets.fn8)}] comment: quad flash.`,
        `ESP32-S3R2 [${fmt(sets.r2)}] comment: quad PSRAM.`,
        `ESP32-S3FH4R2 [${fmt(sets.fh4r2)}] comment: quad flash + quad PSRAM. Differs from R2 by also listing GPIO27. Not applied as its own mode.`,
        `ESP32-S3R8 / R8V / R16V [${fmt(sets.r8)}] comment: octal PSRAM.`,
        `ESP32-S3-PICO-1-N8R2 reserved [${fmt(sets.picoR2)}]. ESP32-S3-PICO-1-N8R8 reserved [${fmt(sets.picoR8)}]. PICO not_connected lists were not applied to this module.`,
        "ESP32-S3 (no embedded flash/PSRAM) reserved_pins is empty.",
      ].join(" "),
      source: `${tool} soc.*.reserved_pins. ${unchecked}`,
      verified: false,
    },
    {
      id: "rtc-domain",
      text: "rtcDomain true on GPIO0–GPIO21 copies the YAML rtc: true flag on power domain VDD3P3_RTC. That is the low-power domain, not the 32 kHz crystal. The crystal pins are the names XTAL_32K_P (GPIO15) and XTAL_32K_N (GPIO16).",
      source: `${tool} gpio power_domain / rtc fields. Confirm the RTC GPIO list in the TRM. ${unchecked}`,
      verified: false,
    },
    {
      id: "no-input-only",
      text: "No GPIO in the YAML is marked input-only, and inputOnly is false on every pin. GPIO46 input-only is an ESP32-S2 fact; the S3 YAML and the esp32pin S3-WROOM-1 pin list do not mark it that way. Confirm GPIO46 can drive high and low.",
      source: `${tool} has no input-only flag. esp32pin S3_WROOM_1_PINS does not attach input_only; S2 does, on GPIO46. ${unchecked}`,
      verified: false,
    },
    {
      id: "at-reset-pulls",
      text: `Internal pulls at reset, from the YAML at_reset field. Pull-up: GPIO ${fmt(pullUp)}. Pull-down: GPIO ${fmt(pullDown)}. Every other GPIO has no at_reset entry, including GPIO3. GPIO0, GPIO3, GPIO45, and GPIO46 were checked separately in ESP32-S3 Series Datasheet v2.2 Table 3-3. This note stays unverified because the other pins in the list were not.`,
      source: `${tool} at_reset PUP/PDOWN. GPIO0, GPIO3, GPIO45, and GPIO46 pulls are cited on those pins. The remaining pins in this list are still only the YAML transcription.`,
      verified: false,
    },
    {
      id: "gpio47-48-polarity",
      text: "The YAML lists SPICLK_DIFF and SUBSPICLK_DIFF on both GPIO47 and GPIO48, with no P/N marker. The KiCad symbol (via esp32pin) names GPIO47 SPICLK_P / SUBSPICLK_P_DIFF and GPIO48 SPICLK_N / SUBSPICLK_N_DIFF. Both name sets are stored. Polarity is not confirmed.",
      source: `${tool} gpio.47 and gpio.48, compared with esp32pin S3_WROOM_1_PINS. ${unchecked}`,
      verified: false,
    },
    {
      id: "no-dac",
      text: "The YAML function lists contain no DAC pin. esp32pin's ESP32-S3 family note also says there is no DAC. There is no DAC assignment in v1.",
      source: `${tool} gpio functions, and esp32pin catalog note for ESP32-S3. Confirm in the datasheet. ${unchecked}`,
      verified: false,
    },
    {
      id: "boot-alias",
      text: "GPIO0 carries an extra name BOOT taken from the KiCad symbol pin name GPIO0/BOOT. It is not in the YAML functions list, which is empty for GPIO0.",
      source: `esp32pin S3_WROOM_1_SYMBOL pin name "GPIO0/BOOT". ${unchecked}`,
      verified: false,
    },
    {
      id: "vdd-spi-18v-modules",
      text: "1.8 V modules (R8V/R16V variants, Table 1-1) need 1.8 V flash and may have VDD_SPI fixed by eFuse. Check the module datasheet for the part you are using.",
      source: "Recorded from review against ESP32-S3 Series Datasheet v2.2 Table 1-1, which names R8V and R16V variants. Whether a WROOM-1 module fixes VDD_SPI with an eFuse has not been checked in that module datasheet.",
      verified: false,
    },
    {
      id: "i2c-pullups",
      text: "Internal GPIO pull-ups are usually too weak for I2C, especially at 400 kHz. Add external pull-ups from SDA and SCL to 3V3, sized for bus speed and capacitance.",
      source: "ESP-IDF v5.3 driver/i2c_master.h says the internal pull-up is not strong enough for a high-speed bus and recommends an external pull-up. The 400 kHz figure is this project's export default, not a checked datasheet limit.",
      verified: false,
    },
  ],
  pins,
}

if (fs.existsSync(outPath) && !process.argv.includes("--force")) {
  console.error("refusing to overwrite src/data/chips/esp32s3.json (pass --force)")
  process.exit(1)
}
fs.mkdirSync(path.dirname(outPath), { recursive: true })
fs.writeFileSync(outPath, `${JSON.stringify(chip, null, 2)}\n`)
console.log(`wrote ${pins.length} pins to ${outPath}`)
