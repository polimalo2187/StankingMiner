from telegram import Update
from telegram.ext import ContextTypes

from app.bot.keyboards import main_menu_kb
from app.services.verification_service import (
    get_or_create_user,
    issue_new_code,
    can_attempt,
    verify_code_value,
    register_failed_attempt,
    mark_verified
)
from app.services.flow_service import get_flow
from app.bot.handlers.stacking import handle_wallet_text

async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    get_or_create_user(telegram_id)

    ok, locked_until = can_attempt(telegram_id)
    if not ok:
        await update.message.reply_text(
            "Has agotado los intentos. Debes esperar 10 minutos para recibir un nuevo código."
        )
        return

    code = issue_new_code(telegram_id)

    await update.message.reply_text(
        "Bienvenido a Nexora Capital.\n\n"
        f"Tu código de verificación es: {code}\n"
        "Envíalo aquí para activar el bot."
    )

async def text_dispatch(update: Update, context: ContextTypes.DEFAULT_TYPE):
    telegram_id = update.effective_user.id
    text = (update.message.text or "").strip()

    flow = get_flow(telegram_id)

    # Si está esperando wallet, este texto es una wallet
    if flow and flow.get("awaiting") == "WALLET":
        amount = int(flow.get("amount") or 0)
        await handle_wallet_text(update, context, amount=amount)
        return

    # Si no, se trata como verificación (código)
    ok, locked_until = can_attempt(telegram_id)
    if not ok:
        await update.message.reply_text(
            "Bloqueado por intentos. Espera 10 minutos y luego usa /start para recibir un nuevo código."
        )
        return

    if verify_code_value(telegram_id, text):
        mark_verified(telegram_id)
        await update.message.reply_text(
            "✅ Verificación correcta. Menú activado:",
            reply_markup=main_menu_kb()
        )
        return

    attempts, locked = register_failed_attempt(telegram_id)
    if locked:
        await update.message.reply_text(
            "❌ Código incorrecto. Has agotado los 3 intentos. "
            "Debes esperar 10 minutos para recibir un nuevo código."
        )
    else:
        await update.message.reply_text(f"❌ Código incorrecto. Intento {attempts} de 3.")
