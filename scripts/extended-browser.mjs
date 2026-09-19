import {chromium} from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const label=process.env.EVIDENCE_LABEL||'rc1';
const url=process.env.GAME_URL||'http://127.0.0.1:4177';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-background-timer-throttling']});
const report={startedAt:new Date().toISOString(),url,method:'Real UI and keyboard, Chrome synthetic touch, navigator gamepad snapshots. No game state mutation. Physical controller/device not tested.',checks:[],errors:[]};
const check=(name,detail)=>{report.checks.push({name,passed:true,detail});console.log('PASS',name);};
const state=p=>p.evaluate(()=>window.__LRG__.getState());
async function ready(p){p.on('pageerror',e=>report.errors.push(e.message));await p.goto(url);await p.waitForFunction(()=>window.__LRG__);await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(120);}
try{
 const p=await browser.newPage({viewport:{width:1280,height:720}});await ready(p);
 for(const [width,height] of [[1280,720],[1920,1080]]){
  await p.setViewportSize({width,height});await p.waitForTimeout(100);
  const box=await p.locator('.title-panel').boundingBox();assert(box&&box.x>=0&&box.y>=0&&box.y+box.height<=height+1);check(`title-${width}x${height}`,box);
  await p.screenshot({path:`evidence/${label}-title-${height}.png`});
  await p.getByTestId('open-codex').click();await p.getByTestId('codex').waitFor({state:'visible'});
  const codexBox=await p.getByTestId('codex').boundingBox();assert(codexBox&&codexBox.y>=0&&codexBox.y+codexBox.height<=height+1);
  assert.equal(await p.locator('[data-testid="codex"] button').count(),1);check(`codex-${height}`,codexBox);
  await p.screenshot({path:`evidence/${label}-codex-${height}.png`});await p.getByTestId('codex-close').click();
 }
 await p.setViewportSize({width:1280,height:720});
 for(const character of ['knight','mage','ranger']){
  await p.getByTestId(`character-${character}`).click();await p.getByTestId('start-normal').click();await p.waitForTimeout(450);
  let s=await state(p);assert.equal(s.player.character,character);assert.equal(s.contentTier,1);check(`character-${character}`,{hp:s.player.maxHp,speed:s.player.speed,weapon:s.weapons[0].id});
  await p.screenshot({path:`evidence/${label}-play-${character}.png`});await p.keyboard.press('Escape');await p.getByTestId('return-title-pause').click();
 }
 await p.getByTestId('challenge-seed').fill('4294967296');await p.getByTestId('start-challenge').click();assert.equal((await state(p)).phase,'title');assert.equal(await p.getByTestId('challenge-seed').getAttribute('aria-invalid'),'true');check('challenge rejects out-of-range');
 await p.getByTestId('challenge-seed').fill('0000000000');await p.getByTestId('start-challenge').click();let s=await state(p);assert.equal(s.seed,0);assert.equal(s.mode,'challenge');const props=JSON.stringify(s.props);check('challenge zero accepted');
 await p.keyboard.press('Escape');await p.getByTestId('return-title-pause').click();await p.getByTestId('start-challenge').click();assert.equal(JSON.stringify((await state(p)).props),props);check('challenge repeatable initial world');
 await p.close();
 const padContext=await browser.newContext({viewport:{width:1280,height:720}});
 await padContext.addInitScript(()=>{window.__PAD__={axes:[0,0],buttons:Array.from({length:16},()=>({pressed:false,touched:false,value:0})),index:0,connected:true,id:'Browser snapshot fixture',mapping:'standard',timestamp:0};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.__PAD__],configurable:true});});
 const pad=await padContext.newPage();await ready(pad);
 async function padButton(i){await pad.evaluate(i=>{window.__PAD__.buttons[i]={pressed:true,touched:true,value:1};},i);await pad.waitForTimeout(100);await pad.evaluate(i=>{window.__PAD__.buttons[i]={pressed:false,touched:false,value:0};},i);await pad.waitForTimeout(100);}
 await pad.getByTestId('start-normal').focus();await padButton(0);assert.equal((await state(pad)).phase,'playing');check('pad A starts focused mode');
 const before=(await state(pad)).player.x;await pad.evaluate(()=>window.__PAD__.axes=[1,0]);await pad.waitForTimeout(450);await pad.evaluate(()=>window.__PAD__.axes=[0,0]);assert((await state(pad)).player.x>before+20);check('pad analog moves player');await padButton(0);assert((await state(pad)).player.dashCooldown>0);check('pad A dash');
 await padButton(9);assert.equal((await state(pad)).phase,'paused');const paused=(await state(pad)).elapsed;await pad.waitForTimeout(250);assert.equal((await state(pad)).elapsed,paused);check('pad Start pause freezes');
 await padButton(1);assert.equal((await state(pad)).phase,'playing');check('pad B resumes without hidden codex click');
 await padButton(9);await pad.getByTestId('return-title-pause').click();await pad.getByTestId('open-codex').click();await padButton(1);assert.equal(await pad.getByTestId('codex').isVisible(),false);assert.equal((await state(pad)).phase,'title');check('pad B closes visible codex');await padContext.close();
 const touchContext=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const touch=await touchContext.newPage();await ready(touch);await touch.getByTestId('start-demo').click();await touch.getByTestId('touch-controls').waitFor({state:'visible'});
 const joystick=await touch.getByTestId('touch-joystick').boundingBox(),dash=await touch.getByTestId('touch-dash').boundingBox();assert(joystick&&dash);
 const cdp=await touchContext.newCDPSession(touch);const point=(b,id,dx=0)=>({x:b.x+b.width/2+dx,y:b.y+b.height/2,id,radiusX:3,radiusY:3,force:1});
 const x0=(await state(touch)).player.x;
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(joystick,1)]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[point(joystick,1,40)]});await touch.waitForTimeout(450);assert((await state(touch)).player.x>x0+20);check('touch joystick movement');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point(joystick,1,40),point(dash,2)]});await touch.waitForTimeout(80);assert((await state(touch)).player.dashCooldown>0);check('touch simultaneous joystick and dash');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await touch.waitForTimeout(300);const stopped=(await state(touch)).player.x;await touch.waitForTimeout(200);assert(Math.abs((await state(touch)).player.x-stopped)<.01);check('touch release clears movement');
 await touch.screenshot({path:`evidence/${label}-touch-landscape.png`});await touch.getByTestId('touch-pause').tap();await touch.waitForFunction(()=>window.__LRG__.getState().phase==='paused',{},{timeout:3000});assert.equal((await state(touch)).phase,'paused');assert.equal(await touch.getByTestId('touch-controls').isVisible(),false);check('touch pause hides controls');
 await touchContext.close();
 assert.deepEqual(report.errors,[]);report.passed=true;
}catch(error){report.passed=false;report.failure=String(error);console.error(error);process.exitCode=1;}finally{report.finishedAt=new Date().toISOString();fs.writeFileSync(`evidence/${label}-extended-browser.json`,JSON.stringify(report,null,2));await browser.close();}
