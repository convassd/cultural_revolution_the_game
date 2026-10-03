import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

const count = Number(process.argv[2] ?? 100)
const start = Number(process.argv[3] ?? 1)
const opponent = process.argv[4] ?? 'face'
const hp = Number(process.argv[5] ?? 20)
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(start) || start < 1 || !Number.isInteger(hp) || hp < 1 || !['face', 'face-first', 'random'].includes(opponent)) {
  throw new Error('Usage: npm run benchmark:ai -- [seed count] [first seed] [face|face-first|random] [initial HP, benchmark only]')
}
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { runBenchmark } = await server.ssrLoadModule('/scripts/ai-benchmark.ts')
  const report = runBenchmark(start, count, opponent, hp)
  mkdirSync('reports', { recursive: true })
  const path = `reports/ai-${opponent}-hp${hp}-${start}-${count}.json`
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, examples: undefined, report: path }, null, 2))
} finally { await server.close() }
