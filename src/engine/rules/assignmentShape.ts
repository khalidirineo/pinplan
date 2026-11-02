import type { Assignment, Issue, Rule } from "../types"
import { makeIssue } from "../issues"

export const assignmentShapeRuleId = "assignment-shape"

const FUNCTIONS = ["gpio", "adc", "ledc", "i2c", "spi", "uart"] as const
const BUS_SIGNALS = {
  i2c: ["sda", "scl"],
  spi: ["mosi", "miso", "sck", "cs"],
  uart: ["tx", "rx"],
} as const

function isBus(fn: Assignment["function"]): fn is "i2c" | "spi" | "uart" {
  return fn === "i2c" || fn === "spi" || fn === "uart"
}

export const assignmentShapeRule: Rule = ({ assignments }) => {
  const issues: Issue[] = []
  for (const assignment of assignments) {
    const where = assignment.id ? `"${assignment.id}"` : "(missing id)"
    const problems: string[] = []
    if (typeof assignment.id !== "string" || assignment.id.trim() === "") problems.push("needs an id")
    if (!Number.isInteger(assignment.gpio)) problems.push("needs an integer GPIO")
    if (!FUNCTIONS.includes(assignment.function)) {
      problems.push(`has unknown function "${String(assignment.function)}"`)
    }
    if (assignment.function === "gpio" && assignment.direction !== "input" && assignment.direction !== "output") {
      problems.push("is a GPIO assignment without direction input or output")
    }
    if (assignment.function !== "gpio" && assignment.direction !== undefined) {
      problems.push("sets direction on a non-GPIO function")
    }
    if (assignment.function === "ledc" && !Number.isInteger(assignment.channel)) {
      problems.push("is an LEDC assignment without an integer channel")
    }
    if (assignment.function !== "ledc" && assignment.channel !== undefined) {
      problems.push("sets a channel on a non-LEDC function")
    }
    if (isBus(assignment.function)) {
      if (!Number.isInteger(assignment.instance)) problems.push("needs an integer instance")
      const allowed = BUS_SIGNALS[assignment.function]
      if (!assignment.signal || !allowed.includes(assignment.signal as never)) {
        problems.push(`needs a signal of ${allowed.join(", ")}`)
      }
    } else if (assignment.instance !== undefined || assignment.signal !== undefined) {
      problems.push("sets instance or signal on a function that has neither")
    }
    if (assignment.externalPull !== undefined && assignment.externalPull !== "up" && assignment.externalPull !== "down") {
      problems.push("has an unknown externalPull")
    }
    if (assignment.role !== undefined && assignment.role !== "button") {
      problems.push("has an unknown role")
    }
    if (problems.length === 0) continue
    const gpio = Number.isInteger(assignment.gpio) ? [assignment.gpio] : []
    issues.push(
      makeIssue(
        "error",
        assignmentShapeRuleId,
        gpio,
        `Assignment ${where} ${problems.join("; ")}.`,
        "Fill in the missing fields. Bus functions need instance and signal, GPIO needs a direction, and LEDC needs a channel.",
      ),
    )
  }
  return issues
}
