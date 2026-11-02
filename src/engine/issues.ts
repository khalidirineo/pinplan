import type { Issue } from "./types"

export function makeIssue(
  severity: Issue["severity"],
  ruleId: string,
  pins: number[],
  message: string,
  fix: string,
): Issue {
  return {
    severity,
    ruleId,
    pins: [...new Set(pins)].sort((a, b) => a - b),
    message,
    fix,
  }
}
