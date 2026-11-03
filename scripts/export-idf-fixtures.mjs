import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { createServer } from "vite"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const outDir = join(root, "firmware", "idf-check", "generated")
const server = await createServer({
  root,
  configFile: join(root, "vite.config.ts"),
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
})

try {
  const fixtures = await server.ssrLoadModule("/src/codegen/idfFixtures.ts")
  const chipModule = await server.ssrLoadModule("/src/data/loadChip.ts")
  const evaluateModule = await server.ssrLoadModule("/src/engine/evaluate.ts")
  const exportModule = await server.ssrLoadModule("/src/codegen/exportIdf.ts")
  const chip = chipModule.loadChip()
  mkdirSync(outDir, { recursive: true })
  for (const fixture of fixtures.idfFixtures) {
    const issues = evaluateModule.evaluate(chip, fixture.assignments, fixture.settings)
    const code = exportModule.exportEspIdf(chip, fixture.assignments, fixture.settings, issues)
    const file = join(outDir, `${fixture.name}.c`)
    writeFileSync(file, code)
    console.log(`wrote ${file}`)
  }
} finally {
  await server.close()
}
