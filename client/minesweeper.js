if (localStorage.getItem("playerId") == null) {
  window.location.replace("/");
} 


console.log(localStorage.getItem("playerId"));

let board = [];
let revealed = [];
let flagged = [];

const width = 15;
const height = 15;
const ctx = document.getElementById("game").getContext("2d");
const cvs = document.getElementById("game");

let box = cvs.getBoundingClientRect();
let mouseX;
let mouseY;
let role;
let leftover = 0;
let collecting = false;
let currentCollected = [];
let currentFixedIndex = 0;
let revealAmount = 0;

const realtime = new Ably.Realtime({
  authUrl: "/auth",
  echoMessages: false,
});

const gameChannel = realtime.channels.get(localStorage.getItem("currentGame"));
gameChannel.presence.enter();

async function gameCommands() {
  await gameChannel.subscribe("commands", (message) => {
    switch (message.data.identifier) {
      case "playerRoles":
        if (localStorage.getItem("playerId") == message.data.p1) {
          document.getElementById("playerRole").innerText = "Solver";
          document.getElementById("roleDescription").innerText = "Your goal is to solve the board like a regular game of minesweeper, however you must give some information about the board away to the bomber who will try to set off a mine before you can flag them all. Good luck!";
          role = "solver";
          document.getElementById("playerUsername").innerText = message.data.nickname1;
          document.getElementById("opponentName").innerText = message.data.nickname2;
        } else {
          document.getElementById("playerRole").innerText = "Bomber";
          document.getElementById("roleDescription").innerText = "Your goal is to set off a mine before the solver can finish solving the grid, you will recieve limited information from the solver and must use this to find a mine. Good luck!"
          role = "bomber";
          document.getElementById("playerUsername").innerText = message.data.nickname2;
          document.getElementById("opponentName").innerText = message.data.nickname1;
        }
        initGrid();
        renderGrid();
        box = cvs.getBoundingClientRect();
        gameUpdates();
        break;
      case "winLoss":
        if(message.data.winner == "bomber"){

        } else {

        }
        window.location.replace("/");
        break;
    }
  });
}

async function gameUpdates() {
  await gameChannel.subscribe(role, (message) => {
    getTimes();
    if (role == "solver") {
      if (typeof (message.data) == "object") {
        for (let i = 0; i < message.data.length - 1; i++) {
          revealed[message.data[i].x][message.data[i].y] = true;
          board[message.data[i].x][message.data[i].y] = message.data[i].val;
        }
        renderGrid();
        let tot = message.data[message.data.length - 1] + leftover;
        revealAmount += Math.floor(tot / 5);
        leftover = tot - (Math.floor(tot / 5) * 5);
        collecting = true;
        document.getElementById("confirmButton").style.backgroundColor = "aliceblue";
      }
    } else {
      if (typeof (message.data) == "object") {
        for (let i = 0; i < message.data.length; i++) {
          revealed[message.data[i].x][message.data[i].y] = true;
          board[message.data[i].x][message.data[i].y] = message.data[i].value;
        }
        renderGrid();
      }
    }
  })
}

gameCommands();

function rect(x, y, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.stroke = stroke;
  ctx.fillRect(x * (800 / width), y * (800 / height), (800 / width), (800 / height));
  ctx.strokeRect(x * (800 / width), y * (800 / height), (800 / width), (800 / height));
}

document.addEventListener('click', async (event) => {
  box = cvs.getBoundingClientRect();
  if (event.x > box.left && event.x < box.right && event.y > box.top && event.y < box.bottom) {
    let selected = {
      x: Math.floor((event.x - box.left) / (box.width/ width)),
      y: Math.floor((event.y - box.top) / (box.height / height))
    };
    if (!collecting && event.button == 0) {
      await gameChannel.publish("input", { position: selected, type: "left", player: localStorage.getItem("playerId") });
    } else if (revealed[selected.x][selected.y]) {
      let val = true;
      for (let i = 0; i < currentCollected.length; i++) {
        if (currentCollected[i].pos.x == selected.x && currentCollected[i].pos.y == selected.y) {
          val = false;
        }
      }
      if (val) {
        currentCollected.push({pos:selected, fixed:false});
        if (currentCollected.length > revealAmount) {
          currentCollected.splice(currentFixedIndex, 1);
        }
        renderGrid();
      }
    }
  }
});

function initGrid() {
  for (let i = 0; i < width; i++) {
    board.push([]);
    revealed.push([]);
    for (let j = 0; j < height; j++) {
      board[i].push(-2);
      revealed[i].push(false);
    }
  }
}


function renderGrid() {
  ctx.fillStyle = "#BBB";
  ctx.fillRect(0, 0, 800, 800);
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      let isCollectedSquare = false;
      for (let k = 0; k < currentCollected.length; k++) {
        if (i == currentCollected[k].pos.x && j == currentCollected[k].pos.y) {
          rect(i, j, "#AAFFAA", "000000");
          isCollectedSquare = true;
        }
      }
      ctx.stroke = "#000000";
      ctx.strokeRect(i * (800 / width), j * (800 / height), (800 / width), (800 / height));
      if (revealed[i][j] && board[i][j] > 0) {
        rect(i, j, "#FFF", "#000000");
        ctx.fillStyle = "#000000";
        ctx.font = "30px Arial";
        ctx.fillText(board[i][j].toString(), i * (800 / width) + 16, j * (800 / height) + 40);
      } else if (revealed[i][j]) {
        if (!isCollectedSquare) {
          rect(i, j, "#ffeeee", "#000000");
        }
      } else {
        for (let k = 0; k < flagged.length; k++) {
          if (flagged[k].x == i && flagged[k].y == j) {
            rect(i, j, "#FF0000", "000000");
          }
        }
      }
    }
  }
}

document.addEventListener('mousemove', (e) => {
  mouseX = e.x;
  mouseY = e.y;
});

async function rightClick() {
  box = cvs.getBoundingClientRect();
  let selected = {
    x: Math.floor((event.x - box.left) / (box.width/ width)),
    y: Math.floor((event.y - box.top) / (box.height / height))
  };
  await gameChannel.publish("input", { position: selected, type: "right", player: localStorage.getItem("playerId") });
    let found = false;
    for (let i = 0; i < flagged.length; i++) {
      if (flagged[i].x == selected.x && flagged[i].y == selected.y) {
        flagged.splice(i, 1);
        found = true;
        renderGrid();
        break;
      }
    }
    if (!found) {
      rect(selected.x, selected.y, "#FF0000", "#000000");
      flagged.push({
        x: selected.x,
        y: selected.y
      });
    }
}

window.addEventListener('contextmenu', (event) => {
  if (document.elementFromPoint(mouseX, mouseY) == cvs) {
    event.preventDefault()
  }
});

async function confirmSelected() {
  if(currentCollected.length >= revealAmount){
    document.getElementById("confirmButton").style.backgroundColor = "lightgray";
    for(let i = 0; i < currentCollected.length; i++){
      if(currentCollected[i].fixed == false){
        currentCollected[i].fixed = true;
        currentFixedIndex = i+1;
      }
    }
    await gameChannel.publish("solverSelection", currentCollected);
    collecting = false;
  }
}

async function getTimes() {
  await gameChannel.subscribe("time", (message) => {
    document.getElementById("opponentTimer").innerText = formatTime(role=="solver" ? message.data.bomberTime : message.data.solverTime);
    document.getElementById("playerTimer").innerText = formatTime(role=="bomber" ? message.data.bomberTime : message.data.solverTime);
  })
}

const formatTime = (x) => Math.floor(x/60).toString() + ":" + (x%60<10? "0" : "") + (x%60).toString();