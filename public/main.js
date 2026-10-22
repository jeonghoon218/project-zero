import * as THREE from '/vendor/three/three.module.js';
const socket=io();let myId=null,role=0,gameId=null,stage=0,unlocked=false,padCount=0;
const info=document.querySelector('#info'),notice=document.querySelector('#notice'),panel=document.querySelector('#codePanel'),exit=document.querySelector('#exit');
const scene=new THREE.Scene();scene.background=new THREE.Color(0x111827);const camera=new THREE.PerspectiveCamera(65,innerWidth/innerHeight,.1,100);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.appendChild(renderer.domElement);
scene.add(new THREE.HemisphereLight(0x8ed6ff,0x3b3854,2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(4,9,3);scene.add(light);
const world=new THREE.Group();scene.add(world);const avatars=new Map();const self={x:0,z:5};const keys=new Set();
const material=c=>new THREE.MeshStandardMaterial({color:c,roughness:.55});
function cube(x,y,z,sx,sy,sz,color){const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),material(color));mesh.position.set(x,y,z);world.add(mesh);return mesh;}
function build(){world.clear();cube(0,-.3,0,21,.6,19,0x293345);cube(-10.5,2,0,.5,4,19,0x3d4d67);cube(10.5,2,0,.5,4,19,0x3d4d67);cube(0,2,-9.5,21,4,.5,0x3d4d67);
 if(!gameId){cube(0,.07,0,4,.14,4,0x2ad79b);cube(0,2,-9,6,3,1,0x243647)}
 else {[-4,0,4].forEach((x,i)=>cube(x,.5,-3,1,1,1,stage===1?[0xfc5c65,0x4dabff,0x65e0a3][i]:0x555f75));cube(0,1.8,-9,4,3,.7,unlocked?0x35d79f:0xaa3455);if(stage>=2)cube(0,.6,-3,2,1.2,1,0x9b8bff);}
}
function updateText(){
 if(!gameId){info.textContent=`대기실 | 발판 대기 인원 ${padCount}/3 · 녹색 발판에 올라가세요.`;panel.hidden=true;exit.hidden=true;}
 else if(stage===1){info.textContent=`팀 ${gameId} | 역할 ${role+1} | 퍼즐 1: 서로 다른 3개 스위치를 3초 안에 누르세요. 스위치 가까이 가서 E.`;panel.hidden=true;exit.hidden=false;}
 else if(stage===2){info.textContent=`퍼즐 2: 내 단서 — ${['첫째 숫자는 2','둘째 숫자는 첫째의 3배','셋째 숫자는 둘째보다 2 작다'][role]}. 보라색 단말기에서 암호를 입력하세요.`;panel.hidden=Math.hypot(self.x,self.z+3)>2.5;exit.hidden=false;}
 else{info.textContent='축하합니다! 연구소 탈출 성공! [대기실로] 버튼으로 다시 시작하세요.';panel.hidden=true;exit.hidden=false;}
}
function interact(){if(!gameId||stage!==1)return;const positions=[-4,0,4];let closest=-1,dist=Infinity;positions.forEach((x,i)=>{const d=Math.hypot(self.x-x,self.z+3);if(d<dist){dist=d;closest=i;}});if(dist<1.8)socket.emit('switch',closest);else notice.textContent='스위치 가까이 이동하세요.';}
document.querySelector('#interact').onclick=interact;document.querySelector('#submit').onclick=()=>socket.emit('code',document.querySelector('#code').value);
exit.onclick=()=>socket.emit('exit');window.addEventListener('keydown',e=>{keys.add(e.key.toLowerCase());if(e.key.toLowerCase()==='e'&&!e.repeat)interact();});window.addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));
socket.on('welcome',d=>{myId=d.id;updateText()});socket.on('lobbyCount',n=>{padCount=n;updateText()});
socket.on('enterGame',d=>{gameId=d.gameId;role=d.role;stage=1;self.x=(role-1)*2;self.z=5;avatars.forEach(m=>scene.remove(m));avatars.clear();build();updateText();notice.textContent='3인 팀 결성!';});
socket.on('returnLobby',()=>{gameId=null;stage=0;unlocked=false;self.x=0;self.z=5;avatars.forEach(m=>scene.remove(m));avatars.clear();build();updateText();notice.textContent='대기실로 돌아왔습니다.';});
socket.on('puzzleState',d=>{stage=d.stage;unlocked=d.unlocked;build();updateText();});socket.on('notice',v=>{notice.textContent=v;});
socket.on('positions',d=>{if((gameId||'lobby')!==d.room)return;const active=new Set();for(const p of d.players){if(p.id===myId)continue;active.add(p.id);let m=avatars.get(p.id);if(!m){m=new THREE.Mesh(new THREE.CapsuleGeometry(.38,1,.2,5),material(0xf9bb5e));scene.add(m);avatars.set(p.id,m);}m.position.set(p.x,1,p.z);}for(const [id,m] of avatars)if(!active.has(id)){scene.remove(m);avatars.delete(id);}});
const myMesh=new THREE.Mesh(new THREE.CapsuleGeometry(.38,1,.2,5),material(0x65aaff));scene.add(myMesh);
let last=performance.now(),lastSent=0;function frame(now){requestAnimationFrame(frame);const dt=Math.min((now-last)/1000,.05);last=now;let dx=0,dz=0;if(keys.has('w')||keys.has('arrowup'))dz--;if(keys.has('s')||keys.has('arrowdown'))dz++;if(keys.has('a')||keys.has('arrowleft'))dx--;if(keys.has('d')||keys.has('arrowright'))dx++;const n=Math.hypot(dx,dz)||1;self.x=THREE.MathUtils.clamp(self.x+dx/n*4*dt,-9.5,9.5);self.z=THREE.MathUtils.clamp(self.z+dz/n*4*dt,-8.5,8.5);myMesh.position.set(self.x,1,self.z);camera.position.set(self.x,8,self.z+10);camera.lookAt(self.x,0,self.z-2);if(now-lastSent>100){socket.emit('move',{x:self.x,z:self.z});lastSent=now;}if(stage===2)panel.hidden=Math.hypot(self.x,self.z+3)>2.5;renderer.render(scene,camera);}build();requestAnimationFrame(frame);
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
