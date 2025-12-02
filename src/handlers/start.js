import { supabase } from "../../supabase.js";
import { mainMenu } from "./menu.js";

export default function startHandler(bot) {

  // Comando /start
  bot.start(async (ctx) => {
    const userId = ctx.from.id;
    const refId = ctx.message.text.split(" ")[1] || null;

    // Generar código de verificación
    const code = Math.floor(100000 + Math.random() * 900000);

    // Guardar/actualizar usuario
    await supabase.from("users").upsert({
      telegram_id: userId,
      verification_code: code,
      verification_step: "waiting_code",
      referred_by: refId || null
    });

    await ctx.reply(
      `🔐 *Verificación*\n\nTu código es:\n\n*${code}*\n\nEnvíalo aquí mismo.`,
      { parse_mode: "Markdown" }
    );
  });

  // Mensajes de texto → verificar código
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;

    // Verificación pendiente
    if (user.verification_step === "waiting_code") {

      if (text !== String(user.verification_code)) {
        return ctx.reply("❌ *Código incorrecto*", { parse_mode: "Markdown" });
      }

      // Código correcto → actualizar usuario
      await supabase
        .from("users")
        .update({
          verification_step: "verified",
          referred_validated: true
        })
        .eq("telegram_id", userId);

      // Sumar referido al que invitó
      if (user.referred_by) {
        await supabase.rpc("add_referral", {
          referrer_id: Number(user.referred_by)
        });
      }

      return ctx.reply(
        `✅ *Verificación exitosa*\n\nBienvenido al sistema.`,
        { parse_mode: "Markdown", ...mainMenu() }
      );
    }

  });
}
