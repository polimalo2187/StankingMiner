import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import { supabase } from "./supabase.js";

// Handlers nuevos totalmente limpios
import menu from "./handlers/menu.js";
import staking from "./handlers/staking.js";
import mining from "./handlers/mining.js";
import referrals from "./handlers/referrals.js";
import gains from "./handlers/gains.js";
import withdraw from "./handlers/withdraw.js";
import support from "./handlers/support.js";
import back from "./handlers/back.js";

const bot = new Telegraf(process.env.BOT_TOKEN);

// ------ Función para generar código -------
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ------ START ------
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  // Genera código nuevo
  const codigo = generarCodigo();

  // Insertar usuario si no existe, actualizar código si existe
  await supabase.from("users").upsert({
    telegram_id: userId,
    verification_code: codigo,
    verified: false
  });

  await ctx.reply(
    `👋 Bienvenido\n\nTu código de verificación es:\n\n🔐 *${codigo}*\n\nIngresa el código para continuar.`,
    { parse_mode: "Markdown" }
  );
});

// ------ VALIDACIÓN DE CÓDIGO ------
bot.on("text", async (ctx) => {
  const userId = ctx.from.id;
  const mensaje = ctx.message.text.trim();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) return;
  if (user.verified) return; // Ya verificado

  if (mensaje !== user.verification_code) {
    return ctx.reply("❌ Código incorrecto, inténtalo nuevamente.");
  }

  // Marcar como verificado
  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", userId);

  // Mostrar menú principal
  await ctx.reply(
    `✅ *VERIFICACIÓN COMPLETADA*\n\nBienvenido al sistema.`,
    { parse_mode: "Markdown" }
  );

  return menu(ctx);
});

// ------ CARGAR LOS HANDLERS ------
menu(bot);
staking(bot);
mining(bot);
referrals(bot);
gains(bot);
withdraw(bot);
support(bot);
back(bot);

// ------ LANZAR BOT ------
bot.launch()
  .then(() => console.log("🚀 Bot iniciado correctamente"))
  .catch((err) => console.error("Error al iniciar bot:", err));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
