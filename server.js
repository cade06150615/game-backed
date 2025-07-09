// server.js - Express 後端
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

let marketItems = [];
let inviteRooms = {};

// 取得市場物品
app.get('/api/market', (req, res) => {
  res.json(marketItems);
});

// 上架物品
app.post('/api/market', (req, res) => {
  const { name, rarity, price, id } = req.body;
  if (!name || !rarity || !price || !id) {
    return res.status(400).json({ success: false, msg: '資料不完整' });
  }
  // 避免重複上架同一物品
  if (marketItems.find(item => item.id === id)) {
    return res.status(400).json({ success: false, msg: '物品已上架' });
  }
  marketItems.push({ id, name, rarity, price });
  res.json({ success: true });
});

// 買下物品
app.post('/api/market/buy', (req, res) => {
  const { id } = req.body;
  const index = marketItems.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ success: false, msg: '物品不存在' });
  const boughtItem = marketItems.splice(index, 1)[0];
  res.json({ success: true, item: boughtItem });
});

// 建立邀請房間
app.post('/api/invite/create', (req, res) => {
  const roomId = uuidv4();
  inviteRooms[roomId] = { users: [] };
  res.json({ success: true, roomId });
});

// 加入邀請房間
app.post('/api/invite/join', (req, res) => {
  const { roomId, userName } = req.body;
  if (!inviteRooms[roomId]) return res.status(404).json({ success: false, msg: '房間不存在' });
  inviteRooms[roomId].users.push(userName || '匿名');
  res.json({ success: true, room: inviteRooms[roomId] });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
