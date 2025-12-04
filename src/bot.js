import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
dotenv.config();

import start from './handlers/start.js';
import menu from './handlers/menu.js';
import staking from './handlers/staking.js';
import mining from './handlers/mining.js';
import deposits from './handlers/deposits.js';
import withdraw from './handlers/withdraw.js';
import referrals from './handlers/referrals.js';
import support from './handlers/support.js';
import verifyTx from './handlers/verifyTx.js';

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Handlers
start(bot);
menu(bot);
staking(bot);
mining(bot);
deposits(bot);
withdraw(bot);
referrals(bot);
support(bot);
verifyTx(bot);

bot.launch();
