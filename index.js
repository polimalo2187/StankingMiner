import 'dotenv/config'
import { Telegraf, session, Markup } from 'telegraf'
import { ethers, Interface } from 'ethers'
import fs from 'fs'

console.log('STAKING MINER - INICIANDO 100% AUTOMÁTICO...')

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// ==== DB ====
let users = {}
const DB_FILE = 'users.json'
if (fs.existsSync(DB_FILE)) {
  try { users = JSON.parse(fs.readFileSync(DB_FILE)) } catch {
    console.log('DB corrupta, creando nueva')
    users = {}
  }
}
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// ==== BLOCKCHAIN / USDT ====
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('Falta PRIVATE_KEY en .env')

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed1.defibit.io/'
const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const BOT_WALLET = wallet.address

const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const USDT = new ethers.Contract(
  USDT_ADDRESS,
  ['function transfer(address,uint256) external returns (bool)'],
  wallet
)

const PLANES = [1, 3, 5, 10, 20, 50] // USDT

// ==== MENSAJES + LIMPIEZA ====
let mensajesGuardados = []
const MAX_MESSAGES = 4

const sendMessage = async (ctx, text, extra = {}) => {
  const m = await ctx.reply(text, extra)
  mensajesGuardados.push({ chatId: m.chat.id, id: m.message_id })
  if (mensajesGuardados.length > MAX_MESSAGES) {
    const old = mensajesGuardados.shift()
    try { await bot.telegram.deleteMessage(old.chatId, old.id) } catch {}
  }
  return m
}

const buildKeyboard = (rows) => ({
  inline_keyboard: [
    ...rows,
    [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
  ]
})

const mainMenu = (ctx) =>
  sendMessage(
    ctx,
    '*STAKING MINER*\nPagos 100% reales · Mínimo retiro 1 USDT',
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: 'Staking', callback_data: 'menu_staking' },
            { text: 'Minería', callback_data: 'menu_mineria' },
            { text: 'Ganancias', callback_data: 'menu_ganancias' }
          ],
          [
            { text: 'Retiro', callback_data: 'menu_retiro' },
            { text: 'Referidos', callback_data: 'menu_referidos' },
            { text: 'Soporte', callback_data: 'menu_soporte' }
          ]
        ]
      }
    }
  )

// ==== /start ====
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.message?.text?.split(' ')[1] || null

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
      inviter: ref || null,
      wallet: null,
      pendingDeposit: null // {planAmount,status,timestamp}
    }
    saveDB()
    await sendMessage(
      ctx,
      `VERIFICACIÓN\n\nEscribe este código:\n\`${code}\``,
      { parse_mode: 'Markdown' }
    )

    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
      bot.telegram
        .sendMessage(ref, 'Nuevo referido +0.02 USDT')
        .catch(() => {})
    }
  } else if (!users[id].verified) {
    await sendMessage(
      ctx,
      `Tu código:\n\`${users[id].code}\``,
      { parse_mode: 'Markdown' }
    )
  } else {
    return mainMenu(ctx)
  }
})

// ==== /setwallet (opcional, registro directo) ====
bot.command('setwallet', async (ctx) => {
  const id = ctx.from.id.toString()
  const parts = ctx.message.text.trim().split(/\s+/)
  if (!parts[1] || !/^0x[a-fA-F0-9]{40}$/.test(parts[1])) {
    return sendMessage(ctx, 'Uso: /setwallet 0xTU_DIRECCION_BEP20')
  }
  const w = parts[1].toLowerCase()
  if (!users[id]) {
    users[id] = {
      balance: 0,
      planes: [],
      referidos: 0,
      refValidos: 0,
      lastMine: 0,
      verified: false,
      code: Math.floor(1000 + Math.random() * 9000),
      inviter: null,
      wallet: w,
      pendingDeposit: null
    }
  } else {
    users[id].wallet = w
  }
  saveDB()
  return sendMessage(
    ctx,
    `Wallet registrada: ${w}\nAhora envía USDT desde esa misma wallet y luego presiona "Confirmar depósito".`
  )
})

// ==== TEXTO GENERAL ====
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()
  if (!users[id]) return

  // verificación
  if (!users[id].verified && text === String(users[id].code)) {
    users[id].verified = true
    delete users[id].code
    saveDB()
    return mainMenu(ctx)
  }

  // flujo staking: esperando wallet para depósito
  if (ctx.session?.pendingPlan && ctx.session.pendingPlan.step === 'await_wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text))
      return sendMessage(ctx, 'Wallet inválida, envíala en formato 0x...')
    users[id].wallet = text.toLowerCase()
    users[id].pendingDeposit = {
      planAmount: ctx.session.pendingPlan.amount,
      status: 'waiting',
      timestamp: Date.now()
    }
    saveDB()
    ctx.session.pendingPlan = null
    return sendMessage(
      ctx,
      `Wallet registrada: ${users[id].wallet}\n\nAhora envía exactamente *${users[id].pendingDeposit.planAmount} USDT* (BEP20) a:\n\`${BOT_WALLET}\`\n\nLuego presiona "✔️ Confirmar depósito".`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✔️ Confirmar depósito', callback_data: 'confirm_deposit' }],
            [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
          ]
        }
      }
    )
  }

  // flujo retiro: paso cantidad
  if (ctx.session?.withdrawStep === 'amount') {
    const amount = Number(text.replace(',', '.'))
    if (isNaN(amount) || amount <= 0) {
      return sendMessage(ctx, 'Cantidad inválida, escribe un número en USDT.')
    }
    if (amount < 1) {
      return sendMessage(ctx, 'El mínimo de retiro es 1 USDT.')
    }
    const u = users[id]
    if ((u.balance || 0) < amount) {
      return sendMessage(
        ctx,
        `No tienes saldo suficiente.\nTu balance: ${(u.balance || 0).toFixed(
          6
        )} USDT`
      )
    }
    ctx.session.withdrawAmount = amount
    ctx.session.withdrawStep = 'wallet'
    return sendMessage(
      ctx,
      `Perfecto. Vas a retirar ${amount.toFixed(
        6
      )} USDT.\n\nAhora envíame tu wallet BEP20 (USDT).`
    )
  }

  // flujo retiro: paso wallet
  if (ctx.session?.withdrawStep === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return sendMessage(ctx, 'Wallet inválida, envíala en formato 0x...')
    }
    ctx.session.withdrawWallet = text
    ctx.session.withdrawStep = 'confirm'
    return sendMessage(
      ctx,
      `Vas a retirar ${ctx.session.withdrawAmount.toFixed(
        6
      )} USDT a:\n${ctx.session.withdrawWallet}\n\nConfirma el retiro:`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Confirmar retiro', callback_data: 'confirm_withdraw' }],
            [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
          ]
        }
      }
    )
  }
})

// ==== MENÚ PRINCIPAL CALLBACKS ====
bot.action('menu_principal', async (ctx) => {
  await ctx.answerCbQuery()
  return mainMenu(ctx)
})

bot.action('menu_staking', async (ctx) => {
  await ctx.answerCbQuery()
  const rows = [
    [
      { text: '1 USDT', callback_data: 'select_plan_1' },
      { text: '3 USDT', callback_data: 'select_plan_3' },
      { text: '5 USDT', callback_data: 'select_plan_5' }
    ],
    [
      { text: '10 USDT', callback_data: 'select_plan_10' },
      { text: '20 USDT', callback_data: 'select_plan_20' },
      { text: '50 USDT', callback_data: 'select_plan_50' }
    ]
  ]
  await sendMessage(
    ctx,
    'Elige un plan de staking (10% diario, duración 20 días):',
    { reply_markup: buildKeyboard(rows) }
  )
})

bot.action('menu_mineria', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  if (!u || (u.refValidos || 0) < 5) {
    return sendMessage(
      ctx,
      `Necesitas 5 referidos válidos (que hayan invertido).\nTienes: ${
        u?.refValidos || 0
      }/5`
    )
  }
  const puede = Date.now() - (u.lastMine || 0) >= 24 * 3600 * 1000
  if (!puede)
    return sendMessage(ctx, 'Ya reclamaste hoy, espera 24 horas más.')
  return sendMessage(
    ctx,
    '*¡RECLAMA 0.03 USDT!*',
    {
      parse_mode: 'Markdown',
      reply_markup: buildKeyboard([
        [{ text: 'RECLAMAR', callback_data: 'mine' }]
      ])
    }
  )
})

bot.action('menu_ganancias', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  let text = `Balance total: ${(u?.balance || 0).toFixed(6)} USDT\n\n`

  if (u?.planes && u.planes.length > 0) {
    text += 'Tus planes activos:\n'
    u.planes.forEach((p, i) => {
      text += `\n#${i + 1} - ${
        p.amount
      } USDT | daily: ${p.daily.toFixed(6)} | días cobrados: ${
        p.daysClaimed || 0
      }/20 | activo: ${p.active ? '✅' : '❌'}`
    })
  } else {
    text += 'No tienes planes activos.'
  }

  const rows = []
  if (u?.planes) {
    u.planes.forEach((p, i) => {
      if (p.active) {
        rows.push([
          {
            text: `Recoger plan #${i + 1}`,
            callback_data: `collect_${i}`
          }
        ])
      }
    })
  }

  await sendMessage(ctx, text, {
    reply_markup: rows.length ? buildKeyboard(rows) : buildKeyboard([])
  })
})

// botón retiro → pide cantidad
bot.action('menu_retiro', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  if (!u || (u.balance || 0) < 1) {
    return sendMessage(
      ctx,
      `Mínimo de retiro: 1 USDT.\nTu balance actual: ${(u?.balance || 0).toFixed(
        6
      )} USDT`
    )
  }
  ctx.session.withdrawStep = 'amount'
  ctx.session.withdrawAmount = null
  ctx.session.withdrawWallet = null
  return sendMessage(
    ctx,
    '💸 MÍNIMO DE RETIRO: 1 USDT\n\nEscribe la CANTIDAD que deseas retirar (en USDT):'
  )
})

bot.action('menu_referidos', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  const me = await bot.telegram.getMe()
  const link = `https://t.me/${me.username}?start=${id}`
  await sendMessage(
    ctx,
    `Referidos totales: ${u?.referidos || 0}\nReferidos válidos (invirtieron): ${
      u?.refValidos || 0
    }\n\nLink de invitación:\n${link}`
  )
})

bot.action('menu_soporte', async (ctx) => {
  await ctx.answerCbQuery()
  await sendMessage(ctx, 'Soporte → @StankingMiner')
})

// ==== STAKING: selección de plan ====
bot.action(/select_plan_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const amount = Number(ctx.match[1])
  const id = ctx.from.id.toString()
  if (!PLANES.includes(amount)) return

  ctx.session.pendingPlan = { amount, step: 'await_wallet' }
  return sendMessage(
    ctx,
    `Has seleccionado *${amount} USDT*.\nGanancia diaria: *${(
      amount * 0.1
    ).toFixed(
      6
    )} USDT* (10%).\n\nEnvía ahora la wallet BEP20 desde donde harás el depósito:`,
    { parse_mode: 'Markdown' }
  )
})

// ==== CONFIRMAR DEPÓSITO (botón) ====
bot.action('confirm_deposit', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  if (!u || !u.pendingDeposit) {
    return sendMessage(
      ctx,
      'No tienes un depósito pendiente. Primero selecciona un plan.'
    )
  }

  if (!u.wallet) {
    return sendMessage(
      ctx,
      'No hay wallet registrada. Repite el proceso de staking.'
    )
  }

  if (u.pendingDeposit.status === 'confirmed') {
    return sendMessage(
      ctx,
      'Depósito ya detectado.\nPulsa el botón "Activar plan" si está disponible.'
    )
  }

  await sendMessage(ctx, '🔎 Verificando depósito en la blockchain...')

  const ok = await checkRecentTransfer(
    u.wallet,
    BOT_WALLET.toLowerCase(),
    u.pendingDeposit.planAmount
  )

  if (!ok) {
    return sendMessage(
      ctx,
      '⚠️ Aún no se detecta el depósito.\nEspera unos minutos y vuelve a pulsar "Confirmar depósito".'
    )
  }

  u.pendingDeposit.status = 'confirmed'
  saveDB()

  await sendMessage(
    ctx,
    `✅ Depósito de ${u.pendingDeposit.planAmount} USDT detectado.\nAhora activa tu plan:`,
    {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `🚀 Activar ${u.pendingDeposit.planAmount} USDT`,
              callback_data: `activate_plan_${u.pendingDeposit.planAmount}`
            }
          ],
          [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
        ]
      }
    }
  )
})

// ==== ACTIVAR PLAN (tras depósito confirmado) ====
bot.action(/activate_plan_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const amount = Number(ctx.match[1])
  const u = users[id]
  if (!u || !u.pendingDeposit) {
    return sendMessage(ctx, 'No tienes depósito pendiente.')
  }
  if (u.pendingDeposit.planAmount !== amount) {
    return sendMessage(
      ctx,
      'El plan pendiente no coincide con el que intentas activar.'
    )
  }
  if (u.pendingDeposit.status !== 'confirmed') {
    return sendMessage(
      ctx,
      'Depósito aún no confirmado. Pulsa "Confirmar depósito" primero.'
    )
  }

  const daily = +(amount * 0.1) // 10%
  const planObj = {
    amount,
    daily,
    startTime: Date.now(),
    daysClaimed: 0,
    lastClaimTime: null,
    active: true,
    durationDays: 20
  }

  u.planes = u.planes || []
  u.planes.push(planObj)
  u.pendingDeposit = null

  // sumar referido válido solo cuando activa plan
  if (u.inviter && users[u.inviter]) {
    users[u.inviter].refValidos = (users[u.inviter].refValidos || 0) + 1
  }

  saveDB()

  return sendMessage(
    ctx,
    `🎉 Plan ${amount} USDT ACTIVADO.\nGanancia diaria: ${daily.toFixed(
      6
    )} USDT.\nDuración: 20 días.\nVuelve en 24h para recoger tu primera recompensa.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
        ]
      }
    }
  )
})

// ==== RECOGER RECOMPENSA STAKING ====
bot.action(/collect_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()
  const uid = ctx.from.id.toString()
  const u = users[uid]
  const idx = Number(ctx.match[1])
  if (!u || !u.planes || !u.planes[idx]) {
    return sendMessage(ctx, 'Plan no encontrado.')
  }
  const p = u.planes[idx]
  if (!p.active) {
    return sendMessage(
      ctx,
      'Este plan ya completó sus 20 días o está inactivo.'
    )
  }
  const now = Date.now()
  if (p.lastClaimTime && now - p.lastClaimTime < 24 * 3600 * 1000) {
    return sendMessage(
      ctx,
      'Aún no han pasado 24h desde la última recolección.'
    )
  }
  if ((p.daysClaimed || 0) >= p.durationDays) {
    p.active = false
    saveDB()
    return sendMessage(
      ctx,
      'Este plan ya completó sus 20 días. Para seguir ganando, activa uno nuevo.'
    )
  }

  u.balance = (u.balance || 0) + p.daily
  p.daysClaimed = (p.daysClaimed || 0) + 1
  p.lastClaimTime = now

  if (p.daysClaimed >= p.durationDays) {
    p.active = false
    await sendMessage(
      ctx,
      `✅ Recompensa recogida: +${p.daily.toFixed(
        6
      )} USDT\nEl plan ha finalizado sus 20 días.`
    )
  } else {
    await sendMessage(
      ctx,
      `✅ Recompensa recogida: +${p.daily.toFixed(
        6
      )} USDT\nHas cobrado ${p.daysClaimed}/${p.durationDays} días. Regresa en 24h.`
    )
  }
  saveDB()
})

// ==== MINERÍA: reclamar 0.03 USDT ====
bot.action('mine', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  if (!u) return sendMessage(ctx, 'Usuario no encontrado.')
  if (Date.now() - (u.lastMine || 0) < 24 * 3600 * 1000) {
    return sendMessage(ctx, 'Ya reclamaste hoy. Espera 24h.')
  }
  u.balance = (u.balance || 0) + 0.03
  u.lastMine = Date.now()
  saveDB()
  return sendMessage(ctx, '+0.03 USDT añadidos a tu balance.')
})

// ==== CONFIRMAR RETIRO ====
bot.action('confirm_withdraw', async (ctx) => {
  await ctx.answerCbQuery()
  const id = ctx.from.id.toString()
  const u = users[id]
  const amount = ctx.session?.withdrawAmount
  const walletTo = ctx.session?.withdrawWallet

  if (!u || !amount || !walletTo) {
    return sendMessage(
      ctx,
      'No hay datos de retiro. Vuelve a iniciar desde el menú Retiro.'
    )
  }

  if ((u.balance || 0) < amount) {
    return sendMessage(
      ctx,
      `Tu balance cambió.\nBalance actual: ${(u.balance || 0).toFixed(
        6
      )} USDT`
    )
  }

  await sendMessage(ctx, 'Procesando retiro en la blockchain...')

  try {
    const tx = await USDT.transfer(
      walletTo,
      ethers.parseUnits(amount.toFixed(6), 18)
    )
    await tx.wait()
    u.balance -= amount
    if (u.balance < 0) u.balance = 0
    saveDB()
    ctx.session.withdrawAmount = null
    ctx.session.withdrawWallet = null
    ctx.session.withdrawStep = null
    await sendMessage(
      ctx,
      `✅ RETIRO COMPLETADO\n\nMonto: ${amount.toFixed(
        6
      )} USDT\nWallet: ${walletTo}\nTx: https://bscscan.com/tx/${tx.hash}`
    )
    return mainMenu(ctx)
  } catch (e) {
    console.error('Error en retiro', e)
    return sendMessage(
      ctx,
      'Error procesando el retiro. Revisa que el bot tenga saldo y gas en BNB.'
    )
  }
})

// ==== LISTENER ON-CHAIN DE TRANSFERENCIAS USDT ====
const ERC20_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
])
const transferTopic = ERC20_IFACE.getEventTopic('Transfer')

const filter = {
  address: USDT_ADDRESS,
  topics: [transferTopic]
}

provider.on(filter, async (log) => {
  try {
    const parsed = ERC20_IFACE.parseLog(log)
    const from = parsed.args.from.toLowerCase()
    const to = parsed.args.to.toLowerCase()
    const value = parsed.args.value
    const amount = Number(ethers.formatUnits(value, 18))

    if (to !== BOT_WALLET.toLowerCase()) return

    console.log(
      `Transfer detected: from=${from} to=${to} amount=${amount} USDT`
    )

    let matchedUid = null
    for (const uid in users) {
      if (users[uid].wallet && users[uid].wallet.toLowerCase() === from) {
        matchedUid = uid
        break
      }
    }
    if (!matchedUid) {
      console.log(
        'Pago recibido a la wallet del bot desde wallet no asociada:',
        from
      )
      return
    }

    const u = users[matchedUid]
    if (
      u.pendingDeposit &&
      Math.round(amount) === Math.round(u.pendingDeposit.planAmount)
    ) {
      u.pendingDeposit.status = 'confirmed'
      saveDB()
      try {
        await bot.telegram.sendMessage(
          matchedUid,
          `✅ Depósito de ${amount} USDT detectado on-chain.\nPulsa *Activar plan* para iniciar tu staking.`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  {
                    text: `🚀 Activar ${u.pendingDeposit.planAmount} USDT`,
                    callback_data: `activate_plan_${u.pendingDeposit.planAmount}`
                  }
                ],
                [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
              ]
            }
          }
        )
      } catch {}
    } else {
      console.log(
        'Pago a BOT_WALLET sin pendingDeposit asociado para uid',
        matchedUid
      )
    }
  } catch (e) {
    console.error('Error parsing transfer log', e)
  }
})

// ==== CHEQUEO MANUAL DE LOGS PARA CONFIRM_DEPOSIT ====
const checkRecentTransfer = async (from, to, amount) => {
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 300)
    const logs = await provider.getLogs({
      address: USDT_ADDRESS,
      topics: [transferTopic],
      fromBlock,
      toBlock: currentBlock
    })
    for (const log of logs.reverse()) {
      const parsed = ERC20_IFACE.parseLog(log)
      const fromLog = parsed.args.from.toLowerCase()
      const toLog = parsed.args.to.toLowerCase()
      const val = Number(ethers.formatUnits(parsed.args.value, 18))
      if (
        fromLog === from.toLowerCase() &&
        toLog === to.toLowerCase() &&
        Math.round(val) === Math.round(amount)
      ) {
        return true
      }
    }
    return false
  } catch (e) {
    console.error('checkRecentTransfer error', e)
    return false
  }
}

// ==== LANZAR BOT ====
bot
  .launch({ dropPendingUpdates: true })
  .then(() => {
    bot.telegram.getMe().then((me) => {
      console.log(`BOT ENCENDIDO: @${me.username}`)
      console.log(`Wallet receptora: ${BOT_WALLET}`)
      console.log(`RPC: ${RPC_URL}`)
    })
  })
  .catch((e) => {
    console.error('Error al lanzar el bot', e)
  })

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
