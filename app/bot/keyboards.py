from telegram import InlineKeyboardButton, InlineKeyboardMarkup
from app.config.settings import settings

def main_menu_kb():
    rows = [
        [InlineKeyboardButton("Stacking", callback_data="MENU:STACKING")],
        [InlineKeyboardButton("Minería", callback_data="MENU:MINING")],
        [InlineKeyboardButton("Ganancias", callback_data="MENU:EARN")],
        [InlineKeyboardButton("Retiro", callback_data="MENU:WITHDRAW")],
        [InlineKeyboardButton("Referidos", callback_data="MENU:REF")],
        [InlineKeyboardButton("Soporte", callback_data="MENU:SUPPORT")],
    ]
    return InlineKeyboardMarkup(rows)

def stacking_plans_kb():
    rows = []
    for amt in settings.STACKING_PLANS:
        rows.append([InlineKeyboardButton(f"{amt}", callback_data=f"STACKING:PLAN:{amt}")])
    rows.append([InlineKeyboardButton("⬅️ Menú", callback_data="MENU:BACK")])
    return InlineKeyboardMarkup(rows)

def confirm_deposit_kb(amount: int):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("Confirmar depósito", callback_data=f"STACKING:CONFIRM_DEPOSIT:{amount}")],
        [InlineKeyboardButton("⬅️ Stacking", callback_data="MENU:STACKING")],
    ])
