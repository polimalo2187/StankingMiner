from pydantic import BaseModel
from dotenv import load_dotenv
import os

load_dotenv()

class Settings(BaseModel):
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")
    MONGO_URI: str = os.getenv("MONGO_URI", "")
    DB_NAME: str = os.getenv("DB_NAME", "nexora_capital")

    DEPOSIT_WALLET_BSC: str = os.getenv("DEPOSIT_WALLET_BSC", "")

    VERIFY_LOCK_MINUTES: int = int(os.getenv("VERIFY_LOCK_MINUTES", "10"))
    VERIFY_MAX_ATTEMPTS: int = int(os.getenv("VERIFY_MAX_ATTEMPTS", "3"))

    STACKING_DAILY_RATE: float = float(os.getenv("STACKING_DAILY_RATE", "0.10"))
    STACKING_DAYS: int = int(os.getenv("STACKING_DAYS", "20"))
    STACKING_PLANS: list[int] = [int(x.strip()) for x in os.getenv("STACKING_PLANS", "1,3,5,7,10,20,30,50").split(",")]

    BSC_USDT_CONTRACT: str = os.getenv("BSC_USDT_CONTRACT", "")
    BSC_RPC_URL: str = os.getenv("BSC_RPC_URL", "")

settings = Settings()
