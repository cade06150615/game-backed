const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: ['http://localhost:5500', 'https://your-username.github.io'], // 修改：添加你的 GitHub Pages 域名
        methods: ['GET', 'POST']
    }
});

const rooms = {};
const players = {};

app.get('/', (req, res) => {
    res.send('太空射擊遊戲後端運行中');
});

io.on('connection', (socket) => {
    console.log('玩家連線:', socket.id); // 修改：添加連線日誌

    socket.on('joinMatchmaking', (data) => {
        // 初始化玩家
        players[socket.id] = {
            x: 100, // 修改：明確設置初始 X 座標
            y: 300, // 修改：明確設置初始 Y 座標
            angle: 0,
            health: 100,
            score: 0,
            name: data.name || '未知艦長'
        };
        console.log('玩家加入:', socket.id, data.name); // 修改：添加日誌

        // 配對邏輯
        let joined = false;
        for (const roomId in rooms) {
            if (Object.keys(rooms[roomId].players).length < 2) {
                rooms[roomId].players[socket.id] = players[socket.id];
                socket.join(roomId);
                io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players });
                joined = true;
                console.log('配對成功:', roomId, rooms[roomId].players); // 修改：添加日誌
                break;
            }
        }
        if (!joined) {
            const roomId = `room-${Object.keys(rooms).length + 1}`;
            rooms[roomId] = { players: { [socket.id]: players[socket.id] }, bullets: [] };
            socket.join(roomId);
            io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players });
            console.log('新房間創建:', roomId); // 修改：添加日誌
        }
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id]) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
            if (roomId) {
                io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
                console.log('玩家移動:', socket.id, data); // 修改：添加日誌
            }
        }
    });

    socket.on('playerShoot', (bullet) => {
        const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
        if (roomId) {
            rooms[roomId].bullets = rooms[roomId].bullets || [];
            rooms[roomId].bullets.push(bullet);
            io.to(roomId).emit('gameStateUpdate', rooms[roomId]);
            console.log('子彈發射:', socket.id, bullet); // 修改：添加日誌
        }
    });

    socket.on('disconnect', () => {
        console.log('玩家斷線:', socket.id); // 修改：添加斷線日誌
        for (const roomId in rooms) {
            if (rooms[roomId].players[socket.id]) {
                delete rooms[roomId].players[socket.id];
                if (Object.keys(rooms[roomId].players).length === 0) {
                    delete rooms[roomId];
                } else {
                    io.to(roomId).emit('gameOver', {
                        winnerId: Object.keys(rooms[roomId].players)[0],
                        scores: rooms[roomId].players
                    });
                }
            }
        }
        delete players[socket.id];
    });
});

// 修改：確保伺服器監聽正確端口
server.listen(process.env.PORT || 3000, () => {
    console.log('伺服器運行於端口', process.env.PORT || 3000);
});
