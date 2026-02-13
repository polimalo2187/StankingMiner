from app.db.mongo import db

def set_flow(telegram_id: int, awaiting: str | None, amount: int | None = None):
    if awaiting is None:
        db.users.update_one({"telegram_id": telegram_id}, {"$set": {"flow": None}})
        return
    db.users.update_one(
        {"telegram_id": telegram_id},
        {"$set": {"flow": {"awaiting": awaiting, "amount": amount}}}
    )

def get_flow(telegram_id: int):
    u = db.users.find_one({"telegram_id": telegram_id}) or {}
    return u.get("flow")
