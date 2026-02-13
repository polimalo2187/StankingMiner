from datetime import datetime, timedelta, timezone
from app.db.mongo import db
from app.config.settings import settings

def _now():
    return datetime.now(timezone.utc)

async def stacking_payout_tick(context):
    """
    Cada minuto:
    - paga recompensas vencidas (next_payout_at <= now)
    - incrementa days_paid
    - finaliza plan cuando days_paid >= STACKING_DAYS
    """
    now = _now()

    positions = db.stacking_positions.find(
        {"status": "ACTIVE", "next_payout_at": {"$lte": now}}
    )

    for pos in positions:
        # Acreditar ganancia a saldo interno
        db.users.update_one(
            {"telegram_id": pos["telegram_id"]},
            {"$inc": {"balances.internal_usdt": float(pos["daily_reward"])}}
        )

        # Siguiente pago en 24h
        new_next = now + timedelta(hours=24)

        db.stacking_positions.update_one(
            {"_id": pos["_id"]},
            {"$set": {"next_payout_at": new_next},
             "$inc": {"days_paid": 1}}
        )

        # Revisar si ya llegó al final
        updated = db.stacking_positions.find_one({"_id": pos["_id"]})
        if updated and int(updated.get("days_paid", 0)) >= settings.STACKING_DAYS:
            db.stacking_positions.update_one(
                {"_id": pos["_id"]},
                {"$set": {"status": "FINISHED"}}
            )

def schedule_staking_jobs(job_queue):
    job_queue.run_repeating(stacking_payout_tick, interval=60, first=10)
