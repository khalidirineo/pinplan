import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const psramReservedRuleId = "psram-reserved"

export const psramReservedRule: Rule = ({ chip, assignments, settings }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    for (const constraint of pin.constraints) {
      if (constraint.id !== "psram_reserved" || !applies(constraint.when, settings)) continue
      const fix =
        pin.modulePad === null
          ? "This GPIO is inside the module for that PSRAM option. Pick a pad the module brings out."
          : "Set PSRAM to none or quad if this pad must stay free, or move the signal off the octal-PSRAM pads."
      issues.push(
        makeIssue(
          "error",
          psramReservedRuleId,
          [pin.gpio],
          `GPIO${pin.gpio}: ${constraint.effect}`,
          fix,
        ),
      )
    }
  }
  return issues
}
