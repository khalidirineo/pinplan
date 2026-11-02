import { describe, expect, it } from "vitest"
import { defaultSettings } from "../engine/types"
import type { Assignment, ProjectSettings } from "../engine/types"
import { isEmptyDesign, parseProject, serializeProject } from "./document"

const chipId = "esp32-s3-wroom-1"

const gpio4: Assignment = { id: "gpio-4", gpio: 4, function: "gpio", direction: "output", label: "LED" }
const i2c: Assignment = { id: "i2c-8", gpio: 8, function: "i2c", instance: 0, signal: "sda" }

describe("project document", () => {
  it("round-trips settings and assignments", () => {
    const settings: ProjectSettings = { wifiEnabled: false, psram: "octal", nativeUsb: true }
    const text = serializeProject(chipId, settings, [i2c, gpio4])
    const parsed = parseProject(text, chipId)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.settings).toEqual(settings)
    expect(parsed.assignments.map((assignment) => assignment.gpio)).toEqual([4, 8])
    expect(parsed.assignments[0]).toEqual(gpio4)
    expect(serializeProject(chipId, settings, [gpio4, i2c])).toBe(text)
  })

  it("treats the default empty planner as an empty design", () => {
    expect(isEmptyDesign(defaultSettings, [])).toBe(true)
    expect(isEmptyDesign({ ...defaultSettings, wifiEnabled: false }, [])).toBe(false)
  })

  it("rejects a file for another chip, bad JSON, and a broken assignment", () => {
    expect(parseProject("{", chipId)).toEqual({ ok: false, error: "This file is not JSON." })
    const other = serializeProject("esp32", defaultSettings, [])
    expect(parseProject(other, chipId).ok).toBe(false)
    if (parseProject(other, chipId).ok) return
    expect(parseProject(other, chipId)).toMatchObject({
      error: "This file is for esp32. This planner opens esp32-s3-wroom-1.",
    })

    const broken = serializeProject(chipId, defaultSettings, [gpio4]).replace('"direction": "output"', '"direction": "sideways"')
    const parsed = parseProject(broken, chipId)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.error).toContain("direction")

    const twice = {
      chip: chipId,
      settings: defaultSettings,
      assignments: [gpio4, { ...gpio4, id: "gpio-4b" }],
    }
    expect(parseProject(JSON.stringify(twice), chipId)).toEqual({
      ok: false,
      error: "GPIO 4 is assigned more than once.",
    })
  })
})
