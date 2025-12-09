import { Markup } from "telegraf";
import menu from "./menu.js";

export default function backHandler(bot) {

  // Acción del botón "Regresar"
  bot.action("back_menu", async (ctx) => {
    await ctx.answerCbQuery();
    await menu(ctx); // ← vuelve a cargar el menú principal
  });

  // Acción del botón "menu" (algunos handlers lo usan)
  bot.action("menu", async (ctx) => {
    await ctx.answerCbQuery();
    await menu(ctx);
  });

}
