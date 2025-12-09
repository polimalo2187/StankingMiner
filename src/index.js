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

// Generar código aleatorio
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ---------------------- START --------------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Crear usuario si no existe
  await supabase.from("users").upsert({
    telegram_id: userId,
    verified: false
  });

  const codigo = generarCodigo();

  // Siempre guardar el código como STRING
  await supabase
    .from("users")
    .update({ verification_code: codigo })
    .eq("telegram_id", userId);

  await ctx.reply(
    `👋 Bienvenido\n\nTu código de verificación es:\n\n🔐 *${codigo}*\n\nIngresa el código para continuar.`,
    { parse_mode: "Markdown" }
  );
});

// ------------------ VALIDAR CÓDIGO ---------------------
bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const mensaje = ctx.message.text.trim();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  // No existe = seguir
  if (!user) return next();

  // Ya verificado = seguir
  if (user.verified) return next();

  const codigoDB = String(user.verification_code).trim();

  // Comparar SIEMPRE como texto
  if (mensaje !== codigoDB) {
    return ctx.reply("❌ Código incorrecto, intenta nuevamente.");
  }

  // Marcar verificado
  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", userId);

  // Mostrar menú
  return ctx.reply(
    `✅ *VERIFICACIÓN COMPLETADA*\n\nBienvenido al sistema.`,
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

// ------------------ CARGAR HANDLERS --------------------
stakingHandler(bot);
miningHandler(bot);
referralsHandler(bot);
gainsHandler(bot);
withdrawHandler(bot);
supportHandler(bot);
backHandler(bot);

// -------------------- INICIAR BOT ----------------------
bot.launch()
  .then(() => console.log("🚀 Bot iniciado correctamente"))
  .catch((err) => console.error("Error al iniciar bot:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
