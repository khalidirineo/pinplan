import type { Rule } from "../types"
import { makeIssue } from "../issues"

export const i2cPullupsRuleId = "i2c-pullups"

export const i2cPullupsRule: Rule = ({ assignments }) => {
  const buses = new Map<number, number[]>()
  for (const assignment of assignments) {
    if (assignment.function !== "i2c" || !Number.isInteger(assignment.instance)) continue
    const list = buses.get(assignment.instance as number) ?? []
    list.push(assignment.gpio)
    buses.set(assignment.instance as number, list)
  }
  return [...buses.entries()].map(([instance, pins]) => {
    const ordered = [...pins].sort((a, b) => a - b)
    return makeIssue(
      "info",
      i2cPullupsRuleId,
      ordered,
      `I2C${instance} (${ordered.map((gpio) => `GPIO${gpio}`).join(", ")}) needs external pull-up resistors on SDA and SCL. Internal GPIO pull-ups are not a substitute for I2C.`,
      "Add a pull-up from SDA to the module 3V3 rail and another from SCL to 3V3. Size them for the bus speed and capacitance.",
    )
  })
}
