const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");

// This sample intentionally hardcodes a Stripe test key so the deploy
// toolkit's secrets detector has something to fire on. The wizard should
// block on the C6 "hardcoded secrets" page and offer the refactor prompt.
//
// DO NOT copy this pattern into a real app — even Stripe TEST keys
// should be loaded from process.env (or Firebase functions:secrets).
const stripe = require("stripe")("sk_test_FakeKeyForTesting1234567890abcdefghij");

const app = express();

app.get("/charge", async (_req, res) => {
  // Pretend we did something with `stripe.charges.create(...)`.
  res.json({
    ok: true,
    note: "This would charge a card if the Stripe key were real.",
    stripeIsConfigured: Boolean(stripe)
  });
});

app.get("/hello", (_req, res) => {
  res.json({
    message: "Hello from Cloud Functions",
    at: new Date().toISOString()
  });
});

exports.api = onRequest(app);
