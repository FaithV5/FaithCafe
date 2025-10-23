// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pkg from "pg";
const { Pool } = pkg;

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("static")); // serve your frontend

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 🧾 Fetch all menu items
app.get("/api/menu", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM faithcafedb ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error fetching menu:", err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
