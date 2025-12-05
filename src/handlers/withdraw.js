import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

const MIN_RETIRO = 1; // mínimo de retiro en USDT

export default function withdrawHandler(bot) {

  // --- BOTÓN PRINCIPAL DEL MENÚ DE RETIRO ---
  bot.action("withdraw_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return ctx.reply("❌ Usuario no encontrado.");

    await ctx.editMessageText(
      `🏦 *Retiro de Fondos*\n\n` +
      `💰 *Balance disponible:* ${user.balance} USDT\n` +
      `🔻 *Mínimo de retiro:* ${MIN_RETIRO} USDT`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("💸 Solicitar Retiro", "withdraw_start")],
          [Markup.button.callback("🔙 Regresar", "back_menu")],
        ]),
      }
    );
  });

  // --- INICIA EL PROCESO ---
  bot.action("withdraw_start", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
      .from("users")
      .update({ withdraw_step: "waiting_wallet" })
      .eq("telegram_id", userId);

    await ctx.editMessageText(
      `🏦 *Retiro — Paso 1*\n\n` +
      `Envíame la *dirección de tu wallet (BEP20)* donde deseas recibir el retiro.`,
      { parse_mode: "Markdown" }
    );
  });

  // --- PROCESAR MENSAJES ---
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // --- PASO 1: RECIBIR WALLET ---
    if (user.withdraw_step === "waiting_wallet") {
      if (!text.startsWith("0x") || text.length < 20) {
        return ctx.reply("❌ Dirección inválida. Intenta de nuevo.");
      }

      await supabase
        .from("users")
        .update({
          withdraw_wallet: text,
          withdraw_step: "waiting_amount",
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `💵 *Retiro — Paso 2*\n\n` +
        `Ahora envíame la *cantidad en USDT* que deseas retirar.`,
        { parse_mode: "Markdown" }
      );
    }

    // --- PASO 2: RECIBIR MONTO ---
    if (user.withdraw_step === "waiting_amount") {
      const amount = Number(text);

      if (isNaN(amount) || amount <= 0) {
        return ctx.reply("❌ Cantidad no válida.");
      }

      if (amount < MIN_RETIRO) {
        return ctx.reply(`❌ El mínimo de retiro es ${MIN_RETIRO} USDT.`);
      }

      if (amount > user.balance) {
        return ctx.reply("❌ No tienes saldo suficiente.");
      }

      // Guardar temporalmente
      await supabase
        .from("users")
        .update({
          withdraw_amount: amount,
          withdraw_step: "waiting_confirm",
        })
        .eq("telegram_id", userId);

      return ctx.reply(
        `🔎 *Confirmar Retiro*\n\n` +
        `💰 Monto: *${amount} USDT*\n` +
        `🏦 Wallet: *${user.withdraw_wallet}*\n\n` +
        `¿Deseas confirmar?`,
        {
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [Markup.button.callback("✅ Confirmar", "withdraw_confirm")],
            [Markup.button.callback("❌ Cancelar", "withdraw_cancel")],
          ]),
        }
      );
    }
  });

  // --- CONFIRMAR RETIRO ---
  bot.action("withdraw_confirm", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // Registrar en tabla withdrawals
    await supabase.from("withdrawals").insert({
      telegram_id: userId,
      amount: user.withdraw_amount,
      wallet: user.withdraw_wallet,
      status: "pending"
    });

    // Descontar del balance
    await supabase
      .from("users")
      .update({
        balance: user.balance - user.withdraw_amount,
        withdraw_step: null,
      })
      .eq("telegram_id", userId);

    await ctx.editMessageText(
      `🟡 *Retiro registrado*\n\n` +
      `Tu retiro está en proceso manual.\n` +
      `Una vez enviado, verás el TXHASH aquí.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Volver", "back_menu")],
        ]),
      }
    );
  });

  // --- CANCELAR RETIRO ---
  bot.action("withdraw_cancel", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
      .from("users")
      .update({ withdraw_step: null })
      .eq("telegram_id", userId);

    await ctx.editMessageText("❌ *Retiro cancelado*", {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Volver", "back_menu")],
      ]),
    });
  });

          }
