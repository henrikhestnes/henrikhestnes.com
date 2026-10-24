const assert = require('node:assert/strict');
const motion = require('../shark-motion.js');

for (const [name,count] of [['futevolei',4],['tennis',2],['football',5]]) {
  assert.equal(motion.ROSTERS[name].length,count);
  for(let i=0;i<=1000;i++){
    const sample=motion.sampleGame(name,i/1000);
    assert.equal(sample.poses.length,count);
    assert(sample.ball.every(Number.isFinite));
    assert(sample.ball[1]>=sample.radius,`${name}: ball cannot enter ground`);
    for(const pose of sample.poses)for(const point of Object.values(pose))assert(point.every(Number.isFinite));
    // Ball proportions should stay constant from rest through contact and landing.
    assert.equal(sample.radius,motion.sampleGame(name,0).radius);
  }
  assert(motion.DURATIONS[name]<5000,'Each requested sequence ends within five seconds.');
}
const strike=motion.sample(motion.CONTACT);
assert(Math.abs(strike.ball[1]+motion.RADIUS-3.46)<1e-9,'Sole meets top of ball.');
assert(strike.pose.ankleL[1]>strike.pose.head[1]);
for(let i=550;i<=760;i++){
 const ball=motion.sample(i/1000).ball;
 if(Math.abs(ball[2])<.04)assert(ball[1]-motion.RADIUS>2.2,'Attack clears net.');
}
for(const t of [.18,.30,.43,motion.CONTACT,.70,motion.IMPACT,.84]){
 const a=motion.sample(t-1e-6),b=motion.sample(t+1e-6);
 for(const k of Object.keys(a.pose))assert(Math.hypot(...a.pose[k].map((v,i)=>v-b.pose[k][i]))<.001);
 assert(Math.hypot(...a.ball.map((v,i)=>v-b.ball[i]))<.001);
}
for(let i=0;i<=360;i++){
 const pose=motion.sampleGame('tennis',i/1000).poses[0];
 for(const foot of ['ankleL','ankleR','toeL','toeR'])assert(pose[foot][2]>9.05,'Server cannot touch or cross the baseline before contact.');
}
const serve=motion.sampleGame('tennis',.36);
assert(Math.hypot(...serve.ball.map((v,i)=>v-serve.poses[0].handR[i]-(i===1?.83:0)))<1e-9,'Racket centre meets serve.');
const header=motion.sampleGame('football',.52);
assert(Math.abs(Math.hypot(...header.ball.map((v,i)=>v-header.poses[1].head[i]))-(.18+header.radius))<1e-9,'Head surface meets ball surface.');
assert(header.poses[1].head[1]>motion.sampleGame('football',0).poses[1].head[1],'Haaland rises to head.');
const goal=motion.sampleGame('football',.84);
assert(goal.ball[2]<-6.8&&Math.abs(goal.ball[0])+goal.radius<2.15&&goal.ball[1]+goal.radius<2.35,'Header enters the goal mouth.');
// No teleports across any action's trajectory/pose transitions.
for(const name of ['tennis','football'])for(const t of [.2,.28,.30,.35,.36,.52,.55,.70,.75,.81,.84]){
 const a=motion.sampleGame(name,t-1e-6),b=motion.sampleGame(name,t+1e-6);
 assert(Math.hypot(...a.ball.map((v,i)=>v-b.ball[i]))<.001);
 a.poses.forEach((p,j)=>Object.keys(p).forEach(k=>assert(Math.hypot(...p[k].map((v,i)=>v-b.poses[j][k][i]))<.001)));
}
console.log('Pass: rosters, constant ball scale, finite/continuous motion, ground/net clearance, legal serve stance, sole/racket/head contact and goal mouth.');
const crossStart=motion.sampleGame('football',0).ball;
assert(Math.abs(header.ball[0]-crossStart[0])>Math.abs(header.ball[2]-crossStart[2]),'The cross travels predominantly sideways from the touchline.');
