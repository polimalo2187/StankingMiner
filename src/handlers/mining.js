import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function miningHandler(bot) {
  
  // Abrir menú de minería
  bot.action("mining_menu", async (ctx) => {
    await enviarMenuMineria(ctx);
  });

  // Activar minería
  bot.action("mining_start", async (ctx) => {
    const userId = ctx.from.id;

    // Buscar usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ No se encontró tu perfil. Usa /start nuevamente.");
    }

    // Requisitos para activar minería
    if (user.valid_referrals < 1) {
      return ctx.reply(
        `⛔ *Requisito no cumplido*\n\n` +
          `Para activar la minería necesitas:\n` +
          `✔ Al menos *1 referido válido*.\n\n` +
          `Invita a tus amigos usando tu enlace desde el menú de referidos.`,
        { parse_mode: "Markdown" }
      );
    }

    if (user.mining_active) {
      return ctx.reply("⚠️ Ya tienes la minería activa.");
    }

    // Activar minería
    await supabase
      .from("users")
      .update({ mining_active: true })
      .eq("telegram_id", userId);

    await ctx.reply(
      `⛏ *Minería activada*\n\n` +
        `Ahora comienzas a generar ganancias automáticas.`,
      { parse_mode: "Markdown" }
    );
  });

  // Desactivar minería
  bot.action("mining_stop", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ No se encontró tu perfil.");
    }

    if (!user.mining_active) {
      return ctx.reply("⚠️ No tienes minería activa.");
    }

    await supabase
      .from("users")
      .update({ mining_active: false })
      .eq("telegram_id", userId);

    await ctx.reply(
      `🛑 *Minería desactivada*\n\n` +
        `Puedes volver a activarla cuando desees.`,
      { parse_mode: "Markdown" }
    );
  });
}

// =====================================
//         MENÚ DE MINERÍA
// =====================================
async function enviarMenuMineria(ctx) {
  await ctx.reply(
    `⛏ *MINERÍA*\n\n` +
      `Sistema de minería automática:\n\n` +
      `• Necesitas *1 referido válido* para activar.\n` +
      `• Generas ganancias todos los días.\n\n` +
      `Selecciona una opción:`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("▶ Activar minería", "mining_start"),
          Markup.button.callback("⏸ Desactivar", "mining_stop")
        ],
        [Markup.button.callback("⬅ Volver", "menu")]
      ])
    }
  );
             }
