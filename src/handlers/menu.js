import { Markup } from "telegraf";

// Exportamos el teclado principal para usarlo en otras partes
export function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("💎 Staking", "staking_menu"),
      Markup.button.callback("⛏ Minería", "mining_menu")
    ],
    [
      Markup.button.callback("👥 Referidos", "ref_menu"),
      Markup.button.callback("💰 Ganancias", "earn_menu")
    ],
    [
      Markup.button.callback("🏦 Retiro", "withdraw_menu"),
      Markup.button.callback("🛠 Soporte", "support_menu")
    ]
  ]);
}

// Handler para los botones del menú
export default function menuHandler(bot) {

  bot.action("back_menu", async (ctx) => {
    await ctx.editMessageText("📋 *Menú Principal*", {
      parse_mode: "Markdown",
      ...mainMenu(),
    });
  });

  bot.action("staking_menu", async (ctx) => {
    import("./staking.js").then((m) => m.default(ctx));
  });

  bot.action("mining_menu", async (ctx) => {
    import("./mining.js").then((m) => m.default(ctx));
  });

  bot.action("ref_menu", async (ctx) => {
    import("./referrals.js").then((m) => m.default(ctx));
  });

  bot.action("earn_menu", async (ctx) => {
    import("./earnings.js").then((m) => m.default(ctx));
  });

  bot.action("withdraw_menu", async (ctx) => {
    import("./withdraw.js").then((m) => m.default(ctx));
  });

  bot.action("support_menu", async (ctx) => {
    import("./support.js").then((m) => m.default(ctx));
  });

}
