import './fonts.css';
import { createGame } from './game/engine';
import { createRenderer } from './render/renderer';
import { createUI } from './ui/ui';
import { createInput } from './input';
import { createAudio } from './audio';
import { loadProfile, saveProfile } from './storage';
import { createGamepadReader, mergeInputFrames, type MenuAction } from './controls/gamepad';
import { createTouchControls } from './controls/touch';
import './controls/touch.css';
import type { GameCommand, GameOptions, Phase } from './types';

const VERSION='1.0.0';
let options:GameOptions={mode:'normal',seed:Math.floor(Math.random()*0xffffffff),character:'knight',contentTier:1};
const game=createGame(options), input=createInput(), audio=createAudio();
const gamepad=createGamepadReader(), touch=createTouchControls(document.body);
const canvas=document.querySelector<HTMLCanvasElement>('#game-canvas')!;
const renderer=createRenderer(canvas);
let profile=loadProfile();audio.setMuted(profile.settings.muted);
let lastPhase:Phase='title',runSaved=false;
function command(value:GameCommand){
  audio.unlock();
  if(value.type==='start'){options={...value.options,contentTier:options.contentTier};value={...value,options};runSaved=false;}
  if(value.type==='restart')runSaved=false;
  game.dispatch(value);input.clear();gamepad.clear();touch.clear();
  touch.setEnabled(game.getState().phase==='playing');
  ui.render(game.getState(),profile);
}
const ui=createUI(document.querySelector<HTMLElement>('#ui-root')!,{
  command,
  settings(patch){profile.settings={...profile.settings,...patch};audio.setMuted(profile.settings.muted);audio.unlock();saveProfile(profile);ui.render(game.getState(),profile);},
  getOptions:()=>({...options}),
  setOptions(patch){options={...options,...patch};},
});
function resize(){renderer.resize(innerWidth,innerHeight,Math.min(devicePixelRatio||1,2));}
window.addEventListener('resize',resize);resize();
function loseFocus(){input.clear();gamepad.clear();touch.clear();if(game.getState().phase==='playing')command({type:'pause'});}
window.addEventListener('blur',loseFocus);
document.addEventListener('visibilitychange',()=>{if(document.hidden)loseFocus();});
window.addEventListener('pointerdown',()=>audio.unlock(),{passive:true});
window.addEventListener('keydown',event=>{
  audio.unlock();
  if(event.repeat)return;
  const state=game.getState();
  if(state.phase==='levelup' && ['Digit1','Digit2','Digit3','Numpad1','Numpad2','Numpad3'].includes(event.code)){
    const index=Number(event.code.slice(-1))-1;const choice=state.upgradeChoices[index];if(choice)command({type:'selectUpgrade',id:choice.id});
  }
});
let lastTime=performance.now(),accumulator=0,lastUI=0,simulationSteps=0,frameCount=0,pendingDash=false;
const frameTimes:number[]=[];
function menuInput(actions:readonly MenuAction[]):boolean{
  if(game.getState().phase==='playing'||!actions.length)return false;
  const buttons=Array.from(document.querySelectorAll<HTMLButtonElement>('#ui-root button:not(:disabled)')).filter(button=>button.getClientRects().length>0);
  for(const action of actions){
    if(action==='back'){
      const close=Array.from(document.querySelectorAll<HTMLButtonElement>('[data-testid="codex-close"], [data-testid="close-help"]')).find(button=>button.getClientRects().length>0);
      if(close)close.click();else if(game.getState().phase==='paused')command({type:'resume'});
      continue;
    }
    if(!buttons.length)continue;
    const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
    if(action==='confirm'){(index<0?buttons[0]:buttons[index])?.click();break;}
    const direction=action==='up'||action==='left'?-1:1;
    buttons[index<0?0:(index+direction+buttons.length)%buttons.length]?.focus({preventScroll:true});
  }
  return true;
}
function frame(time:number){
  const rawDelta=(time-lastTime)/1000,delta=Math.min(rawDelta,0.1);lastTime=time;frameCount++;
  if(frameCount>10){frameTimes.push(rawDelta*1000);if(frameTimes.length>3600)frameTimes.shift();}
  let pads:readonly (Gamepad|null)[]=[];
  try{pads=navigator.getGamepads?.()??[];}catch{/* Browsers may disable the optional gamepad capability. */}
  const pad=gamepad.readGamepad(pads);
  const menuHandled=menuInput(pad.menuPressed);
  const controls=mergeInputFrames(mergeInputFrames(input.read(),menuHandled?{moveX:0,moveY:0,dashPressed:false,pausePressed:false}:pad.frame),touch.read());
  if(controls.pausePressed){const p=game.getState().phase;if(p==='playing')command({type:'pause'});else if(p==='paused')command({type:'resume'});controls.pausePressed=false;}
  if(game.getState().phase==='playing'){
    pendingDash ||= controls.dashPressed;
    accumulator=Math.min(accumulator+delta,0.1);
    let first=true;
    while(accumulator>=1/60){game.step(1/60,{...controls,dashPressed:first&&pendingDash});pendingDash=false;first=false;accumulator-=1/60;simulationSteps++;if(game.getState().phase!=='playing'){accumulator=0;break;}}
  }else {accumulator=0;pendingDash=false;}
  const state=game.getState();
  const events=game.drainEvents();renderer.consumeEvents(events);audio.consume(events,profile.settings);
  if((state.phase==='victory'||state.phase==='defeat')&&!runSaved){
    if(state.mode!=='challenge'){
      profile.bestScore=Math.max(profile.bestScore,state.stats.score);profile.bestTime=Math.max(profile.bestTime,state.elapsed);if(state.phase==='victory')profile.wins++;saveProfile(profile);
    }
    runSaved=true;
  }
  renderer.render(state,delta,profile.settings);
  if(time-lastUI>=75 || lastPhase!==state.phase){ui.render(state,profile);touch.setEnabled(state.phase==='playing');lastUI=time;}
  if(lastPhase!==state.phase){input.clear();gamepad.clear();touch.clear();}
  lastPhase=state.phase;requestAnimationFrame(frame);
}
ui.render(game.getState(),profile);requestAnimationFrame(frame);
const observer={
  version:VERSION,
  getState:()=>structuredClone(game.getState()),
  getDiagnostics:()=>({version:VERSION,simulationSteps,frameCount,rafLoopCount:1,input:input.diagnostics(),gamepad:gamepad.diagnostics(),audio:audio.diagnostics(),frameTimes:frameTimes.slice(),viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio}}),
};
Object.defineProperty(window,'__LRG__',{value:Object.freeze(observer),writable:false});
