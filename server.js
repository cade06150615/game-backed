const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://localhost:5500', 'https://your-username.github.io'], // **修改處 2**：添加你的 GitHub Pages 域名
        methods: ['GET', 'POST']
    }
});

const rooms = {};
const players = {};
const bulletSpeed = 15;
const bulletLifetime = 2000;

app.get('/', (req, res) => {
    res.send('太空射擊遊戲後端運行中');
});

io.on('connection', (socket) => {
    console.log('玩家連線:', socket.id); // **修改處 3**：添加連線日誌

    socket.on('joinMatchmaking', (data) => {
        players[socket.id] = {
            x: 100, // **修改處 1**：明確設置初始 X 座標
            y: 300, // **修改處 1**：明確設置初始 Y 座標
            angle: 0,
            health: 100,
            score: 0,
            name: data.name || '未知艦長'
        };
        console.log('玩家加入:', socket.id, data.name); // **修改處 3**：添加日誌

        let joined = false;
        for (const roomId in rooms) {
            if (Object.keys(rooms[roomId].players).length < 2) {
                rooms[roomId].players[socket.id] = players[socket.id];
                socket.join(roomId);
                io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players });
                joined = true;
                console.log('配對成功:', roomId, rooms[roomId].players); // **修改處 3**：添加日誌
                break;
            }
        }
        if (!joined) {
            const roomId = `room-${Object.keys(rooms).length + 1}`;
            rooms[roomId] = { players: { [socket.id]: players[socket.id] }, bullets: [] };
            socket.join(roomId);
            io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players });
            console.log('新房間創建:', roomId); // **修改處 3**：添加日誌
        }
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
            if (roomId) {
                io.to(roomId).emit('gameStateUpdate', rooms[roomId]); // **修改處 4**：發送完整遊戲狀態
                console.log('玩家移動:', socket.id, data); // **修改處 3**：添加日誌
            }
        }
    });

    socket.on('playerShoot', (bullet) => {
        const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
        if (roomId) {
            rooms[roomId].bullets = rooms[roomId].bullets || [];
            rooms[roomId].bullets.push(bullet);
            io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
            console.log('子彈發射:', socket.id, bullet); // **修改處 3**：添加日誌
        }
    });

    socket.on('disconnect', () => {
        console.log('玩家斷線:', socket.id); // **修改處 3**：添加斷線日誌
        for (const roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                if (Object.keys(rooms[roomId].players).length === 0) {
                    delete rooms[roomId];
                } else {
                    const winnerId = Object.keys(rooms[roomId].players)[0];
                    io.to(roomId).emit('gameOver', {
                        winnerId,
                        scores: rooms[roomId].players
                    });
robin);
                    console.log('遊戲結束，因玩家斷線:', roomId, winnerId); // **修改處 3**：添加日誌
                }
            }
        }
        delete players[socket.id];
    });

    // **修改處 5**：添加碰撞檢測和遊戲邏輯
    setInterval(() => {
        for (const roomId in rooms) {
            const room = rooms[roomId];
            const now = Date.now();
            room.bullets = room.bullets.filter(b => now - b.time < bulletLifetime);

            for (const bullet of room.bullets) {
                bullet.x += Math.cos((bullet.angle * Math.PI) / 180) * bulletSpeed;
                bullet.y += Math.sin((bullet.angle * Math.PI) / 180) * bulletSpeed;

                for (const playerId in room.players) {
                    if (playerId === bullet.id.split('-')[0]) continue;
                    const player = room.players[playerId];
                    const dx = bullet.x - player.x;
                    const dy = bullet.y - player.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < 20) {
                        player.health -= 10;
                        room.bullets = room.bullets.filter(b => b !== bullet);
                        const shooterId = bullet.id.split('-')[0];
                        if (room.players[shooterId]) {
                            room.players[shooterId].score += 10;
                        }
                        if (player.health <= 0) {
                            const winnerId = Object.keys(room.players).find(id => id !== playerId);
                            io.to(roomId).emit('gameOver', {
                                winnerId,
                                scores: room.players
                            });
                            console.log('遊戲結束:', roomId, '贏家:', winnerId); // **修改處 3**：添加日誌
                            delete rooms[roomId];
                            break;
                        }
                    }
                }
            }
            io.to(roomId).emit('gameStateUpdate', room);
        }
    }, 1000 / 60);
});

server.listen(process.env.PORT || 3000, () => {
    console.log('伺服器運行於端口', process.env.PORT || 3000); // **修改處 6**：支援 Render 動態端口
});
