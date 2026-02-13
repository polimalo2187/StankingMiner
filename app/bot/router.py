from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters

from app.bot.handlers.start import start_cmd, text_dispatch
from app.bot.handlers.menu import menu_callback
from app.bot.handlers.stacking import stacking_callback

def build_router(app: Application):
    app.add_handler(CommandHandler("start", start_cmd))

    # Un solo handler para texto (código o wallet dependiendo del flow)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, text_dispatch))

    app.add_handler(CallbackQueryHandler(menu_callback, pattern=r"^MENU:"))
    app.add_handler(CallbackQueryHandler(stacking_callback, pattern=r"^STACKING:"))
