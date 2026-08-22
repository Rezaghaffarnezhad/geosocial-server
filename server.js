const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');
const path = require('path'); // <-- ۱. این کتابخانه برای مدیریت مسیرها اضافه شد

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

// ۲. این خط فایل‌های HTML, CSS و JS داخل پوشه public را به دنیا نشان می‌دهد
app.use(express.static(path.join(__dirname, 'public')));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        avatar TEXT,
        lat DOUBLE PRECISION,
        lng DOUBLE PRECISION,
        status TEXT
      );
      CREATE TABLE IF NOT EXISTS public_chat (
        id SERIAL PRIMARY KEY,
        name TEXT,
        avatar TEXT,
        text TEXT
      );
    `);
    console.log("Database ready!");
  } catch (err) {
    console.error("DB Error:", err);
  }
}
initDB();

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('update_location', async (data) => {
    try {
      await pool.query(
        `INSERT INTO users (name, avatar, lat, lng, status) VALUES ($1, $2, $3, $4, $5)`,
        [data.name, data.avatar, data.lat, data.lng, data.status]
      );
      io.emit('users_updated');
    } catch (err) {
      console.error(err);
    }
  });

  socket.on('send_public_message', async (msg) => {
    try {
      await pool.query(
        `INSERT INTO public_chat (name, avatar, text) VALUES ($1, $2, $3)`,
        [msg.name, msg.avatar, msg.text]
      );
      io.emit('new_public_message', msg);
    } catch (err) {
      console.error(err);
    }
  });
});

// ۳. مسیر پیش‌فرض برای اطمینان از بارگذاری index.html در روت سایت
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
