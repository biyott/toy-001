import{chromium}from'playwright';import fs from'node:fs';import assert from'node:assert/strict';
const url=process.env.GAME_URL||'http://127.0.0.1:4180',label=process.env.EVIDENCE_LABEL||'rc3';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const report={url,startedAt:new Date().toISOString(),checks:[],errors:[],method:'Real keyboard/UI only, no game state mutation.'};
const p=await browser.newPage({viewport:{width:1280,height:720}}),state=()=>p.evaluate(()=>window.__LRG__.getState());p.on('pageerror',e=>report.errors.push(e.message));
const check=(name,data)=>{report.checks.push({name,data,passed:true});console.log('PASS',name);};
try{
 await p.goto(url);await p.waitForFunction(()=>window.__LRG__);await p.evaluate(()=>document.fonts.ready);
 for(const [character,charges,duration] of [['knight',2,5],['mage',1,4],['ranger',3,6]]){
  await p.getByTestId(`character-${character}`).click();await p.getByTestId('start-normal').click();await p.waitForTimeout(120);let s=await state();assert.equal(s.player.dashCharges,charges);assert.equal(s.player.dashRechargeDuration,duration);assert.equal((await p.getByTestId('dash-charges').innerText()).replace(/\s/g,''),`${charges}/${charges}`);check(`${character} full charges`,s.player);
  await p.keyboard.press('Space');await p.waitForTimeout(120);s=await state();assert.equal(s.player.dashCharges,charges-1);assert(s.player.dashRechargeRemaining>duration-.5);check(`${character} consumes charge`,{charges:s.player.dashCharges,remaining:s.player.dashRechargeRemaining});
  await p.keyboard.press('Space');await p.waitForTimeout(120);assert.equal((await state()).player.dashCharges,charges-1);check(`${character} repeat blocked`);
  await p.waitForTimeout(1000);const before=(await state()).player;assert(before.dashRechargeRemaining<duration-.9);assert(Number(await p.getByTestId('dash-recharge').getAttribute('aria-valuenow'))>0);
  assert.equal(before.dashReuseDelay,0);assert(!(await p.getByTestId('dash-status').innerText()).includes('연속 사용 대기'));assert(!(await p.getByTestId('dash-status').getAttribute('aria-label')).includes('연속 사용 대기'));check(`${character} recharge distinct from short reuse delay`);
  await p.screenshot({path:`evidence/${label}-dash-${character}.png`});
  if(charges>1){await p.keyboard.press('Space');await p.waitForTimeout(120);const after=(await state()).player;assert.equal(after.dashCharges,charges-2);assert(after.dashRechargeRemaining<before.dashRechargeRemaining);check(`${character} next use retains refill progress`);}
  await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__LRG__.getState().phase==='paused');const frozen=(await state()).player.dashRechargeRemaining;await p.waitForTimeout(400);assert.equal((await state()).player.dashRechargeRemaining,frozen);check(`${character} pause freezes refill`);
  await p.keyboard.press('Escape');await p.waitForTimeout((frozen+.2)*1000);const refilled=(await state()).player;assert(refilled.dashCharges>charges-(charges>1?2:1));check(`${character} one slot recharges`,{charges:refilled.dashCharges,remaining:refilled.dashRechargeRemaining});
  await p.keyboard.press('Escape');await p.getByTestId('return-title-pause').click();
 }
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(e){report.passed=false;report.failure=String(e);process.exitCode=1;console.error(e);}finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(`evidence/${label}-dash-browser.json`,JSON.stringify(report,null,2));await browser.close();}
