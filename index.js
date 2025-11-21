import 'dotenv/config'
import { Telegraf, Markup } from 'telegraf'
import { Wallet, ethers } from 'ethers'
import fs from 'fs'

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

// === BASE DE DATOS LOCAL ===
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) users = JSON.parse(fs.readFileSync(DB_FILE))
function save() { fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2)) }

// === WEB3 ===
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL)
const wallet = new Wallet(process.env.PRIVATE_KEY, provider)
const USDT = new ethers.Contract("0x55d398326f99059fF775485246999027B3197955", [
  "function transfer(address to, uint amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)"
], wallet)

const PLANES = {1:0.1,3:0.3,5:0.5,10:1.0,20:2.0,30:3.0,50:5.0}

// === START + REFERRAL ===
bot.start((ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.startPayload

  if (!users[id]) {
    users[id] = { balance: 0, planes: [], ref_validos: 0, last_mine: 0, referidos: 0, inviter: ref || null, verified: true }
    save()
    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      save()
      bot.telegram.sendMessage(ref, "¡Nuevo referido +0.02 USDT!").catch(() => {})
    }
  }

  ctx.reply(`STANKING MINER\nBienvenido ${ctx.from.first_name || 'crack'}`, Markup.keyboard([
    ['Staking', 'Minería'],
    ['Ganancias', 'Retiro'],
    ['Referidos', 'Soporte']
  ]).resize())
})

// === MENÚS COMPLETOS (Staking, Minería, Ganancias, Retiro, Referidos) ===
bot.hears('Ganancias', (ctx) => {
  const u = users[ctx.from.id] || { balance: 0 }
  ctx.reply(`Balance: ${u.balance.toFixed(3)} USDT`)
})

bot.hears('Retiro', async (ctx) => {
  const u = users[ctx.from.id] || { balance: 0 }
  if (u.balance < 1) return ctx.reply("Mínimo 1 USDT")
  ctx.reply("Envía tu wallet BEP-20:")
  ctx.session = { waiting: true }
})

bot.on('text', async (ctx) => {
  if (ctx.session?.waiting) {
    const wallet = ctx.message.text
    const id = ctx.from.id.toString()
    const amount = users[id].balance

    await ctx.reply("Procesando retiro...")
    try {
      const tx = await USDT.transfer(wallet, ethers.parseUnits(amount.toString(), 18))
      await tx.wait()
      users[id].balance = 0
      save()
      await ctx.reply(`Retiro exitoso!\n\( {amount} USDT\nTX: https://bscscan.com/tx/ \){tx.hash}`)
    } catch (e) {
      await ctx.reply("Error: " + e.message.slice(0,100))
    }
    ctx.session.waiting = false
  }
})

// === MÁS MENÚS (Staking, Minería, etc.) los tienes listos para pegar cuando quieras ===

bot.launch()
console.log('STANKING MINER EN LA NUBE – COBRANDO 24/7')
