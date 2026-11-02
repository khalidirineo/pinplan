import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"

export const adcCapabilityRuleId = "adc-capability"

export const adcCapabilityRule: Rule = ({ chip, assignments }) => {
  const adc1 = chip.pins.filter((pin) => pin.adc?.unit === "ADC1").map((pin) => `GPIO${pin.gpio}`)
  const adc2 = chip.pins.filter((pin) => pin.adc?.unit === "ADC2").map((pin) => `GPIO${pin.gpio}`)
  const issues = []
  for (const assignment of assignments) {
    if (assignment.function !== "adc") continue
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin || pin.adc) continue
    issues.push(
      makeIssue(
        "error",
        adcCapabilityRuleId,
        [pin.gpio],
        `GPIO${pin.gpio} has no ADC channel.`,
        `Use an ADC1 pin (${adc1.join(", ")}) or an ADC2 pin (${adc2.join(", ")}).`,
      ),
    )
  }
  return issues
}
