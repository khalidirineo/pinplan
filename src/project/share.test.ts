import { describe, expect, it } from "vitest"
import { defaultSettings } from "../engine/types"
import { serializeProject } from "./document"
import { ShareError, decodeShare, encodeShare } from "./share"

describe("share link", () => {
  it("round-trips a design through gzip and hides the JSON", async () => {
    const json = serializeProject(
      "esp32-s3-wroom-1",
      { ...defaultSettings, psram: "quad" },
      [{ id: "gpio-4", gpio: 4, function: "gpio", direction: "input", role: "button" }],
      false,
    )
    const token = await encodeShare(json)
    expect(token.startsWith("v1.")).toBe(true)
    expect(token).not.toContain("wifiEnabled")
    expect(await decodeShare(token)).toBe(json)
  })

  it("rejects an unknown format and a broken token", async () => {
    await expect(decodeShare("v0.abc")).rejects.toBeInstanceOf(ShareError)
    await expect(decodeShare("v1.not-a-real-payload")).rejects.toThrow("This link could not be read.")
    await expect(decodeShare(`v1.${"a".repeat(20_001)}`)).rejects.toThrow("This link is too long to load.")
  })
})
