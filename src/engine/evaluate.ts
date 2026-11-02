import type { Assignment, Issue, ProjectSettings, Rule } from "./types"
import type { Chip } from "../data/types"
import { rules } from "./rules"

const rank: Record<Issue["severity"], number> = { error: 0, warning: 1, info: 2 }

export function evaluate(
  chip: Chip,
  assignments: Assignment[],
  settings: ProjectSettings,
  ruleList: Rule[] = rules,
): Issue[] {
  const issues = ruleList.flatMap((rule) => rule({ chip, assignments, settings }))
  return issues.sort((a, b) => {
    const severity = rank[a.severity] - rank[b.severity]
    if (severity !== 0) return severity
    const pin = (a.pins[0] ?? 0) - (b.pins[0] ?? 0)
    if (pin !== 0) return pin
    return a.ruleId.localeCompare(b.ruleId)
  })
}
