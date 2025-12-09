import "dotenv/config";
import { Telegraf } from "telegraf";
import { supabase } from "../supabase.js";
import menu from "./handlers/menu.js";
import staking from "./handlers/staking.js";
import mining from "./handlers/mining.js";
import referrals from "./handlers/referrals.js";
import withdraw from "./handlers/withdraw.js";

const bot = new Telegraf(process.env.BOT_TOKEN);

// ------------------------------------------------------
// 1️⃣  GENERAR CÓDIGO DE VERIFICACIÓN
// ------------------------------------------------------
function generarCodigo() {
  return Math.floor(10000 + Math.random() * 90000).toString();
}

// ------------------------------------------------------
// 2️⃣  COMANDO /start
// ------------------------------------------------------
bot.start(async (ctx) => {
  const telegram_id = ctx.from.id;
  const referral = ctx.startPayload ? parseInt(ctx.startPayload) : null;

  // Buscar si existe el usuario
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .maybeSingle();

  // Si el usuario NO existe, se crea
  if (!user) {
    const code = generarCodigo();

    await supabase.from("users").insert({
      telegram_id,
      verification_code: code,
      verified: false,
      referrals: 0,
      valid_referrals: 0,
      balance: 0,
      referral_earnings: 0,
      staking_earnings: 0,
      mining_earnings: 0,
      staking_active: false,
      staking_amount: 0,
      stanking_day: 0,
      mining_active: false,
      stanking_step: null,
    });

    if (referral && referral !== telegram_id) {
      await supabase.from("referrals").insert({
        referrer_id: referral,
        referred_id: telegram_id,
        validated: false,
      });
    }

    await ctx.reply(
      "👋 *Bienvenido*\n\nTu código de verificación es:\n\n🔐 *" +
        code +
        "*\n\nIngresa el código para continuar.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Si existe pero no está verificado → reenviar código
  if (!user.verified) {
    const newCode = generarCodigo();

    await supabase
      .from("users")
      .update({ verification_code: newCode })
      .eq("telegram_id", telegram_id);

    await ctx.reply(
      "🔐 Tu nuevo código de verificación es:\n\n*" +
        newCode +
        "*\n\nEnvíalo aquí para continuar.",
      { parse_mode: "Markdown" }
    );
    return;
  }

  // Si ya está verificado → mostrar menú
  return menu(ctx);
});

// ------------------------------------------------------
// 3️⃣  CAPTURA DE MENSAJES (VERIFICACIÓN DE CÓDIGO)
// ------------------------------------------------------
bot.on("text", async (ctx) => {
  const telegram_id = ctx.from.id;
  const mensaje = ctx.message.text.trim();

  // Buscar usuario
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("telegram_id", telegram_id)
    .maybeSingle();

  if (!user) return ctx.reply("⚠️ Usa /start primero.");

  // SI YA ESTÁ VERIFICADO → DIRECTO AL MENÚ
  if (user.verified) {
    return menu(ctx);
  }

  // SI NO ESTÁ VERIFICADO:
  if (mensaje !== user.verification_code) {
    return ctx.reply("❌ Código incorrecto. Intente nuevamente.");
  }

  // Código correcto → activar verificación
  await supabase
    .from("users")
    .update({ verified: true })
    .eq("telegram_id", telegram_id);

  await ctx.reply("✅ *Verificación exitosa!*", { parse_mode: "Markdown" });

  return menu(ctx);
});

// ------------------------------------------------------
// 4️⃣  MANEJO DE BOTONES DEL MENÚ
// ------------------------------------------------------
bot.action("staking", (ctx) => staking(ctx));
bot.action("mining", (ctx) => mining(ctx));
bot.action("referrals", (ctx) => referrals(ctx));
bot.action("withdraw", (ctx) => withdraw(ctx));

// ------------------------------------------------------
// 5️⃣  INICIAR BOT
// ------------------------------------------------------
bot
  .launch()
  .then(() => console.log("🤖 Bot iniciado correctamente"))
  .catch((err) => console.error("Error al iniciar bot:", err));
