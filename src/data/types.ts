export interface Cited {
  source: string
  verified: boolean
}

export type BootLevel = "high" | "low"
export type AtReset = "pull-up" | "pull-down"
export type PsramSetting = "none" | "quad" | "octal"

export type ConstraintId =
  | "strapping"
  | "adc2_wifi"
  | "flash_reserved"
  | "not_exposed"
  | "psram_reserved"
  | "usb"
  | "uart0"
  | "jtag"

export type When =
  | "always"
  | { setting: "wifiEnabled"; equals: boolean }
  | { setting: "nativeUsb"; equals: boolean }
  | { setting: "psram"; equals: PsramSetting }
  | { setting: "psram"; in: PsramSetting[] }

export interface Constraint extends Cited {
  id: ConstraintId
  when?: When
  bootLevel?: BootLevel
  signal?: string
  /** Always report info. GPIO3 straps only when the JTAG eFuses are burnt. */
  infoOnly?: boolean
  effect: string
}

export interface AdcCapability extends Cited {
  unit: "ADC1" | "ADC2"
  channel: number
}

export interface TouchCapability extends Cited {
  channel: number
}

export interface Pin {
  gpio: number
  names: string[]
  /** Castellation number on the module, or null when the GPIO is not bonded out. */
  modulePad: number | null
  /** esp-gpio-tool `rtc: true` (VDD3P3_RTC domain). Not the 32 kHz crystal. */
  rtcDomain: boolean
  inputOnly: boolean
  atReset: AtReset | null
  adc: AdcCapability | null
  touch: TouchCapability | null
  constraints: Constraint[]
}

export interface CountedResource extends Cited {
  count: number
  /** Hardware instance numbers a design may use. SPI is 2 and 3, not 0 and 1. */
  instances: number[]
  note?: string
}

export interface LedcResource extends Cited {
  channels: number
}

export type PadSide = "left" | "bottom" | "right" | "center"

export interface ModulePad {
  number: number
  side: PadSide
  gpio?: number
  name?: string
}

export interface ChipNote extends Cited {
  id: string
  text: string
}

export interface ChipDocument {
  title: string
  url: string
  revision: string
}

export interface Chip {
  id: string
  name: string
  family: string
  datasheet: ChipDocument
  moduleDatasheet: ChipDocument
  trm: ChipDocument
  resources: {
    i2c: CountedResource
    uart: CountedResource
    spi: CountedResource
    ledc: LedcResource
  }
  gpioMatrix: Cited & {
    routable: Array<"gpio" | "ledc" | "i2c" | "spi" | "uart">
    fixed: Array<"adc" | "touch" | "usb">
  }
  /** How long a strap must stay valid after CHIP_PU rises. Datasheet t_H. */
  strappingTiming: Cited & {
    holdAfterChipPuMs: number
  }
  module: {
    name: string
    padOrder: string
    padSource: Cited
    pads: ModulePad[]
  }
  notes: ChipNote[]
  pins: Pin[]
}
