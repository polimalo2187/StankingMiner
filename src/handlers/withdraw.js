import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function withdrawHandler(bot) {

  // Botón del menú principal
  bot.action("withdraw_menu", async (ctx) => {
    const userId = ctx.from.id;

    // Obtener usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Usuario no encontrado.");
    }

    if (!user.verified) {
      return ctx.reply("⚠️ Primero debes verificar tu cuenta.");
    }

    if (user.balance <= 0) {
      return ctx.reply("❌ No tienes saldo disponible para retirar.");
    }

    // Guardar paso
    await supabase
      .from("users")
      .update({ withdraw_step: "ask_wallet" })
      .eq("telegram_id", userId);

    return ctx.editMessageText(
      `💸 *RETIRAR FONDOS*\n\nTu saldo disponible es:\n\n` +
      `💰 *${user.balance} USDT*\n\n` +
      `Por favor envía la *dirección BEP20* donde deseas recibir el pago.`,
      { parse_mode: "Markdown" }
    );
  });

  // Lectura de mensajes — dirección + confirmación
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    // Leer usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // Paso 1: pedir dirección
    if (user.withdraw_step === "ask_wallet") {
      const wallet = text;

      // Guardar dirección y pasar al siguiente paso
      await supabase
        .from("users")
        .update({
          withdraw_step: "confirm",
          withdraw_wallet: wallet
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `📝 *CONFIRMAR RETIRO*\n\n` +
        `Monto: *${user.balance} USDT*\n` +
        `Wallet: *${wallet}*\n\n` +
        `¿Deseas confirmar el retiro?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✔ Confirmar", "withdraw_confirm")],
            [Markup.button.callback("❌ Cancelar", "withdraw_cancel")]
          ])
        }
      );
    }
  });

  // Confirmación de retiro
  bot.action("withdraw_confirm", async (ctx) => {
    const userId = ctx.from.id;

    // Obtener usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Usuario no encontrado.");
    }

    const amount = user.balance;
    const wallet = user.withdraw_wallet;

    // Registrar solicitud en Supabase
    await supabase.from("withdrawals").insert({
      telegram_id: userId,
      amount: amount,
      wallet: wallet,
      status: "pending"
    });

    // Resetear datos del usuario
    await supabase
      .from("users")
      .update({
        balance: 0,
        withdraw_step: null,
        withdraw_wallet: null
      })
      .eq("telegram_id", userId);

    // Notificar al usuario
    await ctx.editMessageText(
      `✅ *SOLICITUD DE RETIRO ENVIADA*\n\n` +
      `Monto: *${amount} USDT*\n` +
      `Wallet: *${wallet}*\n\n` +
      `El pago será procesado manualmente.`,
      { parse_mode: "Markdown" }
    );

    // Notificar al OWNER del bot
    if (process.env.OWNER_ID) {
      ctx.telegram.sendMessage(
        process.env.OWNER_ID,
        `📤 *NUEVO RETIRO SOLICITADO*\n\n` +
        `👤 Usuario: ${userId}\n` +
        `💰 Monto: ${amount} USDT\n` +
        `🏧 Wallet: ${wallet}`,
        { parse_mode: "Markdown" }
      );
    }
  });

  // Cancelar retiro
  bot.action("withdraw_cancel", async (ctx) => {
    const userId = ctx.from.id;

    // Resetear estado
    await supabase
      .from("users")
      .update({
        withdraw_step: null,
        withdraw_wallet: null
      })
      .eq("telegram_id", userId);

    return ctx.editMessageText(
      `❌ *Retiro cancelado*\n\nRegresando al menú.`,
      { parse_mode: "Markdown" }
    );
  });

             }
