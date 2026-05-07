import express from "express";
const app = express();
app.get("/", (_, res) => res.send("ok"));
app.listen(3000);