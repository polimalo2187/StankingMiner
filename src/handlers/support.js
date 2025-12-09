import { Markup } from "telegraf";
import menu from "./menu.js";

export default function supportHandler(bot) {

  bot.action("support_menu", async (ctx) => {
    await ctx.answerCbQuery();

    const supportChat = process.env.SUPPORT_CHAT || "@StankingMiner";
    const supportChannel = process.env.SUPPORT_CHANNEL || "@STMiner";

    return ctx.reply(
      `🛠 *SOPORTE OFICIAL*\n\n` +
      `📞 *Chat de soporte:*\n${supportChat}\n\n` +
      `📢 *Canal oficial del bot:*\n${supportChannel}\n\n` +
      `Si necesitas ayuda, puedes escribir directamente al soporte.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔙 Regresar", "back_menu")]
        ])
      }
    );
  });

}
