import dotenv from "dotenv";
dotenv.config();

import { Telegraf, Markup } from "telegraf";
import axios from "axios";
import { createClient } from "@supabase/supabase-js";
import http from "http";

// --- CONFIGURACIONES ---
const bot = new Telegraf(process.env.BOT_TOKEN);
const WEBHOOK_URL = process.env.WEBHOOK_URL;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Servidor HTTP (Railway lo necesita activo)
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Bot running\n");
}).listen(process.env.PORT || 3000);

// Borrar webhook viejo
bot.telegram.deleteWebhook().catch(() => {});function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

bot.start(async (ctx) => {
  const userId = ctx.from.id;

  await supabase.from("users").upsert({
    telegram_id: userId,
    balance: 0,
    referrals: 0,
    valid_referrals: 0,
    referral_earnings: 0,
    staking_earnings: 0,
    mining_earnings: 0,
    staking_active: false,
    mining_active: false,
  });

  const codigo = generarCodigo();

  await supabase
    .from("users")
    .update({ verification_code: codigo })
    .eq("telegram_id", userId);

  await ctx.reply(
    `👋 *Bienvenido*\n\nTu código de verificación es:\n\n🔐 *${codigo}*\n\nIngresa el código para continuar.`,
    { parse_mode: "Markdown" }
  );
});bot.on("text", async (ctx, next) => {
  const userId = ctx.from.id;
  const mensaje = ctx.message.text.trim();

  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", userId)
    .single();

  if (!user) return next();
  if (user.verified) return next();

  if (mensaje !== user.verification_code) {
    return ctx.reply("❌ Código incorrecto, intenta nuevamente.");
  }

  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", userId);

  await ctx.reply(
    `✅ *VERIFICACIÓN COMPLETADA*\n\nBienvenido.`,
    { parse_mode: "Markdown" }
  );

  mostrarMenu(ctx);
});

function mostrarMenu(ctx) {
  ctx.reply(
    `🏠 *MENÚ PRINCIPAL*`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("📦 Staking", "staking_menu"),
          Markup.button.callback("⛏ Minería", "mining_menu")
        ],
        [
          Markup.button.callback("👥 Referidos", "referrals_menu"),
        ],
        [
          Markup.button.callback("💰 Ganancias", "gains_menu"),
          Markup.button.callback("💸 Retiro", "withdraw_menu")
        ],
        [
          Markup.button.callback("🛠 Soporte", "support_menu")
        ]
      ])
    }
  );
}bot.action("staking_menu", async (ctx) => {
  ctx.reply(
    `📦 *STAKING*\n\nElige una acción:`,
    {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("▶ Activar", "staking_start"),
          Markup.button.callback("⏸ Desactivar", "staking_stop")
        ],
        [Markup.button.callback("⬅ Volver", "menu_back")]
      ])
    }
  );
});

bot.action("staking_start", async (ctx) => {
  const userId = ctx.from.id;

  await supabase
    .from("users")
    .update({ staking_active: true })
    .eq("telegram_id", userId);

  ctx.reply(`📦 *Staking activado*`, { parse_mode: "Markdown" });
});

bot.action("staking_stop", async (ctx) => {
  const userId = ctx.from.id;

  await supabase
    .from("users")
    .update({ staking_active: false })
    .eq("telegram_id", userId);

  ctx.reply(`🛑 *Staking desactivado*`, { parse_mode: "Markdown" });
});// ==========================================
//       SISTEMA DE MINERÍA AUTOMÁTICA
// ==========================================

bot.action("mining_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return ctx.reply("⚠️ Error cargando datos.");

    await ctx.reply(
        `⛏ *MINERÍA*\n\n` +
        `Estado actual: *${user.mining_active ? "ACTIVA" : "DESACTIVADA"}*\n` +
        `Ganancia diaria: *0.5 USDT*\n\n` +
        `Selecciona una opción:`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback("▶ Activar minería", "mining_start"),
                    Markup.button.callback("⏸ Detener", "mining_stop")
                ],
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});

// Activar minería
bot.action("mining_start", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
        .from("users")
        .update({ mining_active: true })
        .eq("telegram_id", userId);

    await ctx.reply(
        `⛏ *Minería activada*\n\nAhora ganas *0.5 USDT diarios* automáticamente.`,
        { parse_mode: "Markdown" }
    );
});

// Desactivar minería
bot.action("mining_stop", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
        .from("users")
        .update({ mining_active: false })
        .eq("telegram_id", userId);

    await ctx.reply(
        `🛑 *Minería detenida*\n\nPuedes activarla cuando desees.`,
        { parse_mode: "Markdown" }
    );
});// ==========================================
//             REFERIDOS
// ==========================================

bot.action("referrals_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return ctx.reply("⚠️ Error cargando datos.");

    const link = `https://t.me/${process.env.BOT_USERNAME}?start=${userId}`;

    await ctx.reply(
        `👥 *PROGRAMA DE REFERIDOS*\n\n` +
        `🔗 Tu enlace:\n${link}\n\n` +
        `🎁 *Recompensa:* 0.02 USDT por cada referido\n` +
        `✔ Referidos totales: *${user.referrals}*\n` +
        `✔ Referidos válidos: *${user.valid_referrals}*\n` +
        `💵 Ganancias por referidos: *${Number(user.referral_earnings).toFixed(2)} USDT*`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});// ==========================================
//               GANANCIAS
// ==========================================

bot.action("gains_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return ctx.reply("⚠️ Error cargando datos.");

    let total =
        Number(user.balance) +
        Number(user.staking_earnings) +
        Number(user.mining_earnings) +
        Number(user.referral_earnings);

    await ctx.reply(
        `💰 *TUS GANANCIAS*\n\n` +
        `📦 Staking: *${user.staking_earnings} USDT*\n` +
        `⛏ Minería: *${user.mining_earnings} USDT*\n` +
        `👥 Referidos: *${user.referral_earnings} USDT*\n\n` +
        `💎 *BALANCE TOTAL:* ${total.toFixed(2)} USDT`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});// =====================================================
//                 SISTEMA DE RETIROS
// =====================================================

bot.action("withdraw_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return ctx.reply("⚠️ Error cargando perfil.");

    if (Number(user.balance) < 1) {
        return ctx.reply(
            `❌ *No cumples con el mínimo de retiro (1 USDT).*`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([[Markup.button.callback("⬅ Volver", "menu")]])
            }
        );
    }

    // Cambiar paso del retiro
    await supabase
        .from("users")
        .update({ withdraw_step: "enter_wallet" })
        .eq("telegram_id", userId);

    return ctx.reply(
        `💸 *RETIRAR FONDOS*\n\nEnvíame tu *dirección USDT-BEP20* para procesar el pago.`,
        { parse_mode: "Markdown" }
    );
});


// =====================================================
//     CAPTURAR WALLET Y LUEGO CANTIDAD A RETIRAR
// =====================================================

bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    // Buscar usuario
    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return;

    // No está en proceso de retiro → ignorar
    if (!user.withdraw_step) return;

    // -------------------------
    // PASO 1 — RECIBIR WALLET
    // -------------------------
    if (user.withdraw_step === "enter_wallet") {

        if (!msg.startsWith("0x") || msg.length < 30) {
            return ctx.reply("❌ Wallet inválida. Inténtalo otra vez.");
        }

        await supabase
            .from("users")
            .update({
                withdraw_wallet: msg,
                withdraw_step: "enter_amount"
            })
            .eq("telegram_id", userId);

        return ctx.reply(
            `💰 Perfecto.\n\nAhora dime la *cantidad* que deseas retirar.`,
            { parse_mode: "Markdown" }
        );
    }

    // -------------------------
    // PASO 2 — RECIBIR MONTO
    // -------------------------
    if (user.withdraw_step === "enter_amount") {

        const amount = Number(msg);

        if (isNaN(amount) || amount <= 0) {
            return ctx.reply("❌ Cantidad inválida.");
        }

        if (amount > Number(user.balance)) {
            return ctx.reply("❌ No tienes balance suficiente.");
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
            `💵 *Monto:* ${amount} USDT\n\n` +
            `¿Deseas continuar?`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [Markup.button.callback("✔ Confirmar", "withdraw_confirm")],
                    [Markup.button.callback("❌ Cancelar", "menu")]
                ])
            }
        );
    }
});


// =====================================================
//          PASO 3 — CONFIRMAR RETIRO
// =====================================================

bot.action("withdraw_confirm", async (ctx) => {
    const userId = ctx.from.id;

    // Obtener usuario
    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return ctx.reply("⚠️ Error interno.");

    // Registrar retiro
    await supabase
        .from("withdrawals")
        .insert({
            user_id: userId,
            wallet: user.withdraw_wallet,
            amount: user.withdraw_amount,
            status: "pending"
        });

    // Reiniciar estado de retiro
    await supabase
        .from("users")
        .update({
            withdraw_step: null,
            withdraw_wallet: null,
            withdraw_amount: null
        })
        .eq("telegram_id", userId);

    return ctx.reply(
        `⏳ *RETIRO SOLICITADO*\n\n` +
        `Tu retiro ha sido registrado y está *pendiente de aprobación*.\n\n` +
        `Un administrador lo procesará manualmente.`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});// =====================================================
//                  SISTEMA DE DEPÓSITOS
// =====================================================

bot.action("deposits_menu", async (ctx) => {
    const wallet = process.env.BOT_WALLET_ADDRESS;

    if (!wallet) {
        return ctx.reply("⚠️ Error: BOT_WALLET_ADDRESS no está configurado.");
    }

    return ctx.reply(
        `💰 *DEPÓSITOS*\n\n` +
        `Envía USDT-BEP20 a esta dirección:\n\n` +
        `🪪 *${wallet}*\n\n` +
        `Luego presiona el botón para enviar tu *TX Hash* y validar el depósito.`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("📨 Enviar TX Hash", "send_tx_hash")],
                [Markup.button.callback("⬅ Volver", "menu")]
            ])
        }
    );
});


// =====================================================
//        USUARIO PRESIONA “Enviar TX Hash”
// =====================================================

bot.action("send_tx_hash", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
        .from("users")
        .update({ deposit_step: "waiting_tx" })
        .eq("telegram_id", userId);

    return ctx.reply(
        `🔍 *VALIDAR DEPÓSITO*\n\nEnvía aquí tu *TX Hash* para verificarlo en la blockchain.`,
        { parse_mode: "Markdown" }
    );
});


// =====================================================
//            CAPTURA DEL TX HASH DEL USUARIO
// =====================================================

bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user) return;
    if (user.deposit_step !== "waiting_tx") return;

    if (msg.length < 20) {
        return ctx.reply("❌ TX Hash inválido. Envíalo nuevamente.");
    }

    // Guardar el TX temporalmente
    await supabase
        .from("users")
        .update({
            deposit_step: "verifying",
            last_tx: msg
        })
        .eq("telegram_id", userId);

    await ctx.reply("⏳ Verificando transacción...");

    // Iniciar verificación
    await verificarDeposito(ctx, msg, userId);
});


// =====================================================
//            FUNCIÓN DE VERIFICACIÓN EN BSCSCAN
// =====================================================

async function verificarDeposito(ctx, txhash, userId) {
    const BSCSCAN = "https://api.bscscan.com/api";

    try {
        const tokenContract = process.env.TOKEN_CONTRACT;
        const botWallet = process.env.BOT_WALLET_ADDRESS.toLowerCase();

        if (!tokenContract) {
            return ctx.reply("❌ Error: TOKEN_CONTRACT no está configurado.");
        }

        const { data } = await axios.get(BSCSCAN, {
            params: {
                module: "proxy",
                action: "eth_getTransactionByHash",
                txhash,
                apikey: process.env.BSCSCAN_API_KEY
            }
        });

        if (!data.result) {
            return ctx.reply("❌ Transacción no encontrada.");
        }

        const tx = data.result;

        // Validar que es un contrato válido
        if (!tx.to) {
            return ctx.reply("❌ Esta transacción no envía tokens.");
        }

        // Validar USDT
        if (tx.to.toLowerCase() !== tokenContract.toLowerCase()) {
            return ctx.reply("❌ La transacción NO es USDT-BEP20.");
        }

        const inputData = tx.input.toLowerCase();

        if (!inputData || inputData.length < 138) {
            return ctx.reply("❌ No se pudo leer la transacción correctamente.");
        }

        // Extraer wallet destino
        const destination = "0x" + inputData.slice(10 + 64 - 40, 10 + 64);

        if (destination.toLowerCase() !== botWallet) {
            return ctx.reply("❌ El depósito NO fue enviado al bot.");
        }

        // Extraer monto
        const amountHex = inputData.slice(-64);
        const amount = parseInt(amountHex, 16) / 1e18;

        if (amount <= 0) {
            return ctx.reply("❌ Depósito inválido.");
        }

        // Registrar depósito + aumentar balance
        await supabase
            .from("users")
            .update({
                balance: amount,
                deposit_step: null,
                last_tx: null
            })
            .eq("telegram_id", userId);

        return ctx.reply(
            `✅ *DEPÓSITO COMPLETADO*\n\n` +
            `💵 *Monto:* ${amount} USDT\n` +
            `🏦 Tu balance fue actualizado.`,
            { parse_mode: "Markdown" }
        );

    } catch (e) {
        console.log("Error verificando TX:", e);
        return ctx.reply("⚠️ Error interno verificando transacción.");
    }
}// =====================================================
//                SISTEMA DE MINERÍA
// =====================================================

bot.action("mining_menu", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("mining_active")
        .eq("telegram_id", userId)
        .single();

    if (!user) {
        return ctx.reply("⚠️ Error cargando perfil. Usa /start nuevamente.");
    }

    const estado = user.mining_active ? "🟢 Activa" : "🔴 Inactiva";

    return ctx.reply(
        `⛏ *MINERÍA*\n\n` +
        `Estado actual: *${estado}*\n\n` +
        `Puedes activar o desactivar la minería cuando quieras.`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [
                    Markup.button.callback(
                        user.mining_active ? "⏸ Desactivar" : "▶ Activar",
                        user.mining_active ? "mining_stop" : "mining_start"
                    )
                ],
                [Markup.button.callback("⬅ Regresar", "menu")]
            ])
        }
    );
});


// =====================================================
//                ACTIVAR MINERÍA
// =====================================================

bot.action("mining_start", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("mining_active")
        .eq("telegram_id", userId)
        .single();

    if (!user) {
        return ctx.reply("⚠️ Error cargando datos.");
    }

    if (user.mining_active) {
        return ctx.reply("⚠️ Ya tienes minería activa.");
    }

    await supabase
        .from("users")
        .update({ mining_active: true })
        .eq("telegram_id", userId);

    return ctx.reply(
        `⛏ *MINERÍA ACTIVADA*\n\n` +
        `✔ Ahora estás generando recompensas automáticas.`,
        { parse_mode: "Markdown" }
    );
});


// =====================================================
//                DESACTIVAR MINERÍA
// =====================================================

bot.action("mining_stop", async (ctx) => {
    const userId = ctx.from.id;

    const { data: user } = await supabase
        .from("users")
        .select("mining_active")
        .eq("telegram_id", userId)
        .single();

    if (!user) {
        return ctx.reply("⚠️ Error cargando datos.");
    }

    if (!user.mining_active) {
        return ctx.reply("⚠️ No tienes minería activa.");
    }

    await supabase
        .from("users")
        .update({ mining_active: false })
        .eq("telegram_id", userId);

    return ctx.reply(
        `🛑 *MINERÍA DESACTIVADA*\n\n` +
        `No seguirás generando recompensas hasta activarla de nuevo.`,
        { parse_mode: "Markdown" }
    );
});// =====================================================
//          SISTEMA AUTOMÁTICO DE GANANCIAS
// =====================================================

// Configuración de ganancias por día
const GANANCIA_STAKING = 0.05;   // 5% diario (ejemplo)
const GANANCIA_MINING = 0.03;    // 3% diario (ejemplo)
const GANANCIA_REFERIDO = 0.02;  // Por referido validado

// Cada 60 segundos suma ganancias a todos los usuarios
setInterval(async () => {
    try {
        console.log("⏳ Procesando ganancias automáticas...");

        // Obtener todos los usuarios
        const { data: users, error } = await supabase
            .from("users")
            .select("*");

        if (error || !users) {
            console.log("❌ Error al leer usuarios:", error);
            return;
        }

        for (const user of users) {

            let gananciaTotal = 0;

            // STAKING ACTIVO
            if (user.staking_active) {
                gananciaTotal += GANANCIA_STAKING;
            }

            // MINERÍA ACTIVA
            if (user.mining_active) {
                gananciaTotal += GANANCIA_MINING;
            }

            // REFERIDOS VÁLIDOS
            if (user.valid_referrals > 0) {
                gananciaTotal += (user.valid_referrals * GANANCIA_REFERIDO);
            }

            // Si no ganó nada, pasar al siguiente
            if (gananciaTotal === 0) continue;

            // Sumar al balance
            const nuevoBalance =
                Number(user.balance) + Number(gananciaTotal);

            await supabase
                .from("users")
                .update({ balance: nuevoBalance })
                .eq("telegram_id", user.telegram_id);

            console.log(
                `💰 Usuario ${user.telegram_id} recibió +${gananciaTotal.toFixed(4)} USDT`
            );
        }

        console.log("✔ Ganancias procesadas");

    } catch (err) {
        console.log("❌ Error procesando ganancias:", err);
    }

}, 60 * 1000); // Se ejecuta cada 1 minuto// =====================================================
//               PANEL DEL ADMINISTRADOR
// =====================================================

// ID del administrador (TU TELEGRAM ID)
const ADMIN_ID = 2010460041;

// Comando /admin (solo tú puedes usarlo)
bot.command("admin", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) {
        return ctx.reply("❌ No tienes permisos para acceder.");
    }

    return ctx.reply(
        "🔐 *PANEL ADMINISTRATIVO*\nElige una opción:",
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("📋 Ver usuarios", "admin_users")],
                [Markup.button.callback("💸 Retiros pendientes", "admin_withdraws")],
                [Markup.button.callback("🗑 Eliminar usuario", "admin_delete")],
                [Markup.button.callback("⬅ Menú principal", "menu")]
            ])
        }
    );
});

// =====================================================
//   VER TODOS LOS USUARIOS
// =====================================================
bot.action("admin_users", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const { data: users, error } = await supabase
        .from("users")
        .select("telegram_id, balance, referrals, staking_active, mining_active");

    if (error || !users) {
        return ctx.reply("❌ Error cargando usuarios.");
    }

    let msg = "📋 *LISTA DE USUARIOS*\n\n";

    users.forEach((u) => {
        msg += `🆔 *${u.telegram_id}*\n`;
        msg += `💰 Balance: ${u.balance}\n`;
        msg += `👥 Referidos: ${u.referrals}\n`;
        msg += `📦 Staking: ${u.staking_active ? "ON" : "OFF"}\n`;
        msg += `⛏ Minería: ${u.mining_active ? "ON" : "OFF"}\n`;
        msg += `-----------------------\n`;
    });

    return ctx.reply(msg, { parse_mode: "Markdown" });
});

// =====================================================
//     RETIROS PENDIENTES
// =====================================================
bot.action("admin_withdraws", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const { data: withdrawals, error } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("status", "pending");

    if (error || !withdrawals) {
        return ctx.reply("❌ Error cargando retiros.");
    }

    if (withdrawals.length === 0) {
        return ctx.reply("✔ No hay retiros pendientes.");
    }

    withdrawals.forEach((w) => {
        ctx.reply(
            `💸 *RETIRO PENDIENTE*\n\n` +
            `🆔 Usuario: ${w.user_id}\n` +
            `🪪 Wallet: ${w.wallet}\n` +
            `💵 Monto: ${w.amount} USDT\n\n` +
            `¿Qué deseas hacer?`,
            {
                parse_mode: "Markdown",
                ...Markup.inlineKeyboard([
                    [
                        Markup.button.callback("✔ Aprobar", `approve_${w.id}`),
                        Markup.button.callback("❌ Rechazar", `reject_${w.id}`)
                    ]
                ])
            }
        );
    });
});

// =====================================================
//          APROBAR RETIRO
// =====================================================
bot.action(/approve_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const withdrawalId = ctx.match[1];

    await supabase
        .from("withdrawals")
        .update({ status: "approved" })
        .eq("id", withdrawalId);

    ctx.reply("✔ Retiro aprobado.");
});

// =====================================================
//          RECHAZAR RETIRO
// =====================================================
bot.action(/reject_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const withdrawalId = ctx.match[1];

    await supabase
        .from("withdrawals")
        .update({ status: "rejected" })
        .eq("id", withdrawalId);

    ctx.reply("❌ Retiro rechazado.");
});

// =====================================================
//          ELIMINAR USUARIO
// =====================================================
bot.action("admin_delete", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    await supabase
        .from("users")
        .update({ delete_step: "waiting_id" })
        .eq("telegram_id", ADMIN_ID);

    return ctx.reply("🗑 Envía el *ID del usuario* a eliminar.", {
        parse_mode: "Markdown"
    });
});

// Capturar texto para eliminar usuario
bot.on("text", async (ctx) => {
    const adminId = ctx.from.id;
    const msg = ctx.message.text.trim();

    const { data: admin } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", adminId)
        .single();

    if (!admin || admin.delete_step !== "waiting_id") return;

    await supabase
        .from("users")
        .delete()
        .eq("telegram_id", msg);

    await supabase
        .from("users")
        .update({ delete_step: null })
        .eq("telegram_id", adminId);

    return ctx.reply(`🗑 Usuario *${msg}* eliminado.`, {
        parse_mode: "Markdown"
    });
});// =====================================================
//            SISTEMA DE REGISTRO DE DEPÓSITOS
// =====================================================

// Cuando el usuario envía un hash manualmente
bot.action("enter_tx", async (ctx) => {
    const userId = ctx.from.id;

    await supabase
        .from("users")
        .update({ deposit_step: "waiting_tx" })
        .eq("telegram_id", userId);

    return ctx.reply(
        "🔍 *ENVÍA EL HASH DE LA TRANSACCIÓN*\n\nEjemplo:\n`0x123abc45...`",
        { parse_mode: "Markdown" }
    );
});

// Capturar hash y verificar depósito
bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const msg = ctx.message.text.trim();

    // Buscar usuario
    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", userId)
        .single();

    if (!user || user.deposit_step !== "waiting_tx") return;

    // Resetear estado
    await supabase
        .from("users")
        .update({ deposit_step: null })
        .eq("telegram_id", userId);

    // Verificar transacción
    const result = await verifyTx(msg, 1); // mínimo 1 USDT

    if (!result.ok) {
        return ctx.reply(`❌ Error: ${result.error}`);
    }

    // Registrar depósito
    await supabase.from("deposits").insert({
        user_id: userId,
        tx_hash: msg,
        amount: result.amount,
        wallet: result.wallet,
        status: "confirmed"
    });

    // Sumar balance
    await supabase
        .from("users")
        .update({
            balance: user.balance + result.amount
        })
        .eq("telegram_id", userId);

    return ctx.reply(
        `✔ *Depósito confirmado*\n\n` +
        `💵 *Monto:* ${result.amount} USDT\n` +
        `📥 Agregado a tu balance`,
        { parse_mode: "Markdown" }
    );
});// =====================================================
//                PANEL DE DEPÓSITOS (ADMIN)
// =====================================================

const ADMIN_ID = 2010460041; // <-- PON TU ID AQUÍ

// Botón para abrir panel de depósitos
bot.action("admin_deposits", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID)
        return ctx.reply("❌ No tienes permisos para ver esto.");

    const { data: deposits, error } = await supabase
        .from("deposits")
        .select("*")
        .order("id", { ascending: false })
        .limit(20);

    if (error) {
        return ctx.reply("❌ Error cargando depósitos.");
    }

    if (!deposits || deposits.length === 0) {
        return ctx.reply("📭 No hay depósitos registrados.");
    }

    let mensaje = "📥 *ÚLTIMOS DEPÓSITOS*\n\n";

    deposits.forEach((d) => {
        mensaje +=
            `👤 Usuario: *${d.user_id}*\n` +
            `💵 Monto: *${d.amount} USDT*\n` +
            `🪪 Wallet: ${d.wallet}\n` +
            `🔗 Hash: \`${d.tx_hash}\`\n` +
            `📅 Fecha: ${d.created_at || "N/A"}\n` +
            `📌 Estado: *${d.status}*\n\n`;
    });

    return ctx.reply(mensaje, { parse_mode: "Markdown" });
});

// =====================================================
//   AGREGAR BOTÓN EN EL PANEL ADMIN EXISTENTE
// =====================================================

// Cuando admin abre panel
bot.action("admin_panel", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID)
        return ctx.reply("❌ Acceso denegado.");

    return ctx.reply(
        `🛠 *PANEL ADMINISTRATIVO*\nSelecciona una opción:`,
        {
            parse_mode: "Markdown",
            ...Markup.inlineKeyboard([
                [Markup.button.callback("📥 Depósitos", "admin_deposits")],
                [Markup.button.callback("⬅ Volver al menú", "menu")]
            ])
        }
    );
});// =====================================================
//                PANEL DE RETIROS (ADMIN)
// =====================================================

// Ver retiros pendientes
bot.action("admin_withdraws", async (ctx) => {
    if (ctx.from.id !== ADMIN_ID)
        return ctx.reply("❌ No tienes permiso para ver esto.");

    const { data: withdrawals, error } = await supabase
        .from("withdrawals")
        .select("*")
        .order("id", { ascending: false })
        .limit(20);

    if (error) return ctx.reply("❌ Error cargando retiros.");
    if (!withdrawals || withdrawals.length === 0)
        return ctx.reply("📭 No hay retiros registrados.");

    let mensaje = "💸 *ÚLTIMOS RETIROS*\n\n";

    withdrawals.forEach((w) => {
        mensaje +=
            `🧑 Usuario: *${w.user_id}*\n` +
            `💵 Cantidad: *${w.amount} USDT*\n` +
            `🪪 Wallet: ${w.wallet}\n` +
            `📌 Estado: *${w.status}*\n` +
            `🕒 Fecha: ${w.created_at || "N/A"}\n\n` +
            `➡️ /aprobar_${w.id}  — Aprobar\n` +
            `⛔ /rechazar_${w.id} — Rechazar\n\n`;
    });

    return ctx.reply(mensaje, { parse_mode: "Markdown" });
});

// =====================================================
//           COMANDOS PARA APROBAR / RECHAZAR
// =====================================================

// Aprobar retiro
bot.hears(/\/aprobar_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const id = ctx.match[1];

    const { data: w } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("id", id)
        .single();

    if (!w) return ctx.reply("❌ Retiro no encontrado.");
    if (w.status !== "pending")
        return ctx.reply("⚠️ Este retiro ya fue procesado.");

    // Descontar balance del usuario
    await supabase
        .from("users")
        .update({
            balance: w.user_balance_after || 0
        })
        .eq("telegram_id", w.user_id);

    // Marcar como aprobado
    await supabase
        .from("withdrawals")
        .update({ status: "approved" })
        .eq("id", id);

    ctx.reply(`✔ *Retiro aprobado*\nID: ${id}`, { parse_mode: "Markdown" });

    // Avisar al usuario
    bot.telegram.sendMessage(
        w.user_id,
        `💸 *Tu retiro ha sido aprobado.*\n\nCantidad: ${w.amount} USDT`,
        { parse_mode: "Markdown" }
    );
});

// Rechazar retiro
bot.hears(/\/rechazar_(\d+)/, async (ctx) => {
    if (ctx.from.id !== ADMIN_ID) return;

    const id = ctx.match[1];

    const { data: w } = await supabase
        .from("withdrawals")
        .select("*")
        .eq("id", id)
        .single();

    if (!w) return ctx.reply("❌ Retiro no encontrado.");
    if (w.status !== "pending")
        return ctx.reply("⚠️ Este retiro ya fue procesado.");

    // Devolver fondos al usuario
    const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("telegram_id", w.user_id)
        .single();

    await supabase
        .from("users")
        .update({
            balance: Number(user.balance) + Number(w.amount)
        })
        .eq("telegram_id", w.user_id);

    // Marcar como rechazado
    await supabase
        .from("withdrawals")
        .update({ status: "rejected" })
        .eq("id", id);

    ctx.reply(`⛔ *Retiro rechazado*\nID: ${id}`, { parse_mode: "Markdown" });

    // Avisar al usuario
    bot.telegram.sendMessage(
        w.user_id,
        `❌ *Tu retiro ha sido rechazado.*\n\nSi tienes dudas, contacta soporte.`,
        { parse_mode: "Markdown" }
    );
});[ Markup.button.callback("💸 Retiros", "admin_withdraws") ],
