import 'dotenv/config'
import { Telegraf, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

console.log('STAKING MINER - INICIANDO 100% AUTOMÁTICO...')

// --- Bot ---
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// --- DB ---
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE)) } catch (e) { console.log('DB corrupta, creando nueva') }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// --- Wallet ---
const privateKey = process.env.PRIVATE_KEY
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://bsc-dataseed.binance.org/")
const wallet = new ethers.Wallet(privateKey, provider)
const BOT_WALLET = wallet.address

const USDT = new ethers.Contract(
  "0x55d398326f99059fF775485246999027B3197955",
  ["function transfer(address,uint256) external returns (bool)"],
  wallet
)

const PLANES = {1:0.1, 3:0.3, 5:0.5, 10:1.0, 20:2.0, 30:3.0, 50:5.0}

// --- Función menú principal con botones en medio ---
const mainMenu = async (ctx) => {
  await ctx.reply(
    `*STAKING MINER*\nPagos 100% reales · Mínimo retiro 1 USDT`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Staking', callback_data: 'menu_staking' }],
          [{ text: 'Minería', callback_data: 'menu_mineria' }],
          [{ text: 'Ganancias', callback_data: 'menu_ganancias' }],
          [{ text: 'Retiro', callback_data: 'menu_retiro' }],
          [{ text: 'Referidos', callback_data: 'menu_referidos' }],
          [{ text: 'Soporte', callback_data: 'menu_soporte' }]
        ]
      }
    }
  )
}

// --- START ---
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.message?.text.split(' ')[1] || null

  if (!users[id]) {
    const code = Math.floor(1000 + Math.random() * 9000)
    users[id] = { balance:0, planes:[], referidos:0, refValidos:0, lastMine:0, verified:false, code, inviter: ref }
    saveDB()
    await ctx.reply(`VERIFICACIÓN\n\nEscribe este código:\n\`${code}\``, { parse_mode: "Markdown" })

    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
      bot.telegram.sendMessage(ref, "Nuevo referido +0.02 USDT").catch(()=>{})
    }
  } else if (!users[id].verified) {
    await ctx.reply(`Tu código:\n\`${users[id].code}\``, { parse_mode: "Markdown" })
  } else {
    mainMenu(ctx)
  }
})

// --- Verificación y retiro ---
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()
  if (!users[id]) return

  if (!users[id].verified && text === users[id].code.toString()) {
    users[id].verified = true
    delete users[id].code
    saveDB()
    return mainMenu(ctx)
  }

  if (!users[id].verified) return

  if (ctx.session?.waitingWallet) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) return ctx.reply("Wallet inválida")
    const amount = users[id].balance
    if (amount < 1) return ctx.reply("Mínimo 1 USDT")
    await ctx.reply("Procesando retiro…")
    try {
      const tx = await USDT.transfer(text, ethers.parseUnits(amount.toFixed(6), 18))
      await tx.wait()
      users[id].balance = 0
      saveDB()
      await ctx.reply(`Retiro exitoso (${amount.toFixed(3)} USDT)\nhttps://bscscan.com/tx/${tx.hash}`)
    } catch (e) {
      await ctx.reply("Error en retiro: " + (e.reason || e.message).slice(0,100))
    }
    ctx.session.waitingWallet = false
    return mainMenu(ctx)
  }
})

// --- Callbacks menú principal ---
bot.action('menu_staking', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply(
    "Elige plan:",
    {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "1 USDT → 0.1/día", callback_data: "plan1" },
            { text: "3 USDT → 0.3/día", callback_data: "plan3" }
          ],
          [
            { text: "5 USDT → 0.5/día", callback_data: "plan5" },
            { text: "10 USDT → 1/día", callback_data: "plan10" }
          ],
          [
            { text: "20 USDT → 2/día", callback_data: "plan20" },
            { text: "30 USDT → 3/día", callback_data: "plan30" }
          ],
          [
            { text: "50 USDT → 5/día", callback_data: "plan50" }
          ]
        ]
      }
    }
  )
})

bot.action('menu_mineria', async (ctx) => {
  const u = users[ctx.from.id]
  await ctx.answerCbQuery()
  if (!u || u.refValidos < 5) return ctx.reply(`Necesitas 5 referidos activos\nTienes: ${u?.refValidos || 0}/5`)
  const puede = Date.now() - (u.lastMine || 0) >= 86400000
  ctx.reply(
    puede ? "*¡RECLAMA 0.03 USDT!*" : "Espera 24h",
    {
      parse_mode: "Markdown",
      reply_markup: puede ? { inline_keyboard: [[{ text: "RECLAMAR", callback_data: "mine" }]] } : undefined
    }
  )
})

bot.action('menu_ganancias', async (ctx) => {
  await ctx.answerCbQuery()
  const u = users[ctx.from.id]
  await ctx.reply(`Balance: ${(u?.balance || 0).toFixed(3)} USDT`)
})

bot.action('menu_retiro', async (ctx) => {
  await ctx.answerCbQuery()
  const u = users[ctx.from.id]
  if (!u || u.balance < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session.waitingWallet = true
})

bot.action('menu_referidos', async (ctx) => {
  await ctx.answerCbQuery()
  const me = await bot.telegram.getMe()
  const u = users[ctx.from.id]
  const link = `https://t.me/${me.username}?start=${ctx.from.id}`
  await ctx.reply(`Referidos totales: ${u?.referidos || 0}\nActivos: ${u?.refValidos || 0}\n\nLink de invitación:\n${link}`)
})

bot.action('menu_soporte', async (ctx) => {
  await ctx.answerCbQuery()
  await ctx.reply("Soporte → @Carlo2187")
})

// --- Planes staking ---
bot.action(/plan(\d+)/, async (ctx) => {
  const monto = Number(ctx.match[1])
  await ctx.answerCbQuery()
  await ctx.reply(`Envía exactamente ${monto}.000000 USDT a:\n${BOT_WALLET}\nPago detectado automáticamente.`)
})

// --- Mining inline ---
bot.action('mine', async (ctx) => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].lastMine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].lastMine = Date.now()
    saveDB()
    await ctx.answerCbQuery("+0.03 USDT")
  }
  mainMenu(ctx)
})

// --- Ganancias diarias ---
setInterval(() => {
  for (const id in users) {
    const u = users[id]
    if (u.planes?.length > 0) {
      const daily = u.planes.reduce((a,p) => a + p.daily, 0)
      u.balance += daily
    }
  }
  saveDB()
}, 3600000)

// --- Detector pagos ---
let lastBlock = 0
setInterval(async () => {
  try {
    const block = await provider.getBlockNumber()
    if (block <= lastBlock) return
    lastBlock = block
    const blk = await provider.getBlockWithTransactions(block)
    for (const tx of blk.transactions) {
      if (tx.to?.toLowerCase() === BOT_WALLET.toLowerCase() && tx.value.eq(0) && tx.data.startsWith("0xa9059cbb")) {
        const receiver = "0x" + tx.data.slice(34,74)
        const amountRaw = "0x" + tx.data.slice(74)
        const amount = Number(ethers.formatUnits(amountRaw,18))
        if (PLANES[amount] && users[receiver]) {
          const daily = PLANES[amount]
          users[receiver].planes.push({ amount, daily, time: Date.now() })
          if (users[receiver].inviter) users[users[receiver].inviter].refValidos += 1
          saveDB()
          bot.telegram.sendMessage(receiver, `Pago recibido (${amount} USDT) — Plan activado: +${daily} USDT/día`).catch(()=>{})
        }
      }
    }
  } catch(e){}
}, 10000)

// --- Lanzamiento ---
bot.launch({ dropPendingUpdates: true }).then(() => {
  bot.telegram.getMe().then(i => {
    console.log(`BOT ENCENDIDO: @${i.username}`)
    console.log(`Wallet receptora: ${BOT_WALLET}`)
  })
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
