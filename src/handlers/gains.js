import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function gainsHandler(bot) {
  
  bot.action("gains_menu", async (ctx) => {
    await mostrarGanancias(ctx);
  });
}

// ===================================================
//               FUNCIÓN PRINCIPAL
// ===================================================
async function mostrarGanancias(ctx) {
  const userId = ctx.from.id;

  // Buscar datos del usuario
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) {
    return ctx.reply("⚠️ No se encontró tu registro. Usa /start para comenzar.");
  }

  // Ganancias separadas
  const referralEarnings = Number(user.referral_earnings || 0);
  const stakingEarnings  = Number(user.staking_earnings || 0);
  const miningEarnings   = Number(user.mining_earnings || 0);

  // Total
  const totalEarnings = referralEarnings + stakingEarnings + miningEarnings;

  await ctx.reply(
    `💰 *TUS GANANCIAS*\n\n` +
      `👥 *Ganancias por referidos:* ${referralEarnings.toFixed(2)} USDT\n` +
      `📦 *Ganancias de staking:* ${stakingEarnings.toFixed(2)} USDT\n` +
      `⛏ *Ganancias de minería:* ${miningEarnings.toFixed(2)} USDT\n\n` +
      `💎 *Ganancia TOTAL:* ${totalEarnings.toFixed(2)} USDT`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⬅ Regresar", "menu")]
      ]),
    }
  );
}
