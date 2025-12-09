import { Markup } from "telegraf";

export default function supportHandler(bot) {
  
  // Cuando el usuario toca el botón "support_menu"
  bot.action("support_menu", async (ctx) => {
    await ctx.reply(
      `🛠 *SOPORTE OFICIAL*\n\n` +
        `Si tienes dudas, problemas con tu cuenta, depósitos, retiros o cualquier consulta,\n` +
        `puedes contactar directamente al *administrador del sistema*.\n\n` +
        `📞 *WhatsApp:* +53 59494299\n` +
        `📩 *Telegram Admin:* @StankingMiner\n\n` +
        `Estamos disponibles para ayudarte.`,
      {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("⬅ Regresar", "menu")]
        ])
      }
    );
  });

}
