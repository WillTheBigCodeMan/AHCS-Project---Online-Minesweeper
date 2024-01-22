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
    localStorage.setItem("nickname", document.getElementById("nickname").value);
    localStorage.setItem("currentGame", message.data);
    window.location.replace("/gameroom");
  });
}