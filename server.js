/*
! ----------------------------------- IMPORTS - References the required node JS modules for the program ----------------------------------- !
*/

const express = require("express");
const Ably = require("ably");
const app = express();

/*
! ----------------------------------- VARIABLES  ----------------------------------- !
*/

/* Game variables - Variables necessary to store game and player data */

let totalPlayers = 0;
let currentGames = [];
let gameChannels = [];
let queue = [];
const width = 15;
const height = 15;
const mines = 40;

/* Reference to the api key used to allow use of the Ably realtime messaging library */

const apiKey = "EPShlg.7aXq-w:yRIF96jnwBoMRKSyzwYGWZOBPp4xuHOxPwDD4rhZjjw";

/* Creates an instance of the realtime messaging class from the Ably library to allow use of the messaging*/

const realtime = new Ably.Realtime({
  key: apiKey,
  echoMessages: false, //Stops server receiving its own messages
});

/* Tells the app to listen at port 3000 from the webpages url(while the server isn't published this is localhost or 127.0.0.1). Stores the associated HTTP server in the vairable listener. */

const listener = app.listen(4000, () => {
  console.log("Your app is listening on port " + listener.address().port);
});

/* Defines an Ably messaging channel to be used to handle communication during matchmaking */

const matchmakingChannel = realtime.channels.get("matchmaking");

/*
! ----------------------------------- CLASSES  -----------------------------------  !
*/

/* Defines a class which creates the template for objects that can store and handle all the logic of an individual game. */

class Game {
  constructor() {
    //Defines all Instance variable
    this.playerIds = [];
    this.nicknames = [];
    this.connectedPlayers = 0;
    this.board = [];
    this.turn = 0;
    this.revealed = [];
    this.player1Time = 300;
    this.player2Time = 60;
    this.revealedTiles = 0;
  }

  /*
  ! ----------------------------------- METHODS  ----------------------------------- !
  */

  /* Defines a method which populates both the board and revealed instance variables as 2D arrays of dimensions width by height (lines 15/16).
  It fills the board with -2 in every entry and the revealed array with false in every entry */

  generateBlank() {
    for (let i = 0; i < width; i++) {
      this.board.push([]);
      this.revealed.push([]);
      for (let j = 0; j < height; j++) {
        this.board[i].push(-2);
        this.revealed[i].push(false);
      }
    }
  }

  /* Defines a method which, given the position of first input, randomly generates a minesweeper grid with an amount of mines dictated by
  the mines variable defined earlier. */

  genBoard(fX, fY) {
    //Setting the values of the area around the first input to all be 0.

    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        if (fX + i >= 0 && fY + j >= 0 && fX + i < width && fY + j < height) {
          this.board[fX + i][fY + j] = 0;
        }
      }
    }

    /*Loops for the amount of mines and chooses a random spot (which is not alread occupied by a mine or
      blank space around the first input) to place a mine (denoted by a value of -1 in the grid) */

    for (let i = 0; i < mines; i++) {
      let x = Math.floor(Math.random() * width);
      let y = Math.floor(Math.random() * height);
      while (this.board[x][y] !== -2) {
        x = Math.floor(Math.random() * width);
        y = Math.floor(Math.random() * height);
      }
      this.board[x][y] = -1;
    }

    // For every square on the grid that isn't a mine, counts the total amount of
    // mines in all adjacent squares and stores this value in the grid array.

    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        if (this.board[i][j] == 0 || this.board[i][j] == -2) {
          this.board[i][j] = 0;
          for (let k = -1; k <= 1; k++) {
            for (let l = -1; l <= 1; l++) {
              if (
                i + k >= 0 &&
                j + l >= 0 &&
                i + k < width &&
                j + l < height &&
                this.board[i + k][j + l] == -1
              ) {
                this.board[i][j]++;
              }
            }
          }
        }
      }
    }
  }

  //Increases the value of the turn instance variable by 1.

  incrementTurn() {
    this.turn++;
  }

  //Sets the value of a specific entry in the revealed array to true.

  reveal(x, y) {
    this.revealed[x][y] = true;
  }
}
/* 
! ----------------------------------- FUNCTIONS ----------------------------------- !
*/

/* Defines a funtion which returns a randomly generated id string to be used to identify players */

function uniqueId(prefix) {
  return prefix + "-" + totalPlayers + Math.random().toString(36).substr(2, 16);
}

/* Defines a function which concatenates any two 1 D arrays a and b */

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

/* This functions handles matchmaking, it checks for when clients join the queue and assigns them to unique gamerooms. */

async function matchmaking() {
  matchmakingChannel.presence.subscribe("enter", async (player) => {
    // Code which is called whenever a player joins the queue
    if (!queue.includes(player.clientId)) {
      // If the player is not already in the queue.
      queue.push(player.clientId); //Add the player to the queue.
      totalPlayers++;
      createGames();
    }
  });
}

/* This functions handles the creation of gamerooms */

async function createGames() {
  while (queue.length >= 2) {
    //While there are enough players to make a game
    const gc = uniqueId("gc");
    for (let i = 0; i < 2; i++) {
      //Send a message to the first two players in the queue with a unique name for a messaging channgel
      await matchmakingChannel.publish(queue[i], gc);
    }
    gameChannels.push(realtime.channels.get(gc)); //Store the new messaging channel in an array
    currentGames.push(new Game()); // Create a game object and store it
    queue.splice(0, 2); //Remove the players from the queue
    gameLoop(
      currentGames[currentGames.length - 1],
      gameChannels[gameChannels.length - 1]
    ); // Start the game loop function for the game.
  }
}

/* This function handles the main bulk of the game logic */

async function gameLoop(cG, gC) {
  gC.presence.subscribe("enter", async (player) => {
    //Check for clients connecting to the given game channel
    cG.connectedPlayers++;
    //Store the newly assigned player client Ids and the player nicknames which are sent to the server upon the player joining the game channel.
    cG.playerIds.push(player.clientId);
    cG.nicknames.push(player.data.nickname);

    await gC.publish(
      "updates",
      `<strong>${
        cG.nicknames[cG.connectedPlayers - 1]
      }</strong> joined the game`
    );

    if (cG.connectedPlayers == 2) {
      //Once both players connected to the game send the details of each player to the clients.
      cG.generateBlank(); //Set up the game board for the current game.
      await gC.publish("commands", {
        p1: cG.playerIds[0],
        p2: cG.playerIds[1],
        nickname1: cG.nicknames[0],
        nickname2: cG.nicknames[1],
        identifier: "playerRoles",
      });
    }
  });

  gC.subscribe("resignation", async (message) => {
    if(cG.board[0][0] == -2) {
      cG.genBoard(0,0);
    }
    await gC.publish("commands", {
      //Publish a bomber win
      winner: message.data.player == cG.playerIds[0] ? "bomber" : "solver",
      identifier: "winLoss",
      winType:"Your oponent resigned",
      board:cG.board
    });
  });

  //Code to handle player input

  gC.subscribe("input", async (message) => {
    //Code to check for the first solver input and generate positions of the mines

    if (cG.turn == 0 && message.clientId == cG.playerIds[0]) {
      cG.genBoard(message.data.position.x, message.data.position.y);
    }

    //Code for all other solver turns

    if (
      //Check that the player is the solver and that its a left click input
      cG.turn % 2 == 0 &&
      message.clientId == cG.playerIds[0] &&
      message.data.type == "left"
    ) {
      if (cG.board[message.data.position.x][message.data.position.y] == -1) {
        //If the solver clicks a mine
        await gC.publish("commands", {
          //Publish a bomber win
          winner: "bomber",
          identifier: "winLoss",
          winType:"The solver detonated a mine by mistake",
          board:cG.board
        });
      }

      if (!cG.revealed[message.data.position.x][message.data.position.y]) {
        //If the grid position is not already revealed
        let fullRevealed = waterfall(
          message.data.position.x,
          message.data.position.y,
          cG,
          null
        ); // Call the waterfall function to get the cells which are now revealed to the solver.

        fullRevealed.push({
          x: message.data.position.x,
          y: message.data.position.y,
          val: cG.board[message.data.position.x][message.data.position.y],
        });

        let totVal = 0;
        fullRevealed.forEach((x) => (totVal += x.val)); // Calculate the value of the total revealed cells
        totVal -= fullRevealed[fullRevealed.length - 1].val;
        fullRevealed.push(totVal);
        fullRevealed.sort((a, b) => a.x + a.y * height - (b.x + b.y * height));
        cG.revealedTiles += fullRevealed.length - 2; //Increments the amount of solver revealed tiles, and if this number is equal to the total amount of non-mine tiles publish a solver win.
        console.log(cG.revealedTiles, fullRevealed);
        if (cG.revealedTiles == width * height - mines) {
          await gC.publish("commands", {
            //Publish a solver win
            winner: "solver",
            identifier: "winLoss",
            winType: "The solver revealed all non mine tiles",
            board:cG.board
          });
        }
        await gC.publish("solver", fullRevealed); //Publish the revealed information to the solver
        await gC.publish(
          "updates",
          `<strong>${
            cG.nicknames[0]
          }</strong> has revealed tiles with a combined value of <strong>${
            fullRevealed[fullRevealed.length - 1]
          }</strong>. ${
            fullRevealed[fullRevealed.length - 1] >= 5
              ? `They must now reveal <strong>${Math.floor(
                  fullRevealed[fullRevealed.length - 1] / 5
                )}</strong> tiles to <strong>${cG.nicknames[1]}</strong>.`
              : "Since they have revealed tiles with a combined value less than 5, it remains their turn."
          }`
        );
      }
    }

    //Code to handle the bombers turn.

    if (
      //Check that conditions are met for the bombers turn
      cG.turn % 2 == 1 &&
      message.data.player == cG.playerIds[1] &&
      message.data.type == "left"
    ) {
      if (cG.board[message.data.position.x][message.data.position.y] == -1) {
        //If the bomber finds a mine
        await gC.publish("commands", {
          //Publish that the bomber has won
          winner: "bomber",
          identifier: "winLoss",
          winType:"The bomber found a mine",
          board:cG.board
        });
      } else {
        //Publish the value of the tile at the bombers input position
        let revealed = [
          {
            x: message.data.position.x,
            y: message.data.position.y,
            value: cG.board[message.data.position.x][message.data.position.y],
          },
        ];
        await gC.publish("bomber", revealed);
      }

      await gC.publish(
        "updates",
        `<strong>${cG.nicknames[1]}</strong> did not discover a mine. It is now <strong>${cG.nicknames[0]}'s</strong> turn.`
      );

      cG.incrementTurn(); //Moves back to the solvers turn
    }
  });

  //Code to handle the solvers selection of revealed cells.

  gC.subscribe("solverSelection", async (message) => {
    if (cG.turn % 2 == 0) {
      let revealed = [];
      message.data.forEach((c) => {
        //Format the chosen cells and check the values of them
        revealed.push({
          x: c.pos.x,
          y: c.pos.y,
          value: cG.board[c.pos.x][c.pos.y],
        });
      });

      await gC.publish("bomber", revealed); //Publish the revealed cells to the bomber.
      cG.incrementTurn(); //Increase the turn
      await gC.publish(
        "updates",
        `<strong>${cG.nicknames[0]}'s</strong> turn is now over. It is now <strong>${cG.nicknames[1]}'s</strong> turn.`
      );
    }
  });
}

/* This function is a recursive process to find all the revealed cells connected to a given cell */

function waterfall(x, y, game) {
  game.reveal(x, y);

  if (
    // If the tile at the requested position has a non zero value and isn't already included in the found tiles array.
    game.board[x][y] > 0
  ) {
    return [{ x: x, y: y, val: game.board[x][y] }];
  }
  let out = [{ x: x, y: y, val: 0 }];
  for (let i = -1; i <= 1; i++) {
    //Loop through all the surrounding tiles
    for (let j = -1; j <= 1; j++) {
      if (
        //Check that the currently viewed tile is in the grid
        x + i >= 0 &&
        y + j >= 0 &&
        x + i < width &&
        y + j < height &&
        game.board[x + i][y + j] >= 0 &&
        !game.revealed[x+i][y+j]
      ) {
        out = concat(out, waterfall(x + i, y + j, game));
      }
    }
  }

  return out;
}

/* 
! ----------------------------------- MAIN PROGRAM ----------------------------------- !
*/

/* Gives the web server access to all files in the client folder so these can be displayed to the user */

app.use(express.static("client"));

/* The below code handles client authentication.When a client first connects to Ably it will request an authentication token from the / auth path which will lead to the below code beign called this will generate a random id using the uniqueId function and return this to the client to be there authentication token. */

app.get("/auth", (request, response) => {
  const tokenParams = {
    clientId: uniqueId("id"),
  };
  realtime.auth.requestToken(tokenParams, function (err, tokenRequest) {
    if (err) {
      response
        .status(500)
        .send("Error requesting token: " + JSON.stingify(err));
    } else {
      response.setHeader("Content-Type", "application/json");
      response.send(JSON.stringify(tokenRequest));
    }
  });
});

/* Handles all requests to the base webpage. Tells the client which response headers it can communicate with and then sends the index.html file to the client. */

app.get("/", (request, response) => {
  response.header("Access-Control-Allow-Origin", "*");
  response.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept"
  );
  response.sendFile(__dirname + "/index.html");
});

/* Sends the gameRoom.html to clients which request the /gameroom path*/

app.get("/gameroom", (request, response) => {
  response.sendFile(__dirname + "/client/gameRoom.html");
});

/* Starts the Ably connection and logs a message to the console when it is successful */

realtime.connection.once("connected", () => {
  console.log("Ably connected");
});

// Calls the matchmaking function

matchmaking();

// Timer funtion - loops through all currently active games every second and decreases the time of the player whose turn it is by a second.

setInterval(async () => {
  for (let i = 0; i < currentGames.length; i++) {
    if (currentGames[i].turn % 2 == 0) {
      currentGames[i].player1Time--;
    } else {
      currentGames[i].player2Time--;
    }
    await gameChannels[i].publish("time", {
      solverTime: currentGames[i].player1Time,
      bomberTime: currentGames[i].player2Time,
    });
  }
}, 1000);
