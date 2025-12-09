import { supabase } from "../../supabase.js";
import { Markup } from "telegraf";
import menu from "./menu.js";

export default function withdrawHandler(bot) {

  // Abrir menú de retiro
  bot.action("withdraw_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const userId = ctx.from.id;

    // Obtener datos del usuario
    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("❌ Error cargando tus datos.");
    }

    // Verificar balance mínimo
    if (Number(user.balance) < 1) {
      return ctx.reply(
        `💸 *RETIRO NO DISPONIBLE*\n\n` +
        `Tu balance actual es: *${user.balance.toFixed(2)} USDT*\n` +
        `El mínimo de retiro es *1 USDT*.`,
        { parse_mode: "Markdown" }
      );
    }

    // Pedir wallet al usuario
    await supabase
      .from("users")
      .update({ withdraw_step: "awaiting_wallet" })
      .eq("telegram_id", userId);

    return ctx.reply(
      `💳 *Enviar Wallet*\n\nEscribe aquí tu *wallet USDT-BEP20 (BSC)* donde deseas recibir el retiro.`,
      { parse_mode: "Markdown" }
    );
  });

  // Procesar textos (wallet o monto)
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // Paso 1 → WALLET
    if (user.withdraw_step === "awaiting_wallet") {

      if (!msg.startsWith("0x") || msg.length < 20) {
        return ctx.reply("❌ Wallet inválida. Intenta nuevamente.");
      }

      await supabase
        .from("users")
        .update({
          withdraw_wallet: msg,
          withdraw_step: "awaiting_amount"
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `💸 *Introduce el monto a retirar*\n\nBalance disponible: *${user.balance.toFixed(2)} USDT*`,
        { parse_mode: "Markdown" }
      );
    }

    // Paso 2 → MONTO
    if (user.withdraw_step === "awaiting_amount") {
      const amount = Number(msg);

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Monto inválido. Escribe un número.");
      }

      if (amount > Number(user.balance)) {
        return ctx.reply("❌ No tienes saldo suficiente.");
      }

      // Registrar retiro en tabla withdrawals
      await supabase.from("withdrawals").insert({
        user_id: userId,
        wallet: user.withdraw_wallet,
        amount: amount,
        status: "pending"
      });

      // Actualizar balance del usuario
      await supabase
        .from("users")
        .update({
          balance: Number(user.balance) - amount,
          withdraw_step: null,
          withdraw_wallet: null
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `⏳ *Retiro registrado*\n\n` +
        `Monto: *${amount} USDT*\n` +
        `Estado: *Pendiente*\n\n` +
        `Tu retiro será procesado manualmente por el administrador.`,
        { parse_mode: "Markdown" }
      );
    }
  });
        }
