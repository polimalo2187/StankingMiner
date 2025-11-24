import 'dotenv/config'
import { Telegraf, Markup, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

console.log('INICIANDO STANKING MINER...')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// === BASE DE DATOS ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch (e) { console.error('Error DB:', e) }
}
function saveDB() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)) }

// === WEB3 + USDT ===
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://bsc-dataseed.binance.org/")
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
const USDT = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", ["function transfer(address to, uint amount) returns (bool)"], wallet)
const BOT_WALLET = process.env.WALLET_BOT || wallet.address

const PLANES = {1:0.1, 3:0.3, 5:0.5, 10:1.0, 20:2.0, 30:3.0, 50:5.0}

// === UTILIDADES ===
function formatUSDT(num) { return Number(num).toFixed(6).replace(/0+\( /, '').replace(/\. \)/, '') }

// === MENÚ ===
const mainKeyboard = Markup.keyboard([
  ['Staking', 'Minería'],
  ['Ganancias', 'Retiro'],
  ['Referidos', 'Soporte']
]).resize()

async function menu(ctx) {
  await ctx.reply("STANKING MINER\nPagos 100% reales · Mínimo retiro 1 USDT", mainKeyboard)
}

// === /start + VERIFICACIÓN ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.startPayload || null

  if (!users[id]) {
    const code = Math.floor(1000 + Math.random() * 9000)
    users[id] = { verified: false, verifyCode: code, balance: 0, planes: [], ref_validos: 0, last_mine: 0, referidos: 0, inviter: ref }
    saveDB()
    await ctx.reply(`VERIFICACIÓN REQUERIDA\n\nEscribe este código:\n\n\`${code}\``, { parse_mode: "Markdown" })
    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
    }
  } else if (!users[id].verified) {
    await ctx.reply(`Escribe tu código:\n\n\`${users[id].verifyCode}\``, { parse_mode: "Markdown" })
  } else {
    menu(ctx)
  }
})

// === VERIFICACIÓN + RETIRO ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()

  if (users[id] && !users[id].verified && text === users[id].verifyCode.toString()) {
    users[id].verified = true
    delete users[id].verifyCode
    saveDB()
    await ctx.reply("¡Verificado con éxito!")
    menu(ctx)
    return
  }
  if (!users[id]?.verified) return

  if (ctx.session?.step === "retiro") {
    if (!text.match(/^0x[a-fA-F0-9]{40}$/i)) return ctx.reply("Wallet inválida")
    const amount = users[id].balance
    if (amount < 1) return ctx.reply("Mínimo 1 USDT")
    await ctx.reply("Procesando retiro...")
    try {
      const tx = await USDT.transfer(text, ethers.parseUnits(amount.toString(), 18))
      await tx.wait()
      users[id].balance = 0
      saveDB()
      await ctx.reply(`Retiro exitoso!\n\( {amount.toFixed(3)} USDT\nhttps://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error: " + e.message.slice(0,100))
    }
    ctx.session.step = null
    menu(ctx)
    return
  }
})

// === COMANDOS ===
bot.hears('Ganancias', ctx => ctx.reply(`Balance: ${(users[ctx.from.id]?.balance || 0).toFixed(3)} USDT`))

bot.hears('Retiro', ctx => {
  if ((users[ctx.from.id]?.balance || 0) < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session = { step: "retiro" }
})

bot.hears('Staking', ctx => {
  ctx.reply("Elige tu plan (10% diario × 20 días):", Markup.inlineKeyboard([
    [Markup.button.callback("1 USDT → 0.1/día", "buy_1"), Markup.button.callback("3 USDT → 0.3/día", "buy_3")],
    [Markup.button.callback("5 USDT → 0.5/día", "buy_5"), Markup.button.callback("10 USDT → 1/día", "buy_10")],
    [Markup.button.callback("20 USDT → 2/día", "buy_20"), Markup.button.callback("30 USDT → 3/día", "buy_30")],
    [Markup.button.callback("50 USDT → 5/día", "buy_50")]
  ]))
})

bot.hears('Minería', ctx => {
  const u = users[ctx.from.id]
  if (!u || u.ref_validos < 5) return ctx.reply(`Necesitas 5 referidos con plan\nTienes: ${u?.ref_validos || 0}/5`)
  const puede = Date.now() - (u.last_mine || 0) >= 86400000
  ctx.reply(puede ? "¡Reclama 0.03 USDT!" : "Espera 24h", puede ? Markup.inlineKeyboard([[Markup.button.callback("RECLAMAR", "mine")]]) : null)
})

bot.hears('Referidos', async ctx => {
  const me = await bot.telegram.getMe()
  const link = `https://t.me/\( {me.username}?start= \){ctx.from.id}`
  const u = users[ctx.from.id]
  ctx.replyWithMarkdown(`*Referidos*\nTotal: \( {u?.referidos || 0}\nVálidos: \){u?.ref_validos || 0}\n\nEnlace:\n${link}`)
})

bot.hears('Soporte', ctx => ctx.reply("Soporte: @Carlo2187"))

// === BOTONES INLINE ===
bot.action(/buy_(\d+)/, async ctx => {
  const monto = ctx.match[1]
  await ctx.answerCbQuery()
  await ctx.replyWithMarkdown(`*Plan \( {monto} USDT*\nEnvía * \){monto} USDT* a:\n\`\( {BOT_WALLET}\`\nPago detectado automáticamente`, Markup.inlineKeyboard([[Markup.button.callback("Ya pagué", `confirm_ \){monto}`)]]))
})

bot.action(/confirm_(\d+)/, async ctx => {
  const monto = parseInt(ctx.match[1])
  const id = ctx.from.id.toString()
  await ctx.answerCbQuery("¡Plan activado!")
  users[id].planes.push({ amount: monto, daily: PLANES[monto], last_claim: Date.now() })
  if (users[id].inviter && users[users[id].inviter]) users[users[id].inviter].ref_validos += 1
  saveDB()
  await ctx.reply("PLAN ACTIVADO!")
  menu(ctx)
})

bot.action('mine', async ctx => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].last_mine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].last_mine = Date.now()
    saveDB()
    await ctx.answerCbQuery("+0.03 USDT")
    ctx.reply("+0.03 USDT acreditado!")
  }
  menu(ctx)
})

// === GANANCIAS DIARIAS AUTOMÁTICAS ===
setInterval(() => {
  for (const id in users) {
    const u = users[id]
    if (u.planes?.length > 0) {
      const daily = u.planes.reduce((a, p) => a + p.daily, 0)
      u.balance += daily
    }
  }
  saveDB()
}, 3600000)

// === DETECTOR DE PAGOS AUTOMÁTICO ===
let lastBlock = 0
setInterval(async () => {
  try {
    const block = await provider.getBlockNumber()
    if (block <= lastBlock) return
    lastBlock = block

    const blockData = await provider.getBlockWithTransactions(block)
    for (const tx of blockData.transactions) {
      if (tx.to?.toLowerCase() === BOT_WALLET.toLowerCase() && tx.value.eq(0)) {
        if (tx.data.startsWith("0xa9059cbb")) {
          const receiver = "0x" + tx.data.slice(34,74)
          const amountRaw = "0x" + tx.data.slice(74)
          const amount = Number(ethers.formatUnits(amountRaw,18))
          if ([1,3,5,10,20,30,50].includes(amount) && users[receiver]) {
            const daily = PLANES[amount]
            users[receiver].planes.push({amount, daily, last_claim: Date.now()})
            if (users[receiver].inviter) users[users[receiver].inviter].ref_validos += 1
            saveDB()
            bot.telegram.sendMessage(receiver, `Pago recibido \( {amount} USDT\nPlan activado: + \){daily} USDT/día`).catch(()=>{})
          }
        }
      }
    }
  } catch(e) {}
}, 10000)

// === LANZAMIENTO ===
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('STANKING MINER 100% ACTIVO Y COBRANDO 24/7'))
  .catch(err => console.error('ERROR:', err))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
