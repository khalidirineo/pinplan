import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"

export const uart0ConsoleRuleId = "uart0-console"

export const uart0ConsoleRule: Rule = ({ chip, assignments }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    const constraint = pin.constraints.find((item) => item.id === "uart0")
    if (!constraint) continue
    const kept =
      assignment.function === "uart" &&
      assignment.instance === 0 &&
      assignment.signal === constraint.signal
    if (kept) continue
    const name = constraint.signal === "tx" ? "TX" : "RX"
    issues.push(
      makeIssue(
        "warning",
        uart0ConsoleRuleId,
        [pin.gpio],
        `GPIO${pin.gpio} is the default UART0 ${name} pin. ${constraint.effect} Reassigning it drops the ROM boot messages on this pin.`,
        `Leave GPIO${pin.gpio} as UART0 ${name}, or plan another way to see ROM logs and to flash.`,
      ),
    )
  }
  return issues
}
