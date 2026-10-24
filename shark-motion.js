// Authored key poses for a stylized footvolley shark attack.
// Pure sampling keeps playback, scrubbing and reduced-motion stills identical.
(function(root) {
  const RADIUS = .20, CONTACT = .55, IMPACT = .76;
  const lerp = (a,b,t) => a.map((v,i)=>v+(b[i]-v)*t);
  const smooth = t => t*t*(3-2*t);
  function standing(z=3.1, dip=0) {
    return {hip:[-1,1.08-dip,z],chest:[-1,1.65-dip,z-.08],head:[-1,2.04-dip,z-.08],
      kneeL:[-1.20,.60-dip*.5,z-.12],ankleL:[-1.25,.13,z-.24],toeL:[-1.25,.09,z-.52],
      kneeR:[-.78,.59-dip*.5,z+.16],ankleR:[-.75,.13,z+.32],toeR:[-.75,.09,z+.04],
      elbowL:[-1.49,1.30-dip,z+.08],handL:[-1.55,1.04-dip,z-.14],
      elbowR:[-.51,1.30-dip,z+.08],handR:[-.45,1.04-dip,z-.14]};
  }
  const ready=standing(), approach=standing(1.4,.12), crouch=standing(1.1,.38);
  crouch.chest=[-1,1.25,1.0];crouch.head=[-1,1.63,.87];
  crouch.kneeL=[-1.22,.45,.70];crouch.kneeR=[-.78,.46,.92];
  crouch.handL=[-1.5,1.1,1.9];crouch.handR=[-.5,1.1,1.9];
  const leap={hip:[-1,1.83,1.15],chest:[-1.22,2.23,1.45],head:[-1.35,2.57,1.62],
    kneeL:[-1,2.43,.95],ankleL:[-.80,2.93,.65],toeL:[-.80,2.88,.35],
    kneeR:[-.50,1.64,1.25],ankleR:[-.12,1.30,1.6],toeR:[-.12,1.26,1.3],
    elbowL:[-1.80,2.27,1.5],handL:[-2.16,2.10,1.6],elbowR:[-.5,2.28,1.6],handR:[-.06,2.17,1.7]};
  const strike={hip:[-1,2.22,1.10],chest:[-1.36,1.67,1.45],head:[-1.55,1.31,1.65],
    kneeL:[-.86,2.88,.9],ankleL:[-.60,3.60,.8],toeL:[-.60,3.52,.24],
    kneeR:[-.42,2.10,1.28],ankleR:[-.02,2.42,1.60],toeR:[.04,2.45,1.30],
    elbowL:[-1.94,1.83,1.6],handL:[-2.25,2.10,1.7],elbowR:[-.73,1.62,1.75],handR:[-.26,1.48,1.97]};
  const recover={hip:[-1,1.55,1.5],chest:[-1.19,1.97,1.55],head:[-1.26,2.35,1.59],
    kneeL:[-1.30,.98,1.3],ankleL:[-1.45,.48,1.2],toeL:[-1.45,.42,.92],
    kneeR:[-.62,1.02,1.8],ankleR:[-.55,.50,2.04],toeR:[-.55,.44,1.76],
    elbowL:[-1.8,1.72,1.5],handL:[-2,1.32,1.5],elbowR:[-.55,1.69,1.7],handR:[-.27,1.29,1.8]};
  const frames=[[0,ready],[.18,approach],[.30,crouch],[.43,leap],[CONTACT,strike],[.70,recover],[.84,standing(1.5,.30)],[1,standing(1.5)]];
  // Sole midpoint minus the ball radius: exact, testable contact at the strike frame.
  const contact=[-.60,3.46-RADIUS,.52], start=[2.7,.23,4.65], landing=[1.4,RADIUS+.03,-5.4];
  function sample(progress) {
    const t=Math.max(0,Math.min(1,progress));
    let i=0;while(i<frames.length-2&&t>frames[i+1][0])i++;
    const [ta,a]=frames[i],[tb,b]=frames[i+1],u=smooth((t-ta)/(tb-ta));
    const pose=Object.fromEntries(Object.keys(a).map(k=>[k,lerp(a[k],b[k],u)]));
    let ball;
    if(t<=CONTACT) {const q=t/CONTACT;ball=lerp(start,contact,q);ball[1]+=Math.sin(q*Math.PI)*2.0;}
    else if(t<=IMPACT) {const q=(t-CONTACT)/(IMPACT-CONTACT);ball=lerp(contact,landing,q);ball[1]+=.18*Math.sin(q*Math.PI);}
    else {const q=(t-IMPACT)/(1-IMPACT);ball=lerp(landing,[1.8,RADIUS+.03,-6.4],q);ball[1]+=.8*Math.sin(Math.PI*q)*(1-q);}
    return {pose,ball,phase:t<.30?'Set':t<.50?'Takeoff':t<.60?'Shark attack':t<.84?'Over the net':'Landed',contact:Math.max(0,1-Math.abs(t-CONTACT)/.045),dust:Math.max(0,1-Math.abs(t-.84)/.10)};
  }
  // Every game uses the same figure rig; these are illustrative sequences, not motion capture.
  const ACTIONS={futevolei:'Play the futevôlei point',tennis:'Play the tennis serve',football:'Play Haaland’s header'};
  const DURATIONS={futevolei:4400,tennis:3800,football:4600};
  const ROSTERS={
    futevolei:[{x:-1,z:3.1,team:0},{x:2.7,z:5.5,team:0},{x:-2.4,z:-4.4,team:1},{x:2.4,z:-5.3,team:1}],
    tennis:[{x:-2,z:9.75,team:0},{x:2,z:-7.8,team:1}],
    // A cropped scoring moment, not a compressed full-team formation.
    football:[{x:-4.1,z:-2.6,team:0,turn:-Math.PI/2},{x:-.7,z:-1.7,team:0,scorer:true},
      {x:.8,z:-2.9,team:1},{x:-2.2,z:-4.8,team:1},{x:.1,z:-6,team:1,keeper:true}]
  };
  function worldPose(p,x,z,scale=1,turn=0){
    const c=Math.cos(turn),s=Math.sin(turn);
    return Object.fromEntries(Object.entries(p).map(([k,v])=>{
      const a=(v[0]+1)*scale,b=(v[2]-3.1)*scale;
      return [k,[x+a*c+b*s,v[1]*scale,z-a*s+b*c]];
    }));
  }
  function blend(a,b,t){return Object.fromEntries(Object.keys(a).map(k=>[k,lerp(a[k],b[k],smooth(Math.max(0,Math.min(1,t))))]));}
  function keyPose(frames,t){let i=0;while(i<frames.length-2&&t>frames[i+1][0])i++;return blend(frames[i][1],frames[i+1][1],(t-frames[i][0])/(frames[i+1][0]-frames[i][0]));}
  function arc(a,b,t,h){const v=lerp(a,b,Math.max(0,Math.min(1,t)));v[1]+=Math.sin(Math.PI*Math.max(0,Math.min(1,t)))*h;return v;}
  function sampleGame(name,progress){
    const t=Math.max(0,Math.min(1,progress));
    const roster=ROSTERS[name],scale=1;
    const poses=roster.map(e=>worldPose(standing(),e.x,e.z,scale,e.turn??(e.team?Math.PI:0)));
    if(name==='futevolei'){
      const s=sample(t);poses[0]=s.pose;
      // Partner sets up behind the attacker; both defenders read the incoming ball.
      for(let i=1;i<4;i++){
        const e=roster[i],shift=i===1?-.30*Math.sin(t*Math.PI):.32*Math.sin(t*Math.PI);
        poses[i]=worldPose(standing(3.1,.12*Math.sin(t*Math.PI)),e.x+shift,e.z+(i>1?.45*Math.sin(t*Math.PI):0),1,e.team?Math.PI:0);
      }
      return {...s,poses,radius:RADIUS,strike:CONTACT};
    }
    if(name==='tennis'){
      const ready=poses[0],toss=structuredClone(ready),serve=structuredClone(ready),finish=structuredClone(ready);
      // Both planted feet remain behind z=9 until the ball leaves the racket.
      toss.elbowL=[-2.35,2.0,9.6];toss.handL=[-2.3,2.55,9.45];toss.elbowR=[-1.5,1.95,9.95];toss.handR=[-1.6,2.25,9.85];
      serve.elbowR=[-1.65,2.0,9.45];serve.handR=[-1.8,2.55,9.3];serve.elbowL=[-2.45,1.5,9.55];serve.handL=[-2.6,1.1,9.25];
      finish.elbowR=[-2.1,1.55,9];finish.handR=[-2.5,1.1,8.75];
      poses[0]=keyPose([[0,ready],[.2,toss],[.36,serve],[.52,finish],[1,ready]],t);
      const angle=t<=.36?Math.max(0,1-t/.36)*.7:Math.min(1,(t-.36)/.2)*2.1;
      poses[0].racketDir=[Math.sin(angle)*.2,Math.cos(angle),-Math.sin(angle)];
      poses[1].racketDir=[-.6,.8,0];
      const hit=[-1.8,3.38,9.3],bounce=[1.4,.105,-3.8];
      const ball=t<.36?arc([-2.3,1.5,9.45],hit,t/.36,1.3):t<.75?arc(hit,bounce,(t-.36)/.39,.35):arc(bounce,[2.5,.105,-8.2],(t-.75)/.25,.9);
      poses[1]=Object.fromEntries(Object.entries(poses[1]).map(([k,v])=>[k,k==='racketDir'?v:[v[0]+.4*Math.sin(t*Math.PI),v[1],v[2]]]));
      return {poses,ball,radius:.075,strike:.36,contact:0,dust:0,phase:t<.2?'Toss':t<.4?'Serve':t<.75?'Over the net':'Ace'};
    }
    // Haaland's first goal against Brazil, 5 July 2026: left-wing cross, rising header, low finish.
    // A five-figure vignette of the moment; positions are composed for the miniature.
    const ready=poses[1],run=worldPose(standing(3.1,.12),-.45,-2.8),jump=worldPose(standing(),-.35,-3.3);
    for(const v of Object.values(jump))v[1]+=.65;
    jump.chest=[-.35,2.30,-3.50];jump.head=[-.35,2.69,-3.72];
    jump.elbowL=[-.95,2.05,-3.25];jump.handL=[-1.18,1.91,-3.40];
    jump.elbowR=[.25,2.10,-3.20];jump.handR=[.45,1.95,-3.35];
    const landing=worldPose(standing(3.1,.25),-.2,-3.8),settled=worldPose(standing(),-.2,-3.8);
    poses[1]=keyPose([[0,ready],[.28,run],[.52,jump],[.70,landing],[1,settled]],t);
    // The crosser follows through; a marker jumps late, leaving a readable heading silhouette.
    const swing=Math.sin(Math.PI*Math.min(t/.35,1));
    poses[0].ankleR=[-4.42+.65*swing,.13+.45*swing,-2.35];poses[0].toeR=[-4.14+.65*swing,.09+.45*swing,-2.35];
    poses[2]=worldPose(standing(),.9,-3.05-.65*smooth(t));
    const leap=.32*Math.sin(Math.PI*Math.max(0,Math.min(1,(t-.32)/.40)));
    for(const v of Object.values(poses[2]))v[1]+=leap;
    poses[3]=worldPose(standing(),-2.2+.25*smooth(t),-4.8-.35*smooth(t));
    const keeperReady=poses[4],dive=structuredClone(keeperReady);
    Object.assign(dive,{hip:[.95,.72,-6.05],chest:[1.27,.95,-6.08],head:[1.52,1.12,-6.12],
      kneeL:[.45,.42,-6],ankleL:[.05,.15,-5.9],toeL:[.05,.10,-5.62],kneeR:[.7,.22,-5.7],ankleR:[.35,.13,-5.35],toeR:[.35,.09,-5.07],
      elbowL:[1.65,.77,-6.25],handL:[1.92,.52,-6.4],elbowR:[1.75,1.05,-6.3],handR:[2.05,.82,-6.45]});
    poses[4]=keyPose([[0,keeperReady],[.52,keeperReady],[.81,dive],[1,dive]],t);
    const start=[-3.88,.23,-2.35],hit=[-.35,2.69,-4.08],goal=[1.45,.30,-7.05];
    const ball=t<=.52?arc(start,hit,t/.52,1.35):t<=.84?arc(hit,goal,(t-.52)/.32,.06):arc(goal,[1.5,.21,-7.5],(t-.84)/.16,.18);
    return {poses,ball,radius:.18,strike:.52,contact:0,dust:0,phase:t<.3?'Cross':t<.55?'Header':t<.84?'Toward goal':'Goal'};
  }
  const api=Object.freeze({sample,sampleGame,ROSTERS,ACTIONS,DURATIONS,RADIUS,CONTACT,IMPACT});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.CourtMotion=api;
})(typeof globalThis!=='undefined'?globalThis:this);
