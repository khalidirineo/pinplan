import { describe, expect, it } from "vitest"
import { countPhrase } from "./format"

describe("count phrase", () => {
  it("uses the singular only for one", () => {
    expect(countPhrase(0, "warning")).toBe("0 warnings")
    expect(countPhrase(1, "warning")).toBe("1 warning")
    expect(countPhrase(2, "error")).toBe("2 errors")
    expect(countPhrase(1, "info", "info")).toBe("1 info")
  })
})
