const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");

// NOTE: deliberately opens the sqlite file alongside the function source,
// NOT under /tmp/. This "works" on a developer laptop because the filesystem
// is persistent, but on Cloud Functions the package directory is read-only
// and the instance is ephemeral — so every cold start would lose all data.
// This is exactly the shape the deploy-toolkit detector is meant to catch.
const db = new Database(path.join(__dirname, "notes.db"));

db.prepare(`
  CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`).run();

const app = express();
app.use(express.json());

app.get("/api/notes", (_req, res) => {
  const rows = db.prepare("SELECT id, body, created_at FROM notes ORDER BY id DESC").all();
  res.json({ notes: rows });
});

app.post("/api/notes", (req, res) => {
  const body = String(req.body?.body ?? "").trim();
  if (!body) return res.status(400).json({ error: "body is required" });
  const info = db.prepare("INSERT INTO notes (body) VALUES (?)").run(body);
  res.status(201).json({ id: info.lastInsertRowid, body });
});

exports.api = onRequest(app);
