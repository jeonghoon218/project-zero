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
const DISTANCE = 1.8;
const clamp = (v,min,max)=>Math.max(min,Math.min(max,v));
function publishLobby(){
  io.emit('lobbyCount', [...players.values()].filter(p=>!p.gameId && p.onPad).length);
}
function synchronize(gameId) {
  const game=games.get(gameId); if (!game) return;
  io.to(gameId).emit('puzzleState', {stage:game.stage, switches:game.switches.size, unlocked:game.unlocked});
}
function leaveGame(id) {
  const p=players.get(id); if (!p || !p.gameId) return;
  const gid=p.gameId, game=games.get(gid);
  io.sockets.sockets.get(id)?.leave(gid);
  p.gameId=null; p.x=0; p.z=5; p.onPad=false;
  io.to(id).emit('returnLobby');
  if(game){game.members=game.members.filter(member=>member!==id); if(!game.members.length)games.delete(gid); else io.to(gid).emit('notice','팀원이 퇴장했습니다.');}
}
function matchmaking(){
  const eligible=[...players.entries()].filter(([id,p])=>!p.gameId && p.onPad).map(([id])=>id);
  while (eligible.length>=3){
    const selected=eligible.splice(0,3), gid=`team-${++gameCounter}`;
    const game={members:selected,stage:1,switches:new Map(),unlocked:false}; games.set(gid,game);
    selected.forEach((id,i)=>{const p=players.get(id);p.gameId=gid;p.onPad=false;p.x=(i-1)*2;p.z=5;io.sockets.sockets.get(id)?.join(gid);io.to(id).emit('enterGame',{gameId:gid,role:i});});
    synchronize(gid);
  }
  publishLobby();
}
io.on('connection',socket=>{
  players.set(socket.id,{x:0,z:5,onPad:false,gameId:null});
  socket.emit('welcome',{id:socket.id});
  socket.on('move',v=>{
    const p=players.get(socket.id);
    if(!p || !v || !Number.isFinite(v.x)||!Number.isFinite(v.z))return;
    const nx=clamp(v.x,-10,10),nz=clamp(v.z,-9,9);
    if(Math.hypot(nx-p.x,nz-p.z)>1.5)return;
    p.x=nx;p.z=nz;
    if(!p.gameId){p.onPad=Math.abs(nx)<2 && Math.abs(nz)<2;matchmaking();}
  });
  socket.on('switch',index=>{
    const p=players.get(socket.id); if(!p?.gameId)return;
    const game=games.get(p.gameId);
    if(!game || game.stage!==1 || !Number.isInteger(index) || index<0||index>2)return;
    const positions=[-4,0,4];
    if(Math.hypot(p.x-positions[index],p.z+3)>DISTANCE)return;
    const now=Date.now();
    for(const [key,val] of game.switches)if(now-val.time>3000)game.switches.delete(key);
    game.switches.set(index,{id:socket.id,time:now});
    if(game.switches.size===3 && new Set([...game.switches.values()].map(v=>v.id)).size===3){game.stage=2;game.switches.clear();io.to(p.gameId).emit('notice','전력 복구 완료! 암호 단말기가 켜졌습니다.');}
    synchronize(p.gameId);
  });
  socket.on('code',code=>{
    const p=players.get(socket.id);if(!p?.gameId)return;
    const game=games.get(p.gameId);if(!game||game.stage!==2)return;
    if(Math.hypot(p.x,p.z+3)>2.5)return;
    if(code==='264'){game.stage=3;game.unlocked=true;io.to(p.gameId).emit('notice','탈출 성공! 격리문이 열렸습니다.');synchronize(p.gameId);}
    else socket.emit('notice','암호가 일치하지 않습니다.');
  });
  socket.on('exit',()=>{leaveGame(socket.id);publishLobby();});
  socket.on('disconnect',()=>{leaveGame(socket.id);players.delete(socket.id);publishLobby();});
  publishLobby();
});
setInterval(()=>{
  const rooms=new Map();
  for(const [id,p] of players){const key=p.gameId||'lobby';if(!rooms.has(key))rooms.set(key,[]);rooms.get(key).push({id,x:p.x,z:p.z,onPad:p.onPad});}
  for(const [room,data] of rooms){if(room==='lobby')io.emit('positions',{room,players:data});else io.to(room).emit('positions',{room,players:data});}
},100);
const port=Number(process.env.PORT)||3000;
server.listen(port,'0.0.0.0',()=>console.log(`Listening on ${port}`));
