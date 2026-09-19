import{chromium}from'playwright';import fs from'node:fs';
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const context=await b.newContext({viewport:{width:1280,height:720}});const p=await context.newPage();const errors=[],checks=[];
p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
const check=(name,ok,details)=>{checks.push({name,ok,details});fs.writeFileSync('evidence/browser-functional-progress.json',JSON.stringify({url,checks,errors},null,2));console.log(JSON.stringify(checks.at(-1)));if(!ok)throw Error(name);};
const state=()=>p.evaluate(()=>window.__LRG__.getState());
await p.goto(url);await p.waitForFunction(()=>window.__LRG__);await p.evaluate(()=>document.fonts.ready);
for(const [width,height]of[[1280,720],[1920,1080]]){
 await p.setViewportSize({width,height});await p.waitForTimeout(300);
 const clips=await p.locator('.title-panel button,.title-panel h1,.title-panel .controls-card').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,text:e.textContent}}));
 check(`title-${width}x${height}`,clips.every(r=>r.x>=0&&r.y>=0&&r.x+r.w<=width+1&&r.y+r.h<=height+1),clips);
 await p.screenshot({path:`evidence/title-${width}.png`});
}
await p.setViewportSize({width:1280,height:720});await p.getByTestId('start-normal').click();await p.waitForTimeout(400);
const a=await state();await p.keyboard.down('d');await p.waitForTimeout(500);await p.keyboard.up('d');const c=await state();check('screen-right-key-moves-right',c.player.x>a.player.x+20,{before:a.player.x,after:c.player.x});
await p.keyboard.press('Space');await p.waitForTimeout(80);check('dash-activates',(await state()).player.dashCooldown>0);
await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__LRG__.getState().phase==='paused');const before=await state();await p.waitForTimeout(1100);const after=await state();check('pause-freezes-time',before.elapsed===after.elapsed,{before:before.elapsed,after:after.elapsed});
await p.getByRole('button',{name:'소리 켜짐',exact:true}).click();await p.getByRole('button',{name:'화면 흔들림 켬',exact:true}).click();
const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('little-rune-guardians.v1')));check('settings-saved',saved.settings.muted&&saved.settings.reducedMotion,saved);
await p.screenshot({path:'evidence/pause-settings.png'});await p.reload();await p.waitForFunction(()=>window.__LRG__);await p.getByTestId('start-normal').click();await p.keyboard.press('Escape');await p.waitForFunction(()=>window.__LRG__.getState().phase==='paused');
check('settings-survive-reload',await p.getByRole('button',{name:'소리 꺼짐',exact:true}).count()===1&&await p.getByRole('button',{name:'화면 흔들림 줄임',exact:true}).count()===1);
await p.getByRole('button',{name:'계속하기',exact:true}).click();
// Deliberate normal-input defeat: walk towards enemies. No game state changes.
let held=new Set();async function keys(next){for(const k of held)if(!next.has(k))await p.keyboard.up(k);for(const k of next)if(!held.has(k))await p.keyboard.down(k);held=next;}
const restarts=[];
for(let run=0;run<3;run++){
 const start=Date.now();
 while((Date.now()-start)<100000){const s=await state();if(s.phase==='defeat')break;if(s.phase==='levelup'){await keys(new Set());await p.keyboard.press('3');continue;}if(s.phase==='paused'){await p.keyboard.press('Escape');continue;}
 const enemy=[...s.enemies].sort((a,b)=>Math.hypot(a.x-s.player.x,a.y-s.player.y)-Math.hypot(b.x-s.player.x,b.y-s.player.y))[0];const next=new Set();
 if(enemy){const dx=enemy.x-s.player.x,dy=enemy.y-s.player.y;if(dx>8)next.add('d');if(dx<-8)next.add('a');if(dy>8)next.add('s');if(dy<-8)next.add('w');}await keys(next);await p.waitForTimeout(130);}
 await keys(new Set());const ended=await state();check(`defeat-${run+1}`,ended.phase==='defeat',{elapsed:ended.elapsed,hp:ended.player.hp});
 if(run===0)await p.screenshot({path:'evidence/defeat.png'});
 {await p.getByTestId('restart').click();await p.waitForTimeout(100);const restarted=await state(),d=await p.evaluate(()=>window.__LRG__.getDiagnostics());const item={run:run+1,elapsed:restarted.elapsed,enemies:restarted.enemies.length,projectiles:restarted.projectiles.length,kills:restarted.stats.kills,level:restarted.player.level,listeners:d.input.listenerCount,raf:d.rafLoopCount};restarts.push(item);check(`restart-clean-${run+1}`,item.elapsed<1&&item.enemies<=1&&item.projectiles===0&&item.kills===0&&item.level===1&&item.listeners===3&&item.raf===1,item);}
}
// Three completed defeats followed by three real restarts; no redundant fourth defeat.
await p.waitForTimeout(1500);
check('third-restart-continues',(await state()).phase==='playing');
const recorded=await p.evaluate(()=>JSON.parse(localStorage.getItem('little-rune-guardians.v1')));check('best-record-saved',recorded.bestTime>0&&recorded.bestScore>0,recorded);
await p.evaluate(()=>localStorage.setItem('little-rune-guardians.v1','{broken'));await p.reload();await p.waitForFunction(()=>window.__LRG__);await p.getByTestId('start-normal').click();check('corrupt-storage-starts',(await state()).phase==='playing');
check('no-runtime-errors',errors.length===0,errors);
fs.writeFileSync('evidence/browser-functional.json',JSON.stringify({at:new Date().toISOString(),url,checks,restarts,errors,method:'UI and keyboard only. localStorage corruption is a storage-recovery fixture; game state never mutated.'},null,2));await b.close();
