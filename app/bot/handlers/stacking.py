from telegram import Update
from telegram.ext import ContextTypes

from app.db.mongo import db
from app.config.settings import settings
from app.bot.keyboards import stacking_plans_kb, confirm_deposit_kb
from app.services.flow_service import set_flow
from app.services.stacking_service import (
    user_wallet,
    set_user_wallet_once,
    ensure_deposit_intent,
    activate_plan_if_confirmed,
    get_position_by_amount,
    format_remaining,
    format_days_left,
)

def _is_bsc_address(addr: str) -> bool:
    addr = addr.strip()
    return addr.startswith("0x") and len(addr) == 42

async def stacking_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    telegram_id = q.from_user.id

    u = db.users.find_one({"telegram_id": telegram_id})
    if not u or not u.get("verified"):
        await q.edit_message_text("Primero debes verificarte con /start.")
        return

    parts = q.data.split(":")
    action = parts[1]

    if action == "PLAN":
        amount = int(parts[2])

        # Si el plan ya está activo, mostrar tiempos
        pos = get_position_by_amount(telegram_id, amount)
        if pos:
            next_in = format_remaining(pos["next_payout_at"])
            days_left = format_days_left(pos["ends_at"])
            await q.edit_message_text(
                f"📌 Plan {amount} USDT\n"
                f"💰 Ganancia diaria: {pos['daily_reward']} USDT\n\n"
                f"⏳ Próxima recompensa en: {next_in}\n"
                f"📅 Vida restante del plan: {days_left} días",
                reply_markup=stacking_plans_kb()
            )
            return

        # Si no está activo, intentar activarlo si hay depósito confirmado listo
        activated = activate_plan_if_confirmed(telegram_id, amount)
        if activated:
            await q.edit_message_text(
                f"✅ Plan {amount} USDT ACTIVADO.\n"
                f"⏳ Próxima recompensa en 24h.\n"
                f"📅 Vida del plan: {settings.STACKING_DAYS} días",
                reply_markup=stacking_plans_kb()
            )
            return

        # No hay depósito confirmado: iniciar flujo de depósito
        addr, locked = user_wallet(telegram_id)
        if not locked:
            set_flow(telegram_id, "WALLET", amount)
            await q.edit_message_text(
                "📌 Para continuar, registra la wallet desde la cual operarás.\n\n"
                "⚠️ Esta wallet quedará registrada como tu wallet oficial.\n"
                "No podrás cambiarla.\n"
                "Todos los depósitos y retiros deberán realizarse con esta misma wallet.\n\n"
                "➡️ Envía ahora tu dirección (BSC)."
            )
            return

        await q.edit_message_text(
            f"📌 Plan seleccionado: {amount} USDT\n\n"
            f"Deposita exactamente {amount} USDT (BEP20) a la wallet:\n{settings.DEPOSIT_WALLET_BSC}\n\n"
            "Luego toca **Confirmar depósito**.",
            reply_markup=confirm_deposit_kb(amount)
        )
        return

    if action == "CONFIRM_DEPOSIT":
        amount = int(parts[2])
        ensure_deposit_intent(telegram_id, amount)
        await q.edit_message_text(
            "⏳ Depósito pendiente.\n"
            "El bot revisará la wallet. Cuando se confirme, te avisaré para que vuelvas a tocar el plan y activarlo.",
            reply_markup=stacking_plans_kb()
        )
        return

async def handle_wallet_text(update: Update, context: ContextTypes.DEFAULT_TYPE, amount: int):
    telegram_id = update.effective_user.id
    addr = (update.message.text or "").strip()

    u = db.users.find_one({"telegram_id": telegram_id})
    if not u or not u.get("verified"):
        await update.message.reply_text("Primero debes verificarte con /start.")
        return

    # Si ya está bloqueada, no permitir cambio
    existing = (u.get("wallet") or {}).get("address")
    locked = (u.get("wallet") or {}).get("locked", False)
    if locked and existing:
        set_flow(telegram_id, None)
        await update.message.reply_text(
            "⚠️ Ya tienes una wallet registrada y no se puede cambiar.\n"
            "Usa el menú de Stacking para continuar."
        )
        return

    if not _is_bsc_address(addr):
        await update.message.reply_text("❌ Dirección inválida. Envía una dirección BSC válida (0x...).")
        return

    # Guardar y bloquear definitivamente
    set_user_wallet_once(telegram_id, addr)
    set_flow(telegram_id, None)

    await update.message.reply_text(
        "✅ Wallet registrada y bloqueada.\n\n"
        "⚠️ No podrás cambiarla.\n"
        "Todos los depósitos y retiros deberán realizarse con esta misma wallet."
    )

    await update.message.reply_text(
        f"📌 Plan seleccionado: {amount} USDT\n\n"
        f"Deposita exactamente {amount} USDT (BEP20) a la wallet:\n{settings.DEPOSIT_WALLET_BSC}\n\n"
        "Luego toca **Confirmar depósito**.",
        reply_markup=confirm_deposit_kb(amount)
  )
