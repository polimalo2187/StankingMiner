import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

const MIN_VALID_REFERRALS = 5;
const MINING_REWARD = 0.02;
const MINING_DAYS = 20;

export default function miningHandler(bot) {

  // Abrir menú de minería
  bot.action("mining_menu", async (ctx) => {

    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return ctx.reply("Usuario no encontrado.");

    // Verificar si el usuario tiene suficientes referidos válidos
    if (user.valid_referrals < MIN_VALID_REFERRALS) {
      return ctx.editMessageText(
        `⛏ *MINERÍA BLOQUEADA*\n\n` +
        `❌ Necesitas *${MIN_VALID_REFERRALS} referidos válidos* para activar la minería.\n` +
        `Actualmente tienes: *${user.valid_referrals}*`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Regresar", "back_menu")]
          ])
        }
      );
    }

    // ¿Ya tiene minería activa?
    if (user.mining_active) {

      const remaining = 24 - user.mining_hours_passed;

      return ctx.editMessageText(
        `⛏ *MINERÍA ACTIVA*\n\n` +
        `Día: *${user.mining_day} / ${MINING_DAYS}*\n` +
        `⏳ Tiempo para reclamar: *${remaining} horas*`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✔ Reclamar ganancia", "mining_claim")],
            [Markup.button.callback("🔙 Regresar", "back_menu")]
          ])
        }
      );

    } else {

      // Usuario puede activar la minería
      await supabase
        .from("users")
        .update({
          mining_active: true,
          mining_day: 1,
          mining_hours_passed: 0
        })
        .eq("telegram_id", userId);

      return ctx.editMessageText(
        `⛏ *MINERÍA ACTIVADA*\n\n` +
        `Tu minería ha comenzado.\n` +
        `Duración: *${MINING_DAYS} días*\n` +
        `Recompensa diaria: *${MINING_REWARD} USDT*`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Regresar", "back_menu")]
          ])
        }
      );
    }
  });

  // Reclamar recompensa
  bot.action("mining_claim", async (ctx) => {

    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user || !user.mining_active)
      return ctx.reply("❌ No tienes minería activa.");

    // Verificar horas transcurridas
    if (user.mining_hours_passed < 24) {
      const falta = 24 - user.mining_hours_passed;
      return ctx.reply(
        `⏳ Aún no puedes reclamar.\nFaltan *${falta} horas*.`,
        { parse_mode: "Markdown" }
      );
    }

    // Sumar ganancia al balance interno
    const nuevoBalance = (user.balance || 0) + MINING_REWARD;

    let nuevoDia = user.mining_day + 1;
    let miningActive = true;

    // Si terminó los 20 días → cerrar minería
    if (nuevoDia > MINING_DAYS) {
      miningActive = false;
      nuevoDia = MINING_DAYS;
    }

    await supabase
      .from("users")
      .update({
        balance: nuevoBalance,
        mining_day: nuevoDia,
        mining_hours_passed: 0,
        mining_active: miningActive
      })
      .eq("telegram_id", userId);

    return ctx.reply(
      miningActive
        ? `🎉 *Recompensa reclamada*\nGanaste *${MINING_REWARD} USDT*.`
        : `⛏ *Minería completada*\nHas terminado los *${MINING_DAYS} días*.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Regresar", "back_menu")]
        ])
      }
    );
  });

  }
