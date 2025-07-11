const mongoose = require('mongoose');

// 使用 Map 儲存 Q 值和 counts，key 是 box id，value 是數字
const MonkeySchema = new mongoose.Schema({
  Q: { type: Map, of: Number, required: true },
  counts: { type: Map, of: Number, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Monkey', MonkeySchema);
