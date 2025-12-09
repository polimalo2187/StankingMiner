import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

export default function withdrawHandler(bot) {

  // Abrir menú de retiro
  bot.action("withdraw_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ Error cargando datos. Usa /start.");
    }

    if (Number(user.balance) < 1) {
      return ctx.reply(
        `❌ *No cumples con el mínimo de retiro (1 USDT).*`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([[Markup.button.callback("⬅ Regresar", "menu")]])
        }
      );
    }

    // Iniciar proceso de retiro
    await supabase
      .from("users")
      .update({ withdraw_step: "enter_wallet" })
      .eq("telegram_id", userId);

    return ctx.reply(
      `💸 *RETIRAR FONDOS*\n\nEnvíame la *dirección USDT-BEP20* donde deseas recibir el pago.`,
      { parse_mode: "Markdown" }
    );
  });

  // Capturar texto
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;
    if (!user.withdraw_step) return;

    // ------------------------------
    // PASO 1 — Recibir wallet
    // ------------------------------
    if (user.withdraw_step === "enter_wallet") {

      if (!msg.startsWith("0x") || msg.length < 40) {
        return ctx.reply("❌ *Wallet inválida.* Envíala nuevamente.", { parse_mode: "Markdown" });
      }

      await supabase
        .from("users")
        .update({
          withdraw_wallet: msg,
          withdraw_step: "enter_amount"
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `💰 *Perfecto.*\n\nAhora envía la **cantidad a retirar**.`,
        { parse_mode: "Markdown" }
      );
    }

    // ------------------------------
    // PASO 2 — Recibir cantidad
    // ------------------------------
    if (user.withdraw_step === "enter_amount") {
      const amount = Number(msg);

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Cantidad inválida. Intenta nuevamente.");
      }

      if (amount > Number(user.balance)) {
        return ctx.reply("❌ No tienes suficiente balance.");
      }

      await supabase
        .from("users")
        .update({
          withdraw_amount: amount,
          withdraw_step: "confirm"
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `⚠️ *CONFIRMAR RETIRO*\n\n` +
          `🪪 *Wallet:* ${user.withdraw_wallet}\n` +
          `💵 *Cantidad:* ${amount} USDT\n\n` +
          `¿Deseas confirmar?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✔ Confirmar Retiro", "withdraw_confirm")],
            [Markup.button.callback("❌ Cancelar", "menu")]
          ])
        }
      );
    }
  });

  // ------------------------------
  // PASO 3 — Confirmación final
  // ------------------------------
  bot.action("withdraw_confirm", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return ctx.reply("⚠️ Error interno.");

    // Registrar retiro pendiente
    await supabase.from("withdrawals").insert({
      telegram_id: userId,
      wallet: user.withdraw_wallet,
      amount: user.withdraw_amount,
      status: "pending"
    });

    // Reset de pasos
    await supabase
      .from("users")
      .update({
        withdraw_step: null,
        withdraw_wallet: null,
        withdraw_amount: null
      })
      .eq("telegram_id", userId);

    return ctx.reply(
      `⏳ *RETIRO SOLICITADO*\n\nTu retiro está *pendiente de aprobación*.\n` +
      `El administrador lo procesará manualmente.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅ Regresar", "menu")]
        ])
      }
    );
  });
  }
