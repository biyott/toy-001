import type { GameEvent, Settings } from './types';

export function createAudio() {
  let context: AudioContext | null = null, master: GainNode | null = null;
  let muted = false, lastHit = 0, lastPickup = 0;
  const voices = new Set<OscillatorNode>();
  function unlock() {
    if (!context) {
      try { context = new AudioContext();master=context.createGain();master.gain.value=muted?0:0.22;master.connect(context.destination); }
      catch { return; }
    }
    if(context.state==='suspended') void context.resume().catch(()=>{});
  }
  function tone(frequency:number,duration:number,type:OscillatorType='sine',volume=0.3,offset=0,endFrequency?:number) {
    if(!context || !master || muted || voices.size>24 || context.state!=='running')return;
    const start=context.currentTime+offset;
    const osc=context.createOscillator(),gain=context.createGain();osc.type=type;
    osc.frequency.setValueAtTime(frequency,start);
    if(endFrequency)osc.frequency.exponentialRampToValueAtTime(endFrequency,start+duration);
    gain.gain.setValueAtTime(0.001,start);gain.gain.exponentialRampToValueAtTime(volume,start+0.008);gain.gain.exponentialRampToValueAtTime(0.001,start+duration);
    osc.connect(gain);gain.connect(master);voices.add(osc);
    osc.onended=()=>{voices.delete(osc);osc.disconnect();gain.disconnect();};osc.start(start);osc.stop(start+duration+0.01);
  }
  return {
    unlock,
    setMuted(value:boolean){muted=value;if(master&&context)master.gain.setTargetAtTime(value?0:0.22,context.currentTime,0.025);},
    consume(events: readonly GameEvent[],settings:Settings) {
      this.setMuted(settings.muted);if(!context)return;
      for(const event of events){
        const now=context.currentTime;
        switch(event.type){
          case 'attack': if(now-lastHit>0.075){tone(event.weapon==='sword'?300:620,0.09,'triangle',0.15,0,event.weapon==='sword'?80:900);lastHit=now;}break;
          case 'hit': if(event.kind==='player'){tone(180,0.18,'triangle',0.3,0,70);}else if(now-lastHit>0.09){tone(370,0.065,'triangle',0.12,0,120);lastHit=now;}break;
          case 'pickup': if(now-lastPickup>0.07){tone(900,0.07,'sine',0.15,0,1250);lastPickup=now;}break;
          case 'dash':tone(160,0.16,'triangle',0.18,0,600);break;
          case 'levelup':case 'upgrade':[523,659,784,1047].forEach((n,i)=>tone(n,0.27,'sine',0.24,i*0.07));break;
          case 'boss':[147,175,220].forEach((n,i)=>tone(n,0.48,'triangle',0.24,i*0.14));break;
          case 'victory':[523,659,784,1047,1319].forEach((n,i)=>tone(n,0.5,'sine',0.23,i*0.13));break;
          case 'defeat':[330,294,220,165].forEach((n,i)=>tone(n,0.38,'triangle',0.2,i*0.14));break;
          case 'heal':tone(740,0.3,'sine',0.23,0,1100);break;
        }
      }
    },
    diagnostics:()=>({state:context?.state??'locked',muted,voices:voices.size}),
    dispose(){for(const voice of voices){try{voice.stop();}catch{}}voices.clear();void context?.close().catch(()=>{});context=null;master=null;},
  };
}
