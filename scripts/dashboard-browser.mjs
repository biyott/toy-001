import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const label=process.env.EVIDENCE_LABEL||'dashboard-m05';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const report={observedAt:new Date().toISOString(),checks:[],errors:[]};
try {
 const p=await browser.newPage({viewport:{width:1440,height:1080}});
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto('http://127.0.0.1:4310');
 await p.waitForFunction(()=>document.querySelector('#agents')?.children.length===21);
 await p.evaluate(()=>document.fonts.ready);
 const state=await(await p.request.get('http://127.0.0.1:4310/api/state')).json();
 assert.equal(state.counts.createdSubagents,20);
 assert.equal(state.operations.limitEvents.length,0);
 for(const id of ['M02','M03','M04','M05'])assert.equal(state.tasks.find(t=>t.id===id).status,'integrated');
 assert(state.tasks.find(t=>t.id==='M04').conflicts.length>0);
 report.checks.push('cumulative creation, explicit integration authority, historical conflicts, real limit errors');
 await p.locator('#role-filter').selectOption('character_designer');
 await p.waitForTimeout(2300);
 assert.equal(await p.locator('#role-filter').inputValue(),'character_designer');
 assert.equal(await p.locator('#agents .agent').count(),3);
 report.checks.push('three independent character designers and filter preserved across polling');
 await p.locator('#reset-filter').click();
 if(process.env.EXPECT_FINAL==='1'){
  assert.equal(state.mode,'final');
  assert((await p.locator('#connection').innerText()).includes('최종 저장본'));
  assert.equal(state.counts.tasks.integrated,state.tasks.length);
  assert.equal(state.counts.readyUnassignedTasks,0);
  const frozenSummary=()=>p.locator('#summary .metric').evaluateAll(cards=>cards.filter(card=>card.querySelector('span')?.textContent!=='수집기 heartbeat').map(card=>card.textContent).join('\n'));
  const summary=await frozenSummary();
  await p.waitForTimeout(2300);
  assert.equal(await frozenSummary(),summary);
  await p.reload();await p.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('최종 저장본'));
  report.checks.push('final snapshot, all integrations, frozen summary, reload');
 }
 await p.screenshot({path:`evidence/${label}.png`,fullPage:true});
 assert.deepEqual(report.errors,[]);report.passed=true;report.counts=state.counts;
}catch(e){report.passed=false;report.failure=String(e);process.exitCode=1;console.error(e);}
finally{fs.writeFileSync(`evidence/${label}-browser.json`,JSON.stringify(report,null,2));await browser.close();}
