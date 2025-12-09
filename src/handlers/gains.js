import { supabase } from "../supabase.js";
import { Markup } from "telegraf";
import menu from "./menu.js";

export default function gainsHandler(bot) {

  bot.action("gains_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    // Obtener información del usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Error cargando tus ganancias.");
    }

    const total =
      Number(user.referral_earnings) +
      Number(user.staking_earnings) +
      Number(user.mining_earnings);

    const mensaje =
      `💰 *TUS GANANCIAS*\n\n` +
      `👥 Referidos: *${user.referral_earnings.toFixed(2)} USDT*\n` +
      `📦 Staking: *${user.staking_earnings.toFixed(2)} USDT*\n` +
      `⛏ Minería: *${user.mining_earnings.toFixed(2)} USDT*\n\n` +
      `💎 *GANANCIA TOTAL: ${total.toFixed(2)} USDT*`;

    return ctx.reply(
      mensaje,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Regresar", "back_menu")]
        ])
      }
    );
  });

}
