import { Markup } from "telegraf";
import { supabase } from "../supabase.js";
import verifyTx from "./verifyTx.js";

const PLAN_AMOUNT = 10; // monto del plan de staking

export default function stakingHandler(bot) {

  bot.action("staking_menu", async (ctx) => {

    await ctx.editMessageText(
      `💎 *PLAN DE STAKING*\n\n` +
      `🔸 Monto: *${PLAN_AMOUNT} USDT*\n` +
      `🔸 Ganancia diaria: *1 USDT*\n` +
      `🔸 Duración: *20 días*\n\n` +
      `📥 Envía *${PLAN_AMOUNT} USDT (BEP20)* a esta dirección:\n\n` +
      `➡️ *${process.env.BOT_WALLET}*\n\n` +
      `Luego presiona *Confirmar Depósito*.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✔ Confirmar Depósito", "staking_confirm")],
          [Markup.button.callback("🔙 Regresar", "back_menu")]
        ])
      }
    );

  });

  // Usuario presiona "Confirmar Depósito"
  bot.action("staking_confirm", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
      .from("users")
      .update({ staking_step: "awaiting_txhash" })
      .eq("telegram_id", userId);

    await ctx.editMessageText(
      `📤 *VALIDACIÓN DE DEPÓSITO*\n\n` +
      `Por favor envía aquí el *TXHASH* de la transacción.\n\n` +
      `Debe ser:\n` +
      `✔ En red BSC\n` +
      `✔ Enviado a *${process.env.BOT_WALLET}*\n` +
      `✔ Monto *exacto* de ${PLAN_AMOUNT} USDT`,
      { parse_mode: "Markdown" }
    );
  });

  // Usuario envía TXHASH por texto
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const tx = ctx.message.text.trim();

    // Leer información del usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // ¿Está enviando TXHASH?
    if (user.staking_step === "awaiting_txhash") {

      const res = await verifyTx(tx, PLAN_AMOUNT);

      if (!res.ok) {
        return ctx.reply(
          `❌ *Depósito no válido*\n${res.error}`,
          { parse_mode: "Markdown" }
        );
      }

      // Activar staking en Supabase
      await supabase
        .from("users")
        .update({
          staking_active: true,
          staking_amount: PLAN_AMOUNT,
          staking_day: 1,
          staking_step: null
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `🎉 *Depósito confirmado*\n\n` +
        `Tu plan de *Staking de ${PLAN_AMOUNT} USDT* ha sido activado.`,
        { 
          parse_mode: "Markdown", 
          ...Markup.inlineKeyboard([
            [Markup.button.callback("🔙 Regresar", "back_menu")]
          ])
        }
      );
    }

  });

          }
