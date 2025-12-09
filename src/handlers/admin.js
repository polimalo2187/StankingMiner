import { Markup } from "telegraf";
import { supabase } from "../supabase.js";

const ADMIN_ID = process.env.ADMIN_ID; // 2010460041

export default function adminHandler(bot) {

  // ============================
  //   COMANDO /admin
  // ============================
  bot.command("admin", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) {
      return ctx.reply("❌ No tienes permisos.");
    }

    return ctx.reply(
      `🛠 *PANEL DE ADMINISTRADOR*\n\nElige una acción:`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("📤 Retiros pendientes", "admin_withdrawals")],
        ])
      }
    );
  });

  // ============================
  //   LISTAR RETIROS PENDIENTES
  // ============================
  bot.action("admin_withdrawals", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;

    const { data: withdrawals } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!withdrawals || withdrawals.length === 0) {
      return ctx.reply("✔ No hay retiros pendientes.");
    }

    let message = `📤 *Retiros pendientes:*\n\n`;

    withdrawals.forEach(w => {
      message += `🆔 ID: *${w.id}*\n👤 Usuario: ${w.telegram_id}\n💵 Cantidad: *${w.amount} USDT*\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });

    return ctx.reply(
      "Selecciona un ID para gestionar:",
      {
        ...Markup.inlineKeyboard(
          withdrawals.map(w =>
            [Markup.button.callback(`ID ${w.id}`, `admin_w_${w.id}`)]
          )
        )
      }
    );
  });

  // ============================
  //   VER DETALLE DE RETIRO
  // ============================
  bot.action(/admin_w_(\d+)/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;

    const withdrawalId = ctx.match[1];

    const { data: w } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("id", withdrawalId)
      .single();

    if (!w) return ctx.reply("❌ Retiro no encontrado.");

    await ctx.reply(
      `📄 *DETALLE DEL RETIRO*\n\n` +
      `🆔 ID: *${w.id}*\n` +
      `👤 Usuario: *${w.telegram_id}*\n` +
      `💵 Monto: *${w.amount} USDT*\n` +
      `🏦 Wallet: \`${w.wallet}\`\n` +
      `📌 Estado: *${w.status}*\n\n`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("✔ Aprobar", `admin_apr_${w.id}`)],
          [Markup.button.callback("❌ Rechazar", `admin_rej_${w.id}`)],
          [Markup.button.callback("⬅ Volver", "admin_withdrawals")]
        ])
      }
    );
  });

  // ============================
  //   APROBAR RETIRO → Pedir TXHASH
  // ============================
  bot.action(/admin_apr_(\d+)/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;

    const withdrawalId = ctx.match[1];

    // Guardar paso ADMIN
    await supabase
      .from("withdrawals")
      .update({ status: "awaiting_tx" })
      .eq("id", withdrawalId);

    return ctx.reply(
      `✍️ *Envía ahora el TXHASH para el retiro ID ${withdrawalId}*`,
      { parse_mode: "Markdown" }
    );
  });

  // ============================
  //   CAPTURAR TXHASH
  // ============================
  bot.on("text", async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;

    const msg = ctx.message.text.trim();

    // Buscar retiro esperando TXHASH
    const { data: pending } = await supabase
      .from("withdrawals")
      .select("*")
      .eq("status", "awaiting_tx")
      .limit(1);

    if (!pending || pending.length === 0) return;

    const retiro = pending[0];

    if (!msg.startsWith("0x") || msg.length < 20) {
      return ctx.reply("❌ TXHASH inválido. Envíalo nuevamente.");
    }

    // Guardar txhash y procesar
    await supabase
      .from("withdrawals")
      .update({
        tx_hash: msg,
        status: "approved",
        processed_at: new Date()
      })
      .eq("id", retiro.id);

    // Restar balance al usuario
    await supabase.rpc("decrease_balance", {
      uid: retiro.telegram_id,
      amount: retiro.amount
    }).catch(() => {});

    // Notificar al usuario
    try {
      await ctx.telegram.sendMessage(
        retiro.telegram_id,
        `💸 *RETIRO APROBADO*\n\n` +
        `✔ Monto: *${retiro.amount} USDT*\n` +
        `🔗 TXHASH:\n\`${msg}\``,
        { parse_mode: "Markdown" }
      );
    } catch {}

    return ctx.reply("✔ Retiro aprobado y TXHASH registrado.");
  });

  // ============================
  //   RECHAZAR RETIRO
  // ============================
  bot.action(/admin_rej_(\d+)/, async (ctx) => {
    if (String(ctx.from.id) !== String(ADMIN_ID)) return;

    const withdrawalId = ctx.match[1];

    await supabase
      .from("withdrawals")
      .update({ status: "rejected" })
      .eq("id", withdrawalId);

    return ctx.reply("❌ Retiro rechazado.");
  });
  }
