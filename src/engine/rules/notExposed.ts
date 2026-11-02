import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const notExposedRuleId = "not-exposed"

export const notExposedRule: Rule = ({ chip, assignments, settings }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    for (const constraint of pin.constraints) {
      if (constraint.id !== "not_exposed" || !applies(constraint.when, settings)) continue
      issues.push(
        makeIssue(
          "error",
          notExposedRuleId,
          [pin.gpio],
          `GPIO${pin.gpio}: ${constraint.effect}`,
          "Choose a GPIO that appears on the module pads.",
        ),
      )
    }
  }
  return issues
}
