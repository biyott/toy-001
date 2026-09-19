// Normal-input test player: observes geometry, chooses one of eight keyboard directions.
// No state writes, timing changes, stat changes, or game commands.
const length=(x,y)=>Math.hypot(x,y);
const distance=(a,b)=>length(a.x-b.x,a.y-b.y);
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function inside(zone,x,y,padding=22){
 const dx=x-zone.x,dy=y-zone.y,d=length(dx,dy);
 if(zone.shape==='circle')return d<zone.radius+padding;
 if(zone.shape==='ring')return d<zone.radius+padding&&d>(zone.innerRadius||0)-padding;
 if(zone.shape==='line'){const along=dx*Math.cos(zone.angle)+dy*Math.sin(zone.angle),cross=-dx*Math.sin(zone.angle)+dy*Math.cos(zone.angle);return along>-padding&&along<(zone.length||zone.radius)+padding&&Math.abs(cross)<(zone.width||24)/2+padding;}
 const a=Math.atan2(Math.sin(Math.atan2(dy,dx)-zone.angle),Math.cos(Math.atan2(dy,dx)-zone.angle));return d<zone.radius+padding&&Math.abs(a)<(zone.width||1.6)/2+.2;
}
function projectileSeparation(projectile,p,vx,vy,horizon){
 const dx=projectile.x-p.x,dy=projectile.y-p.y,rvx=projectile.vx-vx,rvy=projectile.vy-vy;
 const speed2=rvx*rvx+rvy*rvy,t=speed2>0?clamp(-(dx*rvx+dy*rvy)/speed2,0,horizon):0;
 return length(dx+rvx*t,dy+rvy*t);
}
export function steer(state,previous={x:0,y:0}){
 const p=state.player;
 const accessible=t=>Math.abs(t.x)<800&&t.y>-370&&t.y<510&&!state.props.some(o=>o.solid&&distance(t,o)<o.radius+p.radius+3);
 const loot=state.pickups.filter(accessible);
 const heal=loot.filter(a=>a.kind==='heal').sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const gem=loot.filter(a=>a.kind==='xp').sort((a,b)=>distance(a,p)-distance(b,p))[0];
 const boss=state.enemies.find(e=>e.boss);
 let target=p.hp<p.maxHp*.8&&heal?heal:gem;
 if(boss&&(!target||distance(target,p)>120)&&distance(boss,p)>135)target=boss;
 target??={x:Math.cos(state.elapsed*.045)*250,y:Math.sin(state.elapsed*.045)*180};
 let best={x:0,y:0,score:-Infinity};
 for(let i=0;i<8;i++){
  const angle=i*Math.PI/4,x=Math.cos(angle),y=Math.sin(angle),horizon=.36;
  const end={x:p.x+x*p.speed*horizon,y:p.y+y*p.speed*horizon};
  let score=(distance(p,target)-distance(end,target))*.55+(x*previous.x+y*previous.y)*2;
  // Keep the deliberate test route inside the open courtyard; walls remain real collision.
  score-=Math.max(0,Math.abs(end.x)-780)*1.5+Math.max(0,-365-end.y)*1.5+Math.max(0,end.y-500)*1.5;
  for(const prop of state.props){if(!prop.solid)continue;
   const start=distance(p,prop),finish=distance(end,prop),safe=prop.radius+p.radius+9;
   const dx=end.x-p.x,dy=end.y-p.y,t=clamp(((prop.x-p.x)*dx+(prop.y-p.y)*dy)/(dx*dx+dy*dy),0,1);
   const closest=length(p.x+dx*t-prop.x,p.y+dy*t-prop.y);
   if(closest<safe&&finish<start+8)score-=100+(safe-closest)*4;
  }
  for(const enemy of state.enemies){
   const d=distance(p,enemy);if(d>210)continue;
   const next={x:enemy.x+(p.x-enemy.x)/Math.max(1,d)*enemy.speed*horizon,y:enemy.y+(p.y-enemy.y)/Math.max(1,d)*enemy.speed*horizon};
   const separation=distance(end,next),safe=enemy.radius+p.radius+20;
   if(separation<safe)score-=150+(safe-separation)*4;
   else if(separation<100)score-=(100-separation)*.65;
  }
  for(const projectile of state.projectiles){
   if(projectile.owner!=='enemy'||distance(projectile,p)>300)continue;
   const separation=projectileSeparation(projectile,p,x*p.speed,y*p.speed,.5),safe=projectile.radius+p.radius+12;
   if(separation<safe)score-=260+(safe-separation)*5;
   else if(separation<60)score-=(60-separation)*1.2;
  }
  for(const zone of state.zones){if(zone.owner!=='enemy')continue;if(inside(zone,end.x,end.y))score-=220;if(inside(zone,p.x,p.y)&&!inside(zone,end.x,end.y))score+=80;}
  if(score>best.score)best={x,y,score};
 }
 const near=state.enemies.some(e=>distance(p,e)<e.radius+p.radius+30);
 const danger=state.zones.some(z=>z.owner==='enemy'&&z.telegraph<.4&&inside(z,p.x,p.y));
 const incoming=state.projectiles.some(q=>q.owner==='enemy'&&projectileSeparation(q,p,best.x*p.speed,best.y*p.speed,.22)<q.radius+p.radius+6);
 return{moveX:Math.abs(best.x)<.1?0:Math.sign(best.x),moveY:Math.abs(best.y)<.1?0:Math.sign(best.y),dashPressed:p.dashCooldown<=0&&(near||danger||incoming),pausePressed:false,target:{x:target.x,y:target.y}};
}
