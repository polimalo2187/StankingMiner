import { Telegraf } from "telegraf";
import dotenv from "dotenv";
dotenv.config();

export const bot = new Telegraf(process.env.BOT_TOKEN);

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

// =========================
// CONFIGURAR WEBHOOK
// =========================
const webhookUrl = process.env.WEBHOOK_URL;

(async () => {
  try {
    // Eliminar polling
    bot.stop();

    // Establecer webhook en Telegram
    await bot.telegram.setWebhook(`${webhookUrl}/webhook`);
    console.log("✔ Webhook configurado:", `${webhookUrl}/webhook`);

    // Activar recepción mediante webhook
    bot.startWebhook('/webhook', null, process.env.PORT || 3000);
    console.log("🔥 Webhook listener activo");
  } catch (error) {
    console.error("❌ Error al configurar webhook:", error);
  }
})();
