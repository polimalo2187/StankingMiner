import menu from "./menu.js";

export default function backHandler(bot) {

  bot.action("back_menu", async (ctx) => {
    await ctx.answerCbQuery();
    return menu(ctx); // Regresa al menú principal
  });

}
