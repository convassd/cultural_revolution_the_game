import { createServer } from 'vite'
import { mkdirSync,writeFileSync } from 'node:fs'

const mode=process.argv[2]??'screen', count=Number(process.argv[3]??40), start=Number(process.argv[4]??210001)
const policy=mode==='screen'?'greedy':process.argv[8]??'planner'
if(!['screen','match','probe'].includes(mode)||!['planner','greedy','spender','random'].includes(policy)||!Number.isInteger(count)||count<1)throw new Error('Invalid mode/count/policy')
const server=await createServer({server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'})
try{
 const {runFlow,emptyHandProbe}=await server.ssrLoadModule('/scripts/flow-simulation.ts')
 const E=Number(process.argv[5]??5),K=Number(process.argv[6]??2),bonus=Number(process.argv[7]??2)
 const results=[]
 const configs=mode==='screen'?[{energyPerTurn:3,drawPerTurn:1,secondPlayerOpeningBonus:2},...[4,5,6].flatMap(energyPerTurn=>[2,3].map(drawPerTurn=>({energyPerTurn,drawPerTurn,secondPlayerOpeningBonus:2})))]:[{energyPerTurn:E,drawPerTurn:K,secondPlayerOpeningBonus:bonus}]
 for(const rules of configs){
  if(mode==='probe'){
   const probes=emptyHandProbe(start,count,rules);results.push({rules,...probes});console.log(JSON.stringify({rules,empty:probes.empty,populated:probes.populated}))
  }else{
   const policies=mode==='screen'?['greedy','greedy']:[policy,policy]
   const report=runFlow(start,count,rules,policies)
   results.push({rules,policies,...report});console.log(JSON.stringify({rules,policies,...report.summary}))
  }
 }
 mkdirSync('reports',{recursive:true})
 const path=mode==='screen'?`reports/hand-flow-screen-${start}-${count}.json`:`reports/hand-flow-${mode}-${E}-${K}-b${bonus}-${policy}-${start}-${count}.json`
 writeFileSync(path,JSON.stringify({mode,count,start,policy,results},null,2)+'\n');console.log('Saved '+path)
}finally{await server.close()}
