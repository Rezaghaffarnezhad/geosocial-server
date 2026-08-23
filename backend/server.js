const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// اتصال به دیتابیس PostgreSQL با استفاده از متغیر محیطی Render
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// ایجاد جداول دیتابیس در صورت عدم وجود
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE,
        name VARCHAR(100),
        bio TEXT,
        city VARCHAR(50),
        avatar TEXT,
        lat DECIMAL(10, 6),
        lng DECIMAL(10, 6),
        status VARCHAR(20) DEFAULT 'online'
      );

      CREATE TABLE IF NOT EXISTS public_chat (
        id SERIAL PRIMARY KEY,
        sender_name VARCHAR(100),
        avatar TEXT,
        text TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS stories (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        avatar TEXT,
        media TEXT,
        likes INT DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Database tables initialized successfully.");
  } catch (err) {
    console.error("Error initializing database:", err);
  }
}
initDB();

// API دریافت اطلاعات از دیتابیس
app.get('/api/data', async (req, res) => {
  try {
    const users = await pool.query('SELECT * FROM users');
    const publicChat = await pool.query('SELECT * FROM public_chat ORDER BY id ASC LIMIT 50');
    const stories = await pool.query('SELECT * FROM stories ORDER BY id DESC');
    
    res.json({
      pins: users.rows,
      publicChat: publicChat.rows,
      stories: stories.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API ارسال پیام به چت عمومی و ذخیره در دیتابیس
app.post('/api/public-chat', async (req, res) => {
  const { name, avatar, text } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public_chat (sender_name, avatar, text) VALUES ($1, $2, $3) RETURNING *',
      [name, avatar, text]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
