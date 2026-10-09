import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

const count = Number(process.argv[2] ?? 100)
const start = Number(process.argv[3] ?? 1)
const opponent = process.argv[4] ?? 'face'
const hp = Number(process.argv[5] ?? 20)
const evaluated = process.argv[6] ?? 'greedy'
const policies = ['planner', 'greedy', 'face', 'face-first', 'random']
if (!Number.isInteger(count) || count < 1 || !Number.isInteger(start) || start < 1 || !Number.isInteger(hp) || hp < 1 || !policies.includes(opponent) || !policies.includes(evaluated)) {
  throw new Error('Usage: npm run benchmark:ai -- [seed count] [first seed] [opponent policy] [initial HP] [evaluated policy]; policies: planner|greedy|face|face-first|random')
}
const server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom' })
try {
  const { runBenchmark } = await server.ssrLoadModule('/scripts/ai-benchmark.ts')
  const report = runBenchmark(start, count, opponent, hp, evaluated)
  mkdirSync('reports', { recursive: true })
  const prefix = evaluated === 'greedy' ? 'ai' : `ai-${evaluated}-vs`
  const path = `reports/${prefix}-${opponent}-hp${hp}-${start}-${count}.json`
  writeFileSync(path, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify({ ...report, examples: undefined, report: path }, null, 2))
} finally { await server.close() }
