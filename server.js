const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// 範例資料：市場商品
let marketItems = [];

// 取得市場商品
app.get('/api/market', (req, res) => {
  res.json(marketItems);
});

// 上架商品
app.post('/api/market', (req, res) => {
  const { id, name, rarity, price } = req.body;
  if (!id || !name || !rarity || !price) {
    return res.status(400).json({ success: false, msg: '資料不完整' });
  }
  if (marketItems.find(item => item.id === id)) {
    return res.status(400).json({ success: false, msg: '商品已存在' });
  }
  marketItems.push({ id, name, rarity, price });
  res.json({ success: true });
});

// 買商品
app.post('/api/market/buy', (req, res) => {
  const { id } = req.body;
  const index = marketItems.findIndex(item => item.id === id);
  if (index === -1) return res.status(404).json({ success: false, msg: '商品不存在' });
  const boughtItem = marketItems.splice(index, 1)[0];
  res.json({ success: true, item: boughtItem });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
