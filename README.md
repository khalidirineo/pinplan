# PinPlan

PinPlan is a GPIO pin planner for the ESP32-S3-WROOM-1. You assign functions to pins, and the rule engine flags conflicts and hardware traps before you build the board. ESP-IDF code export, file save, and shareable links are later phases.

The database is `src/data/chips/esp32s3.json`. Every constraint has a `source` and a `verified` flag. Leave `verified` false until that fact has been compared with the cited document. Paths that have been checked are listed in `src/data/chip.test.ts`. `scripts/draft-esp32s3.mjs` drafted that file from the local reference clone and will not overwrite it unless you pass `--force`. After you start reviewing facts, do not re-run it.

## Run

```sh
npm install
npm test
npm run dev
```

`npm test` runs Vitest. `npm run dev` opens the planner: the module pad map, the assignment sidebar, and the live issues list.

## Layout

- `src/data/` loads and checks the chip JSON. No React.
- `src/engine/` is a pure function, `evaluate(chip, assignments, settings)`, which returns issues. No React.
- `src/engine/rules/` has one file per rule. Add a rule here.
- `src/ui/` is not created yet. `src/App.tsx` is only a placeholder.

An issue is `{ severity, pins, ruleId, message, fix }` with severity `error`, `warning`, or `info`.

Project settings for v1 are `wifiEnabled`, `psram` (`none`, `quad`, or `octal`), and `nativeUsb`.

## Add a rule

1. Create `src/engine/rules/myRule.ts` that exports a rule id and a function `(ctx) => Issue[]`. `ctx` is `{ chip, assignments, settings }`. Use `makeIssue` so pins are deduped and the `fix` string is required.
2. Register the function and the id in `src/engine/rules/index.ts`.
3. Add a `describe` block in `src/engine/evaluate.test.ts`.
4. If the rule needs a new hardware fact, put it in `esp32s3.json` with a `source` and `verified: false`. Do not invent a datasheet section.

Rules should read facts from the JSON. The severity and the way an assignment interacts with a fact live in the rule, because one strapping pin can be a warning or an info depending on the assignment.

## Assignment fields the strapping rule reads

A button is `function: "gpio"`, `direction: "input"`, `role: "button"`. An external resistor that is present at reset is `externalPull: "up"` or `"down"`. Outputs, LEDC, UART TX, and SPI MOSI/SCK/CS warn on a strapping pin because the load can pull the strap before firmware runs. I2C warns when its pull-ups fight the recorded boot level. A warning also says the pin must hold its level for at least 3 ms after `CHIP_PU` goes high. GPIO3 is the exception: `infoOnly` forces info, because it floats at reset and is sampled only when the JTAG eFuses are burnt (they default to 0). GPIO45's weak pull-down is verified; the 3.3 V / 1.8 V mapping is not.

SPI instance numbers are `2` and `3` (SPI2 and SPI3). SPI0 and SPI1 are the flash/PSRAM bus. I2C is `0` and `1`. UART is `0`, `1`, and `2`.

## Dependencies

React, Vite, TypeScript, and Vitest are the app stack. Tailwind CSS is pinned to v3, with PostCSS and Autoprefixer, which is the usual v3 build path. No other runtime libraries. URL compression and ESP-IDF codegen are not in this phase.

## Credits and licenses

PinPlan code is MIT (see `LICENSE`).

Pin function names, strapping text, reset pulls, peripheral counts, and reserved-pin sets were transcribed from Espressif's [esp-gpio-tool](https://github.com/espressif/esp-gpio-tool) (Apache-2.0, commit `a1bcdb2`). The WROOM-1 pad map was transcribed from [ESP32 Pinout Studio](https://esp32pin.com) by Felix Kunz (MIT), which generated it from Espressif's KiCad libraries (Apache-2.0). See `NOTICE`.

ESP32 is a trademark of Espressif Systems. This project is not affiliated with or endorsed by Espressif.
