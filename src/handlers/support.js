import { Markup } from "telegraf";

export default function supportHandler(bot) {

  bot.action("support_menu", async (ctx) => {

    const msg =
      `🛠 *Centro de Soporte*\n\n` +
      `📢 Canal oficial:\n@STMiner\n\n` +
      `👤 Soporte directo:\n@StankingMiner\n\n` +
      `Si tienes dudas o problemas, puedes escribir directamente al soporte.`;

    await ctx.editMessageText(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔙 Regresar", "back_menu")]
      ])
    });

  });

}
