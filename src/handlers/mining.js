import { supabase } from "../supabase.js";
import { Markup } from "telegraf";
import menu from "./menu.js";

export default function miningHandler(bot) {

  // Abrir menú de minería
  bot.action("mining_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    // Obtener datos del usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Error cargando tus datos.");
    }

    // Verificar si tiene 5 referidos válidos
    if (user.valid_referrals < 5) {
      return ctx.reply(
        `⛏ *MINERÍA BLOQUEADA*\n\n` +
        `Necesitas *5 referidos válidos* para activar la minería.\n\n` +
        `Actualmente tienes: *${user.valid_referrals}*`,
        { parse_mode: "Markdown" }
      );
    }

    // Activar minería si no está activa
    if (!user.mining_active) {
      await supabase
        .from("users")
        .update({ mining_active: true })
        .eq("telegram_id", userId);

      await ctx.reply(
        `🔥 *MINERÍA ACTIVADA*\n\n` +
        `Empiezas a generar ganancias automáticamente cada día.`,
        { parse_mode: "Markdown" }
      );
    }

    return ctx.reply(
      `⛏ *MINERÍA ACTIVA*\n\n` +
      `Tus ganancias se suman automáticamente cada 24 horas.`,
      { parse_mode: "Markdown" }
    );
  });

  // Botón para volver atrás
  bot.action("back_mining", async (ctx) => {
    await ctx.answerCbQuery();
    return menu(ctx);
  });
}
