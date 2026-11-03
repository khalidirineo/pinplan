import type { Chip } from "../data/types"

interface VerificationNoteProps {
  chip: Chip
}

export function VerificationNote({ chip }: VerificationNoteProps) {
  return (
    <section aria-label="Data verification" className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <h2 className="text-sm font-semibold text-zinc-100">Data verification</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-300">
        Checked facts were compared with the{" "}
        <a className="underline decoration-zinc-600 underline-offset-2" href={chip.datasheet.url}>
          {chip.datasheet.title} {chip.datasheet.revision}
        </a>
        {" and the "}
        <a className="underline decoration-zinc-600 underline-offset-2" href={chip.moduleDatasheet.url}>
          {chip.moduleDatasheet.title} {chip.moduleDatasheet.revision}
        </a>
        {`. The ${chip.trm.title} revision is ${chip.trm.revision}.`}
      </p>
      <h3 className="mt-4 text-sm font-semibold text-zinc-100">Verified</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
        <li>
          GPIO0, GPIO3, GPIO45, and GPIO46 straps: reset pulls and boot levels. The GPIO45 VDD_SPI map is Series Datasheet Section 3.2, Table 3-4. GPIO3 has no internal pull (Section 3.4). The strap pins were also checked against WROOM-1 Section 4.
        </li>
        <li>A strap must hold its level for at least 3 ms after CHIP_PU goes high (Table 3-2, t_H).</li>
        <li>
          ADC2 on GPIO11-20 can make <code>adc_oneshot_read</code> return <code>ESP_ERR_TIMEOUT</code> while Wi-Fi is on (ESP-IDF adc_oneshot docs). The ADC channel numbers are not part of that check.
        </li>
      </ul>
      <h3 className="mt-4 text-sm font-semibold text-zinc-100">Not verified</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-300">
        <li>
          Function names, the pad map, flash and PSRAM reserved pins, peripheral counts, UART0 and JTAG labels, and reset pulls on pins other than GPIO0, GPIO3, GPIO45, and GPIO46.
        </li>
        <li>
          1.8 V modules (R8V/R16V, Table 1-1) need 1.8 V flash and may have VDD_SPI fixed by eFuse. Check the module datasheet for the part you are using.
        </li>
        <li>
          Internal GPIO pull-ups are usually too weak for I2C, especially at 400 kHz. That note was not checked against a datasheet section.
        </li>
      </ul>
    </section>
  )
}
