import asyncio
from telegram.ext import Application

from app.config.settings import settings
from app.db.mongo import init_mongo
from app.bot.router import build_router
from app.jobs.staking_jobs import schedule_staking_jobs
from app.jobs.deposit_jobs import schedule_deposit_jobs

async def main():
    await init_mongo()

    app = Application.builder().token(settings.TELEGRAM_BOT_TOKEN).build()
    build_router(app)

    # Jobs
    schedule_staking_jobs(app.job_queue)
    schedule_deposit_jobs(app.job_queue)

    await app.initialize()
    await app.start()
    await app.updater.start_polling()

    # Keep alive
    await asyncio.Event().wait()

if __name__ == "__main__":
    asyncio.run(main())
