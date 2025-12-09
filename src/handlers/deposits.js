import { Markup } from "telegraf";
import verifyTx from "./verifyTx.js";
import { supabase } from "../supabase.js";

export default function depositsHandler(bot) {

  // --- ABRIR MENÚ DE DEPÓSITOS ---
  bot.action("deposit_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const wallet = process.env.BOT_WALLET_ADDRESS;

    await ctx.reply(
      `💸 *DEPÓSITOS USDT (BEP20)*\n\n` +
        `📥 Dirección de depósito del bot:\n` +
        `\`${wallet}\`\n\n` +
        `⚠️ Solo enviar *USDT-BEP20*.\n` +
        `Después de enviar, toca *Verificar Depósito* y coloca el TXHASH.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Verificar Depósito", "verify_deposit")],
          [Markup.button.callback("⬅ Regresar", "back_menu")],
        ]),
      }
    );
  });

  // --- SOLICITAR HASH DE TRANSACCIÓN ---
  bot.action("verify_deposit", async (ctx) => {
    await ctx.answerCbQuery();
    await ctx.reply("🔍 Envíame el *TXHASH* de la transacción:", {
      parse_mode: "Markdown",
    });

    ctx.session = ctx.session || {};
    ctx.session.waitingHash = true; // Esperar el TX del usuario
  });

  // --- RECIBIR TXHASH DEL USUARIO ---
  bot.on("text", async (ctx) => {
    if (!ctx.session || !ctx.session.waitingHash) return;

    const txhash = ctx.message.text.trim();
    ctx.session.waitingHash = false;

    const userId = ctx.from.id;

    await ctx.reply("⏳ Verificando transacción, espera un momento...");

    // Verificar transacción en la blockchain
    const result = await verifyTx(txhash, 1); // mínima cantidad: 1 USDT

    if (!result.ok) {
      return ctx.reply(`❌ Error:\n${result.error}`, {
        parse_mode: "Markdown",
      });
    }

    // Depósito válido → actualizar balance del usuario
    const amount = result.amount;

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) {
      return ctx.reply("⚠️ Error interno: usuario no encontrado.");
    }

    const nuevoBalance = Number(user.balance) + Number(amount);

    await supabase
      .from("users")
      .update({ balance: nuevoBalance })
      .eq("telegram_id", userId);

    await ctx.reply(
      `✅ *DEPÓSITO CONFIRMADO*\n\n` +
        `Monto recibido: *${amount} USDT*\n` +
        `Balance actual: *${nuevoBalance} USDT*`,
      { parse_mode: "Markdown" }
    );
  });
         }
