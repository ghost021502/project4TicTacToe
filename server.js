// Created by Irvin Luna
// Project 4: Multiplayer Tic-Tac-Toe server
// Lecture 7 concepts: Node.js, Express, HTTP, WebSocket, shared game state.

const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static("public"));

// Lecture 7 uses this password for the classroom game.
const GAME_PASSWORD = "secret123";

// The server is the central authority and owns the shared game state.
let gameState = {
    board: Array(9).fill(""),
    currentPlayer: "X",
    winner: null,
    tie: false
};

// Only two connected clients can be players.
let players = {
    X: null,
    O: null
};

// Send the current state to every connected browser.
function broadcastState() {
    const payload = JSON.stringify({
        type: "state",
        gameState: gameState
    });

    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(payload);
        }
    });
}

// Check all eight possible winning combinations.
function checkWinner(board) {
    const lines = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const [a, b, c] of lines) {
        if (
            board[a] &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}

// A new WebSocket connection is created for each browser.
wss.on("connection", ws => {
    // Information belonging to this individual connection.
    ws.playerName = "";
    ws.role = "spectator";
    ws.authenticated = false;

    // Immediately send the current board to the new connection.
    ws.send(JSON.stringify({ type: "state", gameState: gameState }));

    ws.on("message", message => {
        let data;

        // Ignore malformed JSON instead of crashing the server.
        try {
            data = JSON.parse(message);
        } catch (error) {
            ws.send(JSON.stringify({
                type: "error",
                message: "The server received an invalid message."
            }));
            return;
        }

        // LOGIN: check the password and assign X, O, or spectator.
        if (data.type === "login") {
            if (ws.authenticated) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "You are already logged in."
                }));
                return;
            }

            const name = typeof data.name === "string" ? data.name.trim() : "";

            if (!name) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Please enter your name."
                }));
                return;
            }

            if (data.password !== GAME_PASSWORD) {
                ws.send(JSON.stringify({
                    type: "error",
                    message: "Invalid password. Please try again."
                }));
                return;
            }

            ws.playerName = name;
            ws.authenticated = true;

            if (!players.X) {
                players.X = ws;
                ws.role = "X";
            } else if (!players.O) {
                players.O = ws;
                ws.role = "O";
            } else {
                ws.role = "spectator";
            }

            ws.send(JSON.stringify({
                type: "role",
                role: ws.role,
                name: ws.playerName
            }));

            // Update everyone so the player/spectator count stays current.
            broadcastState();
            return;
        }

        // No game commands are accepted until the client logs in.
        if (!ws.authenticated) {
            ws.send(JSON.stringify({
                type: "error",
                message: "Join the game before sending game commands."
            }));
            return;
        }

        // PLACE: validate the move on the server before changing the board.
        if (data.type === "place") {
            const index = data.index;

            if (ws.role !== "X" && ws.role !== "O") {
                return; // Spectators cannot play.
            }

            if (ws.role !== gameState.currentPlayer) {
                return; // It is not this player's turn.
            }

            if (gameState.winner || gameState.tie) {
                return; // The game has already ended.
            }

            if (!Number.isInteger(index) || index < 0 || index > 8) {
                return; // Only board positions 0 through 8 are valid.
            }

            if (gameState.board[index] !== "") {
                return; // A square can only be used once.
            }

            gameState.board[index] = gameState.currentPlayer;

            const winner = checkWinner(gameState.board);

            if (winner) {
                gameState.winner = winner;
            } else if (gameState.board.every(square => square !== "")) {
                gameState.tie = true;
            } else {
                gameState.currentPlayer =
                    gameState.currentPlayer === "X" ? "O" : "X";
            }

            broadcastState();
        }

        // RESET: either active player can start a new game.
        if (data.type === "reset") {
            if (ws.role !== "X" && ws.role !== "O") {
                return; // Spectators cannot reset the game.
            }

            gameState = {
                board: Array(9).fill(""),
                currentPlayer: "X",
                winner: null,
                tie: false
            };

            broadcastState();
        }
    });

    // Free the player position if a player closes their browser.
    ws.on("close", () => {
        if (players.X === ws) {
            players.X = null;
        }

        if (players.O === ws) {
            players.O = null;
        }

        broadcastState();
    });
});

// Start the HTTP and WebSocket server on port 3000.
server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
