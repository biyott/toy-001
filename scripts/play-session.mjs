import { chromium } from 'playwright';
import fs from 'node:fs';
const mode=process.argv[2]||'normal';
const label=process.argv[3]||mode;
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
const seconds=Number(process.env.PLAY_SECONDS|| (mode==='normal'?720:290));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const page=await browser.newPage({viewport:{width:1280,height:720}});
const errors=[],samples=[],choices=[],captures=[];let held=new Set(),minHp=Infinity,lastLog=-30,lastCapture=0,bossCaptured=false,growthCaptured=false;
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
await page.goto(url);await page.waitForFunction(()=>window.__LRG__);await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:`evidence/${label}-title.png`});captures.push(`${label}-title.png`);
await page.getByTestId(mode==='demo'?'start-demo':'start-normal').click();
const start=Date.now();
async function keys(next){for(const key of held)if(!next.has(key))await page.keyboard.up(key);for(const key of next)if(!held.has(key))await page.keyboard.down(key);held=next;}
async function snapshot(){return await page.evaluate(()=>window.__LRG__.getState());}
let state;
while((Date.now()-start)/1000<seconds){
 state=await snapshot();const p=state.player;minHp=Math.min(minHp,p.hp);
 if(state.phase==='victory'||state.phase==='defeat')break;
 if(state.phase==='paused'){await page.keyboard.press('Escape');await page.waitForTimeout(100);continue;}
 if(state.phase==='levelup'){
  await keys(new Set());
  if(!growthCaptured){await page.screenshot({path:`evidence/${label}-growth.png`});captures.push(`${label}-growth.png`);growthCaptured=true;}
  const preference=['arrow','spirit','chain','pierce','split','regen','sword','power','haste','vitality','magnet','speed','armor','fireball','lightning','frost'];
  const rank=id=>{const i=preference.indexOf(id);return i<0?100:i;};
  const choice=state.upgradeChoices.map((v,i)=>({...v,index:i})).sort((a,b)=>rank(a.id)-rank(b.id))[0];
  choices.push({at:state.elapsed,id:choice.id});await page.keyboard.press(String(choice.index+1));await page.waitForTimeout(70);continue;
 }
 if(state.phase!=='playing'){console.log('Unexpected phase',state.phase);break;}
 if(state.elapsed-lastLog>=30){
  const d=await page.evaluate(()=>window.__LRG__.getDiagnostics());
  const sample={elapsed:state.elapsed,wall:(Date.now()-start)/1000,hp:p.hp,level:p.level,kills:state.stats.kills,enemies:state.enemies.length,projectiles:state.projectiles.length,pickups:state.pickups.length,synergies:state.synergies,bosses:state.enemies.filter(e=>e.boss).map(e=>({kind:e.kind,hp:e.hp}))};
  samples.push(sample);lastLog=state.elapsed;console.log(JSON.stringify(sample));
  fs.writeFileSync(`evidence/${label}-progress.json`,JSON.stringify({start:new Date(start).toISOString(),samples,choices,errors,diagnostics:d},null,2));
 }
 if(state.enemies.some(e=>e.boss)&&!bossCaptured){await page.screenshot({path:`evidence/${label}-boss.png`});captures.push(`${label}-boss.png`);bossCaptured=true;}
 if(state.elapsed>lastCapture+60){await page.screenshot({path:`evidence/${label}-combat.png`});lastCapture=state.elapsed;}
 if(mode==='idle'){await keys(new Set());await page.waitForTimeout(200);continue;}
 const dist=a=>(a.x-p.x)**2+(a.y-p.y)**2;
 const target=state.pickups.filter(k=>k.kind==='heal'&&p.hp<p.maxHp*.65).sort((a,b)=>dist(a)-dist(b))[0]??state.pickups.filter(k=>k.kind==='xp').sort((a,b)=>dist(a)-dist(b))[0];
 const boss=state.enemies.find(e=>e.boss),near=state.enemies.filter(e=>dist(e)<88**2);let mx=0,my=0;
 if(near.length){for(const e of near){const d=Math.max(1,Math.hypot(p.x-e.x,p.y-e.y));mx+=(p.x-e.x)/d;my+=(p.y-e.y)/d;}}
 else if(boss&&Math.hypot(boss.x-p.x,boss.y-p.y)>135){mx=boss.x-p.x;my=boss.y-p.y;}
 else if(target){mx=target.x-p.x;my=target.y-p.y;}
 else {mx=-p.x;my=-p.y;}
 const len=Math.hypot(mx,my);mx/=len||1;my/=len||1;
 const next=new Set();if(mx>.3)next.add('d');if(mx<-.3)next.add('a');if(my>.3)next.add('s');if(my<-.3)next.add('w');
 await keys(next);
 if(p.hp<p.maxHp*.6&&state.enemies.some(e=>dist(e)<65**2)&&p.dashCooldown<=0)await page.keyboard.press('Space');
 await page.waitForTimeout(100);
}
await keys(new Set());state=await snapshot();await page.screenshot({path:`evidence/${label}-result.png`});captures.push(`${label}-result.png`);
const diagnostics=await page.evaluate(()=>window.__LRG__.getDiagnostics());
const result={url,version:diagnostics.version,mode,label,startedAt:new Date(start).toISOString(),finishedAt:new Date().toISOString(),wallSeconds:(Date.now()-start)/1000,phase:state.phase,elapsed:state.elapsed,minHp,stats:state.stats,level:state.player.level,upgrades:state.player.upgrades,synergies:state.synergies,samples,choices,captures,errors,diagnostics,method:'Real-time Chrome. Only UI click and keyboard input; observation API read-only. No time acceleration, invulnerability or state mutation.'};
fs.writeFileSync(`evidence/${label}-result.json`,JSON.stringify(result,null,2));console.log('RESULT',JSON.stringify({phase:state.phase,elapsed:state.elapsed,wallSeconds:result.wallSeconds,minHp,errors}));await browser.close();
if(errors.length||!['victory','defeat'].includes(state.phase))process.exitCode=1;
