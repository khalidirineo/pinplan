import type { Assignment, Rule } from "../types"
import { makeIssue } from "../issues"

export const duplicateSignalRuleId = "duplicate-signal"

function keyOf(assignment: Assignment): string | null {
  if (assignment.function === "i2c" && Number.isInteger(assignment.instance) && assignment.signal) {
    return `I2C${assignment.instance} ${assignment.signal.toUpperCase()}`
  }
  if (assignment.function === "uart" && Number.isInteger(assignment.instance) && assignment.signal) {
    return `UART${assignment.instance} ${assignment.signal.toUpperCase()}`
  }
  if (
    assignment.function === "spi" &&
    Number.isInteger(assignment.instance) &&
    assignment.signal &&
    assignment.signal !== "cs"
  ) {
    return `SPI${assignment.instance} ${assignment.signal.toUpperCase()}`
  }
  if (assignment.function === "ledc" && Number.isInteger(assignment.channel)) {
    return `LEDC channel ${assignment.channel}`
  }
  return null
}

export const duplicateSignalRule: Rule = ({ assignments }) => {
  const groups = new Map<string, Assignment[]>()
  for (const assignment of assignments) {
    const key = keyOf(assignment)
    if (!key) continue
    const list = groups.get(key) ?? []
    list.push(assignment)
    groups.set(key, list)
  }
  const issues = []
  for (const [key, list] of groups) {
    if (list.length < 2) continue
    const pins = list.map((assignment) => assignment.gpio).sort((a, b) => a - b)
    issues.push(
      makeIssue(
        "error",
        duplicateSignalRuleId,
        pins,
        `${key} is assigned to ${pins.map((gpio) => `GPIO${gpio}`).join(" and ")}.`,
        key.startsWith("LEDC")
          ? "Give each pin its own LEDC channel."
          : `Keep one ${key} pin. SPI chip-select is the signal that may repeat.`,
      ),
    )
  }
  return issues
}
