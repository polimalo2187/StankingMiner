import { Markup } from "telegraf";

export default function menu(bot) {
  // Acción del botón "menu"
  bot.action("menu", async (ctx) => {
    await enviarMenu(ctx);
  });
}

export async function enviarMenu(ctx) {
  try {
    await ctx.answerCbQuery().catch(() => {});
    
    await ctx.reply(
      `🏠 *MENÚ PRINCIPAL*`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("📦 Staking", "staking_menu"),
            Markup.button.callback("⛏ Minería", "mining_menu")
          ],
          [
            Markup.button.callback("👥 Referidos", "referrals_menu")
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

  } catch (err) {
    console.error("Error mostrando menú:", err);
  }
}
