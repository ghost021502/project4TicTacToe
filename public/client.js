// Created by Irvin Luna
// Project 4: Browser-side Tic-Tac-Toe client.
// Uses the Lecture 7 WebSocket, canvas, and event-listener examples.

// DOM ELEMENTS
const boardCanvas = document.getElementById("board");
const ctx = boardCanvas.getContext("2d");
const statusElement = document.getElementById("status");
const roleElement = document.getElementById("role");
const connectionElement = document.getElementById("connection");
const resetBtn = document.getElementById("resetBtn");
const joinBtn = document.getElementById("joinBtn");
const nameInput = document.getElementById("nameInput");
const passwordInput = document.getElementById("passwordInput");

const CELL_SIZE = 200;

// Create a permanent WebSocket connection to the Node.js server.
const ws = new WebSocket(`ws://${window.location.host}`);

// The browser displays the state received from the server.
// The server, not the browser, is the source of truth.
let gameState = null;
let role = "spectator";
let loggedIn = false;

// DRAW THE BOARD GRID (adapted from the Lecture 7 canvas example).
function drawGrid() {
    ctx.strokeStyle = "#333333";
    ctx.lineWidth = 6;

    ctx.beginPath();
    ctx.moveTo(CELL_SIZE, 0);
    ctx.lineTo(CELL_SIZE, 600);
    ctx.moveTo(CELL_SIZE * 2, 0);
    ctx.lineTo(CELL_SIZE * 2, 600);
    ctx.moveTo(0, CELL_SIZE);
    ctx.lineTo(600, CELL_SIZE);
    ctx.moveTo(0, CELL_SIZE * 2);
    ctx.lineTo(600, CELL_SIZE * 2);
    ctx.stroke();
}

// DRAW AN X IN THE SELECTED CELL.
function drawX(x, y) {
    const padding = 45;

    ctx.strokeStyle = "#2457a7";
    ctx.lineWidth = 12;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(x + padding, y + padding);
    ctx.lineTo(x + CELL_SIZE - padding, y + CELL_SIZE - padding);
    ctx.moveTo(x + CELL_SIZE - padding, y + padding);
    ctx.lineTo(x + padding, y + CELL_SIZE - padding);
    ctx.stroke();
}

// DRAW AN O IN THE SELECTED CELL.
function drawO(x, y) {
    ctx.strokeStyle = "#d14b3f";
    ctx.lineWidth = 12;

    ctx.beginPath();
    ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 65, 0, Math.PI * 2);
    ctx.stroke();
}

// Redraw the canvas whenever the server sends updated game state.
function drawBoard() {
    ctx.clearRect(0, 0, boardCanvas.width, boardCanvas.height);
    drawGrid();

    if (!gameState) {
        return;
    }

    // Draw each X or O using its position in the shared board array.
    gameState.board.forEach((value, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const x = col * CELL_SIZE;
        const y = row * CELL_SIZE;

        if (value === "X") {
            drawX(x, y);
        } else if (value === "O") {
            drawO(x, y);
        }
    });

    // Display winner, tie, or the current turn.
    if (gameState.winner) {
        statusElement.textContent = `Winner: ${gameState.winner}!`;
    } else if (gameState.tie) {
        statusElement.textContent = "It's a tie!";
    } else {
        statusElement.textContent = `Turn: ${gameState.currentPlayer}`;
    }

    // Tell each connected user whether they can make a move.
    if (!loggedIn) {
        statusElement.textContent = "Enter your name and password to join.";
    } else if (role === "spectator") {
        statusElement.textContent += " (You are watching as a spectator.)";
    } else if (role !== gameState.currentPlayer && !gameState.winner && !gameState.tie) {
        statusElement.textContent += " (Please wait for your turn.)";
    }
}

// WebSocket connection status.
ws.onopen = () => {
    connectionElement.textContent = "Connected to the game server.";
};

ws.onclose = () => {
    connectionElement.textContent = "Disconnected from the server. Refresh to reconnect.";
    statusElement.textContent = "The game server connection was closed.";
    joinBtn.disabled = true;
};

ws.onerror = () => {
    connectionElement.textContent = "Could not connect. Make sure the Node.js server is running.";
};

// RECEIVE SERVER MESSAGES.
ws.onmessage = event => {
    const data = JSON.parse(event.data);

    // Updated shared game state.
    if (data.type === "state") {
        gameState = data.gameState;
        drawBoard();
    }

    // Server tells this browser its assigned role.
    if (data.type === "role") {
        role = data.role;
        loggedIn = true;
        roleElement.textContent = `Logged in as ${data.name} (${role})`;
        joinBtn.disabled = true;
        nameInput.disabled = true;
        passwordInput.disabled = true;
        drawBoard();
    }

    // Show login or server validation errors.
    if (data.type === "error") {
        alert(data.message);
    }
};

// JOIN GAME EVENT LISTENER.
joinBtn.addEventListener("click", () => {
    if (ws.readyState !== WebSocket.OPEN) {
        alert("The server is not connected yet. Please wait or refresh.");
        return;
    }

    ws.send(JSON.stringify({
        type: "login",
        name: nameInput.value.trim(),
        password: passwordInput.value
    }));
});

// Allow Enter to submit the login information.
passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        joinBtn.click();
    }
});

// BOARD CLICK EVENT LISTENER.
// Convert the mouse position into one of the nine board indexes.
boardCanvas.addEventListener("click", event => {
    if (!loggedIn || (role !== "X" && role !== "O") || !gameState) {
        return;
    }

    if (gameState.winner || gameState.tie || role !== gameState.currentPlayer) {
        return;
    }

    const rect = boardCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * (boardCanvas.width / rect.width);
    const y = (event.clientY - rect.top) * (boardCanvas.height / rect.height);

    const col = Math.floor(x / CELL_SIZE);
    const row = Math.floor(y / CELL_SIZE);

    if (col < 0 || col > 2 || row < 0 || row > 2) {
        return;
    }

    const index = row * 3 + col;

    // Send the requested move to the server.
    // The server checks whether the move is valid before changing the board.
    ws.send(JSON.stringify({ type: "place", index: index }));
});

// RESET GAME EVENT LISTENER.
resetBtn.addEventListener("click", () => {
    if (!loggedIn || (role !== "X" && role !== "O")) {
        alert("Only the two players can reset the game.");
        return;
    }

    ws.send(JSON.stringify({ type: "reset" }));
});

// Draw an empty grid while waiting for the first server message.
drawGrid();
