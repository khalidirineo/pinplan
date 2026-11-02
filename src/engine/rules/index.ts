import type { Rule } from "../types"
import { assignmentShapeRule, assignmentShapeRuleId } from "./assignmentShape"
import { unknownPinRule, unknownPinRuleId } from "./unknownPin"
import { duplicatePinRule, duplicatePinRuleId } from "./duplicatePin"
import { adcCapabilityRule, adcCapabilityRuleId } from "./adcCapability"
import { flashReservedRule, flashReservedRuleId } from "./flashReserved"
import { notExposedRule, notExposedRuleId } from "./notExposed"
import { psramReservedRule, psramReservedRuleId } from "./psramReserved"
import { usbPinsRule, usbPinsRuleId } from "./usbPins"
import { adc2WifiRule, adc2WifiRuleId } from "./adc2Wifi"
import { strappingRule, strappingRuleId } from "./strapping"
import { uart0ConsoleRule, uart0ConsoleRuleId } from "./uart0Console"
import { jtagPinsRule, jtagPinsRuleId } from "./jtagPins"
import { peripheralLimitRule, peripheralLimitRuleId } from "./peripheralLimit"
import { duplicateSignalRule, duplicateSignalRuleId } from "./duplicateSignal"
import { i2cPullupsRule, i2cPullupsRuleId } from "./i2cPullups"

export const ruleIds = [
  assignmentShapeRuleId,
  unknownPinRuleId,
  duplicatePinRuleId,
  adcCapabilityRuleId,
  flashReservedRuleId,
  notExposedRuleId,
  psramReservedRuleId,
  usbPinsRuleId,
  adc2WifiRuleId,
  strappingRuleId,
  uart0ConsoleRuleId,
  jtagPinsRuleId,
  peripheralLimitRuleId,
  duplicateSignalRuleId,
  i2cPullupsRuleId,
] as const

export const rules: Rule[] = [
  assignmentShapeRule,
  unknownPinRule,
  duplicatePinRule,
  adcCapabilityRule,
  flashReservedRule,
  notExposedRule,
  psramReservedRule,
  usbPinsRule,
  adc2WifiRule,
  strappingRule,
  uart0ConsoleRule,
  jtagPinsRule,
  peripheralLimitRule,
  duplicateSignalRule,
  i2cPullupsRule,
]
