import random
import string
from datetime import datetime, timedelta, timezone

from app.db.mongo import db
from app.config.settings import settings

def _now():
    return datetime.now(timezone.utc)

def generate_code(n=6):
    return "".join(random.choices(string.digits, k=n))

def get_or_create_user(telegram_id: int):
    u = db.users.find_one({"telegram_id": telegram_id})
    if u:
        return u

    doc = {
        "telegram_id": telegram_id,
        "verified": False,
        "verify": {
            "code": None,
            "attempts": 0,
            "locked_until": None,
        },
        "flow": None,
        "wallet": {"address": None, "locked": False},
        "balances": {"internal_usdt": 0.0},
        "created_at": _now(),
    }
    db.users.insert_one(doc)
    return db.users.find_one({"telegram_id": telegram_id})

def issue_new_code(telegram_id: int):
    code = generate_code()
    db.users.update_one(
        {"telegram_id": telegram_id},
        {"$set": {
            "verify.code": code,
            "verify.attempts": 0,
            "verify.locked_until": None,
            "flow": {"awaiting": "VERIFY_CODE", "amount": None}
        }}
    )
    return code

def can_attempt(telegram_id: int):
    u = db.users.find_one({"telegram_id": telegram_id})
    if not u:
        return True, None
    locked_until = (u.get("verify") or {}).get("locked_until")
    if locked_until and locked_until > _now():
        return False, locked_until
    return True, None

def verify_code_value(telegram_id: int, code: str) -> bool:
    u = db.users.find_one({"telegram_id": telegram_id}) or {}
    return ((u.get("verify") or {}).get("code") == code)

def register_failed_attempt(telegram_id: int):
    u = db.users.find_one({"telegram_id": telegram_id}) or {}
    attempts = int((u.get("verify") or {}).get("attempts", 0)) + 1

    if attempts >= settings.VERIFY_MAX_ATTEMPTS:
        locked_until = _now() + timedelta(minutes=settings.VERIFY_LOCK_MINUTES)
        db.users.update_one(
            {"telegram_id": telegram_id},
            {"$set": {"verify.attempts": attempts, "verify.locked_until": locked_until}}
        )
        return attempts, locked_until

    db.users.update_one({"telegram_id": telegram_id}, {"$set": {"verify.attempts": attempts}})
    return attempts, None

def mark_verified(telegram_id: int):
    db.users.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"verified": True, "flow": None}}
  )
