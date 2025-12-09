import express from "express";
import { bot } from "./server.js";

const app = express();
app.use(express.json());

// Ruta webhook
app.post("/webhook", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

const PORT = process.env.PORT || 3000;

// Iniciar servidor
app.listen(PORT, () => {
  console.log("🔥 Webhook activo en puerto " + PORT);
});
