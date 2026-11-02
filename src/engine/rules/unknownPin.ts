import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"

export const unknownPinRuleId = "unknown-pin"

export const unknownPinRule: Rule = ({ chip, assignments }) => {
  const missing = new Set<number>()
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.gpio)) continue
    if (!pinByGpio(chip, assignment.gpio)) missing.add(assignment.gpio)
  }
  return [...missing].map((gpio) =>
    makeIssue(
      "error",
      unknownPinRuleId,
      [gpio],
      `GPIO${gpio} does not exist on ${chip.name}.`,
      "Choose a GPIO from this chip. GPIO22–GPIO25 are not pins on the ESP32-S3, and GPIO26–GPIO34 are not bonded out on this module.",
    ),
  )
}
