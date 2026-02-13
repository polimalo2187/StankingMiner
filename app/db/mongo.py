from pymongo import MongoClient, ASCENDING
from app.config.settings import settings

client = None
db = None

async def init_mongo():
    global client, db
    client = MongoClient(settings.MONGO_URI)
    db = client[settings.DB_NAME]

    # Índices (importantes)
    db.users.create_index([("telegram_id", ASCENDING)], unique=True)

    # Deposits
    db.deposits.create_index([("tx_hash", ASCENDING)], unique=True, sparse=True)
    db.deposits.create_index([("telegram_id", ASCENDING), ("status", ASCENDING), ("created_at", ASCENDING)])

    # Stacking positions
    db.stacking_positions.create_index([("telegram_id", ASCENDING), ("status", ASCENDING)])
    db.stacking_positions.create_index([("status", ASCENDING), ("next_payout_at", ASCENDING)])
