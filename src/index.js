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

const bot = new Telegraf(process.env.BOT_TOKEN);

// ------------------------------
// GENERAR CÓDIGO
// ------------------------------
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ------------------------------
// COMANDO /START
// ------------------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Crear usuario si no existe
  await supabase.from("users").upsert({
    telegram_id: userId,
    verified: false,
    balance: 0,
    referrals: 0,
    valid_referrals: 0,
    referral_earnings: 0,
    staking_earnings: 0,
    mining_earnings: 0,
    staking_active: false,
    mining_active: false
  });

  const codigo = generarCodigo();

  // Guardar código
  await supabase
    .from("users")
    .update({ verification_code: codigo })
    .eq("telegram_id", userId);

  // Enviar código
  await ctx.reply(
    `👋 Bienvenido\n\nTu código de verificación es:\n\n` +
    `🔐 *${codigo}*\n\nIngresa este código aquí mismo.`,
    { parse_mode: "Markdown" }
  );
});

// ------------------------------
// VERIFICAR CÓDIGO
// ------------------------------
bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const texto = ctx.message.text.trim();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) return next();

  // si ya está verificado, pasamos al menú
  if (user.verified) return next();

  // código incorrecto
  if (texto !== user.verification_code) {
    return ctx.reply("❌ Código incorrecto. Intenta nuevamente.");
  }

  // marcar verificado
  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", userId);

  // enviar menú
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
          Markup.button.callback("💰 Ganancias", "gains_menu"),
          Markup.button.callback("💸 Retiro", "withdraw_menu"),
          Markup.button.callback("🛠 Soporte", "support_menu")
        ]
      ])
    }
  );
});

// ------------------------------
// CARGAR HANDLERS
// ------------------------------
stakingHandler(bot);
miningHandler(bot);
referralsHandler(bot);
gainsHandler(bot);
withdrawHandler(bot);
supportHandler(bot);
backHandler(bot);

// ------------------------------
// INICIAR BOT
// ------------------------------
bot.launch()
  .then(() => console.log("🚀 Bot iniciado correctamente"))
  .catch((err) => console.error("❌ Error iniciando bot:", err));

// Apagado seguro en Railway
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
