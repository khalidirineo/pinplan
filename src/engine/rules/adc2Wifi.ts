import type { Pin } from "../../data/types"
import type { Assignment, Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const adc2WifiRuleId = "adc2-wifi"

function isStrap(pin: Pin): boolean {
  return pin.constraints.some((constraint) => constraint.id === "strapping")
}

/** Free ADC1 pins, with strapping pins such as GPIO3 last and marked. */
export function adc1Fix(pins: Pin[], assignments: Assignment[]): string {
  const taken = new Set(assignments.map((assignment) => assignment.gpio))
  const free = pins.filter((pin) => pin.adc?.unit === "ADC1" && !taken.has(pin.gpio))
  const label = (pin: Pin) => (isStrap(pin) ? `GPIO${pin.gpio} (strapping)` : `GPIO${pin.gpio}`)
  const ordered = [...free.filter((pin) => !isStrap(pin)), ...free.filter((pin) => isStrap(pin))]
  if (ordered.length === 0) return "No ADC1 pin is free."
  return `Move this analog signal to an ADC1 pin (${ordered.map(label).join(", ")}).`
}

export const adc2WifiRule: Rule = ({ chip, assignments, settings }) => {
  const issues = []
  for (const assignment of assignments) {
    if (assignment.function !== "adc") continue
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin?.adc || pin.adc.unit !== "ADC2") continue
    const constraint = pin.constraints.find((item) => item.id === "adc2_wifi")
    if (!constraint || !applies(constraint.when, settings)) continue
    issues.push(
      makeIssue(
        "warning",
        adc2WifiRuleId,
        [pin.gpio],
        `GPIO${pin.gpio} is ADC2 channel ${pin.adc.channel}. ${constraint.effect}`,
        adc1Fix(chip.pins, assignments),
      ),
    )
  }
  return issues
}
