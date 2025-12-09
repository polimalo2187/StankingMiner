import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import { supabase } from "./supabase.js";

// Handlers
import stakingHandler from "./handlers/staking.js";
import miningHandler from "./handlers/mining.js";
import referralsHandler from "./handlers/referrals.js";
import gainsHandler from "./handlers/gains.js";
import withdrawHandler from "./handlers/withdraw.js";
import supportHandler from "./handlers/support.js";
import backHandler from "./handlers/back.js";
import depositsHandler from "./handlers/deposits.js";   // <--- AGREGADO

const bot = new Telegraf(process.env.BOT_TOKEN);

// Generar código aleatorio de 5 dígitos
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// --------------------- START ---------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Crear usuario si no existe
  await supabase.from("users").upsert({
    telegram_id: userId,
    balance: 0,
    referrals: 0,
    valid_referrals: 0,
    referral_earnings: 0,
    staking_earnings: 0,
    mining_earnings: 0,
    staking_active: false,
    mining_active: false
  });

  // Generar código
  const codigo = generarCodigo();

  await supabase
    .from("users")
    .update({ verification_code: codigo })
    .eq("telegram_id", userId);

  await ctx.reply(
    `👋 Bienvenido\n\nTu código de verificación es:\n\n🔐 *${codigo}*\n\nIngresa el código para continuar.`,
    { parse_mode: "Markdown" }
  );
});

// --------------------- VALIDAR CÓDIGO ---------------------
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

  await ctx.reply(
    `✅ *VERIFICACIÓN COMPLETADA*\n\nBienvenido al sistema.`,
    { parse_mode: "Markdown" }
  );

  return ctx.reply(
    `🏠 *MENÚ PRINCIPAL*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("📦 Staking", "staking_menu"),
          Markup.button.callback("⛏ Minería", "mining_menu"),
          Markup.button.callback("👥 Referidos", "referrals_menu")
        ],
        [
          Markup.button.callback("💳 Depósito", "deposit_menu"),
          Markup.button.callback("💰 Ganancias", "gains_menu"),
          Markup.button.callback("💸 Retiro", "withdraw_menu")
        ],
        [
          Markup.button.callback("🛠 Soporte", "support_menu")
        ]
      ])
    }
  );
});

// --------------------- CARGA DE HANDLERS ---------------------
stakingHandler(bot);
miningHandler(bot);
referralsHandler(bot);
gainsHandler(bot);
withdrawHandler(bot);
supportHandler(bot);
backHandler(bot);
depositsHandler(bot);   // <--- AGREGADO

// --------------------- INICIO DEL BOT ---------------------
bot.launch()
  .then(() => console.log("🚀 Bot iniciado correctamente"))
  .catch((err) => console.error("Error al iniciar bot:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
