const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");

const app = express();

app.get("/hello", (_req, res) => {
  res.json({
    message: "Hello from Cloud Functions",
    at: new Date().toISOString()
  });
});

app.get("/time", (_req, res) => {
  res.json({ now: new Date().toISOString() });
});

exports.api = onRequest(app);
