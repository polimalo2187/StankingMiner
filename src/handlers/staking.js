import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function stakingHandler(bot) {
  
  // Abrir menú de staking
  bot.action("staking_menu", async (ctx) => {
    await enviarMenuStaking(ctx);
  });

  // Activar staking
  bot.action("staking_start", async (ctx) => {
    const userId = ctx.from.id;

    // Buscar usuario en Supabase
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ No se encontró tu perfil. Usa /start nuevamente.");
    }

    if (user.staking_active) {
      return ctx.reply("⚠️ Ya tienes staking activo.");
    }

    // Activar staking
    await supabase
      .from("users")
      .update({ staking_active: true })
      .eq("telegram_id", userId);

    await ctx.reply(
      `📦 *Staking activado*\n\n` +
      `✔ Ahora estás generando ganancias automáticas todos los días.`,
      { parse_mode: "Markdown" }
    );
  });

  // Desactivar staking
  bot.action("staking_stop", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ No se encontró tu perfil. Usa /start nuevamente.");
    }

    if (!user.staking_active) {
      return ctx.reply("⚠️ No tienes staking activo.");
    }

    await supabase
      .from("users")
      .update({ staking_active: false })
      .eq("telegram_id", userId);

    await ctx.reply(
      `🛑 *Staking desactivado*\n\n` +
      `No seguirás generando ganancias hasta activarlo nuevamente.`,
      { parse_mode: "Markdown" }
    );
  });
}

// ==============================
//     MENÚ DE STAKING
// ==============================
async function enviarMenuStaking(ctx) {
  await ctx.reply(
    `📦 *STAKING*\n\n` +
      `Elige una acción:\n\n` +
      `• Activar staking\n` +
      `• Desactivar staking\n\n` +
      `Tus ganancias se actualizarán automáticamente.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("▶ Activar", "staking_start"),
          Markup.button.callback("⏸ Desactivar", "staking_stop")
        ],
        [Markup.button.callback("⬅ Volver", "menu")]
      ])
    }
  );
        }
