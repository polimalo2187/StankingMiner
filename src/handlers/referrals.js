import { supabase } from "../../supabase.js";
import { Markup } from "telegraf";
import menu from "./menu.js";

export default function referralsHandler(bot) {

  // Abrir menú de referidos
  bot.action("referrals_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;
    const usernameBot = process.env.BOT_USERNAME || "STMiner_Bot";

    // Obtener datos del usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Error cargando información de referidos.");
    }

    // Crear enlace real
    const referralLink = `https://t.me/${usernameBot}?start=${userId}`;

    const mensaje =
      `👥 *PROGRAMA DE REFERIDOS*\n\n` +
      `🔗 *Tu enlace único:*\n${referralLink}\n\n` +
      `👤 Referidos totales: *${user.referrals}*\n` +
      `🟢 Referidos válidos: *${user.valid_referrals}*\n\n` +
      `💰 Ganancia por referido: *0.02 USDT*\n` +
      `⚡ Se acredita cuando el usuario ingresa su código correctamente.\n`;

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

  // Registrar cuando alguien entra con /start ID
  bot.start(async (ctx) => {
    const userId = ctx.from.id;

    const refParam = ctx.message.text.split(" ")[1];
    if (!refParam) return; // sin referido

    const referrerId = Number(refParam);

    if (referrerId === userId) return; // no puede referirse a sí mismo

    // Guardar en tabla referrals
    await supabase.from("referrals").upsert({
      referrer_id: referrerId,
      referred_id: userId,
      validated: false
    });
  });

}
