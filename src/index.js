import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import http from "http";
import { supabase } from "./supabase.js";

// Handlers
import menuHandler from "./handlers/menu.js";
import stakingHandler from "./handlers/staking.js";
import miningHandler from "./handlers/mining.js";
import referralsHandler from "./handlers/referrals.js";
import gainsHandler from "./handlers/gains.js";
import withdrawHandler from "./handlers/withdraw.js";
import depositsHandler from "./handlers/deposits.js";
import verifyTxHandler from "./handlers/verifyTx.js";
import backHandler from "./handlers/back.js";
import supportHandler from "./handlers/support.js";

const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBHOOK_URL = process.env.WEBHOOK_URL;

// ===============================
// SERVIDOR PARA RAILWAY
// ===============================
http
  .createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot running\n");
  })
  .listen(process.env.PORT || 3000);

// ===============================
// GENERADOR DE CÓDIGO
// ===============================
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ===============================
// COMANDO /start
// ===============================
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  await supabase.from("users").upsert({
    telegram_id: userId,
    balance: 0,
    referrals: 0,
    valid_referrals: 0,
    referral_earnings: 0,
    staking_earnings: 0,
    mining_earnings: 0,
    staking_active: false,
    mining_active: false,
  });

  const codigo = generarCodigo();

  await supabase
    .from("users")
    .update({ verification_code: codigo })
    .eq("telegram_id", userId);

  await ctx.reply(
    `👋 *Bienvenido*\n\nTu código de verificación es:\n\n🔐 *${codigo}*\nIngresa el código para continuar.`,
    { parse_mode: "Markdown" }
  );
});

// ===============================
// VALIDACIÓN DEL CÓDIGO
// ===============================
bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const mensaje = ctx.message.text.trim();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) return next();
  if (user.verified) return next();

  if (mensaje !== user.verification_code) {
    return ctx.reply("❌ Código incorrecto, intenta nuevamente.");
  }

  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", userId);

  await ctx.reply(`✅ *VERIFICACIÓN COMPLETADA*\n\nBienvenido.`, {
    parse_mode: "Markdown",
  });

  // Referidos
  const { data: ref } = await supabase
    .from("referrals")
    .select("*")
    .eq("referred_id", userId)
    .single();

  if (ref && !ref.validated) {
    await supabase
      .from("referrals")
      .update({ validated: true })
      .eq("referred_id", userId);

    const { data: refUser } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", ref.referrer_id)
      .single();

    if (refUser) {
      await supabase
        .from("users")
        .update({
          referrals: refUser.referrals + 1,
          valid_referrals: refUser.valid_referrals + 1,
          referral_earnings: refUser.referral_earnings + 0.02,
          balance: refUser.balance + 0.02,
        })
        .eq("telegram_id", ref.referrer_id);
    }
  }

  return ctx.reply(`🏠 *MENÚ PRINCIPAL*`, {
    parse_mode: "Markdown",
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback("📦 Staking", "staking_menu"),
        Markup.button.callback("⛏ Minería", "mining_menu"),
        Markup.button.callback("👥 Referidos", "referrals_menu"),
      ],
      [
        Markup.button.callback("💰 Ganancias", "gains_menu"),
        Markup.button.callback("💸 Retiro", "withdraw_menu"),
        Markup.button.callback("🛠 Soporte", "support_menu"),
      ],
    ]),
  });
});

// ===============================
// REGISTRAR HANDLERS
// ===============================
menuHandler(bot);
stakingHandler(bot);
miningHandler(bot);
referralsHandler(bot);
gainsHandler(bot);
withdrawHandler(bot);
depositsHandler(bot);
verifyTxHandler(bot);
supportHandler(bot);
backHandler(bot);

// ===============================
// INICIAR BOT
// ===============================
if (WEBHOOK_URL) {
  bot.telegram.setWebhook(`${WEBHOOK_URL}/bot${process.env.BOT_TOKEN}`);

  bot.launch({
    webhook: {
      domain: WEBHOOK_URL,
      port: process.env.PORT || 3000,
    },
  });

  console.log("🚀 Bot iniciado con WEBHOOK");
} else {
  bot.launch();
  console.log("🔥 Bot iniciado con POLLING");
}

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
