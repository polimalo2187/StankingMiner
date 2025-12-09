import { supabase } from "../../supabase.js";
import { Markup } from "telegraf";
import menu from "./menu.js";

export default function stakingHandler(bot) {

  // Abrir menú de staking
  bot.action("staking_menu", async (ctx) => {
    await ctx.answerCbQuery();

    await ctx.reply(
      `📦 *STAKING*\n\n` +
      `Puedes activar el staking con un rendimiento del *10%*.\n\n` +
      `💰 *Ingresa el monto que deseas poner en staking.*`,
      { parse_mode: "Markdown" }
    );

    // Guardamos que el usuario está en modo "ingresar monto"
    const userId = ctx.from.id;

    await supabase
      .from("users")
      .update({ stanking_step: "enter_amount" })
      .eq("telegram_id", userId);
  });

  // Cuando el usuario escribe el monto
  bot.on("text", async (ctx) => {
    const userId = ctx.from.id;
    const text = ctx.message.text.trim();

    const { data: user } = await supabase
      .from("users")
      .select("*")
      .eq("telegram_id", userId)
      .single();

    if (!user) return;
    if (user.stanking_step !== "enter_amount") return;

    const amount = parseFloat(text);

    if (isNaN(amount) || amount <= 0) {
      return ctx.reply("❌ *Monto inválido*. Ingresa un número válido.", {
        parse_mode: "Markdown"
      });
    }

    // Guardar staking
    await supabase
      .from("users")
      .update({
        staking_amount: amount,
        staking_active: true,
        stanking_step: null
      })
      .eq("telegram_id", userId);

    await ctx.reply(
      `✅ *STAKING ACTIVADO*\n\n` +
      `💰 Monto: *${amount} USDT*\n` +
      `📈 Ganancia diaria: *${(amount * 0.10).toFixed(2)} USDT*\n\n`,
      { parse_mode: "Markdown" }
    );

    return menu(ctx);
  });

  // Volver atrás
  bot.action("back_staking", async (ctx) => {
    await ctx.answerCbQuery();
    return menu(ctx);
  });
}
