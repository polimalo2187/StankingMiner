import { Markup } from "telegraf";

export default function backHandler(bot) {

  bot.action("back_menu", async (ctx) => {

    const msg =
      `🏠 *Menú Principal*\n\n` +
      `Selecciona una opción:`;

    await ctx.editMessageText(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("📦 Staking", "staking_menu"),
          Markup.button.callback("⛏ Minería", "mining_menu"),
          Markup.button.callback("👥 Referidos", "referrals_menu")
        ],
        [
          Markup.button.callback("💰 Ganancias", "gains_menu"),
          Markup.button.callback("💸 Retiro", "withdraw_menu"),
          Markup.button.callback("🛠 Soporte", "support_menu")
        ]
      ])
    });

  });

}
