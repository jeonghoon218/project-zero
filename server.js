'use strict';
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const app = express();
const server = http.createServer(app);
const io = new Server(server);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/vendor/three', express.static(path.join(__dirname, 'node_modules/three/build')));
const players = new Map();
const games = new Map();
let gameCounter = 0;
const clamp = (v,min,max) => Math.max(min,Math.min(max,v));
const xs = [-4,0,4];
const ORDER1 = [2,0,1];  // C-A-B: 각 담당자가 자기 콘솔에 접근
const ORDER4 = [1,2,0];  // B-C-A
const DIAL_TARGET = [2,0,3];
const COOL_TARGET = [2,1,0];
const spawn = role => ({x:(role-1)*2, z:5, y:0});
function countLobby(){io.emit('lobbyCount',[...players.values()].filter(p => !p.gameId && p.onPad).length);}
function roomOf(stage){return Math.floor(stage/2)+1;}
function snapshot(gid){
  const g=games.get(gid); if(!g)return;
  io.to(gid).emit('puzzleState',{
    stage:g.stage,room:roomOf(g.stage),relay:g.relay.length,
    dials:g.dials, cooling:g.cooling,hold:g.holdStart?Math.min(3,(Date.now()-g.holdStart)/1000):0,
    complete:g.stage===6
  });
}
function notice(gid,msg){io.to(gid).emit('notice',msg);}
function advance(gid){
  const g=games.get(gid);if(!g || g.stage>=6)return;
  g.stage++;
  g.relay=[];g.relayStart=0;g.holdStart=0;
  if(g.stage<6){g.members.forEach((id,i)=>{const p=players.get(id);if(p){Object.assign(p,spawn(i));io.to(id).emit('teleport',spawn(i));}});}
  const messages=['','송신 전력이 안정되었습니다. 이제 변압 코어를 보정하세요.','전력 복구! 암호 기록실에 진입합니다.','인증 암호 확인. 이제 교란된 통신 순서를 복원하세요.','기록 해독 완료! 원자로 격리실에 진입합니다.','냉각 안정화! 모두 각자 인증 발판에 서세요.','격리 해제! 녹색 탈출 발판에 올라가면 팀 전체가 대기실로 돌아갑니다.'];
  notice(gid,messages[g.stage]);snapshot(gid);
}
function leaveGame(id,whole=false){
  const p=players.get(id);if(!p?.gameId)return;
  const gid=p.gameId,g=games.get(gid);
  if(!g){p.gameId=null;return;}
  const ids=whole?[...g.members]:[id];
  for(const mid of ids){const member=players.get(mid);if(!member)continue;io.sockets.sockets.get(mid)?.leave(gid);member.gameId=null;member.onPad=false;Object.assign(member,{x:0,y:0,z:5});io.to(mid).emit('returnLobby');}
  g.members=g.members.filter(mid=>!ids.includes(mid));
  if(!g.members.length)games.delete(gid);
  else notice(gid,'팀원이 퇴장했습니다. 3인 협동 퍼즐을 계속하려면 새 팀을 결성하세요.');
  countLobby();
}
function matchmaking(){
  const eligible=[...players.entries()].filter(([id,p])=>!p.gameId && p.onPad).map(([id])=>id);
  while(eligible.length>=3){
    const selected=eligible.splice(0,3),gid=`team-${++gameCounter}`;
    const g={members:selected,stage:0,relay:[],relayStart:0,dials:[-1,-1,-1],cooling:[-1,-1,-1],holdStart:0};games.set(gid,g);
    selected.forEach((id,role)=>{const p=players.get(id);p.gameId=gid;p.onPad=false;p.role=role;Object.assign(p,spawn(role));io.sockets.sockets.get(id)?.join(gid);io.to(id).emit('enterGame',{gameId:gid,role,stage:0});});
    notice(gid,'ZERO 긴급 방송: 봉쇄까지 30분. 세 명의 인증을 모두 완료하세요.');snapshot(gid);
  }
  countLobby();
}
function nearbyConsole(p){return p.role>=0 && p.role<=2 && Math.hypot(p.x-xs[p.role],p.z+3)<2.25;}
function handleAction(id){
  const p=players.get(id);if(!p?.gameId)return;
  const g=games.get(p.gameId);if(!g || g.stage===6)return;
  const gid=p.gameId,role=p.role;
  if(!nearbyConsole(p)){io.to(id).emit('notice','자기 번호의 콘솔 가까이 가서 E를 누르세요.');return;}
  if(g.stage===0 || g.stage===3){
    const order=g.stage===0?ORDER1:ORDER4,limit=g.stage===0?8000:9000;
    const now=Date.now();
    if(g.relay.length && now-g.relayStart>limit){g.relay=[];g.relayStart=0;}
    if(g.relay.length===0)g.relayStart=now;
    if(order[g.relay.length]===role){g.relay.push(role);notice(gid,`동기화 ${g.relay.length}/3 성공!`);if(g.relay.length===3){advance(gid);return;}}
    else {g.relay=[];g.relayStart=0;notice(gid,'순서 오류! 릴레이가 초기화되었습니다. 단서를 다시 조합하세요.');}
  } else if(g.stage===1){
    g.dials[role]=(g.dials[role]+1)%4;
    if(g.dials.every((v,i)=>v===DIAL_TARGET[i])){advance(gid);return;}
  } else if(g.stage===4){
    g.cooling[role]=(g.cooling[role]+1)%3;
    if(g.cooling.every((v,i)=>v===COOL_TARGET[i])){advance(gid);return;}
  }else if(g.stage===2){io.to(id).emit('notice','중앙 보라색 단말기로 이동해 계산한 3자리 암호를 입력하세요.');}
  snapshot(gid);
}
io.on('connection',socket=>{
  players.set(socket.id,{x:0,y:0,z:5,role:-1,onPad:false,gameId:null});socket.emit('welcome',{id:socket.id});
  socket.on('move',v=>{
    const p=players.get(socket.id);if(!p || !v || !Number.isFinite(v.x)||!Number.isFinite(v.z))return;
    const nx=clamp(v.x,-9.6,9.6),nz=clamp(v.z,-8.5,8.5);
    if(Math.hypot(nx-p.x,nz-p.z)>2.1)return;
    p.x=nx;p.z=nz;p.y=Number.isFinite(v.y)?clamp(v.y,0,2.6):0;
    if(!p.gameId){const old=p.onPad;p.onPad=Math.abs(nx)<2&&Math.abs(nz)<2;if(old!==p.onPad)matchmaking();return;}
    const g=games.get(p.gameId);if(!g)return;
    if(g.stage===6 && Math.abs(nx)<2&&nz< -5.2){leaveGame(socket.id,true);return;}
  });
  socket.on('action',()=>handleAction(socket.id));
  socket.on('code',v=>{
    const p=players.get(socket.id);if(!p?.gameId)return;
    const g=games.get(p.gameId);if(!g || g.stage!==2 || Math.hypot(p.x,p.z+5)>2.5)return;
    if(String(v).trim()==='741')advance(p.gameId);
    else socket.emit('notice','보안 암호가 틀렸습니다. 세 기록의 관계를 다시 살펴보세요.');
  });
  socket.on('exit',()=>{leaveGame(socket.id);});
  socket.on('disconnect',()=>{leaveGame(socket.id);players.delete(socket.id);countLobby();});
  countLobby();
});
setInterval(()=>{
  for(const [gid,g] of games){
    if(g.stage!==5)continue;
    const standing=g.members.length===3 && g.members.every((id,i)=>{
      const p=players.get(id);return p && Math.hypot(p.x-xs[i],p.z+3)<1.15 && p.y<0.45;
    });
    if(standing){if(!g.holdStart)g.holdStart=Date.now();if(Date.now()-g.holdStart>=3000){advance(gid);continue;}}
    else g.holdStart=0;
    snapshot(gid);
  }
},200);
setInterval(()=>{
  const rooms=new Map();
  for(const [id,p] of players){const key=p.gameId||'lobby';if(!rooms.has(key))rooms.set(key,[]);rooms.get(key).push({id,x:p.x,y:p.y,z:p.z,role:p.role,onPad:p.onPad});}
  for(const [room,data] of rooms){if(room!=='lobby')io.to(room).emit('positions',{room,players:data});}
  // lobby isn't a Socket.IO room; emit only to current lobby users
  if(rooms.has('lobby')){for(const [id,p] of players)if(!p.gameId)io.to(id).emit('positions',{room:'lobby',players:rooms.get('lobby')});}
},100);
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Listening on ${port}`));
