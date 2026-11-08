import { createServer } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'

// Discovery seeds and validation seeds never overlap. Each seed swaps deck assignments.
const mode = process.argv[2] ?? 'grid'
const count = Number(process.argv[3] ?? (mode === 'grid' ? 40 : 100))
const start = Number(process.argv[4] ?? (mode === 'grid' ? 120001 : 130001))
const a = process.argv[7] ?? 'planner', b = process.argv[8] ?? 'planner'
const maxNodes = Number(process.argv[9] ?? 4800)
if (!['grid','matchup','ablation'].includes(mode) || !Number.isInteger(count) || count < 1 || !['planner','greedy','random'].includes(a) || !['planner','greedy','random'].includes(b)) throw new Error('Invalid simulation arguments')
const server = await createServer({ server: { middlewareMode: true, hmr: false, ws: false }, appType: 'custom' })
try {
  const { match, summarize, defaultRules } = await server.ssrLoadModule('/scripts/economy-simulation.ts')
  const e = Number(process.argv[5] ?? defaultRules.energyPerTurn), k = Number(process.argv[6] ?? defaultRules.drawPerTurn)
  if (!Number.isInteger(e) || e < 1 || !Number.isInteger(k) || k < 0 || !Number.isInteger(maxNodes) || maxNodes < 1) throw new Error('E>=1, K>=0 and maxNodes>=1 must be integers')
  mkdirSync('reports', { recursive: true })
  const results = [], matches = []
  const run = (rules, policies, overrides = {}) => {
    const games = []
    for (let seed=start; seed<start+count; seed++) {
      for (const swapped of [false,true]) games.push(match(seed,rules,policies,swapped,overrides,maxNodes))
      if (count >= 100 && (seed-start+1)%25===0) console.log(`Progress ${seed-start+1}/${count}: E=${rules.energyPerTurn}, K=${rules.drawPerTurn}, ${policies.join('/')}`)
    }
    return games
  }
  if (mode === 'grid') {
    for (const energyPerTurn of [1,2,3,4,5,6]) for (const drawPerTurn of [1,2,3]) {
      const rules = { energyPerTurn, drawPerTurn }, games = run(rules,['greedy','greedy']), report = summarize(games)
      const row = { rules, ...report }; results.push(row)
      console.log(JSON.stringify({ ...row,cardStats:undefined }))
    }
  } else if (mode === 'matchup') {
    // Reverse policy seats as well as deck assignments for asymmetric comparisons.
    matches.push(...run({energyPerTurn:e,drawPerTurn:k},[a,b]))
    if (a !== b) matches.push(...run({energyPerTurn:e,drawPerTurn:k},[b,a]))
    results.push({ rules:{energyPerTurn:e,drawPerTurn:k},policies:[a,b],...summarize(matches),
      evaluatedWins:matches.filter(m=>m.winner!==null&&m.policies[m.winner]===a).length,
      evaluatedFirstWins:matches.filter(m=>m.policies[0]===a&&m.winner===0).length,
      evaluatedSecondWins:matches.filter(m=>m.policies[1]===a&&m.winner===1).length })
    console.log(JSON.stringify({...results[0],cardStats:undefined}))
  } else {
    const base = run({energyPerTurn:e,drawPerTurn:k},[a,a])
    for (const id of ['liu_shaoqi','ye_jianying','wang_hongwen','nie_yuanzi','hua_guofeng','xie_fuzhi','mao_zedong','zhou_enlai']) {
      // Remove only the ability, retain cost/body/deal/dice seed. This diagnoses ability contribution, not a balanced replacement.
      const changed=run({energyPerTurn:e,drawPerTurn:k},[a,a],{[id]:{abilityId:null}})
      let holderNet=0,flips=0,held=0,helps=0,hurts=0
      const pairs=[]
      for(let i=0;i<base.length;i++){
        const origin=base[i], altered=changed[i]
        // Use the initial private deal, including cards never drawn; avoid conditioning on play.
        if(origin.winner!==altered.winner)flips++
        for(const seat of [0,1])if(origin.holdings[seat].includes(id)){
          const delta=(origin.winner===seat?1:0)-(altered.winner===seat?1:0)
          held++;holderNet+=delta;if(delta>0)helps++;if(delta<0)hurts++
          pairs.push({seed:origin.seed,swapped:origin.swapped,delta})
        }
      }
      const row={id,held,holderNet,flips,helps,hurts,games:base.length,pairs};results.push(row);console.log(JSON.stringify({...row,pairs:undefined}))
    }
  }
  const path=mode==='grid' ? `reports/economy-grid-${start}-${count}.json` : `reports/economy-${mode}-${e}-${k}-${a}-${b}-${start}-${count}.json`
  writeFileSync(path,JSON.stringify({mode,count,start,maxNodes,results,matches:mode==='matchup'?matches:undefined},null,2)+'\n')
  console.log('Saved '+path)
} finally { await server.close() }
