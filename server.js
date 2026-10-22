
function matchmaking() {
  const eligible = [...players.entries()]
    .filter(([id, p]) => !p.gameId && p.onPad)
    .map(([id]) => id);

  while (eligible.length >= 3) {
    const selected = eligible.splice(0, 3);
    const gid = `team-${++gameCounter}`;

    const game = {
      members: selected,
      stage: 1,
      switches: new Map(),
      unlocked: false
    };

    games.set(gid, game);

    selected.forEach((id, i) => {
      const p = players.get(id);
      p.gameId = gid;
      p.onPad = false;
      p.x = (i - 1) * 2;
      p.z = 5;

      io.sockets.sockets.get(id)?.join(gid);
      io.to(id).emit('enterGame', {
        gameId: gid,
        role: i
      });
    });

    synchronize(gid);
  }

  publishLobby();
}
