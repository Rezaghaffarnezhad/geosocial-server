const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());

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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
