import type { Assignment, Rule } from "../types"
import { makeIssue } from "../issues"

export const duplicatePinRuleId = "duplicate-pin"

function describe(assignment: Assignment): string {
  const detail = assignment.signal ?? assignment.direction ?? (assignment.channel !== undefined ? `ch${assignment.channel}` : "")
  const name = detail ? `${assignment.function} ${detail}` : assignment.function
  return assignment.label ? `${name} "${assignment.label}"` : name
}

export const duplicatePinRule: Rule = ({ assignments }) => {
  const byGpio = new Map<number, Assignment[]>()
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.gpio)) continue
    const list = byGpio.get(assignment.gpio) ?? []
    list.push(assignment)
    byGpio.set(assignment.gpio, list)
  }
  const issues = []
  for (const [gpio, list] of byGpio) {
    if (list.length < 2) continue
    issues.push(
      makeIssue(
        "error",
        duplicatePinRuleId,
        [gpio],
        `GPIO${gpio} is assigned ${list.length} times (${list.map(describe).join(", ")}). A GPIO can have only one function.`,
        `Remove the extra assignments on GPIO${gpio}.`,
      ),
    )
  }
  return issues
}
