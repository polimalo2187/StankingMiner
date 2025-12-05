import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function gainsHandler(bot) {

  bot.action("gains_menu", async (ctx) => {

    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return ctx.reply("❌ Usuario no encontrado.");

    // Datos del usuario
    const stakingGain = user.staking_earnings || 0;
    const miningGain = user.mining_earnings || 0;
    const referralGain = user.referral_earnings || 0;

    const totalGain =
      Number(stakingGain) +
      Number(miningGain) +
      Number(referralGain);

    const msg =
      `💹 *Panel de Ganancias*\n\n` +
      `⛓ *Ganancia por Staking:* ${stakingGain.toFixed(2)} USDT\n` +
      `⛏ *Ganancia por Minería:* ${miningGain.toFixed(2)} USDT\n` +
      `👥 *Ganancia por Referidos:* ${referralGain.toFixed(2)} USDT\n\n` +
      `💰 *Ganancia Total:* *${totalGain.toFixed(2)} USDT*`;

    await ctx.editMessageText(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Regresar", "back_menu")]
      ])
    });
  });

}
