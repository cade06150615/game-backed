const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const Monkey = require('./models/Monkey');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/monkey-gacha';

app.use(cors());
app.use(bodyParser.json());

// 連接 MongoDB
mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

// API: 取得最新學習資料
app.get('/api/monkey', async (req, res) => {
  try {
    const data = await Monkey.findOne().sort({ updatedAt: -1 });
    if (!data) return res.status(404).json({ message: 'No data found' });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API: 儲存學習資料
app.post('/api/monkey', async (req, res) => {
  try {
    const { Q, counts } = req.body;
    if (!Q || !counts) return res.status(400).json({ message: 'Missing Q or counts' });

    // 新增紀錄
    const monkey = new Monkey({ Q, counts });
    await monkey.save();
    res.json({ message: 'Saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
