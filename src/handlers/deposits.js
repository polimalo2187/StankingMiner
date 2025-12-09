import { supabase } from "../supabase.js";
import verifyTx from "../handlers/verifyTx.js";
import { Markup } from "telegraf";

export default function depositsHandler(bot) {

  // ---- Abrir menú depósito ----
  bot.action("deposit_menu", async (ctx) => {
    await ctx.reply(
      `💳 *DEPÓSITOS*\n\n` +
      `Envia USDT (BEP20) a la siguiente dirección:\n\n` +
      `📥 *${process.env.BOT_WALLET_ADDRESS}*\n\n` +
      `Luego pega aquí el TXHASH para verificar tu depósito.`,
      { parse_mode: "Markdown" }
    );
  });

  // ---- Verificar TXHASH ----
  bot.on("text", async (ctx, next) => {

    const tx = ctx.message.text.trim();

    // Filtrar solo si el usuario envió un posible hash
    if (!tx.startsWith("0x") || tx.length < 30) return next();

    await ctx.reply("⏳ Verificando transacción...");

    const result = await verifyTx(tx, 1); // mínimo 1 USDT

    if (!result.ok) {
      return ctx.reply(`❌ Error: ${result.error}`);
    }

    // Sumar balance al usuario
    await supabase
      .from("users")
      .update({
        balance: result.amount
      })
      .eq("telegram_id", ctx.from.id);

    await ctx.reply(
      `✅ *DEPÓSITO CONFIRMADO*\n\n` +
      `Monto: *${result.amount} USDT*\n\n` +
      `Tu balance ya fue actualizado.`,
      { parse_mode: "Markdown" }
    );
  });
}
