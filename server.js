const envConfig = require("dotenv").config();
const express = require("express");
const Ably = require("ably");
const app = express();
let totalPlayers = 0;
let currentGames = [];
let gameChannels = [];
let queue = [];
let width = 15;
let height = 15;
let mines = 40;

let apiKey = "EPShlg.7aXq-w:yRIF96jnwBoMRKSyzwYGWZOBPp4xuHOxPwDD4rhZjjw";

const realtime = new Ably.Realtime({
  key: apiKey,
  echoMessages: false,
});

app.use(express.static("client"));

const uniqueId = function() {
  return "id-" + totalPlayers + Math.random().toString(36).substr(2, 16);
}

app.get("/auth", (request, response) => {
  const tokenParams = { clientId: uniqueId() };
  realtime.auth.requestToken(tokenParams, function(err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send("Error requesting token: " + JSON.stingify(err));
    } else {
      response.setHeader("Content-Type", "application/json");
      response.send(JSON.stringify(tokenRequest));
    }
  })
});

app.get("/", (request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  response.sendFile(__dirname + "/index.html");
});

app.get("/gameroom", (request, response) => {
  response.sendFile(__dirname + "/client/gameRoom.html");
});


const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

realtime.connection.once("connected", () => {
  console.log("Ably connected");
});

const matchmakingChannel = realtime.channels.get("matchmaking");

async function matchmaking() {
  matchmakingChannel.presence.subscribe("enter", async (player) => {
    if (!queue.includes(player.clientId)) {
      queue.push([player.clientId, uniqueId()]);
      await matchmakingChannel.publish(queue[queue.length - 1][0], queue[queue.length - 1][1]);
      totalPlayers++;
    }
    while (queue.length >= 2) {
      for (let i = 0; i < 2; i++) {
        await matchmakingChannel.publish(queue[i][0], ("gameChannel" + currentGames.length.toString()));
      }
      gameChannels.push(realtime.channels.get("gameChannel" + currentGames.length.toString()));
      currentGames.push([queue[0][1], queue[1][1], 0]);
      queue.splice(0, 2);
      gameLoop();
    }
  });
}

async function gameLoop() {
  for (let i = 0; i < gameChannels.length; i++) {
    gameChannels[i].presence.subscribe("enter", async (player) => {
      currentGames[i][2]++;
      if (currentGames[i][2] == 2) {
        currentGames[i].push([]);
        currentGames[i].push(0);
        currentGames[i].push([]);
        for (let ii = 0; ii < 15; ii++) {
          currentGames[i][3].push([]);
          currentGames[i][5].push([]);
          for (let j = 0; j < 15; j++) {
            currentGames[i][3][ii].push(-2);
            currentGames[i][5][ii].push(false);
          }
        }
        await gameChannels[i].publish("commands", { p1: currentGames[i][0], p2: currentGames[i][1], identifier: "playerRoles" })
      }
    });
    gameChannels[i].subscribe("input", async (message) => {
      console.log(message.data);
      if (currentGames[i][4] == 0 && message.data.player == currentGames[i][0]) {
        currentGames[i][3] = genBoard(message.data.position.x, message.data.position.y, currentGames[i][3]);
      }
      if (currentGames[i][4] % 2 == 0 && message.data.player == currentGames[i][0]&&message.data.type == "left") {
        if(currentGames[i][3][message.data.position.x][message.data.position.y] == -1){
          await gameChannels[i].publish("commands", {winner:"bomber", identifier:"winLoss"});
        }
        currentGames[i][4] += 1;
        let fullRevealed = waterfall(message.data.position.x, message.data.position.y, currentGames[i][3], currentGames[i][5]);
        fullRevealed.push({x:message.data.position.x, y:message.data.position.y, val:currentGames[i][3][message.data.position.x][message.data.position.y]});
        let newRevealed = [];
        for (let i = 0; i < fullRevealed.length; i++) {
          let valid = true;
          for (let j = 0; j < newRevealed.length; j++) {
            if (newRevealed[j].x == fullRevealed[i].x && newRevealed[j].y == fullRevealed[i].y) {
              valid = false;
              break;
            }
          }
          if (valid) {
            newRevealed.push(fullRevealed[i]);
          }
        }
        let totVal = 0;
        for (let i = 0; i < newRevealed.length; i++) {
          totVal += newRevealed[i].val;
        }
        newRevealed.push(totVal);
        await gameChannels[i].publish("solver", newRevealed);
      }
      if (currentGames[i][4] % 2 == 1 && message.data.player == currentGames[i][1]&&message.data.type == "left") {
        currentGames[i][4] += 1;
        console.log(message.data);
        if (currentGames[i][3][message.data.position.x][message.data.position.y] == -1) {  
          await gameChannels[i].publish("commands", {winner:"bomber", identifier:"winLoss"});
          console.log("BOMB WIN");
        } else {
          let revealed = [{ x: message.data.position.x, y: message.data.position.y, value: currentGames[i][3][message.data.position.x][message.data.position.y]}]
          await gameChannels[i].publish("bomber", revealed);
        }
      }
    });
    gameChannels[i].subscribe("solverSelection", async (message) => {
      let revealed = [];
      for (let j = 0; j < message.data.length; j++) {
        revealed.push({ x: message.data[j].pos.x, y: message.data[j].pos.y, value: currentGames[i][3][message.data[j].pos.x][message.data[j].pos.y] });
      }
      await gameChannels[i].publish("bomber", revealed)
    });
  }
}

matchmaking();

function genBoard(fX, fY, board) {
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (fX + i >= 0 && fY + j >= 0 && fX + i < width && fY + j < height) {
        board[fX + i][fY + j] = 0;
      }
    }
  }
  for (let i = 0; i < mines; i++) {
    let x = Math.floor(Math.random() * width);
    let y = Math.floor(Math.random() * height);
    while (board[x][y] !== -2) {
      x = Math.floor(Math.random() * width);
      y = Math.floor(Math.random() * height);
    }
    board[x][y] = -1;
  }
  for (let i = 0; i < width; i++) {
    for (let j = 0; j < height; j++) {
      if (board[i][j] < -1) {
        board[i][j] = 0;
      }
      if (board[i][j] >= 0) {
        for (let k = -1; k <= 1; k++) {
          for (let l = -1; l <= 1; l++) {
            if ((i + k) >= 0 && (j + l) >= 0 && (i + k) < width && (j + l) < height) {
              if (board[i + k][j + l] == -1) {
                board[i][j]++;
              }
            }
          }
        }
      }
    }
  }
  return board;
}

function waterfall(x, y, board, revealed) {
  if(board[x][y] > 0&&!revealed[x][y]){
    revealed[x][y] = true;
    return [{x:x, y:y, val:board[x][y]}];
  }
  let out = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (!(i == 0 && j == 0) && x + i >= 0 && y + j >= 0 && x + i < width && y + j < height) {
        if (board[x + i][y + j] >= 0) {
          if (board[x + i][y + j] == 0 && revealed[x + i][y + j] == false) {
            revealed[x + i][y + j] = true;
            out = concat(out, waterfall(x + i, y + j, board, revealed));
          }
          revealed[x + i][y + j] = true;
          out.push({ x: x + i, y: y + j, val: board[x + i][y + j] });
        }
      }
    }
  }
  return out;
}

function concat(a, b) {
  let c = new Array(a.length + b.length);
  for (let i = 0; i < c.length; i++) {
    if (i < a.length) {
      c[i] = a[i];
    } else {
      c[i] = b[i - a.length];
    }
  }
  return c;
}