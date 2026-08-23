const express = require("express");
const cors = require("cors");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "../frontend")));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
});

async function db(sql, params=[]) {
  const r = await pool.query(sql, params);
  return r.rows;
}

app.get("/api/health", async (req,res) => {
  try {
    await db("SELECT 1");
    res.json({ ok:true, database:true });
  } catch (e) {
    res.status(500).json({ ok:false, database:false, error:"database_error" });
  }
});

app.post("/api/users", async (req,res) => {
  try {
    const { name, username, avatar, bio, city } = req.body || {};
    if (!name) return res.status(400).json({ error:"name_required" });

    const rows = await db(`
      INSERT INTO users (name, username, avatar, bio, city, last_seen)
      VALUES ($1,$2,$3,$4,$5,NOW())
      ON CONFLICT (username)
      DO UPDATE SET name=EXCLUDED.name, avatar=EXCLUDED.avatar,
                    bio=EXCLUDED.bio, city=EXCLUDED.city, last_seen=NOW()
      RETURNING *
    `, [name, username || null, avatar || null, bio || "", city || ""]);
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"user_create_failed"});
  }
});

app.post("/api/location", async (req,res) => {
  try {
    const { userId, lat, lng, precise=true } = req.body || {};
    if (!userId || !Number.isFinite(Number(lat)) || !Number.isFinite(Number(lng)))
      return res.status(400).json({error:"invalid_location"});

    const rows = await db(`
      UPDATE users
      SET latitude=$1, longitude=$2, precise_location=$3, last_seen=NOW(), online=true
      WHERE id=$4
      RETURNING id, latitude, longitude, last_seen, online
    `, [Number(lat), Number(lng), !!precise, userId]);

    if (!rows.length) return res.status(404).json({error:"user_not_found"});
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"location_update_failed"});
  }
});

app.post("/api/heartbeat", async (req,res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({error:"user_required"});
    const rows = await db(`
      UPDATE users SET last_seen=NOW(), online=true
      WHERE id=$1 RETURNING id,last_seen,online
    `,[userId]);
    if (!rows.length) return res.status(404).json({error:"user_not_found"});
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"heartbeat_failed"});
  }
});

app.get("/api/people/nearby", async (req,res) => {
  try {
    const lat=Number(req.query.lat), lng=Number(req.query.lng);
    const radius=Math.min(Math.max(Number(req.query.radius)||5,0.1),100);
    const userId=req.query.userId ? Number(req.query.userId) : null;

    if (!Number.isFinite(lat)||!Number.isFinite(lng))
      return res.status(400).json({error:"invalid_coordinates"});

    const rows = await db(`
      SELECT
        id,name,username,avatar,bio,city,online,last_seen,latitude,longitude,
        ROUND((
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1))*cos(radians(latitude))*cos(radians(longitude)-radians($2))
              + sin(radians($1))*sin(radians(latitude))
            ))
          )
        )::numeric, 2) AS distance_km
      FROM users
      WHERE latitude IS NOT NULL
        AND longitude IS NOT NULL
        AND ($3::bigint IS NULL OR id <> $3)
        AND (
          6371 * acos(
            LEAST(1, GREATEST(-1,
              cos(radians($1))*cos(radians(latitude))*cos(radians(longitude)-radians($2))
              + sin(radians($1))*sin(radians(latitude))
            ))
          )
        ) <= $4
      ORDER BY distance_km ASC
      LIMIT 500
    `,[lat,lng,userId,radius]);

    res.json({people:rows});
  } catch(e) {
    console.error(e);
    res.status(500).json({error:"nearby_query_failed"});
  }
});

app.get("/api/people/:id", async (req,res) => {
  try {
    const rows=await db(`
      SELECT id,name,username,avatar,bio,city,online,last_seen,latitude,longitude
      FROM users WHERE id=$1
    `,[Number(req.params.id)]);
    if(!rows.length) return res.status(404).json({error:"not_found"});
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"person_failed"});
  }
});

app.post("/api/messages", async (req,res) => {
  try {
    const {senderId, receiverId, text, replyTo=null}=req.body||{};
    if(!senderId||!receiverId||!String(text||"").trim())
      return res.status(400).json({error:"invalid_message"});

    const rows=await db(`
      INSERT INTO messages(sender_id,receiver_id,text,reply_to)
      VALUES($1,$2,$3,$4) RETURNING *
    `,[senderId,receiverId,String(text).trim(),replyTo]);
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"message_send_failed"});
  }
});

app.get("/api/messages/:a/:b", async (req,res) => {
  try {
    const a=Number(req.params.a), b=Number(req.params.b);
    const rows=await db(`
      SELECT id,sender_id,receiver_id,text,reply_to,created_at
      FROM messages
      WHERE (sender_id=$1 AND receiver_id=$2)
         OR (sender_id=$2 AND receiver_id=$1)
      ORDER BY created_at ASC
      LIMIT 500
    `,[a,b]);
    res.json({messages:rows});
  } catch(e) {
    res.status(500).json({error:"messages_failed"});
  }
});

app.post("/api/public-messages", async (req,res) => {
  try {
    const {userId,text}=req.body||{};
    if(!userId||!String(text||"").trim()) return res.status(400).json({error:"invalid_message"});
    const rows=await db(`
      INSERT INTO public_messages(user_id,text) VALUES($1,$2)
      RETURNING id,user_id,text,created_at
    `,[userId,String(text).trim()]);
    res.json(rows[0]);
  } catch(e) {
    res.status(500).json({error:"public_message_failed"});
  }
});

app.get("/api/public-messages", async (req,res) => {
  try {
    const rows=await db(`
      SELECT pm.id,pm.user_id,pm.text,pm.created_at,u.name,u.avatar
      FROM public_messages pm JOIN users u ON u.id=pm.user_id
      ORDER BY pm.created_at DESC LIMIT 100
    `);
    res.json({messages:rows.reverse()});
  } catch(e) {
    res.status(500).json({error:"public_messages_failed"});
  }
});

app.post("/api/offline", async (req,res) => {
  try {
    const {userId}=req.body||{};
    await db("UPDATE users SET online=false WHERE id=$1",[userId]);
    res.json({ok:true});
  } catch(e) {
    res.status(500).json({error:"offline_failed"});
  }
});

app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname,"../frontend/index.html"));
});

app.listen(PORT,()=>console.log(`GeoSocial API listening on ${PORT}`));
