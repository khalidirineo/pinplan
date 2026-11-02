import raw from "./chips/esp32s3.json"
import { validateChip } from "./validateChip"
import type { Chip } from "./types"

export function loadChip(): Chip {
  return validateChip(raw)
}
