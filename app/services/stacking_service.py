from datetime import datetime, timedelta, timezone
from app.db.mongo import db
from app.config.settings import settings

def _now():
    return datetime.now(timezone.utc)

def user_wallet(telegram_id: int):
    u = db.users.find_one({"telegram_id": telegram_id}) or {}
    wallet = u.get("wallet") or {}
    return wallet.get("address"), bool(wallet.get("locked"))

def set_user_wallet_once(telegram_id: int, address: str):
    # Solo permite setear si no está bloqueada
    db.users.update_one(
        {"telegram_id": telegram_id, "wallet.locked": {"$ne": True}},
        {"$set": {"wallet.address": address, "wallet.locked": True}}
    )

def ensure_deposit_intent(telegram_id: int, amount: int):
    doc = {
        "telegram_id": telegram_id,
        "amount": float(amount),
        "status": "PENDING",       # PENDING -> CONFIRMED
        "created_at": _now(),
        "confirmed_at": None,
        "tx_hash": None,
        "used_for_activation": False,
    }
    db.deposits.insert_one(doc)
    return doc

def activate_plan_if_confirmed(telegram_id: int, amount: int):
    dep = db.deposits.find_one(
        {
            "telegram_id": telegram_id,
            "amount": float(amount),
            "status": "CONFIRMED",
            "used_for_activation": False
        },
        sort=[("confirmed_at", -1)]
    )
    if not dep:
        return None

    start = _now()
    ends = start + timedelta(days=settings.STACKING_DAYS)

    pos = {
        "telegram_id": telegram_id,
        "amount": float(amount),
        "daily_reward": float(amount) * settings.STACKING_DAILY_RATE,
        "status": "ACTIVE",
        "started_at": start,
        "ends_at": ends,
        "next_payout_at": start + timedelta(hours=24),
        "days_paid": 0
    }
    db.stacking_positions.insert_one(pos)

    db.deposits.update_one({"_id": dep["_id"]}, {"$set": {"used_for_activation": True}})
    return pos

def get_position_by_amount(telegram_id: int, amount: int):
    return db.stacking_positions.find_one(
        {"telegram_id": telegram_id, "amount": float(amount), "status": "ACTIVE"},
        sort=[("started_at", -1)]
    )

def format_remaining(dt):
    now = _now()
    if not dt or dt <= now:
        return "0s"
    secs = int((dt - now).total_seconds())
    h = secs // 3600
    m = (secs % 3600) // 60
    s = secs % 60
    return f"{h}h {m}m {s}s"

def format_days_left(ends_at):
    now = _now()
    if not ends_at or ends_at <= now:
        return 0
    # días restantes redondeado hacia arriba
    secs = int((ends_at - now).total_seconds())
    days = secs // 86400
    if secs % 86400 != 0:
        days += 1
    return days
