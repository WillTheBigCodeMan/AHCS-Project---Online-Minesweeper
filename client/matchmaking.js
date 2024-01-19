const realtime = new Ably.Realtime({
  authUrl: "/auth",
  echoMessages: false,
});

realtime.connection.once("connected", () => {
  console.log("Connected");
});

const matchmakingChannel = realtime.channels.get("matchmaking");
let gameChannel;

function enterQueue() {
  if (document.getElementById("nickname").value != "") {
    matchmakingChannel.presence.enter();
    document.getElementById("joinGame").onclick = "";
    document.getElementById("joinGame").innerHTML = "Matchmaking";
    connect();
  }
}

async function connect() {
  await matchmakingChannel.subscribe(matchmakingChannel.connectionManager.connectionDetails.clientId, (message) => {
    if (message.data == 'Request Nickname') {
      localStorage.setItem("playerId", matchmakingChannel.connectionManager.connectionDetails.clientId);
      matchmakingChannel.publish(matchmakingChannel.connectionManager.connectionDetails.clientId, document.getElementById("nickname").value);
    } else {
      localStorage.setItem("currentGame", message.data);
      window.location.replace("/gameroom");
    }
  });
}