import * as THREE from '/vendor/three/three.module.js';
const socket=io();
const el=id=>document.getElementById(id);
const ui={chapter:el('chapter'),story:el('story'),info:el('info'),clue:el('clue'),timer:el('timer'),status:el('status'),notice:el('notice'),panel:el('codePanel'),code:el('code'),exit:el('exit')};
let myId=null,gameId=null,role=0,stage=0,padCount=0,state={relay:0,dials:[-1,-1,-1],cooling:[-1,-1,-1],hold:0};
const keys=new Set(),self={x:0,z:5},avatars=new Map();
const scene=new THREE.Scene();scene.background=new THREE.Color(0x101b29);
const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,120);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.outputColorSpace=THREE.SRGBColorSpace;document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0xaaccf5,0x293144,2.1));const sun=new THREE.DirectionalLight(0xfff3de,2.2);sun.position.set(4,10,5);scene.add(sun);
const world=new THREE.Group();scene.add(world);
const mat=(color,emissive=0x000000)=>new THREE.MeshStandardMaterial({color,emissive,roughness:.66});
function box(parent,x,y,z,sx,sy,sz,c,emissive=0){const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(c,emissive));m.position.set(x,y,z);parent.add(m);return m;}
function sphere(parent,x,y,z,r,c){const m=new THREE.Mesh(new THREE.SphereGeometry(r,12,10),mat(c));m.position.set(x,y,z);parent.add(m);return m;}
function cylinder(parent,x,y,z,rt,rb,h,c){const m=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,10),mat(c));m.position.set(x,y,z);parent.add(m);return m;}
const roleColors=[0x63b4ff,0xffbf67,0x7ee4ab];
// 몸통, 목, 머리, 두 팔, 두 다리를 별도 메시로 구성한 3D 사람형 캐릭터
function makeHuman(color){const person=new THREE.Group();const torso=box(person,0,1.22,0,.76,.9,.36,color);
 box(person,0,1.73,0,.23,.18,.24,0xe2b999);sphere(person,0,2.06,0,.3,0xf0c7a6);
 const hair=box(person,0,2.29,-.03,.57,.18,.55,0x293346);
 box(person,-.52,1.22,0,.24,.85,.27,color);box(person,.52,1.22,0,.24,.85,.27,color);
 box(person,-.21,.46,0,.29,.88,.3,0x26384c);box(person,.21,.46,0,.29,.88,.3,0x26384c);
 box(person,-.21,.09,-.12,.32,.19,.51,0x171d2c);box(person,.21,.09,-.12,.32,.19,.51,0x171d2c);
 sphere(person,-.11,2.09,-.27,.036,0x152234);sphere(person,.11,2.09,-.27,.036,0x152234);
 return person;}
const myself=makeHuman(0x65aaff);scene.add(myself);
const SPEED=5.2, JUMP=7.5, GRAVITY=20;let height=0,velocity=0,last=performance.now(),lastSent=0;
function resetMovement(){height=0;velocity=0;keys.clear();}
function room(){return Math.floor(stage/2)+1;}
function makeWorld(){
 world.clear();
 const palette=!gameId?0x273850:room()===1?0x263e53:room()===2?0x393047:0x3d3238;
 box(world,0,-.32,0,21,.6,19,palette);box(world,-10.5,2,0,.5,4,19,0x34475c);box(world,10.5,2,0,.5,4,19,0x34475c);
 box(world,0,2,-9.5,21,4,.5,0x36455d);
 for(let x=-8;x<=8;x+=4){box(world,x,3.65,-9.1,1,.12,.1,0x6bb9db,0x174c64);}
 if(!gameId){box(world,0,.065,0,4,.13,4,0x24d69c,0x063927);box(world,0,1.2,-9.1,6,2.4,.3,0x17363b);return;}
 const cols=stage===1||stage===4?roleColors:stage===6?[0x46ec9a,0x46ec9a,0x46ec9a]:[0xc95565,0x7791ef,0x50bfad];
 [-4,0,4].forEach((x,i)=>{
   box(world,x,.48,-3,1.25,.96,1.25,cols[i]);
   const data=stage===1?state.dials:stage===4?state.cooling:null;
   if(data){for(let j=0;j<Math.max(0,data[i]+1);j++)box(world,x-.37+j*.23,1.08,-3,.16,.16,.17,0xf6d790,0x493910);}
   if(stage===5)box(world,x,.09,-3,2,.18,2,0x30c77c,0x0c3821);
 });
 if(stage===2){box(world,0,.58,-5,2,1.15,1.15,0x947aff);}
 const open=stage===6;
 box(world,0,1.75,-9,4.1,3.5,.55,open?0x32db95:0x9b485b,open?0x114e36:0x37101b);
 if(open){box(world,0,.08,-7,3.5,.16,2.6,0x30ee94,0x075b33);}
}
const plots=[
 {chapter:'1구역 / 송전실 — 퍼즐 1·송신 릴레이',story:'2087년, 연구소 ZERO의 송전계가 붕괴했다. 세 조작자의 인증 신호를 올바른 순서로 보내야 비상 전력을 공급할 수 있다.',objective:'8초 안에 세 콘솔을 올바른 순서로 작동시켜라.',clues:['내 기록: 첫 송신은 C가 아니다. 마지막 송신은 B다.','내 기록: A보다 먼저 송신하는 조작자는 C다.','내 기록: 송신 순서에는 중복이 없다. B는 마지막이다.']},
 {chapter:'1구역 / 송전실 — 퍼즐 2·변압 코어',story:'송신 성공. 하지만 과부하 방지를 위해 세 변압 다이얼을 각각 0~3 눈금으로 맞춰야 한다.',objective:'각자 자기 콘솔에서 E로 값을 순환시키고 정확한 조합을 찾아라.',clues:['A 목표값은 B보다 2 크다.','B 목표값은 A와 C를 더한 값에서 5를 뺀 수다.','C 목표값은 A보다 1 크다. 세 값은 0~3 사이 정수다.']},
 {chapter:'2구역 / 기록실 — 퍼즐 3·인증 암호',story:'복구된 기록에는 세 명의 연구원이 분리 저장한 보안 암호가 남아 있다. 중앙 보라색 단말기에서 입력해야 한다.',objective:'서로 다른 세 단서를 조합하여 3자리 암호를 입력하라.',clues:['첫째 자리 = 7. 세 숫자는 서로 다르다.','둘째 자리 = 첫째 자리보다 3 작다.','셋째 자리 = (첫째 자리 + 둘째 자리)의 일의 자리다.']},
 {chapter:'2구역 / 기록실 — 퍼즐 4·교란 신호',story:'인공지능 ZERO는 통신 로그를 뒤섞었다. 로그의 문장 셋을 조합해 9초 안에 신호를 올바른 순서로 재송신하라.',objective:'서로 다른 조작자가 정해진 순서대로 자기 콘솔을 E로 누른다.',clues:['기록 A: 나는 마지막에 송신했다.','기록 B: C보다 먼저 송신했다.','기록 C: 첫 송신은 내가 아니었다.']},
 {chapter:'3구역 / 격리실 — 퍼즐 5·냉각 균형',story:'원자로가 불안정하다. 세 냉각 콘솔을 정확히 맞추지 않으면 최종 격리문은 열리지 않는다.',objective:'각자 자기 콘솔의 냉각 강도(0~2)를 E로 맞춰라.',clues:['A의 강도는 B의 두 배다.','B는 C보다 정확히 1 높다.','C의 강도가 가장 낮다. 모든 강도는 서로 다르다.']},
 {chapter:'3구역 / 격리실 — 퍼즐 6·생체 인증',story:'마지막 잠금장치는 3명의 생체 신호를 동시에 요구한다. 잠깐이라도 한 명이 발판을 벗어나면 인증 시간이 초기화된다.',objective:'각자 자기 녹색 인증 발판 위에 3초 동안 동시에 서 있어라. 점프하면 인증이 끊긴다.',clues:['A: 왼쪽 인증 발판(-4, -3)','B: 가운데 인증 발판(0, -3)','C: 오른쪽 인증 발판(4, -3)']},
 {chapter:'탈출 성공 — ZERO 봉쇄 해제',story:'“격리 프로토콜 종료. 세 명의 공동 인증이 완료되었습니다.” 멀리 초록색 탈출 발판이 켜진다.',objective:'방 끝의 초록색 판 위로 걸어가면 3명 모두 대기실로 돌아간다.',clues:['앞쪽 출구(z=-7)의 초록색 발판으로 이동!','발판을 한 사람만 밟아도 팀 전체가 돌아간다.','임무 완료. 연구소는 다시 잠들었다.']}
];
function renderUI(){
 if(!gameId){ui.chapter.textContent='대기 구역 / TEAM FORMATION';ui.story.textContent='초록 발판 위에 세 명이 모이면 임무가 시작됩니다. 준비되면 같은 발판 위에 서세요.';ui.info.textContent=`발판 대기 인원 ${padCount}/3`;ui.clue.textContent='이동: WASD · 점프: Space · 상호작용: E';ui.timer.textContent='';ui.status.textContent='';ui.panel.hidden=true;ui.exit.hidden=true;return;}
 const p=plots[stage];ui.chapter.textContent=p.chapter;ui.story.textContent=p.story;ui.info.textContent=p.objective;ui.clue.textContent=`나만 보는 단서 · ${'ABC'[role]}\n${p.clues[role]}`;
 ui.panel.hidden=stage!==2||Math.hypot(self.x,self.z+5)>2.5;
 ui.exit.hidden=false;
 ui.status.textContent=stage===0||stage===3?`순서 진행 ${state.relay}/3`:stage===1?`변압 눈금 A/B/C: ${state.dials.map(n=>n<0?'미조작':n).join(' / ')}`:stage===4?`냉각 눈금 A/B/C: ${state.cooling.map(n=>n<0?'미조작':n).join(' / ')}`:stage===5?`동시 인증 ${Math.floor(state.hold*10)/10}/3초`:stage===6?'초록색 출구가 열렸습니다.':'';
 ui.timer.textContent=stage===6?'출구로 이동하세요.':'연구소 전체: 6개 협동 보안장치';
}
function clearAvatars(){for(const a of avatars.values())scene.remove(a);avatars.clear();}
function use(){if(gameId && stage!==5&&stage!==6)socket.emit('action');else ui.notice.textContent=stage===5?'녹색 발판에 서서 3초간 버티세요.':'자기 콘솔로 이동하세요.';}
el('interact').onclick=use;
el('submit').onclick=()=>socket.emit('code',ui.code.value);
ui.code.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter')el('submit').click();});
ui.exit.onclick=()=>{socket.emit('exit');};
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLInputElement)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
 if(e.code==='Space'){if(!e.repeat && height===0 && velocity===0)velocity=JUMP;return;}
 keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'&&!e.repeat)use();
});
window.addEventListener('keyup',e=>{keys.delete(e.key.toLowerCase());});
socket.on('welcome',d=>{myId=d.id;renderUI();});
socket.on('lobbyCount',n=>{padCount=n;if(!gameId)renderUI();});
socket.on('enterGame',d=>{gameId=d.gameId;role=d.role;stage=d.stage;Object.assign(self,{x:(role-1)*2,z:5});resetMovement();clearAvatars();myself.children[0].material.color.setHex(roleColors[role]);makeWorld();renderUI();ui.notice.textContent='임무 시작! 각자 서로 다른 단서를 친구들에게 설명하세요.';});
socket.on('teleport',p=>{self.x=p.x;self.z=p.z;resetMovement();});
socket.on('returnLobby',()=>{gameId=null;role=0;stage=0;Object.assign(self,{x:0,z:5});resetMovement();clearAvatars();makeWorld();renderUI();ui.notice.textContent='팀이 대기실로 귀환했습니다.';});
socket.on('puzzleState',d=>{const changed=stage!==d.stage;stage=d.stage;state=d;if(changed)makeWorld();else if(stage===1||stage===4)makeWorld();renderUI();});
socket.on('notice',m=>{ui.notice.textContent=m;});
socket.on('positions',d=>{
 if((gameId||'lobby')!==d.room)return;const active=new Set();
 for(const p of d.players){if(p.id===myId)continue;active.add(p.id);let a=avatars.get(p.id);if(!a){a=makeHuman(roleColors[p.role]??0xdea668);avatars.set(p.id,a);scene.add(a);}a.position.set(p.x,p.y||0,p.z);}
 for(const [id,a] of avatars)if(!active.has(id)){scene.remove(a);avatars.delete(id);}
});
function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;
 let dx=0,dz=0;if(keys.has('w')||keys.has('arrowup'))dz--;if(keys.has('s')||keys.has('arrowdown'))dz++;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;
 const n=Math.hypot(dx,dz)||1;self.x=THREE.MathUtils.clamp(self.x+dx/n*SPEED*dt,-9.5,9.5);self.z=THREE.MathUtils.clamp(self.z+dz/n*SPEED*dt,-8.4,8.4);
 if(velocity!==0||height>0){height+=velocity*dt;velocity-=GRAVITY*dt;if(height<=0){height=0;velocity=0;}}
 myself.position.set(self.x,height,self.z);if(dx||dz)myself.rotation.y=Math.atan2(-dx,-dz);
 const target=new THREE.Vector3(self.x,7.3,self.z+9);camera.position.lerp(target,Math.min(1,dt*9));camera.lookAt(self.x,1.15,self.z-2);
 if(now-lastSent>=100){socket.emit('move',{x:self.x,y:height,z:self.z});lastSent=now;}
 if(stage===2 && gameId)ui.panel.hidden=Math.hypot(self.x,self.z+5)>2.5;
 renderer.render(scene,camera);
}
makeWorld();renderUI();requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
