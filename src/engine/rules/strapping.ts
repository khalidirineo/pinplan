import type { Assignment, Rule } from "../types"
import type { BootLevel, Constraint } from "../../data/types"
import { makeIssue } from "../issues"
import { pinByGpio } from "../pins"

export const strappingRuleId = "strapping"

// Firmware direction does not exist yet when the strap is sampled. An output
// still warns because the load on that net can pull the pin during reset.
function drivesPin(assignment: Assignment): boolean {
  if (assignment.function === "gpio" && assignment.direction === "output") return true
  if (assignment.function === "ledc") return true
  if (assignment.function === "uart" && assignment.signal === "tx") return true
  if (assignment.function === "spi" && (assignment.signal === "mosi" || assignment.signal === "sck" || assignment.signal === "cs")) {
    return true
  }
  return false
}

function pullOpposes(boot: BootLevel | undefined, pull: "up" | "down"): boolean {
  if (!boot) return true
  return boot === "high" ? pull === "down" : pull === "up"
}

function reasonsFor(assignment: Assignment, constraint: Constraint): string[] {
  const reasons: string[] = []
  if (drivesPin(assignment)) {
    reasons.push(
      "This assignment drives the pin or attaches a load. Reset samples the strap before firmware runs, so that load can pull the pin off its boot level.",
    )
  }
  if (assignment.role === "button") {
    reasons.push("A button can be held while reset is released and force this pin to a level.")
  }
  if (assignment.externalPull && pullOpposes(constraint.bootLevel, assignment.externalPull)) {
    const held = assignment.externalPull === "up" ? "high" : "low"
    reasons.push(`An external pull-${assignment.externalPull} can hold this pin ${held} at reset.`)
  } else if (assignment.function === "i2c" && pullOpposes(constraint.bootLevel, "up")) {
    reasons.push("I2C needs external pull-ups, which hold this pin high at reset.")
  }
  return reasons
}

export const strappingRule: Rule = ({ chip, assignments }) => {
  const issues = []
  for (const assignment of assignments) {
    const pin = pinByGpio(chip, assignment.gpio)
    if (!pin) continue
    const constraint = pin.constraints.find((item) => item.id === "strapping")
    if (!constraint) continue
    if (constraint.infoOnly) {
      issues.push(
        makeIssue(
          "info",
          strappingRuleId,
          [pin.gpio],
          `GPIO${pin.gpio} is a strapping pin. ${constraint.effect}`,
          `GPIO${pin.gpio} has no internal pull. When it is used as a strap, an external circuit must hold a defined level. It is sampled only when the JTAG eFuses are burnt, and those eFuses default to 0.`,
        ),
      )
      continue
    }
    const reasons = reasonsFor(assignment, constraint)
    const hold = `The pin must hold its level for at least ${chip.strappingTiming.holdAfterChipPuMs} ms after CHIP_PU goes high (Table 3-2, t_H).`
    const moduleNote = pin.gpio === 45
      ? chip.notes.find((note) => note.id === "vdd-spi-18v-modules")?.text
      : undefined
    const boot = constraint.bootLevel
      ? `This database expects GPIO${pin.gpio} to stay ${constraint.bootLevel} at reset.`
      : `The safe reset level for GPIO${pin.gpio} is not in the pin database yet.`
    if (reasons.length > 0) {
      issues.push(
        makeIssue(
          "warning",
          strappingRuleId,
          [pin.gpio],
          `GPIO${pin.gpio} is a strapping pin. ${constraint.effect} ${reasons.join(" ")} ${hold}${moduleNote ? ` ${moduleNote}` : ""}`,
          `Move this signal off GPIO${pin.gpio}, or keep the pin at its boot level while reset is released. ${boot} ${hold}`,
        ),
      )
    } else {
      issues.push(
        makeIssue(
          "info",
          strappingRuleId,
          [pin.gpio],
          `GPIO${pin.gpio} is a strapping pin. ${constraint.effect} This use does not by itself pull the pin off its boot level. The external circuit still has to leave the strap alone while reset is released.${moduleNote ? ` ${moduleNote}` : ""}`,
          `Confirm the attached circuit does not fight this strap at reset. ${boot}`,
        ),
      )
    }
  }
  return issues
}
