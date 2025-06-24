const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: ['https://cadeid.github.io', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.use(cors({
    origin: ['https://cadeid.github.io', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => {
    res.send('太空射擊遊戲後端運行中！');
});

const waitingPlayers = [];
const rooms = new Map();

const generateRoomId = () => {
    return Math.random().toString(36).substring(2, 10);
};

io.on('connection', (socket) => {
    console.log(`玩家 ${socket.id} 連線，來源: ${socket.handshake.headers.origin}`);

    socket.on('joinMatchmaking', () => {
        waitingPlayers.push(socket);
        console.log(`玩家 ${socket.id} 加入匹配隊列`);

        if (waitingPlayers.length >= 2) {
            const player1 = waitingPlayers.shift();
            const player2 = waitingPlayers.shift();

            const roomId = generateRoomId();
            const gameState = {
                players: {
                    [player1.id]: { x: 100, y: 500, angle: 0, health: 100, score: 0 },
                    [player2.id]: { x: 1000, y: 500, angle: 180, health: 100, score: 0 }
                },
                bullets: []
            };

            rooms.set(roomId, { player1, player2, gameState });

            player1.join(roomId);
            player2.join(roomId);
            io.to(roomId).emit('matchFound', { roomId, players: gameState.players });
            console.log(`房間 ${roomId} 創建，玩家 ${player1.id} 對 ${player2.id}`);
        } else {
            let progress = 0;
            const matchmakingInterval = setInterval(() => {
                progress += 2;
                socket.emit('matchmakingProgress', { progress, timeLeft: Math.max(0, Math.floor(15 - (progress / 100) * 15)) });
                if (progress >= 100 || !waitingPlayers.includes(socket)) {
                    clearInterval(matchmakingInterval);
                }
            }, 100);
        }
    });

    socket.on('playerMove', ({ x, y, angle }) => {
        const room = Array.from(rooms.entries()).find(([_, r]) => r.player1.id === socket.id || r.player2.id === socket.id);
        if (room) {
            const [roomId, gameRoom] = room;
            gameRoom.gameState.players[socket.id] = { ...gameRoom.gameState.players[socket.id], x, y, angle };
            io.to(roomId).emit('gameStateUpdate', gameRoom.gameState);
        }
    });

    socket.on('playerShoot', ({ x, y, angle }) => {
        const room = Array.from(rooms.entries()).find(([_, r]) => r.player1.id === socket.id || r.player2.id === socket.id);
        if (room) {
            const [roomId, gameRoom] = room;
            const bullet = {
                owner: socket.id,
                x,
                y,
                velocityX: Math.sin((angle * Math.PI) / 180) * 10,
                velocityY: -Math.cos((angle * Math.PI) / 180) * 10,
                createdAt: Date.now()
            };
            gameRoom.gameState.bullets.push(bullet);
            io.to(roomId).emit('gameStateUpdate', gameRoom.gameState);
        }
    });

    socket.on('bulletHit', ({ targetId, damage }) => {
        const room = Array.from(rooms.entries()).find(([_, r]) => r.player1.id === socket.id || r.player2.id === socket.id);
        if (room) {
            const [roomId, gameRoom] = room;
            const target = gameRoom.gameState.players[targetId];
            if (target) {
                target.health -= damage;
                gameRoom.gameState.players[socket.id].score += 10;
                if (target.health <= 0) {
                    const winner = targetId === gameRoom.player1.id ? gameRoom.player2.id : gameRoom.player1.id;
                    io.to(roomId).emit('gameOver', {
                        winner,
                        scores: {
                            [gameRoom.player1.id]: gameRoom.gameState.players[gameRoom.player1.id].score,
                            [gameRoom.player2.id]: gameRoom.gameState.players[gameRoom.player2.id].score
                        }
                    });
                    rooms.delete(roomId);
                } else {
                    io.to(roomId).emit('gameStateUpdate', gameRoom.gameState);
                }
            }
        }
    });

    socket.on('disconnect', () => {
        console.log(`玩家 ${socket.id} 斷線`);
        const room = Array.from(rooms.entries()).find(([_, r]) => r.player1.id === socket.id || r.player2.id === socket.id);
        if (room) {
            const [roomId, gameRoom] = room;
            const opponent = socket.id === gameRoom.player1.id ? gameRoom.player2 : gameRoom.player1;
            opponent.emit('gameOver', { winner: opponent.id, message: '對手斷線，你獲勝！' });
            rooms.delete(roomId);
        }
        const index = waitingPlayers.indexOf(socket);
        if (index !== -1) waitingPlayers.splice(index, 1);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`伺服器運行在端口 ${PORT}`);
});
  console.log(`伺服器運行在端口 ${PORT}`);
});
