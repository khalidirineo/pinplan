import type { Chip, Pin } from "../data/types"
import type { Assignment, Issue, ProjectSettings } from "../engine/types"
import { pinByGpio } from "../engine/pins"

const INDENT = "    "

export function exportEspIdf(
  chip: Chip,
  assignments: Assignment[],
  settings: ProjectSettings,
  issues: Issue[],
): string {
  const sorted = [...assignments].sort((a, b) => a.gpio - b.gpio || a.id.localeCompare(b.id))
  const used = new Set(sorted.map((assignment) => assignment.function))
  const chunks: string[] = [header(chip, settings, issues, sorted.length === 0)]

  const includes = ['#include "esp_err.h"', '#include "driver/gpio.h"']
  if (used.has("adc")) includes.push('#include "esp_adc/adc_oneshot.h"')
  if (used.has("i2c")) includes.push('#include "driver/i2c_master.h"')
  if (used.has("spi")) includes.push('#include "driver/spi_master.h"')
  if (used.has("uart")) includes.push('#include "driver/uart.h"')
  if (used.has("ledc")) includes.push('#include "driver/ledc.h"')
  chunks.push(includes.join("\n"))

  const defines: string[] = []
  if (used.has("i2c")) defines.push("#define PINPLAN_I2C_HZ 400000")
  if (used.has("spi")) defines.push("#define PINPLAN_SPI_HZ 1000000")
  if (used.has("uart")) {
    defines.push("#define PINPLAN_UART_BAUD 115200")
    defines.push("#define PINPLAN_UART_RX_BUF 256")
  }
  if (used.has("ledc")) defines.push("#define PINPLAN_LEDC_HZ 5000")
  if (defines.length > 0) chunks.push(defines.join("\n"))

  const bodies: string[] = []
  const gpio = renderGpio(chip, sorted.filter((assignment) => assignment.function === "gpio"))
  const adc = renderAdc(chip, sorted.filter((assignment) => assignment.function === "adc"))
  const i2c = renderI2c(sorted.filter((assignment) => assignment.function === "i2c"))
  const spi = renderSpi(sorted.filter((assignment) => assignment.function === "spi"))
  const uart = renderUart(sorted.filter((assignment) => assignment.function === "uart"))
  const ledc = renderLedc(sorted.filter((assignment) => assignment.function === "ledc"))
  for (const part of [gpio, adc, i2c, spi, uart, ledc]) {
    if (part) bodies.push(part)
  }

  const calls = [
    gpio ? "pinplan_init_gpio();" : null,
    adc ? "pinplan_init_adc();" : null,
    i2c ? "pinplan_init_i2c();" : null,
    spi ? "pinplan_init_spi();" : null,
    uart ? "pinplan_init_uart();" : null,
    ledc ? "pinplan_init_ledc();" : null,
  ].filter((line): line is string => line !== null)

  bodies.push(
    [
      "void pinplan_init(void)",
      "{",
      ...(calls.length > 0 ? calls.map((line) => `${INDENT}${line}`) : []),
      "}",
    ].join("\n"),
  )

  chunks.push(bodies.join("\n\n"))
  return `${chunks.filter((chunk) => chunk.length > 0).join("\n\n")}\n`
}

function header(chip: Chip, settings: ProjectSettings, issues: Issue[], empty: boolean): string {
  const conflicts = issues.filter((issue) => issue.severity === "error" || issue.severity === "warning")
  const lines = [
    `PinPlan export for ${chip.name}.`,
    "ESP-IDF v5.3+.",
    `Settings: Wi-Fi ${settings.wifiEnabled ? "on" : "off"}, PSRAM ${settings.psram}, native USB ${settings.nativeUsb ? "on" : "off"}.`,
    "Clock rates, ADC attenuation, and the LEDC timer are export defaults. Edit the PINPLAN_* macros. They are not facts from the pin database.",
  ]
  if (conflicts.length === 0) {
    lines.push("No errors or warnings at export.")
  } else {
    lines.push("This design still has conflicts. The code below was generated anyway.")
    for (const issue of conflicts) {
      const pins = issue.pins.length > 0 ? ` GPIO${issue.pins.join(", GPIO")}` : ""
      lines.push(`[${issue.severity}] ${issue.ruleId}${pins}: ${issue.message.replaceAll("\n", " ")}`)
    }
  }
  if (empty) lines.push("No pins are assigned.")
  return block(lines)
}

function renderGpio(chip: Chip, assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const calls: string[] = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    const mode = assignment.direction === "input" ? "GPIO_MODE_INPUT" : "GPIO_MODE_OUTPUT"
    const notes = [labelNote(assignment), strapNote(chip, pin)].filter((note) => note.length > 0)
    if (notes.length > 0) calls.push(block(notes, INDENT))
    calls.push(
      [
        `${INDENT}gpio_config_t gpio${assignment.gpio} = {`,
        `${INDENT}${INDENT}.pin_bit_mask = 1ULL << ${assignment.gpio},`,
        `${INDENT}${INDENT}.mode = ${mode},`,
        `${INDENT}${INDENT}.pull_up_en = GPIO_PULLUP_DISABLE,`,
        `${INDENT}${INDENT}.pull_down_en = GPIO_PULLDOWN_DISABLE,`,
        `${INDENT}${INDENT}.intr_type = GPIO_INTR_DISABLE,`,
        `${INDENT}};`,
        `${INDENT}ESP_ERROR_CHECK(gpio_config(&gpio${assignment.gpio}));`,
      ].join("\n"),
    )
  }
  return fn("pinplan_init_gpio", calls.join("\n"))
}

function renderAdc(chip: Chip, assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const ready: Array<{ assignment: Assignment; pin: Pin }> = []
  const skipped: string[] = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin?.adc) {
      skipped.push(block([`GPIO${assignment.gpio} is assigned as ADC but has no channel in the pin database.`], INDENT))
      continue
    }
    ready.push({ assignment, pin })
  }
  if (ready.length === 0) return fn("pinplan_init_adc", skipped.join("\n"))

  const units = [...new Set(ready.map((item) => item.pin.adc?.unit))].sort()
  const handles = units.map((unit) => `static adc_oneshot_unit_handle_t pinplan_${unit?.toLowerCase()};`)
  const setup: string[] = [
    ...skipped,
    block([
      "ADC_ATTEN_DB_12 is an export default, not a fact from the pin database.",
    ], INDENT),
  ]
  for (const unit of units) {
    const name = unit === "ADC2" ? "pinplan_adc2" : "pinplan_adc1"
    const id = unit === "ADC2" ? "ADC_UNIT_2" : "ADC_UNIT_1"
    setup.push(
      [
        `${INDENT}adc_oneshot_unit_init_cfg_t ${name}_cfg = {`,
        `${INDENT}${INDENT}.unit_id = ${id},`,
        `${INDENT}};`,
        `${INDENT}ESP_ERROR_CHECK(adc_oneshot_new_unit(&${name}_cfg, &${name}));`,
        `${INDENT}adc_oneshot_chan_cfg_t ${name}_chan = {`,
        `${INDENT}${INDENT}.bitwidth = ADC_BITWIDTH_DEFAULT,`,
        `${INDENT}${INDENT}.atten = ADC_ATTEN_DB_12,`,
        `${INDENT}};`,
      ].join("\n"),
    )
  }
  for (const item of ready) {
    const handle = item.pin.adc?.unit === "ADC2" ? "pinplan_adc2" : "pinplan_adc1"
    setup.push(
      `${INDENT}ESP_ERROR_CHECK(adc_oneshot_config_channel(${handle}, ADC_CHANNEL_${item.pin.adc?.channel}, &${handle}_chan));`,
    )
  }

  const readers = ready.map((item) => renderAdcRead(item.assignment, item.pin))
  return `${handles.join("\n")}\n\n${fn("pinplan_init_adc", setup.join("\n"))}\n\n${readers.join("\n\n")}`
}

function renderAdcRead(assignment: Assignment, pin: Pin): string {
  const handle = pin.adc?.unit === "ADC2" ? "pinplan_adc2" : "pinplan_adc1"
  const channel = `ADC_CHANNEL_${pin.adc?.channel}`
  const name = `pinplan_adc_read_gpio${assignment.gpio}`
  if (pin.adc?.unit === "ADC2") {
    return [
      block([
        labelNote(assignment) || `GPIO${assignment.gpio} ADC2 channel ${pin.adc.channel}.`,
        "ADC2 is also used by Wi-Fi. adc_oneshot_read may return ESP_ERR_TIMEOUT, and the raw result is then invalid.",
      ]),
      `esp_err_t ${name}(int *raw)`,
      "{",
      `${INDENT}esp_err_t err = adc_oneshot_read(${handle}, ${channel}, raw);`,
      `${INDENT}if (err == ESP_ERR_TIMEOUT) {`,
      `${INDENT}${INDENT}return err;`,
      `${INDENT}}`,
      `${INDENT}ESP_ERROR_CHECK(err);`,
      `${INDENT}return err;`,
      "}",
    ].join("\n")
  }
  return [
    block([labelNote(assignment) || `GPIO${assignment.gpio} ${pin.adc?.unit} channel ${pin.adc?.channel}.`]),
    `esp_err_t ${name}(int *raw)`,
    "{",
    `${INDENT}esp_err_t err = adc_oneshot_read(${handle}, ${channel}, raw);`,
    `${INDENT}ESP_ERROR_CHECK(err);`,
    `${INDENT}return err;`,
    "}",
  ].join("\n")
}

function renderI2c(assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const lines: string[] = []
  const instances = uniqueInstances(assignments)
  for (const instance of instances) {
    const group = assignments.filter((assignment) => assignment.instance === instance)
    const sda = group.filter((assignment) => assignment.signal === "sda")
    const scl = group.filter((assignment) => assignment.signal === "scl")
    if (instance !== 0 && instance !== 1) {
      lines.push(block([`I2C instance ${String(instance)} is not I2C0 or I2C1. This bus was not initialized.`], INDENT))
      continue
    }
    noteExtras(lines, "SDA", sda)
    noteExtras(lines, "SCL", scl)
    if (!sda[0] || !scl[0]) {
      const missing = [sda[0] ? null : "SDA", scl[0] ? null : "SCL"].filter(Boolean).join(" and ")
      lines.push(block([`I2C${instance} is missing ${missing}. Both pins are required, so this bus was not initialized.`], INDENT))
      continue
    }
    lines.push(block([`Add devices on this bus with i2c_master_bus_add_device. Use PINPLAN_I2C_HZ as scl_speed_hz.`], INDENT))
    lines.push(
      [
        `${INDENT}i2c_master_bus_config_t i2c${instance} = {`,
        `${INDENT}${INDENT}.i2c_port = I2C_NUM_${instance},`,
        `${INDENT}${INDENT}.sda_io_num = GPIO_NUM_${sda[0].gpio},`,
        `${INDENT}${INDENT}.scl_io_num = GPIO_NUM_${scl[0].gpio},`,
        `${INDENT}${INDENT}.clk_source = I2C_CLK_SRC_DEFAULT,`,
        `${INDENT}${INDENT}.glitch_ignore_cnt = 7,`,
        `${INDENT}${INDENT}.flags.enable_internal_pullup = false,`,
        `${INDENT}};`,
        `${INDENT}i2c_master_bus_handle_t i2c${instance}_bus = NULL;`,
        `${INDENT}ESP_ERROR_CHECK(i2c_new_master_bus(&i2c${instance}, &i2c${instance}_bus));`,
        `${INDENT}(void)i2c${instance}_bus;`,
      ].join("\n"),
    )
  }
  return fn("pinplan_init_i2c", lines.join("\n"))
}

function renderSpi(assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const lines: string[] = []
  for (const instance of uniqueInstances(assignments)) {
    const group = assignments.filter((assignment) => assignment.instance === instance)
    const host = instance === 2 ? "SPI2_HOST" : instance === 3 ? "SPI3_HOST" : null
    if (!host) {
      lines.push(block([`SPI instance ${String(instance)} is not SPI2 or SPI3. This bus was not initialized.`], INDENT))
      continue
    }
    const mosi = group.filter((assignment) => assignment.signal === "mosi")
    const miso = group.filter((assignment) => assignment.signal === "miso")
    const sck = group.filter((assignment) => assignment.signal === "sck")
    const cs = group.filter((assignment) => assignment.signal === "cs")
    noteExtras(lines, "MOSI", mosi)
    noteExtras(lines, "MISO", miso)
    noteExtras(lines, "SCK", sck)
    if (!sck[0]) {
      lines.push(block([`${host} has no SCK pin. The bus was not initialized.`], INDENT))
      continue
    }
    const mosiPin = mosi[0] ? `GPIO_NUM_${mosi[0].gpio}` : "-1"
    const misoPin = miso[0] ? `GPIO_NUM_${miso[0].gpio}` : "-1"
    lines.push(
      [
        `${INDENT}spi_bus_config_t ${host.toLowerCase()} = {`,
        `${INDENT}${INDENT}.mosi_io_num = ${mosiPin},`,
        `${INDENT}${INDENT}.miso_io_num = ${misoPin},`,
        `${INDENT}${INDENT}.sclk_io_num = GPIO_NUM_${sck[0].gpio},`,
        `${INDENT}${INDENT}.quadwp_io_num = -1,`,
        `${INDENT}${INDENT}.quadhd_io_num = -1,`,
        `${INDENT}${INDENT}.max_transfer_sz = 4096,`,
        `${INDENT}};`,
        `${INDENT}ESP_ERROR_CHECK(spi_bus_initialize(${host}, &${host.toLowerCase()}, SPI_DMA_CH_AUTO));`,
      ].join("\n"),
    )
    if (cs.length === 0) {
      lines.push(block([`${host} has no CS pin. Add a device with spi_bus_add_device when you choose one.`], INDENT))
      continue
    }
    cs.forEach((assignment, index) => {
      const dev = `${host.toLowerCase()}_cs${index}`
      lines.push(
        [
          `${INDENT}spi_device_interface_config_t ${dev} = {`,
          `${INDENT}${INDENT}.clock_speed_hz = PINPLAN_SPI_HZ,`,
          `${INDENT}${INDENT}.mode = 0,`,
          `${INDENT}${INDENT}.spics_io_num = GPIO_NUM_${assignment.gpio},`,
          `${INDENT}${INDENT}.queue_size = 1,`,
          `${INDENT}};`,
          `${INDENT}spi_device_handle_t ${dev}_handle = NULL;`,
          `${INDENT}ESP_ERROR_CHECK(spi_bus_add_device(${host}, &${dev}, &${dev}_handle));`,
          `${INDENT}(void)${dev}_handle;`,
        ].join("\n"),
      )
    })
  }
  return fn("pinplan_init_spi", lines.join("\n"))
}

function renderUart(assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const lines: string[] = []
  for (const instance of uniqueInstances(assignments)) {
    const group = assignments.filter((assignment) => assignment.instance === instance)
    if (instance !== 0 && instance !== 1 && instance !== 2) {
      lines.push(block([`UART instance ${String(instance)} is not UART0, UART1, or UART2. This port was not initialized.`], INDENT))
      continue
    }
    const tx = group.filter((assignment) => assignment.signal === "tx")
    const rx = group.filter((assignment) => assignment.signal === "rx")
    noteExtras(lines, "TX", tx)
    noteExtras(lines, "RX", rx)
    if (!tx[0] && !rx[0]) {
      lines.push(block([`UART${instance} has neither TX nor RX. It was not initialized.`], INDENT))
      continue
    }
    const txPin = tx[0] ? `GPIO_NUM_${tx[0].gpio}` : "UART_PIN_NO_CHANGE"
    const rxPin = rx[0] ? `GPIO_NUM_${rx[0].gpio}` : "UART_PIN_NO_CHANGE"
    lines.push(
      [
        `${INDENT}uart_config_t uart${instance} = {`,
        `${INDENT}${INDENT}.baud_rate = PINPLAN_UART_BAUD,`,
        `${INDENT}${INDENT}.data_bits = UART_DATA_8_BITS,`,
        `${INDENT}${INDENT}.parity = UART_PARITY_DISABLE,`,
        `${INDENT}${INDENT}.stop_bits = UART_STOP_BITS_1,`,
        `${INDENT}${INDENT}.flow_ctrl = UART_HW_FLOWCTRL_DISABLE,`,
        `${INDENT}${INDENT}.source_clk = UART_SCLK_DEFAULT,`,
        `${INDENT}};`,
        `${INDENT}ESP_ERROR_CHECK(uart_driver_install(UART_NUM_${instance}, PINPLAN_UART_RX_BUF, 0, 0, NULL, 0));`,
        `${INDENT}ESP_ERROR_CHECK(uart_param_config(UART_NUM_${instance}, &uart${instance}));`,
        `${INDENT}ESP_ERROR_CHECK(uart_set_pin(UART_NUM_${instance}, ${txPin}, ${rxPin}, UART_PIN_NO_CHANGE, UART_PIN_NO_CHANGE));`,
      ].join("\n"),
    )
  }
  return fn("pinplan_init_uart", lines.join("\n"))
}

function renderLedc(assignments: Assignment[]): string | null {
  if (assignments.length === 0) return null
  const lines: string[] = [
    block([
      "The pin database does not record how many LEDC timers the chip has. Every channel below uses timer 0.",
      "PINPLAN_LEDC_HZ and the 13-bit duty resolution are export defaults.",
    ], INDENT),
    [
      `${INDENT}ledc_timer_config_t timer = {`,
      `${INDENT}${INDENT}.speed_mode = LEDC_LOW_SPEED_MODE,`,
      `${INDENT}${INDENT}.duty_resolution = LEDC_TIMER_13_BIT,`,
      `${INDENT}${INDENT}.timer_num = LEDC_TIMER_0,`,
      `${INDENT}${INDENT}.freq_hz = PINPLAN_LEDC_HZ,`,
      `${INDENT}${INDENT}.clk_cfg = LEDC_AUTO_CLK,`,
      `${INDENT}};`,
      `${INDENT}ESP_ERROR_CHECK(ledc_timer_config(&timer));`,
    ].join("\n"),
  ]
  for (const assignment of assignments) {
    if (assignment.channel === undefined || assignment.channel < 0 || assignment.channel > 7) {
      lines.push(block([`GPIO${assignment.gpio} has no LEDC channel in range 0-7. It was not configured.`], INDENT))
      continue
    }
    const name = `ledc_gpio${assignment.gpio}`
    lines.push(
      [
        `${INDENT}ledc_channel_config_t ${name} = {`,
        `${INDENT}${INDENT}.gpio_num = GPIO_NUM_${assignment.gpio},`,
        `${INDENT}${INDENT}.speed_mode = LEDC_LOW_SPEED_MODE,`,
        `${INDENT}${INDENT}.channel = LEDC_CHANNEL_${assignment.channel},`,
        `${INDENT}${INDENT}.intr_type = LEDC_INTR_DISABLE,`,
        `${INDENT}${INDENT}.timer_sel = LEDC_TIMER_0,`,
        `${INDENT}${INDENT}.duty = 0,`,
        `${INDENT}${INDENT}.hpoint = 0,`,
        `${INDENT}};`,
        `${INDENT}ESP_ERROR_CHECK(ledc_channel_config(&${name}));`,
      ].join("\n"),
    )
  }
  return fn("pinplan_init_ledc", lines.join("\n"))
}

function strapNote(chip: Chip, pin: Pin | undefined): string {
  const constraint = pin?.constraints.find((item) => item.id === "strapping")
  if (!constraint) return ""
  if (constraint.infoOnly) {
    return `GPIO${pin?.gpio} has no internal pull. When it is used as a strap, an external circuit must hold a defined level.`
  }
  return `GPIO${pin?.gpio} is a strapping pin. Hold its boot level for at least ${chip.strappingTiming.holdAfterChipPuMs} ms after CHIP_PU goes high.`
}

function labelNote(assignment: Assignment): string {
  const label = assignment.label?.trim()
  if (!label) return ""
  return `Label: ${label.replaceAll("*/", "* /")}.`
}

function noteExtras(lines: string[], signal: string, matches: Assignment[]): void {
  if (matches.length < 2) return
  const pins = matches.map((assignment) => `GPIO${assignment.gpio}`).join(", ")
  lines.push(block([`More than one ${signal} pin was assigned (${pins}). The first one is used here.`], INDENT))
}

function uniqueInstances(assignments: Assignment[]): number[] {
  return [...new Set(assignments.map((assignment) => assignment.instance ?? -1))].sort((a, b) => a - b)
}

function fn(name: string, body: string): string {
  return `static void ${name}(void)\n{\n${body}\n}`
}

const COMMENT_COLUMNS = 80

function block(lines: string[], indent = ""): string {
  const prefix = `${indent} * `
  const width = Math.max(24, COMMENT_COLUMNS - prefix.length)
  const body = lines
    .filter((line) => line.length > 0)
    .flatMap((line) => wrapComment(line.replaceAll("*/", "* /"), width))
    .map((line) => `${prefix}${line}`)
    .join("\n")
  return `${indent}/*\n${body}\n${indent} */`
}

function wrapComment(text: string, width: number): string[] {
  const lines: string[] = []
  let current = ""
  for (const word of text.split(/\s+/).filter((part) => part.length > 0)) {
    if (word.length > width) {
      if (current) lines.push(current)
      for (let index = 0; index < word.length; index += width) lines.push(word.slice(index, index + width))
      current = ""
      continue
    }
    const next = current ? `${current} ${word}` : word
    if (next.length > width) {
      lines.push(current)
      current = word
    } else {
      current = next
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : [""]
}
