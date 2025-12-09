import express from "express";
import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

// Inicializar bot
const bot = new Telegraf(process.env.BOT_TOKEN);

// Handlers
import menuHandler from "./handlers/menu.js";
import adminHandler from "./handlers/admin.js";
import miningHandler from "./handlers/mining.js";
import depositsHandler from "./handlers/deposits.js";
import withdrawHandler from "./handlers/withdraw.js";
import referralsHandler from "./handlers/referrals.js";
import stakingHandler from "./handlers/staking.js";
import gainsHandler from "./handlers/gains.js";
import supportHandler from "./handlers/support.js";
import verifyTxHandler from "./handlers/verifyTx.js";
import backHandler from "./handlers/back.js";

// Registrar handlers
menuHandler(bot);
adminHandler(bot);
miningHandler(bot);
depositsHandler(bot);
withdrawHandler(bot);
referralsHandler(bot);
stakingHandler(bot);
gainsHandler(bot);
supportHandler(bot);
verifyTxHandler(bot);
backHandler(bot);

const app = express();
app.use(express.json());

// Webhook Telegram
const WEBHOOK = process.env.WEBHOOK_URL + "/webhook";

(async () => {
    try {
        bot.stop(); // Detener polling por si acaso
        await bot.telegram.setWebhook(WEBHOOK);

        console.log("Webhook configurado:", WEBHOOK);
    } catch (err) {
        console.log("Error configurando webhook:", err);
    }
})();

// Endpoint para Telegram
app.post("/webhook", (req, res) => {
    bot.handleUpdate(req.body);
    res.sendStatus(200);
});

// Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor activo en puerto", PORT);
});
