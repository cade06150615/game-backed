const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

const PORT = process.env.PORT || 3000;

// 存儲匹配中的玩家和遊戲房間
const matchmakingQueue = [];
const rooms = {};

// 碰撞檢測函數
function checkCollision(bullet, player) {
    const dx = bullet.x - player.x;
    const dy = bullet.y - player.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    return distance < 30; // 假設飛船半徑約為 30
}

io.on('connection', (socket) => {
    console.log(`玩家連線: ${socket.id}`);

    // 玩家加入匹配
    socket.on('joinMatchmaking', (data) => {
        const player = {
            id: socket.id,
            name: data.name || '玩家',
            x: 100,
            y: 400,
            angle: 0,
            health: 100,
            score: 0
        };
        matchmakingQueue.push(player);

        if (matchmakingQueue.length >= 2) {
            const player1 = matchmakingQueue.shift();
            const player2 = matchmakingQueue.shift();
            const roomId = `room_${Date.now()}`;
            rooms[roomId] = {
                players: {
                    [player1.id]: player1,
                    [player2.id]: player2
                },
                bullets: []
            };

            // 通知玩家匹配成功
            io.to(player1.id).emit('matchFound', {
                roomId,
                players: rooms[roomId].players
            });
            io.to(player2.id).emit('matchFound', {
                roomId,
                players: rooms[roomId].players
            });

            // 將玩家加入房間
            socket.join(roomId);
            io.to(player1.id).join(roomId);
            io.to(player2.id).join(roomId);
        } else {
            socket.emit('matchmakingProgress', { progress: 50, timeLeft: 15 });
        }
    });

    // 處理玩家移動
    socket.on('playerMove', (data) => {
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                rooms[roomId].players[socket.id].x = data.x;
                rooms[roomId].players[socket.id].y = data.y;
                rooms[roomId].players[socket.id].angle = data.angle;
                rooms[roomId].players[socket.id].name = data.name;
                io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
            }
        }
    });

    // 處理玩家射擊
    socket.on('playerShoot', (data) => {
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                const radians = data.angle * Math.PI / 180;
                rooms[roomId].bullets.push({
                    x: data.x,
                    y: data.y,
                    velocityX: Math.sin(radians) * 10,
                    velocityY: -Math.cos(radians) * 10,
                    owner: socket.id,
                    createdAt: Date.now()
                });
                io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
            }
        }
    });

    // 處理子彈命中
    socket.on('bulletHit', (data) => {
        for (let roomId in rooms) {
            if (rooms[roomId].players[data.targetId]) {
                rooms[roomId].players[data.targetId].health -= data.damage;
                rooms[roomId].players[socket.id].score += 10;

                if (rooms[roomId].players[data.targetId].health <= 0) {
                    const winner = socket.id;
                    const loser = data.targetId;
                    const scores = {
                        [winner]: rooms[roomId].players[winner].score,
                        [loser]: rooms[roomId].players[loser].score
                    };
                    io.to(roomId).emit('gameOver', {
                        winner,
                        scores,
                        message: `${rooms[roomId].players[winner].name} 獲勝！`
                    });
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
                }
            }
        }
    });

    // 處理玩家斷線
    socket.on('disconnect', () => {
        console.log(`玩家斷線: ${socket.id}`);
        for (let roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                const opponentId = Object.keys(rooms[roomId].players).find(id => id !== socket.id);
                if (opponentId) {
                    io.to(opponentId).emit('gameOver', {
                        winner: opponentId,
                        scores: {
                            [opponentId]: rooms[roomId].players[opponentId].score,
                            [socket.id]: rooms[roomId].players[socket.id].score
                        },
                        message: '對手已斷線，你獲勝！'
                    });
                }
                delete rooms[roomId];
            }
        }
        const index = matchmakingQueue.findIndex(player => player.id === socket.id);
        if (index !== -1) {
            matchmakingQueue.splice(index, 1);
        }
    });

    // 定期更新遊戲狀態（處理子彈移動和碰撞）
    setInterval(() => {
        for (let roomId in rooms) {
            const room = rooms[roomId];
            const now = Date.now();

            // 更新子彈位置並檢查碰撞
            room.bullets = room.bullets.filter(bullet => now - bullet.createdAt < 2000);
            room.bullets.forEach(bullet => {
                bullet.x += bullet.velocityX;
                bullet.y += bullet.velocityY;

                // 檢查子彈與玩家的碰撞
                for (let playerId in room.players) {
                    if (playerId !== bullet.owner && checkCollision(bullet, room.players[playerId])) {
                        room.players[playerId].health -= 10;
                        room.players[bullet.owner].score += 10;
                        bullet.createdAt = 0; // 標記子彈為移除
                        if (room.players[playerId].health <= 0) {
                            const winner = bullet.owner;
                            const loser = playerId;
                            const scores = {
                                [winner]: room.players[winner].score,
                                [loser]: room.players[loser].score
                            };
                            io.to(roomId).emit('gameOver', {
                                winner,
                                scores,
                                message: `${room.players[winner].name} 獲勝！`
                            });
                            delete rooms[roomId];
                            return;
                        }
                    }
                }
            });

            // 移除過期的子彈
            room.bullets = room.bullets.filter(bullet => now - bullet.createdAt < 2000);

            // 廣播遊戲狀態
            io.to(roomId).emit('gameStateUpdate', room);
        }
    }, 1000 / 60); // 60 FPS
});

server.listen(PORT, () => {
    console.log(`伺服器運行於端口 ${PORT}`);
});
