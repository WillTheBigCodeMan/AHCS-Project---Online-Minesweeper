/*Establishes a reference to the Ably matchmaking channel.
It provides the /auth path as the url to request an authentication token.*/

const realtime = new Ably.Realtime({
  authUrl: "/auth",
  echoMessages: false,
});

//Reference the matchmaking channel.

const matchmakingChannel = realtime.channels.get("matchmaking");

//When the user presses the join queue the below function is called which alerts the server to the users presence.

function enterQueue() {
  if (document.getElementById("nickname").value != "") {
    matchmakingChannel.presence.enter();
    document
      .getElementById("nicknameForm")
      .addEventListener('submit', null);
    document.getElementById("joinGame").value = "Matchmaking";
    connect();
  }
}

/*After the user has joined the matchmaking channel, it awaits the servers response - a game channel. 
When the response is received it stores the game channel and the nickname 
in local storage and redirects the user to the gameroom page.*/

async function connect() {
  await matchmakingChannel.subscribe(
    matchmakingChannel.connectionManager.connectionDetails.clientId,
    (message) => {
      localStorage.setItem(
        "nickname",
        document.getElementById("nickname").value
      );
      localStorage.setItem("currentGame", message.data);
      window.location.replace("/gameroom");
    }
  );
}

var form = document.getElementById("nicknameForm");
function preventReload(event) { event.preventDefault(); } 
form.addEventListener('submit', preventReload);
