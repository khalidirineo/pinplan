import type { Rule } from "../types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"
import { applies } from "../when"

export const usbPinsRuleId = "usb-pins"

export const usbPinsRule: Rule = ({ chip, assignments, settings }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    for (const constraint of pin.constraints) {
      if (constraint.id !== "usb" || !applies(constraint.when, settings)) continue
      issues.push(
        makeIssue(
          "error",
          usbPinsRuleId,
          [pin.gpio],
          `GPIO${pin.gpio} is assigned while native USB is enabled. ${constraint.effect}`,
          "Turn native USB off, or move this function to another GPIO. GPIO19 and GPIO20 stay with the USB PHY when native USB is on.",
        ),
      )
    }
  }
  return issues
}
