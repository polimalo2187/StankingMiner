import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function referralsHandler(bot) {
  
  // Abrir menú de referidos
  bot.action("referrals_menu", async (ctx) => {
    await enviarMenuReferidos(ctx);
  });
}

// =============================================
//         FUNCIÓN MENU DE REFERIDOS
// =============================================
async function enviarMenuReferidos(ctx) {
  const userId = ctx.from.id;

  // Obtener datos del usuario
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) {
    return ctx.reply("⚠️ No se encontró tu perfil. Usa /start nuevamente.");
  }

  // Crear link de referido
  const referralLink = `https://t.me/${ctx.botInfo.username}?start=${userId}`;

  await ctx.reply(
    `👥 *SISTEMA DE REFERIDOS*\n\n` +
      `🔗 *Tu enlace de invitación:*\n${referralLink}\n\n` +
      `💵 *Ganancia:* 0.02 USDT por cada usuario que valide su código\n\n` +
      `📊 *Tus estadísticas:*\n` +
      `• Referidos totales: *${user.referrals}*\n` +
      `• Referidos válidos: *${user.valid_referrals}*\n` +
      `• Ganancias por referidos: *${user.referral_earnings.toFixed(2)} USDT*\n\n` +
      `📌 Los *referidos válidos* son los que sirven para activar la minería.\n` +
      `Los *referidos normales* generan 0.02 USDT al validar código.`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("⬅ Volver al menú", "menu")]
      ])
    }
  );
}
