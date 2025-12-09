import { supabase } from "../../supabase.js";
import verifyTx from "./verifyTx.js";
import { Markup } from "telegraf";

export default function depositsHandler(bot) {

  bot.action("deposit_menu", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `💰 *DEPÓSITOS*\n\n` +
      `Envía USDT BEP20 a la siguiente dirección para recargar tu balance:\n\n` +
      `🔗 *${process.env.BOT_WALLET_ADDRESS}*\n\n` +
      `Después envía aquí el TXHASH para verificar tu depósito.`,
      { parse_mode: "Markdown" }
    );
  });

  bot.on("text", async (ctx) => {

    const text = ctx.message.text.trim();

    if (!text.startsWith("0x") || text.length < 30) return;

    const userId = ctx.from.id;

    const REQUIRED_AMOUNT = 1; // mínimo de depósito en USDT

    const result = await verifyTx(text, REQUIRED_AMOUNT);

    if (!result.ok) {
      return ctx.reply(`❌ ${result.error}`);
    }

    await supabase
      .from("users")
      .update({ balance: supabase.raw(`balance + ${result.amount}`) })
      .eq("telegram_id", userId);

    await ctx.reply(
      `✅ *Depósito confirmado*\n\n` +
      `Monto: *${result.amount} USDT*\n` +
      `Wallet: *${result.wallet}*`,
      { parse_mode: "Markdown" }
    );

  });
}
