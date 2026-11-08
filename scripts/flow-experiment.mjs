import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

const mode = process.argv[2] ?? 'discovery'
const count = Number(process.argv[3] ?? 40), start = Number(process.argv[4] ?? 230001)
if (!['discovery','probes','bonus','bonus-high','validate','cross'].includes(mode) || !Number.isInteger(count) || count < 1) throw new Error('Invalid experiment arguments')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { runFlow, emptyHandProbe, summarizeFlow } = await server.ssrLoadModule('/scripts/flow-simulation.ts')
  const { match } = await server.ssrLoadModule('/scripts/economy-simulation.ts')
  const results = []
  const configs = mode === 'probes'
    ? [[3,1,2], ...[4,5,6].flatMap(e => [2,3].map(k => [e,k,2]))]
    : mode.startsWith('bonus') ? (mode === 'bonus-high' ? [8,10] : [0,2,4,6]).map(b => [4,3,b])
    : ['validate','cross'].includes(mode) ? [[4,3,Number(process.argv[5] ?? 6)]] : [[4,2,2],[4,3,2],[5,2,2],[5,3,2]]
  for (const [energyPerTurn, drawPerTurn, secondPlayerOpeningBonus] of configs) {
    const rules = { energyPerTurn, drawPerTurn, secondPlayerOpeningBonus }
    if (mode === 'probes') {
      const probes = emptyHandProbe(start,count,rules)
      results.push({ rules,...probes }); console.log(JSON.stringify({rules,empty:probes.empty,populated:probes.populated}))
    } else if (mode === 'cross') {
      for (const opponent of ['spender','random']) {
        const games = []
        for (let seed=start; seed<start+count; seed++) for (const policies of [['planner',opponent],[opponent,'planner']]) for (const swap of [false,true]) games.push(match(seed,rules,policies,swap,{},4800,true))
        const summary = { ...summarizeFlow(games), evaluatedWins: games.filter(g => g.winner !== null && g.policies[g.winner] === 'planner').length }
        results.push({ rules, opponent, summary, games }); console.log(JSON.stringify({rules,opponent,...summary}))
      }
    } else {
      const policies = mode.startsWith('bonus') ? ['planner'] : ['planner','spender']
      for (const policy of policies) {
        const report = runFlow(start,count,rules,[policy,policy])
        results.push({rules,policy,...report}); console.log(JSON.stringify({rules,policy,...report.summary}))
      }
    }
  }
  mkdirSync('reports',{recursive:true})
  const path = `reports/flow-${mode}-${start}-${count}.json`
  writeFileSync(path,JSON.stringify({mode,start,count,results},null,2)+'\n')
  console.log('Saved '+path)
} finally { await server.close() }
