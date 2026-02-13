from app.db.mongo import db
from app.config.settings import settings

def find_matching_deposit(telegram_id: int, amount: float):
    """
    Aquí se implementará la lectura real en BSC:
    - from: user.wallet.address (registrada/bloqueada)
    - to: settings.DEPOSIT_WALLET_BSC
    - token: settings.BSC_USDT_CONTRACT (Transfer event)
    - amount exacto (USDT tiene 6 decimales)
    - evitar tx repetidas

    Retorna: (True, tx_hash) si encuentra un depósito válido no usado.
    """
    u = db.users.find_one({"telegram_id": telegram_id}) or {}
    from_addr = ((u.get("wallet") or {}).get("address") or "").lower()
    if not from_addr:
        return (False, None)

    # TODO: Implementar con RPC / indexador
    return (False, None)
