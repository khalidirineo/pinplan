import type { Assignment, Issue, Rule } from "../types"
import type { CountedResource } from "../../data/types"
import { makeIssue } from "../issues"

export const peripheralLimitRuleId = "peripheral-limit"

function checkBus(
  issues: Issue[],
  resource: CountedResource,
  prefix: string,
  assignments: Assignment[],
): void {
  const legal = new Set(resource.instances)
  const bad = new Map<number, number[]>()
  for (const assignment of assignments) {
    if (!Number.isInteger(assignment.instance) || legal.has(assignment.instance as number)) continue
    const list = bad.get(assignment.instance as number) ?? []
    list.push(assignment.gpio)
    bad.set(assignment.instance as number, list)
  }
  const names = resource.instances.map((instance) => `${prefix}${instance}`).join(", ")
  for (const [instance, pins] of bad) {
    issues.push(
      makeIssue(
        "error",
        peripheralLimitRuleId,
        pins,
        `${prefix} instance ${instance} is not available. This chip's ${prefix} controllers are ${names}. ${resource.note ?? ""}`.trim(),
        `Use one of ${names}, or remove the extra controller.`,
      ),
    )
  }
}

export const peripheralLimitRule: Rule = ({ chip, assignments }) => {
  const issues: Issue[] = []
  checkBus(issues, chip.resources.i2c, "I2C", assignments.filter((assignment) => assignment.function === "i2c"))
  checkBus(issues, chip.resources.uart, "UART", assignments.filter((assignment) => assignment.function === "uart"))
  checkBus(issues, chip.resources.spi, "SPI", assignments.filter((assignment) => assignment.function === "spi"))

  const channels = chip.resources.ledc.channels
  for (const assignment of assignments) {
    if (assignment.function !== "ledc" || !Number.isInteger(assignment.channel)) continue
    if ((assignment.channel as number) >= 0 && (assignment.channel as number) < channels) continue
    issues.push(
      makeIssue(
        "error",
        peripheralLimitRuleId,
        [assignment.gpio],
        `LEDC channel ${assignment.channel} is outside 0–${channels - 1}. This chip has ${channels} LEDC channels.`,
        `Use a channel from 0 to ${channels - 1}.`,
      ),
    )
  }
  return issues
}
