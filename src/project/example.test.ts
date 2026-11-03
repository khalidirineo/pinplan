import { describe, expect, it } from "vitest"
import { loadChip } from "../data/loadChip"
import { evaluate } from "../engine/evaluate"
import { adc2WifiRuleId } from "../engine/rules/adc2Wifi"
import { strappingRuleId } from "../engine/rules/strapping"
import { exampleAssignments, exampleSettings } from "./example"

describe("example design", () => {
  it("shows an ADC2 warning with Wi-Fi on and a strapping note", () => {
    const issues = evaluate(loadChip(), exampleAssignments, exampleSettings)
    const adc = issues.find((issue) => issue.ruleId === adc2WifiRuleId)
    expect(adc?.severity).toBe("warning")
    expect(adc?.pins).toEqual([11])
    const suggested = adc?.fix.match(/\((.*)\)\.$/)?.[1]?.split(", ") ?? []
    expect(suggested).toEqual(["GPIO1", "GPIO2", "GPIO6", "GPIO7", "GPIO10", "GPIO3 (strapping)"])
    const strap = issues.find((issue) => issue.ruleId === strappingRuleId && issue.pins.includes(0))
    expect(strap?.severity).toBe("info")
    expect(exampleSettings.wifiEnabled).toBe(true)
  })
})
