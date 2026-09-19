import { chromium } from 'playwright';
import fs from 'node:fs';
import {steer} from './steering.mjs';
const mode=process.argv[2]||'normal';
const label=process.argv[3]||mode;
const url=process.env.GAME_URL||'http://127.0.0.1:4173';
const seconds=Number(process.env.PLAY_SECONDS|| (mode==='normal'?720:290));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
const viewport=process.env.VIEWPORT==='1080'?{width:1920,height:1080}:{width:1280,height:720};
const page=await browser.newPage({viewport});
const errors=[],samples=[],choices=[],captures=[],bossCaptures=new Set(),projectileCaptures=new Set(),flightSamples=[];let held=new Set(),minHp=Infinity,lastLog=-30,lastCapture=0,bossCaptured=false,growthCaptured=false;
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text());});
if(process.env.PROFILE_FIXTURE)await page.addInitScript(profile=>localStorage.setItem('little-rune-guardians.v1',JSON.stringify(profile)),JSON.parse(process.env.PROFILE_FIXTURE));
await page.goto(url);await page.waitForFunction(()=>window.__LRG__);await page.evaluate(()=>document.fonts.ready);
await page.screenshot({path:`evidence/${label}-title.png`});captures.push(`${label}-title.png`);
if(process.env.CHARACTER)await page.getByTestId(`character-${process.env.CHARACTER}`).click();
await page.getByTestId(mode==='demo'?'start-demo':'start-normal').click();
const start=Date.now();let previous={x:0,y:0};
async function keys(next){for(const key of held)if(!next.has(key))await page.keyboard.up(key);for(const key of next)if(!held.has(key))await page.keyboard.down(key);held=next;}
async function snapshot(){return await page.evaluate(()=>window.__LRG__.getState());}
let state;
while((Date.now()-start)/1000<seconds){
 state=await snapshot();const p=state.player;minHp=Math.min(minHp,p.hp);
 if(state.phase==='victory'||state.phase==='defeat')break;
 if(state.phase==='paused'){await page.keyboard.press('Escape');await page.waitForTimeout(100);continue;}
 if(state.phase==='levelup'){
  await keys(new Set());
  if(p.level===8&&!captures.includes(`${label}-growth-level8.png`)){await page.screenshot({path:`evidence/${label}-growth-level8.png`});captures.push(`${label}-growth-level8.png`);}
  if(!growthCaptured){await page.screenshot({path:`evidence/${label}-growth.png`});captures.push(`${label}-growth.png`);growthCaptured=true;}
  const preference=['arrow','spirit','chain','pierce','split','regen','sword','power','haste','vitality','magnet','speed','armor','fireball','lightning','frost'];
  const guideTarget=process.env.DEMO_GUIDE==='1'?['arrow','spirit','pierce','split','chain'].find(id=>!p.upgrades[id]):null;
  const rank=id=>{if(id===guideTarget)return -1;const i=preference.indexOf(id);return i<0?100:i;};
  const choice=state.upgradeChoices.map((v,i)=>({...v,index:i})).sort((a,b)=>rank(a.id)-rank(b.id))[0];
  choices.push({at:state.elapsed,id:choice.id});await page.keyboard.press(String(choice.index+1));await page.waitForTimeout(70);continue;
 }
 if(state.phase!=='playing'){console.log('Unexpected phase',state.phase);break;}
 for(const projectile of state.projectiles.filter(q=>q.owner==='enemy')){
  if(flightSamples.length<150)flightSamples.push({elapsed:state.elapsed,id:projectile.id,kind:projectile.kind,x:projectile.x,y:projectile.y,playerX:p.x,playerY:p.y,hp:p.hp,life:projectile.life});
  if(!projectileCaptures.has(projectile.kind)&&Math.abs(projectile.x-p.x)<380&&Math.abs(projectile.y-p.y)<230){const file=`${label}-enemy-${projectile.kind}.png`;await page.screenshot({path:`evidence/${file}`});captures.push(file);projectileCaptures.add(projectile.kind);}
 }
 if(state.elapsed-lastLog>=30){
  const d=await page.evaluate(()=>window.__LRG__.getDiagnostics());
  const sample={elapsed:state.elapsed,wall:(Date.now()-start)/1000,seed:state.seed,x:p.x,y:p.y,hp:p.hp,level:p.level,kills:state.stats.kills,enemies:state.enemies.length,projectiles:state.projectiles.length,pickups:state.pickups.length,enemyProjectiles:state.projectiles.filter(q=>q.owner==='enemy').length,dashCharges:p.dashCharges,dashMax:p.dashMaxCharges,synergies:state.synergies,bosses:state.enemies.filter(e=>e.boss).map(e=>({kind:e.kind,hp:e.hp}))};
  samples.push(sample);lastLog=state.elapsed;console.log(JSON.stringify(sample));
  fs.writeFileSync(`evidence/${label}-progress.json`,JSON.stringify({start:new Date(start).toISOString(),samples,choices,errors,diagnostics:d},null,2));
 }
 if(state.enemies.some(e=>e.boss)&&!bossCaptured){await page.screenshot({path:`evidence/${label}-boss.png`});captures.push(`${label}-boss.png`);bossCaptured=true;}
 for(const boss of state.enemies.filter(e=>e.boss&&Math.abs(e.x-p.x)<300&&Math.abs(e.y-p.y)<190)){
  for(const key of [boss.kind,...state.zones.filter(z=>z.owner==='enemy'&&(z.kind.startsWith('boss')||z.kind.startsWith('golem'))).map(z=>z.kind+(z.telegraph>0?'-telegraph':'-active'))]){
   if(bossCaptures.has(key))continue;
   const capture=`${label}-${key}.png`;await page.screenshot({path:`evidence/${capture}`});captures.push(capture);bossCaptures.add(key);
  }
 }
 if(state.elapsed>lastCapture+60){await page.screenshot({path:`evidence/${label}-combat.png`});lastCapture=state.elapsed;}
 if(mode==='idle'){await keys(new Set());await page.waitForTimeout(200);continue;}
 const control=steer(state,previous);previous={x:control.moveX,y:control.moveY};
 const next=new Set();if(control.moveX>0)next.add('d');if(control.moveX<0)next.add('a');if(control.moveY>0)next.add('s');if(control.moveY<0)next.add('w');
 await keys(next);if(control.dashPressed)await page.keyboard.press('Space');
 await page.waitForTimeout(100);
}
await keys(new Set());state=await snapshot();await page.screenshot({path:`evidence/${label}-result.png`});captures.push(`${label}-result.png`);
const diagnostics=await page.evaluate(()=>window.__LRG__.getDiagnostics());
const savedProfile=await page.evaluate(()=>{try{return JSON.parse(localStorage.getItem('little-rune-guardians.v1'));}catch{return null;}});
const result={url,viewport,demoGuide:process.env.DEMO_GUIDE==='1',savedProfile,profileFixture:process.env.PROFILE_FIXTURE?JSON.parse(process.env.PROFILE_FIXTURE):null,version:diagnostics.version,mode,label,startedAt:new Date(start).toISOString(),finishedAt:new Date().toISOString(),wallSeconds:(Date.now()-start)/1000,phase:state.phase,seed:state.seed,elapsed:state.elapsed,minHp,finalPlayer:state.player,stats:state.stats,level:state.player.level,upgrades:state.player.upgrades,synergies:state.synergies,samples,choices,captures,flightSamples,observedEnemyProjectileKinds:[...projectileCaptures],errors,diagnostics,method:'Real-time Chrome. Only UI click and keyboard input; observation API read-only. No time acceleration, invulnerability or state mutation.'};
fs.writeFileSync(`evidence/${label}-result.json`,JSON.stringify(result,null,2));console.log('RESULT',JSON.stringify({phase:state.phase,elapsed:state.elapsed,wallSeconds:result.wallSeconds,minHp,errors}));await browser.close();
if(errors.length||state.phase!==(mode==='idle'?'defeat':'victory'))process.exitCode=1;
