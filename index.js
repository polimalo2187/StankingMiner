import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { Wallet, ethers } from 'ethers'
import fs from 'fs'

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

// === BASE DE DATOS LOCAL (users.json) ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) } catch {}
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

// === START + REFERRAL ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.startPayload || null

  if (!users[id]) {
    users[id] = { balance: 0, planes: [], ref_validos: 0, last_mine: 0, referidos: 0, inviter: ref, verified: true }
    save()
    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      save()
      try { await bot.telegram.sendMessage(ref, "¡Nuevo referido +0.02 USDT!") } catch {}
    }
  }
  menu(ctx)
})

// === GANANCIAS ===
bot.hears('Ganancias', (ctx) => {
  const u = users[ctx.from.id.toString()] || { balance: 0 }
  ctx.reply(`Tu balance actual:\n${u.balance.toFixed(3)} USDT`)
})

// === RETIRO REAL ===
bot.hears('Retiro', (ctx) => {
  const u = users[ctx.from.id.toString()] || { balance: 0 }
  if (u.balance < 1) return ctx.reply("Mínimo 1 USDT para retirar")
  ctx.reply("Envía tu wallet BEP-20 (USDT):")
  ctx.session = { step: "retiro" }
})

bot.on('text', async (ctx) => {
  if (ctx.session?.step === "retiro") {
    const walletAddr = ctx.message.text.trim()
    if (!walletAddr.match(/^0x[a-fA-F0-9]{40}$/)) return ctx.reply("Wallet inválida")
    const id = ctx.from.id.toString()
    const amount = users[id].balance

    await ctx.reply("Procesando retiro...")
    try {
      const tx = await USDT.transfer(walletAddr, ethers.parseUnits(amount.toString(), 18))
      await tx.wait()
      users[id].balance = 0
      save()
      await ctx.reply(`Retiro completado!\n\( {amount.toFixed(3)} USDT enviados\n\nTX: https://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error en retiro: " + e.message.slice(0, 100))
    }
    ctx.session.step = null
    menu(ctx)
  }
})

// === STAKING (COMPRA DE PLANES) ===
bot.hears('Staking', (ctx) => {
  ctx.reply("Elige tu plan (10% diario × 20 días):", Markup.inlineKeyboard([
    [Markup.button.callback("1 USDT → 0.1/día", "buy_1"), Markup.button.callback("3 USDT → 0.3/día", "buy_3")],
    [Markup.button.callback("5 USDT → 0.5/día", "buy_5"), Markup.button.callback("10 USDT → 1/día", "buy_10")],
    [Markup.button.callback("20 USDT → 2/día", "buy_20"), Markup.button.callback("30 USDT → 3/día", "buy_30")],
    [Markup.button.callback("50 USDT → 5/día", "buy_50")]
  ]))
})

bot.action(/buy_(\d+)/, async (ctx) => {
  const monto = ctx.match[1]
  await ctx.answerCbQuery()
  await ctx.replyWithMarkdown(
    `*Plan \( {monto} USDT*\nGanancia diaria: \){PLANES[monto]} USDT\n\nEnvía exactamente *\( {monto} USDT* a:\n\` \){BOT_WALLET}\`\n\nDespués presiona CONFIRMAR`,
    Markup.inlineKeyboard([[Markup.button.callback("CONFIRMAR DEPÓSITO", `confirm_${monto}`)]])
  )
})

bot.action(/confirm_(\d+)/, async (ctx) => {
  const monto = parseInt(ctx.match[1])
  const id = ctx.from.id.toString()
  await ctx.answerCbQuery("¡Plan activado!")
  
  users[id].planes.push({ amount: monto, daily: PLANES[monto], last_claim: Date.now(), day: 1 })
  if (users[id].inviter && users[users[id].inviter]) users[users[id].inviter].ref_validos += 1
  save()
  
  await ctx.reply(`PLAN DE ${monto} USDT ACTIVADO!\nRegresa en 24h para reclamar tu ganancia diaria.`)
  menu(ctx)
})

// === MINERÍA (5 referidos válidos) ===
bot.hears('Minería', (ctx) => {
  const id = ctx.from.id.toString()
  const u = users[id] || { ref_validos: 0, last_mine: 0 }
  if (u.ref_validos < 5) {
    return ctx.reply(`Minería bloqueada\nNecesitas 5 referidos que hayan invertido\nTienes: ${u.ref_validos}/5`)
  }
  const puedeMinar = Date.now() - (u.last_mine || 0) >= 86400000
  const kb = puedeMinar ? Markup.inlineKeyboard([[Markup.button.callback("RECLAMAR 0.03 USDT", "mine")]]) : null
  ctx.reply(puedeMinar ? "¡Puedes reclamar tu minería diaria!" : "Espera 24h para reclamar", kb)
})

bot.action('mine', async (ctx) => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].last_mine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].last_mine = Date.now()
    save()
    await ctx.answerCbQuery("+0.03 USDT")
    ctx.reply("¡+0.03 USDT reclamado!")
  }
  menu(ctx)
})

// === REFERIDOS ===
bot.hears('Referidos', async (ctx) => {
  const id = ctx.from.id.toString()
  const me = await bot.telegram.getMe()
  const link = `https://t.me/\( {me.username}?start= \){id}`
  const u = users[id] || { referidos: 0, ref_validos: 0 }
  ctx.replyWithMarkdown(
    `*Tus referidos*\nTotal: \( {u.referidos}\nVálidos (invirtieron): \){u.ref_validos}\n\nTu enlace de referido:\n${link}`
  )
})

// === SOPORTE ===
bot.hears('Soporte', (ctx) => ctx.reply("Soporte oficial: @Carlo2187"))

// === LANZAMIENTO ===
bot.launch()
console.log('STANKING MINER 100% COMPLETO Y FUNCIONANDO 24/7')
process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())
