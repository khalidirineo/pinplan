import type { Rule } from "../types"
import { makeIssue } from "../issues"

export const i2cPullupsRuleId = "i2c-pullups"

export const i2cPullupsNoteId = "i2c-pullups"

const i2cPullupsFallback =
  "Internal GPIO pull-ups are usually too weak for I2C, especially at 400 kHz. Add external pull-ups from SDA and SCL to 3V3, sized for bus speed and capacitance."

export const i2cPullupsRule: Rule = ({ chip, assignments }) => {
  const buses = new Map<number, number[]>()
  for (const assignment of assignments) {
    if (assignment.function !== "i2c" || !Number.isInteger(assignment.instance)) continue
    const list = buses.get(assignment.instance as number) ?? []
    list.push(assignment.gpio)
    buses.set(assignment.instance as number, list)
  }
  const note = chip.notes.find((item) => item.id === i2cPullupsNoteId)?.text ?? i2cPullupsFallback
  const split = note.indexOf(". ")
  const fact = split === -1 ? note : note.slice(0, split + 1)
  const action = split === -1 ? note : note.slice(split + 2)
  return [...buses.entries()].map(([instance, pins]) => {
    const ordered = [...pins].sort((a, b) => a - b)
    return makeIssue(
      "info",
      i2cPullupsRuleId,
      ordered,
      `I2C${instance} (${ordered.map((gpio) => `GPIO${gpio}`).join(", ")}). ${fact}`,
      action,
    )
  })
}
