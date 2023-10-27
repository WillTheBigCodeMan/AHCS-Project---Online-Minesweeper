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
    if (message.data[0] == 'i') {
      console.log(message.data);
      localStorage.setItem("playerId", message.data);
    } else {
      localStorage.setItem("currentGame", message.data);
      window.location.replace("/gameroom");
    }
  });
}