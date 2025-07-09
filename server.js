// server.js（後端主程式）
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 模擬資料庫
let marketItems = [];
let inviteRooms = {};

// [API] 取得市場物品
app.get('/api/market', (req, res) => {
  res.json(marketItems);
});

// [API] 上架物品
app.post('/api/market', (req, res) => {
  const item = req.body;
  item.id = uuidv4();
  marketItems.push(item);
  res.json({ success: true, item });
});

// [API] 購買物品
app.post('/api/market/buy', (req, res) => {
  const { id } = req.body;
  const idx = marketItems.findIndex(i => i.id === id);
  if (idx === -1) return res.status(404).json({ success: false, msg: '找不到物品' });
  const item = marketItems.splice(idx, 1)[0];
  res.json({ success: true, item });
});

// [API] 建立邀請房間
app.post('/api/invite/create', (req, res) => {
  const roomId = uuidv4();
  inviteRooms[roomId] = { users: [] };
  res.json({ success: true, roomId });
});

// [API] 加入邀請房間
app.post('/api/invite/join', (req, res) => {
  const { roomId, userName } = req.body;
  if (!inviteRooms[roomId]) return res.status(404).json({ success: false, msg: '房間不存在' });
  inviteRooms[roomId].users.push(userName || '匿名');
  res.json({ success: true, room: inviteRooms[roomId] });
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
