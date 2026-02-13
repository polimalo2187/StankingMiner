from telegram import Update
from telegram.ext import ContextTypes

from app.db.mongo import db
from app.bot.keyboards import main_menu_kb, stacking_plans_kb

async def menu_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    telegram_id = q.from_user.id

    u = db.users.find_one({"telegram_id": telegram_id})
    if not u or not u.get("verified"):
        await q.edit_message_text("Primero debes verificarte con /start.")
        return

    action = q.data.split(":")[1]

    if action == "BACK":
        await q.edit_message_text("Menú principal:", reply_markup=main_menu_kb())
        return

    if action == "STACKING":
        await q.edit_message_text("Selecciona un plan de Stacking:", reply_markup=stacking_plans_kb())
        return

    # Los demás botones se implementan luego
    await q.edit_message_text("Este botón se configurará luego.", reply_markup=main_menu_kb())
