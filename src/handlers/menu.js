import { Markup } from "telegraf";

export default function menu(botOrCtx) {
  
  // Si se pasó un contexto (ctx), enviamos el menú directamente
  if (botOrCtx.reply) {
    return enviarMenu(botOrCtx);
  }

  // Si se pasó el bot, registramos el handler
  botOrCtx.action("menu", async (ctx) => {
    await enviarMenu(ctx);
  });
}

async function enviarMenu(ctx) {
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
}
