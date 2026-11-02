import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const adc2WifiRuleId = "adc2-wifi"

export const adc2WifiRule: Rule = ({ chip, assignments, settings }) => {
  const adc1 = chip.pins.filter((pin) => pin.adc?.unit === "ADC1").map((pin) => `GPIO${pin.gpio}`)
  const issues = []
  for (const assignment of assignments) {
    if (assignment.function !== "adc") continue
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin?.adc || pin.adc.unit !== "ADC2") continue
    const constraint = pin.constraints.find((item) => item.id === "adc2_wifi")
    if (!constraint || !applies(constraint.when, settings)) continue
    issues.push(
      makeIssue(
        "warning",
        adc2WifiRuleId,
        [pin.gpio],
        `GPIO${pin.gpio} is ADC2 channel ${pin.adc.channel}. ${constraint.effect}`,
        `Move this analog signal to an ADC1 pin (${adc1.join(", ")}).`,
      ),
    )
  }
  return issues
}
