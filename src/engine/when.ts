import type { ProjectSettings } from "./types"
import type { When } from "../data/types"

export function applies(when: When | undefined, settings: ProjectSettings): boolean {
  if (when === undefined || when === "always") return true
  if ("in" in when) return when.in.includes(settings.psram)
  if (when.setting === "psram") return settings.psram === when.equals
  if (when.setting === "wifiEnabled") return settings.wifiEnabled === when.equals
  return settings.nativeUsb === when.equals
}
