import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const flashReservedRuleId = "flash-reserved"

export const flashReservedRule: Rule = ({ chip, assignments, settings }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    for (const constraint of pin.constraints) {
      if (constraint.id !== "flash_reserved" || !applies(constraint.when, settings)) continue
      issues.push(
        makeIssue(
          "error",
          flashReservedRuleId,
          [pin.gpio],
          `GPIO${pin.gpio}: ${constraint.effect}`,
          "Do not assign this GPIO. Pick a pad the module brings out.",
        ),
      )
    }
  }
  return issues
}
