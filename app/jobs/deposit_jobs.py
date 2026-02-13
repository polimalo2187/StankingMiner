from app.db.mongo import db
from app.services.chain_watcher import find_matching_deposit

async def deposit_check_tick(context):
    """
    Cada 45s:
    - revisa depósitos PENDING
    - si aparecen en cadena (stub por ahora), los marca CONFIRMED y notifica usuario
    """
    pendings = db.deposits.find({"status": "PENDING"})
    for dep in pendings:
        ok, txhash = find_matching_deposit(dep["telegram_id"], dep["amount"])
        if ok:
            db.deposits.update_one(
                {"_id": dep["_id"]},
                {"$set": {"status": "CONFIRMED", "tx_hash": txhash}}
            )

            try:
                await context.bot.send_message(
                    chat_id=dep["telegram_id"],
                    text=f"✅ Depósito confirmado ({dep['amount']} USDT). Vuelve a tocar tu plan para activarlo."
                )
            except Exception:
                pass

def schedule_deposit_jobs(job_queue):
    job_queue.run_repeating(deposit_check_tick, interval=45, first=15)
