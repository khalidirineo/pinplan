import type { Chip, Pin } from "../data/types"

export function pinByGpio(chip: Chip, gpio: number): Pin | undefined {
  return chip.pins.find((pin) => pin.gpio === gpio)
}
