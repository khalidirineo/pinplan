import type { Issue, Assignment } from "../engine/types"

export function countPhrase(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function shortAssignment(assignment: Assignment): string {
  if (assignment.function === "gpio") return assignment.direction === "input" ? "IN" : "OUT"
  if (assignment.function === "adc") return "ADC"
  if (assignment.function === "ledc") return "PWM"
  if (assignment.function === "i2c") return "I2C"
  if (assignment.function === "spi") return "SPI"
  return "UART"
}

export function assignmentDetail(assignment: Assignment): string {
  if (assignment.function === "gpio") {
    const pull = assignment.externalPull ? `, pull-${assignment.externalPull}` : ""
    const button = assignment.role === "button" ? ", button" : ""
    return `${assignment.direction ?? "gpio"}${pull}${button}`
  }
  if (assignment.function === "adc") return "analog"
  if (assignment.function === "ledc") return `channel ${assignment.channel ?? "?"}`
  return `${assignment.function.toUpperCase()}${assignment.instance ?? "?"} ${assignment.signal?.toUpperCase() ?? ""}`.trim()
}

const rank: Record<Issue["severity"], number> = { error: 0, warning: 1, info: 2 }

export function worstSeverity(issues: Issue[]): Issue["severity"] | null {
  const ranked = [...issues].sort((a, b) => rank[a.severity] - rank[b.severity])
  return ranked[0]?.severity ?? null
}
