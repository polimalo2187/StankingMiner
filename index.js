import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import { MongoClient } from "mongodb";
import express from "express";

// ------------------------------------
// CONFIGURACIONES PRINCIPALES
// ------------------------------------
const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

// ------------------------------------
// CONEXIÓN A MONGODB
// ------------------------------------
let db, users, withdrawals, deposits;

const client = new MongoClient(MONGO_URI);

async function connectDB() {
  try {
    await client.connect();
    db = client.db(DB_NAME);
    users = db.collection("users");
    withdrawals = db.collection("withdrawals");
    deposits = db.collection("deposits");
    console.log("📦 MongoDB conectado correctamente");
  } catch (e) {
    console.error("❌ Error conectando MongoDB:", e);
  }
}
connectDB();

// ------------------------------------
// EXPRESS PARA WEBHOOK
// ------------------------------------
const app = express();
app.use(express.json());

app.post("/webhook", (req, res) => {
  bot.handleUpdate(req.body);
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🔥 Webhook activo en puerto", process.env.PORT);
});

// ------------------------------------
// FUNCIONES UTILITARIAS
// ------------------------------------
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

async function limpiarChat(ctx) {
  try {
    const messages = await ctx.telegram.getChatHistory(ctx.chat.id, { limit: 4 });
    for (let msg of messages) {
      await ctx.deleteMessage(msg.message_id).catch(() => {});
    }
  } catch {}
}

// ------------------------------------
// COMANDO /start
// ------------------------------------
bot.start(async (ctx) => {
  const userId = ctx.from.id;

  let user = await users.findOne({ telegram_id: userId });

  if (!user) {
    await users.insertOne({
      telegram_id: userId,
      verified: false,
      verification_code: generarCodigo(),
      balance: 0,
      referrals: 0,
      valid_referrals: 0,
      referral_earnings: 0,
      staking_active: false,
      mining_active: false,
      staking_earnings: 0,
      mining_earnings: 0,
      deposit_step: null,
      withdraw_step: null,
    });
  }

  user = await users.findOne({ telegram_id: userId });

  await ctx.reply(
    `👋 *Bienvenido*\n\nTu código de verificación es:\n🔐 *${user.verification_code}*\n\nEnvíalo para continuar.`,
    { parse_mode: "Markdown" }
  );
});

// ------------------------------------
// VERIFICAR CÓDIGO
// ------------------------------------
bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const msg = ctx.message.text.trim();

  let user = await users.findOne({ telegram_id: userId });
  if (!user) return next();

  if (!user.verified) {
    if (msg !== user.verification_code) {
      return ctx.reply("❌ Código incorrecto. Inténtalo nuevamente.");
    }

    await users.updateOne({ telegram_id: userId }, { $set: { verified: true } });

    return mostrarMenu(ctx);
  }

  next();
});

// ------------------------------------
// MENÚ PRINCIPAL
// ------------------------------------
function mostrarMenu(ctx) {
  ctx.reply(
    `🏠 *MENÚ PRINCIPAL*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("📦 Staking", "staking"),
          Markup.button.callback("⛏ Minería", "mining")
        ],
        [
          Markup.button.callback("👥 Referidos", "referrals"),
          Markup.button.callback("💰 Ganancias", "gains")
        ],
        [
          Markup.button.callback("💸 Retiro", "withdraw"),
          Markup.button.callback("🛠 Soporte", "support")
        ]
      ])
    }
  );
}

// ------------------------------------
// BOTÓN VOLVER
// ------------------------------------
bot.action("menu", (ctx) => mostrarMenu(ctx));

// ------------------------------------
// SOPORTE
// ------------------------------------
bot.action("support", async (ctx) => {
  await ctx.reply(
    `🛠 *SOPORTE*\n\n` +
    `📩 Soporte: @StankingMiner\n` +
    `📢 Canal oficial: https://t.me/StankinMiner`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.callback("⬅ Volver", "menu")]])
    }
  );
});

// ------------------------------------
// STAKING
// ------------------------------------
bot.action("staking", async (ctx) => {
  await ctx.reply(
    `📦 *STAKING*\n\nPlanes disponibles: 1, 3, 5, 7, 10, 20, 30, 40, 50 USDT\nGanancia: *10% diario por 20 días*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("▶ Activar Staking", "staking_start")],
        [Markup.button.callback("⏸ Desactivar", "staking_stop")],
        [Markup.button.callback("⬅ Volver", "menu")]
      ])
    }
  );
});

bot.action("staking_start", async (ctx) => {
  const userId = ctx.from.id;

  await users.updateOne(
    { telegram_id: userId },
    { $set: { staking_active: true } }
  );

  ctx.reply("📦 *Staking activado correctamente*", { parse_mode: "Markdown" });
});

bot.action("staking_stop", async (ctx) => {
  const userId = ctx.from.id;

  await users.updateOne(
    { telegram_id: userId },
    { $set: { staking_active: false } }
  );

  ctx.reply("🛑 *Staking desactivado*", { parse_mode: "Markdown" });
});

// ------------------------------------
// MINERÍA
// ------------------------------------
bot.action("mining", async (ctx) => {
  const u = await users.findOne({ telegram_id: ctx.from.id });

  await ctx.reply(
    `⛏ *MINERÍA*\n\n` +
    `Ganancia: *0.02 USDT diario*\n` +
    `Duración: *20 días*\n` +
    `Requisito: *5 referidos válidos*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("▶ Activar", "mining_start")],
        [Markup.button.callback("⏸ Desactivar", "mining_stop")],
        [Markup.button.callback("⬅ Volver", "menu")]
      ])
    }
  );
});

bot.action("mining_start", async (ctx) => {
  const userId = ctx.from.id;
  const u = await users.findOne({ telegram_id: userId });

  if (u.valid_referrals < 5)
    return ctx.reply("❌ Necesitas 5 referidos válidos para activar minería.");

  await users.updateOne(
    { telegram_id: userId },
    { $set: { mining_active: true } }
  );

  ctx.reply("⛏ *Minería activada*", { parse_mode: "Markdown" });
});

// ------------------------------------
// REFERIDOS
// ------------------------------------
bot.action("referrals", async (ctx) => {
  const userId = ctx.from.id;
  const u = await users.findOne({ telegram_id: userId });

  const link = `https://t.me/${process.env.BOT_USERNAME}?start=${userId}`;

  ctx.reply(
    `👥 *REFERIDOS*\n\n` +
    `🔗 Tu enlace: ${link}\n` +
    `👤 Referidos: ${u.referrals}\n` +
    `✔ Válidos: ${u.valid_referrals}\n` +
    `💵 Ganancias: ${u.referral_earnings.toFixed(2)} USDT`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.callback("⬅ Volver", "menu")]])
    }
  );
});

// ------------------------------------
// GANANCIAS
// ------------------------------------
bot.action("gains", async (ctx) => {
  const u = await users.findOne({ telegram_id: ctx.from.id });

  const total =
    u.balance +
    u.mining_earnings +
    u.staking_earnings +
    u.referral_earnings;

  ctx.reply(
    `💰 *TUS GANANCIAS*\n\n` +
    `📦 Staking: ${u.staking_earnings} USDT\n` +
    `⛏ Minería: ${u.mining_earnings} USDT\n` +
    `👥 Referidos: ${u.referral_earnings} USDT\n\n` +
    `💎 *Total:* ${total.toFixed(2)} USDT`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([[Markup.button.callback("⬅ Volver", "menu")]])
    }
  );
});

// ------------------------------------
// RETIROS
// ------------------------------------
bot.action("withdraw", async (ctx) => {
  const u = await users.findOne({ telegram_id: ctx.from.id });

  if (u.balance < 1)
    return ctx.reply("❌ Mínimo de retiro: 1 USDT");

  await users.updateOne(
    { telegram_id: ctx.from.id },
    { $set: { withdraw_step: "wallet" } }
  );

  ctx.reply("💸 Envía la *wallet USDT-BEP20* para el retiro.", {
    parse_mode: "Markdown",
  });
});

// CAPTURA RETIROS
bot.on("text", async (ctx) => {
  const u = await users.findOne({ telegram_id: ctx.from.id });
  if (!u) return;

  if (u.withdraw_step === "wallet") {
    if (!ctx.message.text.startsWith("0x"))
      return ctx.reply("❌ Wallet inválida.");

    await users.updateOne(
      { telegram_id: ctx.from.id },
      {
        $set: {
          withdraw_wallet: ctx.message.text,
          withdraw_step: "amount",
        },
      }
    );

    return ctx.reply("💵 Ahora dime la cantidad a retirar.");
  }

  if (u.withdraw_step === "amount") {
    const amount = Number(ctx.message.text);

    if (amount > u.balance)
      return ctx.reply("❌ No tienes suficiente balance.");

    await withdrawals.insertOne({
      telegram_id: ctx.from.id,
      wallet: u.withdraw_wallet,
      amount,
      status: "pending",
    });

    await users.updateOne(
      { telegram_id: ctx.from.id },
      {
        $set: {
          withdraw_step: null,
          withdraw_wallet: null,
        },
      }
    );

    return ctx.reply("⏳ Retiro solicitado. Un admin lo procesará.");
  }
});

// ------------------------------------
// INICIAR BOT CON WEBHOOK
// ------------------------------------
(async () => {
  try {
    await bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);
    console.log("✔ Webhook configurado");
  } catch (err) {
    console.error("❌ Error configurando webhook:", err);
  }
})();
