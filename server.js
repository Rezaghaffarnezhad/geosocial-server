const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// معرفی پوشه public به عنوان فایل‌های استاتیک (برای اینکه index.html و عکس‌ها باز شوند)
app.use(express.static(path.join(__dirname, 'public')));

// حافظه موقت سرور برای نگهداری پین‌ها، چت‌ها و استوری‌ها
let db = {
  pins: [],
  publicChat: [],
  stories: []
};

// ۱. باز کردن فایل index.html به عنوان صفحه اصلی سایت
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// دریافت تمام اطلاعات برنامه
app.get('/api/data', (req, res) => {
  res.json(db);
});

// ثبت یا بروزرسانی موقعیت مکانی هر کاربر
app.post('/api/update-location', (req, res) => {
  const { name, avatar, lat, lng, caption, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  let existingPin = db.pins.find(p => p.name === name);

  if (existingPin) {
    existingPin.lat = lat;
    existingPin.lng = lng;
    existingPin.avatar = avatar || existingPin.avatar;
    existingPin.caption = caption || existingPin.caption;
    existingPin.status = status || 'online';
  } else {
    db.pins.push({
      id: Date.now(),
      name,
      avatar: avatar || 'https://i.pravatar.cc/150?img=33',
      lat,
      lng,
      caption: caption || 'کاربر جدید',
      status: 'online',
      chat: []
    });
  }

  res.json({ success: true, pins: db.pins });
});

// ثبت پیام چت عمومی
app.post('/api/public-chat', (req, res) => {
  const { name, avatar, text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text is required' });

  const newMsg = {
    id: Date.now(),
    name: name || 'ناشناس',
    avatar: avatar || '',
    text
  };

  db.publicChat.push(newMsg);
  res.json(newMsg);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
