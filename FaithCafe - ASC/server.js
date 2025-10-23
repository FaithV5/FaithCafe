// server.js
import express from "express";
import cors from "cors";
import pkg from "pg";
const { Pool } = pkg;

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 Connect to Neon PostgreSQL
const pool = new Pool({
  connectionString: "postgresql://neondb_owner:npg_npd2tPgTAU5V@ep-dawn-firefly-a15q0cl5-pooler.ap-southeast-1.aws.neon.tech/neondb",
  ssl: { rejectUnauthorized: false }
});

// 🧾 Route: Get all items from your table
app.get("/api/menu", async (req, res) => {
  try {
    // ✅ FIX: Missing 'FROM' keyword in SQL query
    const result = await pool.query("SELECT * FROM FaithCafedb ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching menu:", err);
    res.status(500).send("Server Error");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
