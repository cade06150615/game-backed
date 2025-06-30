const express = require('express');
const app = express();
const server = require('http').createServer(app);
const io = require('socket.io')(server, {
    cors: {
        origin: [
            'http://localhost:5500',
            'https://cade06150615.github.io'
        ],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

const rooms = {};
const players = {};
const bulletSpeed = 15;
const bulletLifetime = 15000; // Increased to 15s for visibility

app.get('/', (req, res) => {
    res.send('Space Shooter backend running');
});

io.on('connection', (socket) => {
    console.log(`Player connected: ${socket.id}, Origin: ${socket.handshake.headers.origin}`);

    socket.on('joinMatchmaking', (data) => {
        players[socket.id] = {
            x: Math.random() * 700 + 50,
            y: Math.random() * 500 + 50,
            angle: 0,
            health: 100,
            score: 0,
            name: data.name || 'Unknown Pilot',
            disconnected: false
        };
        console.log(`Player joined: ${socket.id}, Name: ${data.name}`);

        let joined = false;
        for (const roomId in rooms) {
            if (Object.keys(rooms[roomId].players).length < 2) {
                rooms[roomId].players[socket.id] = players[socket.id];
                socket.join(roomId);
                io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players, playerId: socket.id });
                io.to(roomId).emit('startGame', { playerId: socket.id });
                io.to(roomId).emit('gameStateUpdate', { ...rooms[roomId], playerId: socket.id });
                console.log(`Match found: ${roomId}`, rooms[roomId].players);
                joined = true;
                break;
            }
        }
        if (!joined) {
            const roomId = `room-${Object.keys(rooms).length + 1}`;
            rooms[roomId] = { players: { [socket.id]: players[socket.id] }, bullets: [] };
            socket.join(roomId);
            io.to(roomId).emit('matchFound', { roomId, players: rooms[roomId].players, playerId: socket.id });
            console.log(`New room created: ${roomId}`);
        }
    });

    socket.on('rejoinGame', (data) => {
        const { roomId, playerId } = data;
        if (rooms[roomId] && players[playerId] && players[playerId].disconnected) {
            players[playerId].disconnected = false;
            socket.join(roomId);
            io.to(roomId).emit('gameStateUpdate', { ...rooms[roomId], playerId: socket.id });
            console.log(`Player rejoined: ${playerId} in ${roomId}`);
        }
    });

    socket.on('playerMove', (data) => {
        if (players[socket.id] && !players[socket.id].disconnected) {
            players[socket.id].x = data.x;
            players[socket.id].y = data.y;
            players[socket.id].angle = data.angle;
            const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
            if (roomId) {
                io.to(roomId).emit('gameStateUpdate', { ...rooms[roomId], playerId: socket.id });
                console.log(`Player moved: ${socket.id}`, data);
            }
        }
    });

    socket.on('playerShoot', (bullet) => {
        const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
        if (roomId) {
            rooms[roomId].bullets = rooms[roomId].bullets || [];
            rooms[roomId].bullets.push(bullet);
            io.to(roomId).emit('gameStateUpdate', { ...rooms[roomId], playerId: socket.id });
            console.log(`Bullet fired in ${roomId}:`, bullet);
        }
    });

    socket.on('disconnect', () => {
        console.log(`Player disconnected: ${socket.id}`);
        const roomId = Object.keys(rooms).find(room => rooms[room].players[socket.id]);
        if (roomId) {
            players[socket.id].disconnected = true;
            io.to(roomId).emit('gameStateUpdate', { ...rooms[roomId], playerId: socket.id });
            setTimeout(() => {
                if (players[socket.id]?.disconnected) {
                    delete rooms[roomId].players[socket.id];
                    if (Object.keys(rooms[roomId].players).length === 0) {
                        delete rooms[roomId];
                        console.log(`Room deleted: ${roomId}`);
                    } else {
                        const winnerId = Object.keys(rooms[roomId].players).find(id => !rooms[roomId].players[id].disconnected);
                        if (winnerId) {
                            io.to(roomId).emit('gameOver', {
                                winnerId,
                                scores: rooms[roomId].players
                            });
                            console.log(`Game ended due to disconnect: ${roomId}, Winner: ${winnerId}`);
                        }
                    }
                    delete players[socket.id];
                }
            }, 60000);
        }
    });

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
                    if (player.disconnected) continue;
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
                            const winnerId = Object.keys(room.players).find(id => id !== playerId && !room.players[id].disconnected);
                            io.to(roomId).emit('gameOver', {
                                winnerId,
                                scores: room.players
                            });
                            console.log(`Game ended: ${roomId}, Winner: ${winnerId}`);
                            delete rooms[roomId];
                            break;
                        }
                    }
                }
            }
            io.to(roomId).emit('gameStateUpdate', { ...room, playerId: socket.id });
            console.log(`Game state update sent to ${roomId}:`, { players: room.players, bullets: room.bullets });
        }
    }, 1000 / 60);
});

server.listen(process.env.PORT || 10000, () => {
    console.log('Server running on port', process.env.PORT || 10000);
});
