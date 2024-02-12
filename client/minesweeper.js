if (localStorage.getItem("currentGame") == null) {
  window.location.replace("/");
}
//Client side game variables

let board = [];
let revealed = [];
let flagged = [];
const width = 15;
const height = 15;

//Creates a reference to the html canvas for rendering the game.

const ctx = document.getElementById("game").getContext("2d");
const cvs = document.getElementById("game");

let ps = [];

//Other variables.

let box = cvs.getBoundingClientRect();
let mouseX;
let mouseY;
let role;
let collecting = false;
let currentCollected = [];
let currentFixedIndex = 0;
let revealAmount = 0;

//Reference to the Ably realtime class.

const realtime = new Ably.Realtime({
  authUrl: "/auth",
  echoMessages: false,
});

//References the game channel and sends the clients username to the server.

const gameChannel = realtime.channels.get(localStorage.getItem("currentGame"));
gameChannel.presence.update({ nickname: localStorage.getItem("nickname") });

//Creates a variable to store the client ID

let clientId;

let particleLoop;

const fullRender = () => {
  for (let i = 0; i < ps.length; i++) {
    renderSystem(ps[i]);
    if (ps[i].a <= 0) {
      ps.splice(i, 1);
    }
    i--;
  }
};

//Function to listen for and process game commands sent from the server.

async function gameCommands() {
  await gameChannel.subscribe("commands", (message) => {
    clientId = gameChannel.connectionManager.connectionDetails.clientId; //Stores the client ID
    switch (
      message.data.identifier //Switches through the different possible server commands.
    ) {
      case "playerRoles":
        if (clientId == message.data.p1) {
          //Checks the player role and updates the game instructions paragraph.
          document.getElementById("playerRole").innerText = "Solver";
          document.getElementById("roleDescription").innerText =
            "Your goal is to solve the board like a regular game of minesweeper, however you must give some information about the board away to the bomber who will try to set off a mine before you can flag them all. Good luck!";
          role = "solver";
          document.getElementById("playerUsername").innerText =
            message.data.nickname1;
          document.getElementById("opponentName").innerText =
            message.data.nickname2;
        } else {
          document.getElementById("playerRole").innerText = "Bomber";
          document.getElementById("roleDescription").innerText =
            "Your goal is to set off a mine before the solver can finish solving the grid, you will recieve limited information from the solver and must use this to find a mine. Good luck!";
          role = "bomber";
          document.getElementById("playerUsername").innerText =
            message.data.nickname2;
          document.getElementById("opponentName").innerText =
            message.data.nickname1;
        }

        //Calls functions and sets variables to initialize the game.

        initGrid();
        renderGrid();
        box = cvs.getBoundingClientRect();
        gameUpdates();
        break;

      //Code for handling when a player has won or lost.

      case "winLoss":
        if (message.data.winner == "bomber") {
          // TODO
        } else {
          // TODO
        }
        window.location.replace("/");
        break;
    }
  });
}

//Function to listen for and process data during the game.

async function gameUpdates() {
  await gameChannel.subscribe(role, (message) => {
    if (role == "solver") {
      //If the player is the solver
      if (typeof message.data[0] == "object") {
        //If the message is an array of revealed tiles
        for (let i = 0; i < message.data.length - 1; i++) {
          //Loop through the tiles and store their information in the relevant game variables.
          revealed[message.data[i].x][message.data[i].y] = true;
          board[message.data[i].x][message.data[i].y] = message.data[i].val;
          if (message.data[i].val > 0) {
            ps.push(
              new ParticleSystem(
                (message.data[i].x + 0.5) * (800 / width),
                (message.data[i].y + 0.5) * (800 / height),
                2,
                10,
                ["#EFDDCC"],
                true,
                200,
                10,
                25
              )
            );
          }
        }
        clearInterval(particleLoop);
        particleLoop = setInterval(fullRender, 50);
        renderGrid(); //Render the new information#

        let tot = message.data[message.data.length - 1];
        if (tot >= 5) {
          revealAmount += Math.floor(tot / 5);
          collecting = true;
        }
        // ------------------------------------------------------
      }
    } else {
      //If the player is the bomber
      if (typeof message.data[0] == "object") {
        for (let i = 0; i < message.data.length; i++) {
          //Loop throught the tiles and render the revealed ones
          revealed[message.data[i].x][message.data[i].y] = true;
          board[message.data[i].x][message.data[i].y] = message.data[i].value;
        }
        renderGrid();
      }
    }
  });
}

//Utility function to render rectangles on the game canvas

function rect(x, y, fill, stroke) {
  ctx.fillStyle = fill;
  ctx.stroke = stroke;
  ctx.fillRect(
    x * (800 / width),
    y * (800 / height),
    800 / width,
    800 / height
  );
  ctx.strokeRect(
    x * (800 / width),
    y * (800 / height),
    800 / width,
    800 / height
  );
}

//Function to listen for and process client click inputs

document.addEventListener("click", async (event) => {
  box = cvs.getBoundingClientRect(); //Ensure the boundaries of the game canvas are up to date.
  if (
    event.x > box.left &&
    event.x < box.right &&
    event.y > box.top &&
    event.y < box.bottom
  ) {
    //If the input is inside the game canvas.
    let selected = {
      //Store the coordinates of the input translated into the game space.
      x: Math.floor((event.x - box.left) / (box.width / width)),
      y: Math.floor((event.y - box.top) / (box.height / height)),
    };
    if (!collecting && event.button == 0) {
      //If the player is not currently the solver choosing which tiles to send to the bomber, and the event type is a left click
      await gameChannel.publish("input", {
        position: selected,
        type: "left",
        player: clientId,
      }); //Publish the input to the server
    } else if (revealed[selected.x][selected.y]) {
      // If the player is the solver and choosing which tiles to send to the bomber
      let val = true;
      for (let i = 0; i < currentCollected.length; i++) {
        //Check that the tile hasn't already been selected.
        if (
          currentCollected[i].pos.x == selected.x &&
          currentCollected[i].pos.y == selected.y
        ) {
          val = false;
        }
      }
      if (val) {
        //Add the selected tile to the end of the array to send to the solver. Removes the earliest tile in the array that hasn't already been sent to the bomber if the amount of selected tiles is above the necessary amount.
        currentCollected.push({ pos: selected, fixed: false });
        if (currentCollected.length > revealAmount) {
          currentCollected.splice(currentFixedIndex, 1);
        }
        if (currentCollected.length >= revealAmount) {
          document.getElementById("confirmButton").style.backgroundColor =
            "aliceblue";
        }
        renderGrid();
      }
    }
  }
});

function initGrid() {
  //Function which fills the board and revealed arrays with blank values.
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
  //Function which uses HTML Canvas rendering library to display the current state of the board.
  ctx.fillStyle = "#CCC";
  ctx.fillRect(0, 0, 800, 800);
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      ctx.stroke = "#000000";
      ctx.strokeRect(
        i * (800 / width),
        j * (800 / height),
        800 / width,
        800 / height
      );
      ctx.fillStyle = "#AAA";
      ctx.fillRect(
        i * (800 / width) + 2,
        (j + 1) * (800 / height) + 4 - 800 / height / 6,
        800 / width - 4,
        800 / height / 6 - 4
      );
      ctx.fillRect(
        (i + 1) * (800 / width) + 2 - 800 / width / 6,
        j * (800 / height) + 2,
        800 / width / 6 - 4,
        800 / height - 4
      );
      ctx.fillStyle = "#FFF";
      ctx.fillRect(
        i * (800 / width) + 2,
        j * (800 / height) + 2,
        800 / width / 6 - 4,
        800 / height - 4
      );
      ctx.fillRect(
        i * (800 / width) + 2,
        j * (800 / height) + 2,
        800 / width - 4,
        800 / height / 6 - 4
      );
      let isCollectedSquare = false;
      for (let k = 0; k < currentCollected.length; k++) {
        if (i == currentCollected[k].pos.x && j == currentCollected[k].pos.y) {
          rect(i, j, "#AAFFAA", "000000");
          isCollectedSquare = true;
        }
      }
      if (revealed[i][j] && board[i][j] > 0) {
        rect(i, j, isCollectedSquare ? "#AFA" : "#FFF", "#000000");
        ctx.fillStyle = "#000000";
        ctx.font = "30px Arial";
        ctx.fillText(
          board[i][j].toString(),
          i * (800 / width) + 16,
          j * (800 / height) + 40
        );
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

document.addEventListener("mousemove", (e) => {
  //Keeps track of the current mouse position.
  mouseX = e.x;
  mouseY = e.y;
});

async function rightClick() {
  //Function which is called when the user right clicks on the canvas.
  box = cvs.getBoundingClientRect(); //Updates the size of the game canvas.
  let selected = {
    x: Math.floor((event.x - box.left) / (box.width / width)),
    y: Math.floor((event.y - box.top) / (box.height / height)),
  };

  let found = false; //Checks if the tile the user clicked on is in the array of flagged tiles, and removes it if it is
  for (let i = 0; i < flagged.length; i++) {
    if (flagged[i].x == selected.x && flagged[i].y == selected.y) {
      flagged.splice(i, 1);
      found = true;
      renderGrid();
      break;
    }
  }
  if (!found && !revealed[selected.x][selected.y]) {
    //If the current selected tile was not already flagged, add it to the flagged array and render it.
    rect(selected.x, selected.y, "#FF0000", "#000000");
    flagged.push({
      x: selected.x,
      y: selected.y,
    });
  }
}

window.addEventListener("contextmenu", (event) => {
  //Prevents the right click menu from appearing on the page
  if (document.elementFromPoint(mouseX, mouseY) == cvs) {
    event.preventDefault();
  }
});

//Function called when the solver presses the confirm selection button.

async function confirmSelected() {
  console.log("aa");
  if (
    currentCollected.length >= revealAmount &&
    document.getElementById("confirmButton").style.backgroundColor ==
      "aliceblue" &&
    collecting
  ) {
    //Check the solver has selected enough tiles
    document.getElementById("confirmButton").style.backgroundColor =
      "lightgray";

    for (let i = 0; i < currentCollected.length; i++) {
      if (currentCollected[i].fixed == false) {
        currentCollected[i].fixed = true;
        currentFixedIndex = i + 1;
      }
    }

    console.log("bb");
    gameChannel.publish("solverSelection", currentCollected);
    collecting = false;
  }
}

async function getTimes() {
  await gameChannel.subscribe("time", (message) => {
    document.getElementById("opponentTimer").innerText = formatTime(
      role == "solver" ? message.data.bomberTime : message.data.solverTime
    );
    document.getElementById("playerTimer").innerText = formatTime(
      role == "bomber" ? message.data.bomberTime : message.data.solverTime
    );
  });
}

async function getUpdates() {
  await gameChannel.subscribe("updates", (message) => {
    document
      .getElementById("updateSidebar")
      .appendChild(document.createElement("p"));
    document
      .getElementById("updateSidebar")
      .children[
        document.getElementById("updateSidebar").children.length - 1
      ].setAttribute("class", "gameUpdate");
    document.getElementById("updateSidebar").children[
      document.getElementById("updateSidebar").children.length - 1
    ].innerHTML = message.data;
  });
}

const formatTime = (x) =>
  Math.floor(x / 60).toString() +
  ":" +
  (x % 60 < 10 ? "0" : "") +
  (x % 60).toString();

getTimes();

gameCommands();

getUpdates();

ctx.fillStyle = "#BBB";
ctx.fillRect(0, 0, 800, 800);

class ParticleSystem {
  constructor(
    x,
    y,
    velocity,
    count,
    colours,
    gravity,
    lifetime,
    minWidth,
    maxWidth
  ) {
    this.x = x;
    this.y = y;
    this.vel = velocity;
    this.num = count;
    this.cols = colours;
    this.grav = gravity;
    this.lifetime = lifetime;
    this.a = 1;
    this.particles = new Array(count);
    for (let i = 0; i < this.particles.length; i++) {
      let theta = Math.random() * 2 * Math.PI;
      this.particles[i] = {
        x: x,
        y: y,
        velX: velocity * Math.sin(theta),
        velY: 1,
        colour: colours[Math.floor(Math.random() * colours.length)],
        w: Math.random() * (maxWidth - minWidth) + minWidth,
      };
    }
    this.loop;
  }
}

function renderSystem(s) {
  s.a -= 1 / (s.lifetime / 50);
  for (let i = 0; i < s.num; i++) {
    let p = s.particles[i];
    p.velY += s.grav ? 0.1 : 0;
    p.x += p.velX;
    p.y += p.velY;
    ctx.fillStyle = rgbaFromHex(p.colour, s.a);
    console.log(rgbaFromHex(p.colour, s.a));
    ctx.fillRect(p.x, p.y, p.w, p.w);
  }
}

const rgbaFromHex = (h, a) =>
  `rgba(${parseInt(h[1] + h[2], 16)}, ${parseInt(h[3] + h[4], 16)}, ${parseInt(
    h[5] + h[6],
    16
  )}, ${a})`;