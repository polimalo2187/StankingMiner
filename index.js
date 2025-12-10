import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import mongoose from "mongoose";

// ======================================================
//                 CONEXIÓN A MONGODB
// ======================================================
const mongo_url = process.env.MONGO_URI;
mongoose.connect(mongo_url, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("MongoDB conectado"))
    .catch(err => console.log("Error en Mongo:", err));

// ======================================================
//                 ESQUEMA DE USUARIO
// ======================================================
const User = mongoose.model("User", new mongoose.Schema({
    telegram_id: Number,
    verified: { type: Boolean, default: false },

    // RECOMPENSAS
    balance: { type: Number, default: 0 },
    ganancias_staking: { type: Number, default: 0 },
    ganancias_mineria: { type: Number, default: 0 },
    ganancias_referidos: { type: Number, default: 0 },

    // REFERIDOS
    referrals: { type: Number, default: 0 },
    valid_referrals: { type: Number, default: 0 },

    // SISTEMA DE MINERÍA
    mining_active: { type: Boolean, default: false },
    mining_start: Date,
    mining_end: Date,

    // SISTEMA DE STAKING
    staking_active: { type: Boolean, default: false },
    staking_amount: { type: Number, default: 0 },
    staking_start: Date,
    staking_end: Date,

    // VERIFICACIÓN
    verification_code: String
}));

// ======================================================
//                 CREAR BOT
// ======================================================
const bot = new Telegraf(process.env.BOT_TOKEN);

// ======================================================
//           AUTOCLEAN — BORRAR CADA 3 MENSAJES
// ======================================================
async function autoClean(ctx) {
    try {
        if (!ctx.session) ctx.session = {};
        if (!ctx.session.messages) ctx.session.messages = [];

        ctx.session.messages.push(ctx.message?.message_id);

        if (ctx.session.messages.length >= 3) {
            for (let id of ctx.session.messages) {
                try { await ctx.deleteMessage(id); } catch (e) { }
            }
            ctx.session.messages = [];
        }
    } catch (err) { }
}

// ======================================================
//                MENÚ PRINCIPAL
// ======================================================
function menuPrincipal(ctx) {
    return ctx.reply(
        `🏠 *MENÚ PRINCIPAL*\nSelecciona una opción:`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback("📦 Staking", "staking_menu"),
                    Markup.button.callback("⛏ Minería", "mining_menu")
                ],
                [
                    Markup.button.callback("👥 Referidos", "ref_menu"),
                    Markup.button.callback("💰 Ganancias", "gains_menu")
                ],
                [
                    Markup.button.callback("💸 Retiro", "withdraw_menu"),
                    Markup.button.callback("🛠 Soporte", "support_menu")
                ]
            ])
        }
    );
}

// ======================================================
//                  /START — CODIGO DE VERIFICACIÓN
// ======================================================
bot.start(async (ctx) => {
    const userId = ctx.from.id;

    let user = await User.findOne({ telegram_id: userId });

    if (!user) {
        user = new User({
            telegram_id: userId,
            verification_code: Math.floor(10000 + Math.random() * 90000).toString()
        });
        await user.save();
    }

    await ctx.reply(
        `👋 *Bienvenido a STANKING MINER*\n\nTu código de verificación es:\n\n🔐 *${user.verification_code}*\n\nEnvíalo para continuar.`,
        { parse_mode: "Markdown" }
    );
});

// ======================================================
//              VALIDACIÓN DEL CÓDIGO
// ======================================================
bot.on("text", async (ctx, next) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    let user = await User.findOne({ telegram_id: userId });

// ======================================================
//                   SISTEMA DE REFERIDOS
// ======================================================

bot.action("ref_menu", async (ctx) => {
    const userId = ctx.from.id;

    let user = await User.findOne({ telegram_id: userId });

    const link = `https://t.me/${process.env.BOT_USERNAME}?start=${userId}`;

    return ctx.reply(
        `👥 *REFERIDOS*\n\n` +
        `🔗 Enlace:\n${link}\n\n` +
        `👤 Total: *${user.referrals}*\n` +
        `✔ Válidos: *${user.valid_referrals}*\n` +
        `💵 Ganancias: *${user.ganancias_referidos.toFixed(2)} USDT*`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

// ======================================================
//                      GANANCIAS
// ======================================================

bot.action("gains_menu", async (ctx) => {
    const user = await User.findOne({ telegram_id: ctx.from.id });

    const total =
        user.balance +
        user.ganancias_mineria +
        user.ganancias_referidos +
        user.ganancias_staking;

    return ctx.reply(
        `💰 *GANANCIAS*\n\n` +
        `📦 Staking: *${user.ganancias_staking.toFixed(2)} USDT*\n` +
        `⛏ Minería: *${user.ganancias_mineria.toFixed(2)} USDT*\n` +
        `👥 Referidos: *${user.ganancias_referidos.toFixed(2)} USDT*\n\n` +
        `💎 Total: *${total.toFixed(2)} USDT*`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

// ======================================================
//                    SOPORTE
// ======================================================

bot.action("support_menu", async (ctx) => {
    return ctx.reply(
        `🛠 *SOPORTE*\n\n` +
        `📞 Soporte: @StankingMiner\n` +
        `📢 Canal oficial:\nhttps://t.me/StankinMiner`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

// ======================================================
//                      STAKING
// ======================================================

const STAKING_PLANES = [1, 3, 5, 7, 10, 20, 30, 40, 50]; // USDT
const STAKING_DIAS = 20;
const STAKING_PORCENTAJE = 0.10; // 10% diario

bot.action("staking_menu", async (ctx) => {
    return ctx.reply(
        `📦 *STAKING*\n\nSelecciona un plan:`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                ...STAKING_PLANES.map(v => [Markup.button.callback(`${v} USDT`, `staking_${v}`)]),
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

STAKING_PLANES.forEach(monto => {
    bot.action(`staking_${monto}`, async (ctx) => {
        const user = await User.findOne({ telegram_id: ctx.from.id });

        if (user.balance < monto)
            return ctx.reply("❌ No tienes saldo suficiente.", backButton);

        user.balance -= monto;
        user.staking_active = true;
        user.staking_amount = monto;
        user.staking_start = new Date();
        user.staking_end = new Date(Date.now() + STAKING_DIAS * 24 * 60 * 60 * 1000);

        await user.save();

        return ctx.reply(
            `📦 *STAKING ACTIVADO*\n\n` +
            `💰 Plan: *${monto} USDT*\n` +
            `⏳ Duración: *20 días*\n` +
            `🏦 Ganancia diaria: *${(monto * STAKING_PORCENTAJE).toFixed(2)} USDT*`,
            { parse_mode: "Markdown", ...backButton }
        );
    });
});

// ======================================================
//                    MINERÍA
// ======================================================

const MINING_DIAS = 20;
const MINING_REWARD = 0.02; // diario
const MINING_REFS_NECESARIOS = 5;

bot.action("mining_menu", async (ctx) => {
    const user = await User.findOne({ telegram_id: ctx.from.id });

    return ctx.reply(
        `⛏ *MINERÍA*\n\n` +
        `Estado: *${user.mining_active ? "Activa" : "Inactiva"}*\n` +
        `Requisito: *5 referidos válidos*\n\n` +
        `Ganancia diaria: *0.02 USDT*`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("▶ Activar", "mining_start")],
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

bot.action("mining_start", async (ctx) => {
    const user = await User.findOne({ telegram_id: ctx.from.id });

    if (user.valid_referrals < MINING_REFS_NECESARIOS)
        return ctx.reply("❌ Necesitas 5 referidos válidos.", backButton);

    user.mining_active = true;
    user.mining_start = new Date();
    user.mining_end = new Date(Date.now() + MINING_DIAS * 24 * 60 * 60 * 1000);
    await user.save();

    return ctx.reply(
        `⛏ *MINERÍA ACTIVADA*\n\n` +
        `Duración: *20 días*\n` +
        `Recompensa diaria: *0.02 USDT*`,
        { parse_mode: "Markdown", ...backButton }
    );
});

// ======================================================
//          PROCESO AUTOMÁTICO DE RECOMPENSAS
// ======================================================

setInterval(async () => {
    const users = await User.find();

    for (let u of users) {
        const now = new Date();

        // Recompensas Staking
        if (u.staking_active && u.staking_end > now) {
            u.ganancias_staking += u.staking_amount * STAKING_PORCENTAJE;
        }

        // Recompensas Minería
        if (u.mining_active && u.mining_end > now) {
            u.ganancias_mineria += MINING_REWARD;
        }

        // Recompensas por referidos
        if (u.referrals > 0) {
            u.ganancias_referidos += (u.referrals * 0.02);
        }

        await u.save();
    }
}, 24 * 60 * 60 * 1000); // cada 24 horas

// ======================================================
//                        MENU GLOBAL
// ======================================================

bot.action("menu", async (ctx) => menuPrincipal(ctx));

// ======================================================
//                        INICIO
// ======================================================

bot.launch();
console.log("🚀 BOT INICIADO CORRECTAMENTE");
    if (!user) return next();
    if (user.verified) return next();

    if (msg !== user.verification_code) {
        return ctx.reply("❌ Código incorrecto.");
    }

    user.verified = true;
    await user.save();

    await ctx.reply("✅ *VERIFICADO*", { parse_mode: "Markdown" });

    return menuPrincipal(ctx);
});
