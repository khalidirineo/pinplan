import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"

export const jtagPinsRuleId = "jtag-pins"

export const jtagPinsRule: Rule = ({ chip, assignments }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    const constraint = pin.constraints.find((item) => item.id === "jtag")
    if (!constraint) continue
    issues.push(
      makeIssue(
        "info",
        jtagPinsRuleId,
        [pin.gpio],
        `GPIO${pin.gpio} is JTAG ${constraint.signal ?? ""}. ${constraint.effect}`,
        "Leave GPIO39–GPIO42 unassigned if you need pad JTAG. Reusing them is informational.",
      ),
    )
  }
  return issues
}
