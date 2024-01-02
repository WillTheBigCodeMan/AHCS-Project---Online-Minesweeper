//const envConfig = require("dotenv").config();
const express = require("express");
const Ably = require("ably");
const app = express();
let totalPlayers = 0;
let currentGames = [];
let gameChannels = [];
let queue = [];
const width = 15;
const height = 15;
const mines = 40;

const apiKey = "EPShlg.7aXq-w:yRIF96jnwBoMRKSyzwYGWZOBPp4xuHOxPwDD4rhZjjw";

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
      matchmakingChannel.subscribe(queue[queue.length - 1][1], async (message) => {
        for(let i = 0; i < queue.length; i ++){
          if(queue[i][1] == message.name){
            queue[i].push(message.data);
            createGames();
          }
        }
      })
      totalPlayers++;
    }
  });
}

async function createGames() {
  while (queue.length >= 2) {
    for (let i = 0; i < 2; i++) {
      await matchmakingChannel.publish(queue[i][0], ("gameChannel" + currentGames.length.toString()));
    }
    gameChannels.push(realtime.channels.get("gameChannel" + currentGames.length.toString()));
    currentGames.push(new Game(queue[0][1], queue[1][1], 0, queue[0][2], queue[1][2]));
    queue.splice(0, 2);
    gameLoop();
  }
}

class Game{
  constructor(p1, p2, cP, nN1, nN2){
    this.player1 = p1;
    this.nickname1 = nN1;
    this.nickname2 = nN2;
    this.player2 = p2;
    this.connectedPlayers = cP;
    this.board = [];
    this.turn = 0;
    this.revealed = [];
    this.player1Time = 300;
    this.player2Time = 60;
  }
  
  generateBlank(){
    for(let i = 0; i < 15; i++){
      this.board.push([]);
      this.revealed.push([]);
      for(let j = 0; j < 15; j++){
        this.board[i].push(-2);
        this.revealed[i].push(false);
      }
    }
  }

  genBoard(fX, fY) {
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (fX + i >= 0 && fY + j >= 0 && fX + i < width && fY + j < height) {
          this.board[fX + i][fY + j] = 0;
        }
      }
    }
    for (let i = 0; i < mines; i++) {
      let x = Math.floor(Math.random() * width);
      let y = Math.floor(Math.random() * height);
      while (this.board[x][y] !== -2) {
        x = Math.floor(Math.random() * width);
        y = Math.floor(Math.random() * height);
      }
      this.board[x][y] = -1;
    }
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        if (this.board[i][j] < -1) {
          this.board[i][j] = 0;
        }
        if (this.board[i][j] >= 0) {
          for (let k = -1; k <= 1; k++) {
            for (let l = -1; l <= 1; l++) {
              if ((i + k) >= 0 && (j + l) >= 0 && (i + k) < width && (j + l) < height) {
                if (this.board[i + k][j + l] == -1) {
                  this.board[i][j]++;
                }
              }
            }
          }
        }
      }
    }
  }

  incrementTurn(){
    this.turn++;
  }

  reveal(x,y){
    this.revealed[x][y] = true;
  }
}

setInterval(async () => {
  for(let i = 0; i < currentGames.length; i++){
    if(currentGames[i].turn%2==0){
      currentGames[i].player1Time --;
    } else {
      currentGames[i].player2Time --;
    }
    await gameChannels[i].publish("time", {solverTime: currentGames[i].player1Time, bomberTime:currentGames[i].player2Time});
  }
}, 1000);

async function gameLoop() {
  for (let i = 0; i < gameChannels.length; i++) {
    gameChannels[i].presence.subscribe("enter", async (player) => {
      currentGames[i].connectedPlayers++;
      if (currentGames[i].connectedPlayers == 2) {
        currentGames[i].generateBlank();
        await gameChannels[i].publish("commands", { p1: currentGames[i].player1, p2: currentGames[i].player2, nickname1:currentGames[i].nickname1, nickname2:currentGames[i].nickname2, identifier: "playerRoles" })
      }
    });
    gameChannels[i].subscribe("input", async (message) => {
      if (currentGames[i].turn == 0 && message.data.player == currentGames[i].player1) {
        currentGames[i].genBoard(message.data.position.x, message.data.position.y);
      }
      if (currentGames[i].turn % 2 == 0 && message.data.player == currentGames[i].player1 && message.data.type == "left") {
        if(currentGames[i].board[message.data.position.x][message.data.position.y] == -1){
          await gameChannels[i].publish("commands", {winner:"bomber", identifier:"winLoss"});
        }
        let fullRevealed = waterfall(message.data.position.x, message.data.position.y, currentGames[i]);
        fullRevealed.push({x:message.data.position.x, y:message.data.position.y, val:currentGames[i].board[message.data.position.x][message.data.position.y]});
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
      if (currentGames[i].turn % 2 == 1 && message.data.player == currentGames[i].player2&&message.data.type == "left") {
        currentGames[i].incrementTurn();
        if (currentGames[i].board[message.data.position.x][message.data.position.y] == -1) {  
          await gameChannels[i].publish("commands", {winner:"bomber", identifier:"winLoss"});
          console.log("BOMB WIN");
        } else {
          let revealed = [{ x: message.data.position.x, y: message.data.position.y, value: currentGames[i].board[message.data.position.x][message.data.position.y]}]
          await gameChannels[i].publish("bomber", revealed);
        }
      }
    });
    gameChannels[i].subscribe("solverSelection", async (message) => {
      let revealed = [];
      for (let j = 0; j < message.data.length; j++) {
        revealed.push({ x: message.data[j].pos.x, y: message.data[j].pos.y, value: currentGames[i].board[message.data[j].pos.x][message.data[j].pos.y] });
      }
      await gameChannels[i].publish("bomber", revealed);
      currentGames[i].incrementTurn();
    });
  }
}

matchmaking();

function waterfall(x, y, game) {
  if(game.board[x][y] > 0&&!game.revealed[x][y]){
    game.reveal(x,y);
    return [{x:x, y:y, val:game.board[x][y]}];
  }
  let out = [];
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      if (!(i == 0 && j == 0) && x + i >= 0 && y + j >= 0 && x + i < width && y + j < height) {
        if (game.board[x + i][y + j] >= 0) {
          if (game.board[x + i][y + j] == 0 && game.revealed[x + i][y + j] == false) {
            game.reveal(x + i, y + j);
            out = concat(out, waterfall(x + i, y + j, game));
          }
          game.reveal(x + i, y + j);
          out.push({ x: x + i, y: y + j, val: game.board[x + i][y + j] });
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