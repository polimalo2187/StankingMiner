import { Markup } from "telegraf";
import { supabase } from "../../supabase.js";

const REF_REWARD = 0.02;

export default function referralsHandler(bot) {

  // Botón de menú de referidos
  bot.action("referrals_menu", async (ctx) => {

    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return ctx.reply("❌ Usuario no encontrado.");

    const referralLink = `https://t.me/${process.env.BOT_USERNAME}?start=${userId}`;

    const text =
      `🎯 *Sistema de Referidos*\n\n` +
      `🔗 *Tu enlace de invitación:*\n${referralLink}\n\n` +
      `👥 Referidos totales: *${user.referrals}*\n` +
      `✔ Referidos válidos (para minería): *${user.valid_referrals}*\n\n` +
      `💰 Ganancia por referidos: *${user.referral_earnings} USDT*\n\n` +
      `Ganas *${REF_REWARD} USDT* por cada usuario que complete la verificación.`;

    await ctx.editMessageText(text, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Regresar", "back_menu")],
      ]),
    });
  });

  // Registrar referido cuando el usuario entra por start=XXXX
  bot.start(async (ctx, next) => {
    try {
      const userId = ctx.from.id;
      const refId = ctx.startPayload ? Number(ctx.startPayload) : null;

      // Registrar usuario si no existe
      await supabase.from("users").upsert({
        telegram_id: userId,
        balance: 0,
        referrals: 0,
        valid_referrals: 0,
        referral_earnings: 0
      });

      // Si no hay referido → continuar normal
      if (!refId || refId === userId) return next();

      // Buscar referido
      const { data: refUser } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", refId)
        .single();

      // Evitar fallos
      if (!refUser) return next();

      // Verificar que no se haya referido antes
      const { data: exists } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", refId)
        .eq("referred_id", userId)
        .single();

      if (exists) return next();

      // Registrar referido pendiente (solo cuenta si completa código de verificación)
      await supabase.from("referrals").insert({
        referrer_id: refId,
        referred_id: userId,
        validated: false
      });

      return next();

    } catch (err) {
      console.log("Error en registro de referido:", err);
      return next();
    }
  });

  // Cuando usuario valida su código → aquí se confirma el referido
  bot.action(/^verify_ok_/, async (ctx) => {

    const userId = ctx.from.id;

    // Buscar si este usuario fue referido por alguien
    const { data: referral } = await supabase
      .from("referrals")
      .select("*")
      .eq("referred_id", userId)
      .single();

    if (!referral) return ctx.answerCbQuery();

    // Ya estaba validado → no hacer nada
    if (referral.validated) return ctx.answerCbQuery();

    // Marcar como validado
    await supabase
      .from("referrals")
      .update({ validated: true })
      .eq("referred_id", userId);

    // Sumar al referrer:
    const { data: refUser } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", referral.referrer_id)
      .single();

    if (refUser) {
      await supabase
        .from("users")
        .update({
          referrals: refUser.referrals + 1,
          valid_referrals: refUser.valid_referrals + 1, // válido solo aquí
          referral_earnings: refUser.referral_earnings + REF_REWARD,
          balance: refUser.balance + REF_REWARD
        })
        .eq("telegram_id", referral.referrer_id);
    }

    return ctx.answerCbQuery("Referido validado correctamente.");
  });
      }
