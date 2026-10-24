// Open Court — the signature illustration for henrikhestnes.
// One orthographic miniature: a thick slab of sand with a court painted on it,
// players, a proportioned ball, a bench with a folded jacket, and a ribbon of sea.
// Three sports share the same slab, camera and light; only surface, equipment,
// markings and ball change. Rendering is on demand: the scene is frozen unless
// something is animating.

// A classic-script bootstrap also works when index.html is opened directly.
(async () => {
const THREE = await import('https://cdnjs.cloudflare.com/ajax/libs/three.js/0.180.0/three.module.min.js');
// Stable procedural detail: screenshots and the live artwork share the same grain.
let seed = 41827;
const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };


const PAL = {
  paper: 0xF2EBDD, ink: 0x173C3A, sand: 0xD8BC8C, clay: 0xC65B3A,
  sea: 0x3F7B75, ball: 0xD8ED62, jacket: 0x2E4A5B, grass: 0x4E8A6C, edge: 0x1B4345,
};

// Court geometry in metres-ish. Length runs along z, the net sits across x at z = 0.
const COURT_W = 9, COURT_L = 18;
const SLAB_W = 12.6, SLAB_L = 22.4, SLAB_T = 1.35;
const BALL_R = 1; // Unit geometry; all states use their physically proportioned sampler radius.
const HOVER = 0.65;                 // the slab floats this far above the "paper"
const GROUND_Y = -SLAB_T - HOVER;  // where the drop shadow and the sea live

const art = document.getElementById('art');
const canvas = document.getElementById('court');
const lineSvg = document.getElementById('court-line');
const hero = document.querySelector('.hero');
const controls = document.querySelector('.art-controls');
const motion = window.CourtMotion;
let pointTick=null, pointPlaying=false;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');

let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
} catch (e) {
  art.classList.add('no-webgl');
  hero.classList.add('no-line');
  controls.classList.add('disabled');
  controls.querySelectorAll('button').forEach(b=>b.disabled=true);
  throw e;
}
renderer.setClearColor(0x000000, 0);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;

const scene = new THREE.Scene();

// ---------- Camera: orthographic, fixed angle, cropped on purpose ----------
const AZ = THREE.MathUtils.degToRad(-34);   // camera sits on the -x, +z side
const EL = THREE.MathUtils.degToRad(34);
const VIEW_H = 18;                           // world units visible vertically
const target = new THREE.Vector3(0, -0.35, 0);
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 200);
camera.position.set(
  target.x + 80 * Math.sin(AZ) * Math.cos(EL),
  target.y + 80 * Math.sin(EL),
  target.z + 80 * Math.cos(AZ) * Math.cos(EL),
);
camera.lookAt(target);

// ---------- Materials & procedural textures ----------
function noiseTexture(size, base, spread) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = base + (random() - 0.5) * spread;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 10);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}
const grain = noiseTexture(256, 235, 28);

function surfaceTexture(kind) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 1024;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#eee8da'; ctx.fillRect(0, 0, 512, 1024);
  // Surface detail is intentionally larger than single pixels so it survives the camera.
  for (let i = 0; i < 32000; i++) {
    const x = random() * 512, y = random() * 1024;
    ctx.fillStyle = random() > .5 ? 'rgba(255,255,255,.24)' : 'rgba(76,58,34,.09)';
    ctx.fillRect(x, y, 1 + random() * 2, kind === 'football' ? 5 : 1.5);
  }
  if (kind === 'football') {
    for (let i = 0; i < 10; i += 2) {
      ctx.fillStyle = 'rgba(30,65,38,.12)'; ctx.fillRect(0, i * 102.4, 512, 102.4);
    }
  } else if (kind === 'futevolei') {
    // Raked sand, interrupted by a short trail of soft footprints along the outside.
    ctx.lineWidth = 1.2;
    for (let y = 12; y < 1024; y += 13) {
      ctx.strokeStyle = 'rgba(125,98,58,.075)'; ctx.beginPath();
      ctx.moveTo(0,y); ctx.bezierCurveTo(140,y-8,320,y+8,512,y); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      ctx.save(); ctx.translate(470 + (i%2)*12, 390+i*30); ctx.rotate(-.25);
      ctx.fillStyle = 'rgba(103,74,39,.13)'; ctx.beginPath(); ctx.ellipse(0,0,3.2,8,0,0,Math.PI*2); ctx.fill(); ctx.restore();
    }
  } else {
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 2;
    for (let i=0; i<65; i++) { const y = random()*1024; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(512,y-30); ctx.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return t;
}
const surfaces = Object.fromEntries(['futevolei','tennis','football'].map(k => [k, surfaceTexture(k)]));

function netTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 64, 64);
  ctx.strokeStyle = '#234340';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(64, 0);
  ctx.moveTo(0, 0); ctx.lineTo(0, 64);
  ctx.stroke();
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(42, 6);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function ballTexture(kind) {
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  ctx.lineCap = 'round';
  if (kind === 'futevolei') {
    // Spherical red pentagons / white triangles, matching Henrik's FT-5 reference.
    // Rectify an icosahedron, then ray-project its panel planes onto the sphere.
    const ico=new THREE.IcosahedronGeometry(1,0).getAttribute('position');
    const vertices=[], faces=[];
    for(let i=0;i<ico.count;i+=3){
      const face=[];
      for(let j=0;j<3;j++){
        const v=new THREE.Vector3().fromBufferAttribute(ico,i+j);
        let n=vertices.findIndex(q=>q.distanceTo(v)<.001);
        if(n<0){n=vertices.length;vertices.push(v);}face.push(n);
      }faces.push(face);
    }
    const planes=vertices.map(v=>({normal:v.clone(),d:0,white:false}));
    for(const [a,b,c] of faces){
      const mid=vertices[a].clone().add(vertices[b]).normalize();
      planes[a].d=planes[b].d=planes[c].d=vertices[a].dot(mid);
      const normal=vertices[a].clone().add(vertices[b]).add(vertices[c]).normalize();
      planes.push({normal,d:normal.dot(mid),white:true});
    }
    const pixels=ctx.createImageData(W,H);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const theta=y/H*Math.PI,phi=x/W*Math.PI*2;
      const v=new THREE.Vector3(-Math.cos(phi)*Math.sin(theta),Math.cos(theta),Math.sin(phi)*Math.sin(theta));
      let best=-Infinity,second=-Infinity,panel;
      for(const p of planes){const score=v.dot(p.normal)/p.d;if(score>best){second=best;best=score;panel=p;}else if(score>second)second=score;}
      const edge=best-second,grain=(random()-.5)*9;
      const base=panel.white?[240,238,223]:[145,39,52];
      const shade=edge<.009?.60:edge<.018?1.11:1;
      const n=(y*W+x)*4;for(let k=0;k<3;k++)pixels.data[n+k]=base[k]*shade+grain;pixels.data[n+3]=255;
    }
    ctx.putImageData(pixels,0,0);
  } else if (kind === 'tennis') {
    ctx.fillStyle = '#D8ED62';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#F2EBDD'; ctx.lineWidth = 26;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 8) ctx.lineTo(x, H / 2 + 150 * Math.sin((x / W) * Math.PI * 2));
    ctx.stroke();
    // felt grain
    ctx.fillStyle = 'rgba(23,60,58,0.07)';
    for (let i = 0; i < 6000; i++) ctx.fillRect(random() * W, random() * H, 2, 2);
  } else {
    ctx.fillStyle = '#F2EBDD';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#173C3A';
    const pent = (cx, cy, r) => {
      ctx.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 5;
        ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a));
      }
      ctx.closePath(); ctx.fill();
    };
    for (let row = 0; row < 3; row++) {
      const y = 128 + row * 128;
      const stretch = 1 / Math.max(0.35, Math.cos(((y / H) - 0.5) * Math.PI));
      for (let col = 0; col < 5; col++) {
        const x = (col + (row % 2) * 0.5) * (W / 5);
        ctx.save(); ctx.translate(x, y); ctx.scale(stretch, 1); pent(0, 0, 44); ctx.restore();
      }
    }
    pent(W / 2, 20, 60); pent(W / 2, H - 20, 60);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

const matte = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0, ...extra });
const M = {
  surface: matte(PAL.sand, { map: surfaces.futevolei, bumpMap: grain, bumpScale: 0.025 }),
  edge: matte(PAL.edge, { roughness: 0.68 }),
  line: matte(PAL.paper, { roughness: 0.9 }),
  post: matte(PAL.clay),
  postInk: matte(PAL.ink),
  net: new THREE.MeshStandardMaterial({ map: netTexture(), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: 0xffffff }),
  band: matte(PAL.paper),
  bench: matte(PAL.ink),
  jacket: matte(PAL.jacket, { roughness: 0.95 }),
  sea: new THREE.MeshBasicMaterial({ color: PAL.sea }),
  shadow: new THREE.ShadowMaterial({ color: PAL.ink, opacity: 0.16 }),
  ball: new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0 }),
};
const ballTex = { futevolei: ballTexture('futevolei'), tennis: ballTexture('tennis'), football: ballTexture('football') };
M.ball.map = ballTex.futevolei;

// ---------- Beveled, layered miniature ----------
function roundedSlab(w, length, height, radius, material) {
  const x = w/2-radius, z = length/2-radius;
  const shape = new THREE.Shape();
  shape.moveTo(-x,-z); shape.lineTo(x,-z); shape.lineTo(x,z); shape.lineTo(-x,z); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: height-radius*2, bevelEnabled:true, bevelThickness:radius,
    bevelSize:radius, bevelSegments:4, steps:1, curveSegments:1,
  });
  geo.rotateX(-Math.PI/2); geo.translate(0,-height+radius,0);
  const mesh = new THREE.Mesh(geo,material); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}
const slab = roundedSlab(SLAB_W, SLAB_L, SLAB_T, .14, M.edge);
scene.add(slab);
// Fine warm aggregate edge between the painted base and the playing surface.
const rim = roundedSlab(SLAB_W-.06, SLAB_L-.06, .20, .045, matte(0xB29A71));
rim.position.y = .025; scene.add(rim);
const top = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W-.17,SLAB_L-.17),M.surface);
top.rotation.x = -Math.PI/2; top.position.y = .028; top.receiveShadow = true; scene.add(top);

const catcher = new THREE.Mesh(new THREE.PlaneGeometry(120,120),M.shadow);
catcher.rotation.x = -Math.PI/2; catcher.position.y=GROUND_Y; catcher.receiveShadow=true; scene.add(catcher);

// A shallow, scalloped strip of water rather than a hard graphic bar.
const waterShape = new THREE.Shape();
waterShape.moveTo(-19,-12.6); waterShape.lineTo(19,-12.6); waterShape.lineTo(19,-10.5);
waterShape.bezierCurveTo(9,-11.8,1,-9.8,-7,-10.9); waterShape.bezierCurveTo(-12,-11.6,-16,-10.8,-19,-11.1); waterShape.closePath();
const sea = new THREE.Mesh(new THREE.ShapeGeometry(waterShape,48),new THREE.MeshBasicMaterial({color:0x8FAFA2}));
sea.rotation.x=-Math.PI/2; sea.position.set(0,GROUND_Y+.02,-26);
scene.add(sea);
// The pale water silhouette stays unmarked to keep the court visually quiet.

// ---------- Court markings ----------
// Lines are thin boxes laid on the surface with a touch of hand-painted wobble.
function line(x1, z1, x2, z2, width = 0.11) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.03, width), M.line);
  m.position.set((x1 + x2) / 2 + (random() - 0.5) * 0.03, 0.05, (z1 + z2) / 2 + (random() - 0.5) * 0.03);
  m.rotation.y = -Math.atan2(dz, dx) + (random() - 0.5) * 0.004;
  m.receiveShadow = true;
  return m;
}
function ring(cx, cz, r, width = 0.11) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - width / 2, r + width / 2, 48), M.line);
  m.rotation.x = -Math.PI / 2;
  m.position.set(cx, 0.05, cz);
  m.receiveShadow = true;
  return m;
}
const hw = COURT_W / 2, hl = COURT_L / 2;

function boundary(g) {
  g.add(line(-hw, -hl, hw, -hl), line(-hw, hl, hw, hl), line(-hw, -hl, -hw, hl), line(hw, -hl, hw, hl));
}
const marks = {
  futevolei: new THREE.Group(),
  tennis: new THREE.Group(),
  football: new THREE.Group(),
};
boundary(marks.futevolei);
// Beach court has no painted halfway line beneath the net.

boundary(marks.tennis);
marks.tennis.add(
  line(-hw + 0.9, -hl, -hw + 0.9, hl, 0.08), line(hw - 0.9, -hl, hw - 0.9, hl, 0.08),  // singles sidelines
  line(-hw + 0.9, -4.6, hw - 0.9, -4.6, 0.08), line(-hw + 0.9, 4.6, hw - 0.9, 4.6, 0.08), // service lines
  line(0, -4.6, 0, 4.6, 0.08),
  line(0, -hl, 0, -hl + 0.3, 0.08), line(0, hl, 0, hl - 0.3, 0.08),
);

// One attacking third: enough space for a cross, a header and the goalkeeper.
marks.football.add(line(-hw,-6.8,hw,-6.8),line(-hw,-6.8,-hw,8),line(hw,-6.8,hw,8),line(-hw,8,hw,8));
for(const [width,front] of [[3.5,-1.3],[2.35,-4.65]]){
 marks.football.add(line(-width,-6.8,-width,front,.08),line(width,-6.8,width,front,.08),line(-width,front,width,front,.08));
}
// 11 m from the goal line within a 16.5 m-deep penalty area (IFAB Law 1).
// Preserve that ratio in this compressed attacking-third illustration.
const penaltyZ=-6.8+(-1.3-(-6.8))*(11/16.5);
const penaltySpot=new THREE.Mesh(new THREE.CircleGeometry(.095,24),M.line);
penaltySpot.rotation.x=-Math.PI/2;penaltySpot.position.set(0,.069,penaltyZ);
marks.football.add(penaltySpot);
Object.values(marks).forEach((g) => { g.visible = false; scene.add(g); });

// The court boundaries stop at their corners. The separate page rule begins
// outside the slab; no painted white line crosses the run-off area.

// A physical touchline board, rather than a caption below the artwork.
function matchBoardTexture(){
 const c=document.createElement('canvas');c.width=1536;c.height=192;
 const ctx=c.getContext('2d');ctx.fillStyle='#173C3A';ctx.fillRect(0,0,c.width,c.height);
 ctx.strokeStyle='#D8BC8C';ctx.lineWidth=4;ctx.strokeRect(6,6,1524,180);
 function norway(x){
  const y=43,w=132,h=96;ctx.fillStyle='#BA0C2F';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#fff';ctx.fillRect(x+36,y,24,h);ctx.fillRect(x,y+36,w,24);
  ctx.fillStyle='#00205B';ctx.fillRect(x+42,y,12,h);ctx.fillRect(x,y+42,w,12);
 }
 function brazil(x){
  const y=43;ctx.fillStyle='#009739';ctx.fillRect(x,y,132,96);
  ctx.fillStyle='#FFDF00';ctx.beginPath();ctx.moveTo(x+66,y+10);ctx.lineTo(x+120,y+48);ctx.lineTo(x+66,y+86);ctx.lineTo(x+12,y+48);ctx.closePath();ctx.fill();
  ctx.fillStyle='#002776';ctx.beginPath();ctx.arc(x+66,y+48,22,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#fff';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(x+46,y+42);ctx.quadraticCurveTo(x+66,y+38,x+85,y+60);ctx.stroke();
 }
 norway(65);brazil(884);
 ctx.fillStyle='#F2EBDD';ctx.font='600 76px Arial, sans-serif';ctx.textBaseline='middle';
 ctx.fillText('NORWAY',235,98);ctx.fillText('BRAZIL',1052,98);
 ctx.fillStyle='#D8BC8C';ctx.font='64px Arial, sans-serif';ctx.fillText('×',741,98);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;
 texture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());return texture;
}
const matchBoard=new THREE.Group();
const boardBack=new THREE.Mesh(new THREE.BoxGeometry(8.1,.99,.12),matte(PAL.ink));
boardBack.castShadow=true;boardBack.receiveShadow=true;matchBoard.add(boardBack);
const boardFace=new THREE.Mesh(new THREE.PlaneGeometry(8.02,.92),new THREE.MeshBasicMaterial({map:matchBoardTexture(),toneMapped:false}));
boardFace.position.z=.067;matchBoard.add(boardFace);
for(const x of [-3.3,3.3]){
 const foot=new THREE.Mesh(new THREE.BoxGeometry(.10,.20,.52),matte(PAL.ink));
 foot.position.set(x,-.53,0);foot.castShadow=true;matchBoard.add(foot);
}
matchBoard.rotation.y=-Math.PI/2;matchBoard.position.set(5.45,.64,-2.1);
matchBoard.visible=false;scene.add(matchBoard);

// ---------- Net, posts, goals ----------
const NET_H = { futevolei: 2.2, tennis: 1.0 };
const net = new THREE.Group();
const postGeo = new THREE.CylinderGeometry(0.09, 0.1, 1, 14);
const postL = new THREE.Mesh(postGeo, M.post), postR = new THREE.Mesh(postGeo, M.post);
postL.castShadow = postR.castShadow = true;
net.add(postL, postR);

const netThreads = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({color:0x39504A,transparent:true,opacity:.48}));
net.add(netThreads);
const NET_SEG = 32;
const netGeo = new THREE.PlaneGeometry(COURT_W + 0.5, 1, NET_SEG, 4);
const netMesh = new THREE.Mesh(netGeo, M.net);
netMesh.castShadow = true;
netMesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: M.net.map, alphaTest: 0.5, side: THREE.DoubleSide });
netMesh.visible=false; // Fine geometry avoids alpha-texture shimmer at small sizes.
net.add(netMesh);
const bandMesh = new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(1, 0, 0)), 1, 0.05, 6), M.band);
bandMesh.castShadow = true;
net.add(bandMesh);
scene.add(net);
// Post collars and anchored tension ropes make the model feel assembled.
const anchors=new THREE.Group();
for(const side of [-1,1]) {
 const cap=new THREE.Mesh(new THREE.CylinderGeometry(.16,.2,.10,20),M.postInk);
 cap.position.set(side*4.87,.07,0);cap.castShadow=true;anchors.add(cap);
 const rope=new THREE.Mesh(new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(side*4.87,1.85,0),new THREE.Vector3(side*5.8,.08,1.1)),1,.015,5),M.band);
 anchors.add(rope);
 const peg=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.25,8),M.postInk);peg.position.set(side*5.8,.12,1.1);anchors.add(peg);
}
scene.add(anchors);


function layoutNet(h, netDepth) {
  const span = COURT_W + 0.5, half = span / 2;
  postL.scale.y = postR.scale.y = h + 0.15;
  postL.position.set(-half - 0.12, (h + 0.15) / 2, 0);
  postR.position.set(half + 0.12, (h + 0.15) / 2, 0);
  const pos = netGeo.attributes.position;
  const sag = (x) => 0.09 * (1 - (x / half) ** 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const v = (i / (NET_SEG + 1)) | 0;            // row index, 0 = top
    const t = v / 4;
    const top = h - sag(x), bottom = h - netDepth;
    pos.setY(i, top - (top - bottom) * t);
  }
  pos.needsUpdate = true;
  netGeo.computeVertexNormals();
  const pts = [];
  for (let i = 0; i <= 24; i++) {
    const x = -half + (i / 24) * span;
    pts.push(new THREE.Vector3(x, h - sag(x), 0));
  }
  const threads=[];
  for (let i=0;i<=32;i++) {
    const x=-half+i*span/32;
    threads.push(new THREE.Vector3(x,h-sag(x),0),new THREE.Vector3(x,h-netDepth,0));
  }
  for(let row=0;row<=5;row++) {
    for(let i=0;i<24;i++) {
      const x=-half+i*span/24, next=x+span/24;
      const y=a=>(h-sag(a))*(1-row/5)+(h-netDepth)*row/5;
      threads.push(new THREE.Vector3(x,y(x),0),new THREE.Vector3(next,y(next),0));
    }
  }
  netThreads.geometry.dispose(); netThreads.geometry=new THREE.BufferGeometry().setFromPoints(threads);
  bandMesh.geometry.dispose();
  bandMesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.045, 6);
}

const goals = new THREE.Group();
function goal(zSign) {
  const g = new THREE.Group();
  const bar = new THREE.CylinderGeometry(0.07, 0.07, 1, 10);
  const mk = () => { const m = new THREE.Mesh(bar, M.line); m.castShadow = true; return m; };
  const h = 2.35, w = 4.3;
  const a = mk(); a.scale.y = h; a.position.set(-w / 2, h / 2, zSign * hl);
  const b = mk(); b.scale.y = h; b.position.set(w / 2, h / 2, zSign * hl);
  const c = mk(); c.scale.y = w + 0.14; c.rotation.z = Math.PI / 2; c.position.set(0, h, zSign * hl);
  // two slanted back supports and a thin net plane
  const bk1 = mk(), bk2 = mk();
  const depth = 0.9;
  bk1.scale.y = Math.hypot(h, depth); bk1.rotation.x = -zSign * Math.atan2(depth, h);
  bk1.position.set(-w / 2, h / 2, zSign * (hl + depth / 2));
  bk2.scale.y = Math.hypot(h, depth); bk2.rotation.x = -zSign * Math.atan2(depth, h);
  bk2.position.set(w / 2, h / 2, zSign * (hl + depth / 2));
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, Math.hypot(h, depth)), M.net);
  mesh.customDepthMaterial = netMesh.customDepthMaterial;
  mesh.rotation.x = -zSign * Math.atan2(depth, h) - Math.PI / 2 + Math.PI / 2;
  mesh.rotation.x = zSign > 0 ? -Math.atan2(depth, h) : Math.atan2(depth, h);
  mesh.position.set(0, h / 2, zSign * (hl + depth / 2));
  mesh.castShadow = true;
  const threads=[];
  for(let col=0;col<=16;col++) {
    const x=-w/2+col*w/16;
    threads.push(new THREE.Vector3(x,h,zSign*hl),new THREE.Vector3(x,0,zSign*(hl+depth)));
  }
  for(let row=0;row<=7;row++) {
    const t=row/7,y=h*(1-t),z=zSign*(hl+depth*t);
    threads.push(new THREE.Vector3(-w/2,y,z),new THREE.Vector3(w/2,y,z));
    for(const side of [-1,1]) threads.push(new THREE.Vector3(side*w/2,y,zSign*hl),new THREE.Vector3(side*w/2,y,z));
  }
  const woven=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(threads),new THREE.LineBasicMaterial({color:0xE4E2D0,transparent:true,opacity:.7}));
  g.add(a, b, c, bk1, bk2, woven);
  return g;
}
const scoringGoal=goal(-1);scoringGoal.position.z=2.2;goals.add(scoringGoal);
goals.visible = false;
scene.add(goals);

// ---------- Ball ----------
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 48, 32), M.ball);
ball.castShadow = true;

ball.rotation.set(0.6, -0.35, -0.25);
scene.add(ball);

// ---------- Bench with a folded jacket (the one cold colour on the page) ----------
const bench = new THREE.Group();
const seat = roundedSlab(1.9, .55, .12, .035, M.bench);
seat.position.y = 0.46; seat.castShadow = true; seat.receiveShadow = true;
bench.add(seat);
[[-0.72, -0.14], [0.72, -0.14], [-0.72, 0.14], [0.72, 0.14]].forEach(([x, z]) => {
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.46, 0.06), M.bench);
  leg.position.set(x, 0.23, z); leg.castShadow = true; bench.add(leg);
});
// Folded cloth has a curved edge and a sleeve falling off the seat.
const jacket = roundedSlab(.72,.46,.17,.05,M.jacket);
jacket.position.set(.35,.69,0); jacket.rotation.y=.14; bench.add(jacket);
const sleeveCurve=new THREE.CatmullRomCurve3([
 new THREE.Vector3(.15,.64,-.05),new THREE.Vector3(-.05,.59,.10),
 new THREE.Vector3(-.10,.49,.26),new THREE.Vector3(-.08,.29,.29)
]);
const sleeve=new THREE.Mesh(new THREE.TubeGeometry(sleeveCurve,16,.075,8),M.jacket);
sleeve.castShadow=true;bench.add(sleeve);
const seam=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
 new THREE.Vector3(.06,.705,-.16),new THREE.Vector3(.33,.712,-.19),new THREE.Vector3(.61,.705,-.12)
]),12,.008,4),matte(0x7D979F));bench.add(seam);
bench.position.set(hw + 1.12, 0.05, 3.4);
bench.rotation.y = Math.PI / 2;
bench.scale.setScalar(1.2);
scene.add(bench);

// Tennis is the only state with a racket; the bench and jacket stay constant.
const racket = new THREE.Group();
const hoop = new THREE.Mesh(new THREE.TorusGeometry(.42,.035,8,48),M.post);
hoop.scale.y=1.32; racket.add(hoop);
const stringMat=new THREE.LineBasicMaterial({color:0xE4D7B9,transparent:true,opacity:.8});
const stringPoints=[];
for(let i=-3;i<=3;i++) {
 const a=i*.105, b=Math.sqrt(.40*.40-a*a);
 stringPoints.push(new THREE.Vector3(a,-b*1.32,0),new THREE.Vector3(a,b*1.32,0));
 stringPoints.push(new THREE.Vector3(-b,a*1.32,0),new THREE.Vector3(b,a*1.32,0));
}
racket.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(stringPoints),stringMat));
const handle=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.6,12),M.jacket); handle.position.y=-.88; racket.add(handle);
const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.026,.026,.35,8),M.post);shaft.position.y=-.59;racket.add(shaft);
racket.rotation.set(-Math.PI/2,0,.55);racket.position.set(5.45,.10,5.5);scene.add(racket);

// ---------- Light ----------
const key = new THREE.DirectionalLight(0xFFF0D9, 3.5);
key.position.set(-10, 20, 9);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = key.shadow.camera.bottom = -20;
key.shadow.camera.right = key.shadow.camera.top = 20;
key.shadow.camera.near = 2; key.shadow.camera.far = 80;
key.shadow.radius = 4;
key.shadow.bias = -0.0006;
key.shadow.normalBias = 0.03;
scene.add(key, key.target);

const fill = new THREE.DirectionalLight(0xC7E4E6, .75);
fill.position.set(18, 6, 14);
scene.add(fill);
scene.add(new THREE.HemisphereLight(0xFFF6E4, 0x45625C, 1.05));

// ---------- Shared articulated figures, with distinct team kits ----------
const sphereGeo = new THREE.SphereGeometry(1,16,10);
const boneGeo = new THREE.CylinderGeometry(1,1,1,8);
const up = new THREE.Vector3(0,1,0);
function makeAthlete(kit, skinColor, boots=false, withRacket=false, blonde=false,shortColor=PAL.ink,sockColor=null) {
const athlete = new THREE.Group();
const skin = matte(skinColor), jersey = matte(kit), shorts = matte(shortColor), hair = matte(blonde?0xC9A76A:0x293936);
const footwear=boots?matte(PAL.paper):skin;
const lowerLeg=sockColor?matte(sockColor):skin;
function part(material,geometry=sphereGeo) {const m=new THREE.Mesh(geometry,material);m.castShadow=true;athlete.add(m);return m;}
const body=part(jersey), pelvis=part(shorts), head=part(skin), hairCap=part(hair);
const bones=[['hip','chest',.23,body],['chest','head',.085,part(skin,boneGeo)],
 ['hip','kneeL',.115,part(shorts,boneGeo)],['kneeL','ankleL',.083,part(lowerLeg,boneGeo)],
 ['hip','kneeR',.115,part(shorts,boneGeo)],['kneeR','ankleR',.083,part(lowerLeg,boneGeo)],
 ['shoulderL','elbowL',.075,part(skin,boneGeo)],['elbowL','handL',.065,part(skin,boneGeo)],
 ['shoulderR','elbowR',.075,part(skin,boneGeo)],['elbowR','handR',.065,part(skin,boneGeo)],
 ['ankleL','toeL',.105,part(footwear)],['ankleR','toeR',.105,part(footwear)]];
const joints=['kneeL','kneeR','elbowL','elbowR','handL','handR'].map(name=>[name,part(skin)]);
const heldRacket=withRacket?racket.clone():null;
if(heldRacket){heldRacket.scale.setScalar(.72);athlete.add(heldRacket);}
function poseAthlete(pose) {
 const p={...pose,shoulderL:[pose.chest[0]-.25,pose.chest[1],pose.chest[2]],shoulderR:[pose.chest[0]+.25,pose.chest[1],pose.chest[2]]};
 for(const [a,b,r,m] of bones) {
   const start=new THREE.Vector3(...p[a]),end=new THREE.Vector3(...p[b]),delta=end.clone().sub(start);
   m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(up,delta.clone().normalize());
   m.scale.set(r,delta.length()*(m.geometry===sphereGeo?.64:1),r*(m===body?.74:1));
 }
 pelvis.position.set(...p.hip);pelvis.scale.set(.29,.22,.19);
 head.position.set(...p.head);head.scale.set(.185,.22,.18);
 hairCap.position.copy(head.position).add(new THREE.Vector3(0,.10,.035));hairCap.scale.set(.19,.15,.17);
 for(const [name,m] of joints){m.position.set(...p[name]);m.scale.setScalar(name.startsWith('hand')?.073:.095);}
 if(heldRacket){const dir=new THREE.Vector3(...(pose.racketDir||[.6,.8,0])).normalize();heldRacket.position.set(...p.handR).addScaledVector(dir,.83);heldRacket.quaternion.setFromUnitVectors(up,dir);}
}
scene.add(athlete);return {group:athlete,pose:poseAthlete};
}
const teams=Object.fromEntries(Object.entries(motion.ROSTERS).map(([name,roster])=>[name,roster.map((entry,i)=>makeAthlete(
 name==='football'?(entry.keeper?0x6A8C92:entry.team===0?0xA53A43:0xECCC45):(entry.team===0?PAL.paper:0xAD4953),
 entry.scorer?0xD9A47C:[0xB87550,0x734B37,0xD9A47C,0x925F43][i%4],name!=='futevolei',name==='tennis',entry.scorer,
 name==='football'?(entry.team===0?PAL.paper:0x224D93):PAL.ink,name==='football'?(entry.team===0?0xA53A43:PAL.paper):null
))]));
function poseTeam(name,poses){teams[name].forEach((player,i)=>player.pose(poses[i]));}
function paintPoint(progress){
 const sample=motion.sampleGame(sport,progress);
 poseTeam(sport,sample.poses);ball.position.set(...sample.ball);ball.scale.setScalar(sample.radius);
 ball.rotation.set(progress*5,progress*8,.3);
}
// ---------- Sport states ----------
const SPORTS = {
  futevolei: { surface: PAL.sand, net: true, netH: NET_H.futevolei, netDepth: 1.0, post: M.post, goals: false, ballTex: 'futevolei' },
  tennis: { surface: PAL.clay, net: true, netH: NET_H.tennis, netDepth: 0.95, post: M.postInk, goals: false, ballTex: 'tennis' },
  football: { surface: PAL.grass, net: false, netH: 0, netDepth: 0, post: M.postInk, goals: true, ballTex: 'football' },
};
let sport = 'futevolei';
function applySport(name) {
  const s = SPORTS[name];
  M.surface.color.setHex(s.surface);
  M.surface.map=surfaces[name]; M.surface.needsUpdate=true;
  Object.entries(marks).forEach(([k, g]) => { g.visible = k === name; });
  matchBoard.visible = name === 'football';
  net.visible = s.net;
  anchors.visible = name === 'futevolei';
  if (s.net) { postL.material = postR.material = s.post; layoutNet(s.netH, s.netDepth); }
  goals.visible = s.goals;
  racket.visible = name === 'tennis';
  Object.entries(teams).forEach(([key,players])=>players.forEach(p=>p.group.visible=key===name));
  M.ball.map = ballTex[s.ballTex];
  M.ball.needsUpdate = true;
  sport = name;
  controls.querySelectorAll('button[data-sport]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.sport===name)));
  art.setAttribute('aria-label', motion.ACTIONS[name]+'. '+{
    futevolei:'A miniature doubles futevôlei court with four players and a burgundy-and-white panel ball.',
    tennis:'A miniature clay tennis court with two singles players, held rackets and a lime felt ball.',
    football:'Norway versus Brazil, with a pitch-side match banner, a crosser, Haaland, two defenders and one goalkeeper.'
  }[name]);
  paintPoint(0);

}
const initialSport = new URLSearchParams(location.search).get('sport');
applySport(SPORTS[initialSport] ? initialSport : 'futevolei');
controls.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sport === sport)));

// ---------- Resize & projection ----------
let W = 1, H = 1;
function resize() {
  const w = art.clientWidth, h = art.clientHeight;
  if (!w || !h) return;
  W = w; H = h;
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  const aspect = w / h;
  // On narrow screens widen the view a little so the ball and both posts stay in frame.
  const narrow = hero.clientWidth <= 860;
  const restingView = narrow ? 16.8 / aspect : Math.max(VIEW_H, 23 / aspect);
  const viewH=restingView;
  const look=target;
  camera.position.set(look.x+80*Math.sin(AZ)*Math.cos(EL),look.y+80*Math.sin(EL),look.z+80*Math.cos(AZ)*Math.cos(EL));
  camera.lookAt(look);
  camera.left = -viewH * aspect / 2; camera.right = viewH * aspect / 2;
  camera.top = viewH / 2; camera.bottom = -viewH / 2;
  camera.updateProjectionMatrix();
  drawLine();
  requestRender();
}

// Project a world point into page coordinates relative to the hero section.
const _v = new THREE.Vector3();
function toHero(x, y, z) {
  _v.set(x, y, z).project(camera);
  const r = art.getBoundingClientRect(), hr = hero.getBoundingClientRect();
  return { x: r.left - hr.left + ((_v.x + 1) / 2) * r.width, y: r.top - hr.top + ((1 - _v.y) / 2) * r.height };
}

// A separate ink rule leaves the slab edge and joins the lower hero divider.
function drawLine() {
 if(!lineSvg)return;
 const ruleY=hero.clientHeight-1;
 hero.style.setProperty('--art-rule-y',`${ruleY}px`);
 hero.style.setProperty('--art-rule-left','0px');
 if(hero.clientWidth<=860){
  lineSvg.classList.add('hidden');hero.classList.add('no-line');return;
 }
 const nearZ=sport==='football'?8:hl;
 const B=toHero(-SLAB_W/2-.16,-SLAB_T,nearZ),A=toHero(-hw,-SLAB_T,nearZ);
 const dx=B.x-A.x,dy=B.y-A.y;
 if(dy<=0||B.y>=ruleY){lineSvg.classList.add('hidden');hero.classList.add('no-line');return;}
 const distance=(ruleY-B.y)/dy,elbowX=B.x+dx*distance;
 const f=n=>n.toFixed(2);
 lineSvg.setAttribute('viewBox',`0 0 ${hero.clientWidth} ${hero.clientHeight}`);
 lineSvg.innerHTML=`<path d="M ${f(B.x)} ${f(B.y)} L ${f(elbowX)} ${f(ruleY)} M 0 ${f(ruleY)} H ${hero.clientWidth}"/>`;
 lineSvg.classList.remove('hidden');hero.classList.remove('no-line');
}

// ---------- Render on demand ----------
let renderQueued = false;
let visible = true;
let contextLost = false;
const anims = new Set();
function requestRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(frame);
}
function frame(now) {
  renderQueued = false;
  if (!visible || document.hidden || contextLost) return;
  for (const a of anims) { if (a(now) === false) anims.delete(a); }
  renderer.render(scene, camera);
  if (!art.classList.contains('is-live')) {
    art.classList.add('is-live');
    art.querySelector('.poster')?.setAttribute('aria-hidden','true');
    // The art wrapper supplies one accessible description; both render layers stay decorative.
    controls.querySelectorAll('button[data-sport]').forEach(b=>b.disabled=false);
    art.setAttribute('aria-disabled','false');art.tabIndex=0;
  }
  if (anims.size) requestRender();
}
function animate(fn) { anims.add(fn); requestRender(); }

new IntersectionObserver((entries) => {
  visible = entries[0].isIntersecting;
  if (visible) requestRender(); else resetPoint();
}, { threshold: 0.01 }).observe(art);

new ResizeObserver(resize).observe(art);
addEventListener('resize', drawLine);
document.fonts?.ready.then(drawLine);

document.addEventListener('visibilitychange', () => { if (!document.hidden) requestRender(); else resetPoint(); });
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  contextLost = true;
  stopPoint();
  art.setAttribute('aria-label','A still illustration of the futevôlei court. Live graphics are temporarily unavailable.');
  canvas.setAttribute('aria-hidden','true');
  document.querySelectorAll('.art-controls button').forEach(b=>b.disabled=true);
  art.setAttribute('aria-disabled','true');art.tabIndex=-1;
  art.classList.remove('is-live');
});
canvas.addEventListener('webglcontextrestored', () => {
 contextLost=false;applySport(sport);requestRender();
});

// ---------- A court is the control: one tap, one complete point ----------
function stopPoint(){
 if(pointTick)anims.delete(pointTick);
 pointTick=null;pointPlaying=false;art.removeAttribute('data-playing');
}
// Abandoned or dismissed actions return to the resting pose, including the reduced-motion contact still.
function resetPoint(){ stopPoint(); paintPoint(0); requestRender(); }
function playPoint(){
 if(contextLost||!art.classList.contains('is-live'))return;
 stopPoint();
 if(reduceMotion.matches){paintPoint(motion.sampleGame(sport,0).strike);requestRender();return;}
 paintPoint(0);pointPlaying=true;art.setAttribute('data-playing','true');
 let last=null,elapsed=0;
 pointTick=(now)=>{
   if(last!==null)elapsed+=Math.min(now-last,80);
   last=now;
   const progress=Math.min(1,elapsed/motion.DURATIONS[sport]);
   paintPoint(progress);
   if(progress===1){pointPlaying=false;pointTick=null;art.removeAttribute('data-playing');return false;}
   return true;
 };
 animate(pointTick);
}
let downAt=null,suppressClick=false;
art.addEventListener('pointerdown',e=>{downAt={x:e.clientX,y:e.clientY};suppressClick=false;});
art.addEventListener('pointercancel',()=>{downAt=null;suppressClick=true;});
art.addEventListener('pointerup',e=>{
 if(!downAt)return;
 suppressClick=Math.hypot(e.clientX-downAt.x,e.clientY-downAt.y)>10;downAt=null;
});
art.addEventListener('click',()=>{if(!suppressClick)playPoint();suppressClick=false;});
art.addEventListener('keydown',e=>{
 if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)playPoint();}
 if(e.key==='Escape')resetPoint();
});
function changeSport(name){
 if(!SPORTS[name])return;
 stopPoint();anims.clear();
 // Commit the entire selection synchronously; tapping immediately cannot start the previous sport.
 applySport(name);drawLine();requestRender();
}
controls.addEventListener('click',e=>{
 const button=e.target.closest('button[data-sport]');
 if(button&&!button.disabled)changeSport(button.dataset.sport);
});
reduceMotion.addEventListener('change',()=>{stopPoint();paintPoint(0);requestRender();});

// Artwork export is exposed only by the local tools/artwork.html utility.
canvas.addEventListener('court:export',()=>{
  renderer.render(scene,camera);
  const composite=document.createElement('canvas');composite.width=1200;composite.height=Math.round(1200*canvas.height/canvas.width);
  const ctx=composite.getContext('2d');ctx.fillStyle='#F2EBDD';ctx.fillRect(0,0,composite.width,composite.height);ctx.drawImage(canvas,0,0,composite.width,composite.height);
  const a=document.createElement('a');a.download=`court-${sport}.jpg`;a.href=composite.toDataURL('image/jpeg',.82);a.click();
});
resize();

})().catch(error => {
  console.warn('Court illustration unavailable; keeping the still artwork.', error);
  document.getElementById('art').classList.add('no-webgl');
  document.querySelector('.hero').classList.add('no-line');
  document.querySelectorAll('.art-controls button').forEach(b=>b.disabled=true);
  const fallback=document.getElementById('art');fallback.setAttribute('aria-disabled','true');fallback.tabIndex=-1;
});
