import 'dotenv/config'
import { Telegraf, session, Markup } from 'telegraf'
import { ethers, Interface } from 'ethers'
import fs from 'fs'

console.log('STAKING MINER - INICIANDO 100% AUTOMÁTICO...')

// Inicializar bot
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// ==== BASE DE DATOS ====
let users = {}
const DB_FILE = 'users.json'

if (fs.existsSync(DB_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DB_FILE))
  } catch {
    console.log('⚠️ DB corrupta, creando nueva...')
    users = {}
  }
}

const saveDB = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))
}

// ==== CONFIG BLOCKCHAIN ====
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) throw new Error('❌ Falta PRIVATE_KEY en Railway (.env)')

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed1.defibit.io/'
const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const BOT_WALLET = wallet.address

console.log("Wallet receptora:", BOT_WALLET)

// USDT BEP20
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const USDT = new ethers.Contract(
  USDT_ADDRESS,
  ['function transfer(address,uint256) external returns (bool)'],
  wallet
)

// Planes disponibles
const PLANES = [1, 3, 5, 10, 20, 50]

// ==== LIMPIEZA DE MENSAJES ====
let mensajesGuardados = []
const MAX_MESSAGES = 4

const sendMessage = async (ctx, text, extra = {}) => {
  const m = await ctx.reply(text, extra)

  mensajesGuardados.push({ chatId: m.chat.id, id: m.message_id })

  if (mensajesGuardados.length > MAX_MESSAGES) {
    const viejo = mensajesGuardados.shift()
    try { await bot.telegram.deleteMessage(viejo.chatId, viejo.id) } catch {}
  }

  return m
}

// ==== TECLADOS ====
const buildKeyboard = (rows) => ({
  inline_keyboard: [
    ...rows,
    [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
  ]
})

// ==== MENÚ PRINCIPAL ====
const mainMenu = (ctx) => {
  return sendMessage(
    ctx,
    `<b>STAKING MINER</b>\nPagos reales - Min retiro 1 USDT`,
    {
      parse_mode: 'HTML',
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
};

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
      pendingDeposit: null
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

      bot.telegram.sendMessage(ref, 'Nuevo referido +0.02 USDT')
        .catch(() => {})
    }

  } else if (!users[id].verified) {
    await sendMessage(
      ctx,
      `Tu código es:\n\`${users[id].code}\``,
      { parse_mode: 'Markdown' }
    )

  } else {
    return mainMenu(ctx)
  }
})

// ==== /setwallet (opcional) ====
bot.command('setwallet', async (ctx) => {
  const id = ctx.from.id.toString()
  const parts = ctx.message.text.trim().split(/\s+/)

  if (!parts[1] || !/^0x[a-fA-F0-9]{40}$/.test(parts[1])) {
    return sendMessage(ctx, 'Uso correcto:\n/setwallet 0xTU_WALLET')
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
    `Wallet registrada: ${w}\nUsa esta misma wallet para depositar.`
  )
})

// ==== TEXTO GENERAL ====
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()

  if (!users[id]) return

  // Verificación
  if (!users[id].verified && text === String(users[id].code)) {
    users[id].verified = true
    delete users[id].code
    saveDB()
    return mainMenu(ctx)
  }

  // Paso 1 del staking → registrar wallet
  if (ctx.session?.pendingPlan && ctx.session.pendingPlan.step === 'await_wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return sendMessage(ctx, 'Wallet inválida, envíala en formato 0x...')
    }

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
      `Wallet registrada: ${users[id].wallet}\n\nAhora envía *${users[id].pendingDeposit.planAmount} USDT* a:\n\`${BOT_WALLET}\`\n\nLuego toca *✔ Confirmar depósito*.`,
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
          }// === RETIRO: paso 1 → escribir cantidad ===
  if (ctx.session?.withdrawStep === 'amount') {

    const amount = Number(text.replace(',', '.'))

    if (isNaN(amount) || amount <= 0) {
      return sendMessage(ctx, 'Cantidad inválida. Escribe solo números.')
    }

    if (amount < 1) {
      return sendMessage(ctx, 'El mínimo de retiro es 1 USDT.')
    }

    const u = users[id]

    if ((u.balance || 0) < amount) {
      return sendMessage(
        ctx,
        `No tienes saldo suficiente.\nTu balance: ${(u.balance || 0).toFixed(6)} USDT`
      )
    }

    ctx.session.withdrawAmount = amount
    ctx.session.withdrawStep = 'wallet'

    return sendMessage(
      ctx,
      `Perfecto.\nVas a retirar *${amount.toFixed(6)} USDT*.\n\nAhora envíame tu wallet BEP20:`,
      { parse_mode: 'Markdown' }
    )
  }

  // === RETIRO: paso 2 → ingresar wallet ===
  if (ctx.session?.withdrawStep === 'wallet') {

    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return sendMessage(ctx, 'Wallet inválida. Debe ser BEP20 (0x...).')
    }

    ctx.session.withdrawWallet = text
    ctx.session.withdrawStep = 'confirm'

    return sendMessage(
      ctx,
      `Confirmar retiro:\n\nMonto: *${ctx.session.withdrawAmount.toFixed(6)} USDT*\nWallet: \`${ctx.session.withdrawWallet}\`\n\n¿Deseas continuar?`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Confirmar retiro', callback_data: 'confirm_withdraw' }],
            [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
          ]
        }
      }
    )
  }

}) // FIN bot.on('text')

// ==== CALLBACK: MENÚ PRINCIPAL ====
bot.action('menu_principal', async (ctx) => {
  await ctx.answerCbQuery()
  return mainMenu(ctx)
})

// ==== MENÚ: STAKING ====
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

  return sendMessage(
    ctx,
    'Selecciona un plan de staking (10% diario por 20 días):',
    { reply_markup: buildKeyboard(rows) }
  )
})

// ==== MENÚ: MINERÍA ====
bot.action('menu_mineria', async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const u = users[id]

  if (!u || (u.refValidos || 0) < 5) {
    return sendMessage(
      ctx,
      `Necesitas 5 referidos VÁLIDOS.\nTienes: ${(u?.refValidos || 0)}/5`
    )
  }

  const puede = Date.now() - (u.lastMine || 0) >= 24 * 3600 * 1000

  if (!puede) {
    return sendMessage(ctx, 'Ya reclamaste minería hoy. Espera 24 horas.')
  }

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
})// ==== MENÚ: GANANCIAS ====
bot.action('menu_ganancias', async (ctx) => {
  await ctx.answerCbQuery()
  
  const id = ctx.from.id.toString()
  const u = users[id]

  let text = `Balance total: ${(u?.balance || 0).toFixed(6)} USDT\n\n`

  if (u?.planes?.length > 0) {
    text += 'Planes activos:\n'
    u.planes.forEach((p, i) => {
      text += `\n#${i + 1} - ${p.amount} USDT | Diario: ${p.daily.toFixed(6)} | Días cobrados: ${p.daysClaimed || 0}/20 | Activo: ${p.active ? '✅' : '❌'}`
    })
  } else {
    text += 'No tienes planes activos.'
  }

  const rows = []

  if (u?.planes) {
    u.planes.forEach((p, i) => {
      if (p.active) {
        rows.push([
          { text: `Recoger plan #${i + 1}`, callback_data: `collect_${i}` }
        ])
      }
    })
  }

  return sendMessage(ctx, text, {
    reply_markup: rows.length ? buildKeyboard(rows) : buildKeyboard([])
  })
})

// ==== MENÚ: RETIRO ====
bot.action('menu_retiro', async (ctx) => {
  await ctx.answerCbQuery()
  
  const id = ctx.from.id.toString()
  const u = users[id]

  if (!u || (u.balance || 0) < 1) {
    return sendMessage(
      ctx,
      `Mínimo de retiro: 1 USDT.\nTu balance actual: ${(u?.balance || 0).toFixed(6)} USDT`
    )
  }

  ctx.session.withdrawStep = 'amount'
  ctx.session.withdrawAmount = null
  ctx.session.withdrawWallet = null

  return sendMessage(
    ctx,
    '💸 *RETIRO*\n\nEscribe la cantidad a retirar (en USDT):',
    { parse_mode: 'Markdown' }
  )
})

// ==== MENÚ: REFERIDOS ====

bot.action('menu_referidos', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = users[id]
  const me = await bot.telegram.getMe()

  const link = `https://t.me/${me.username}?start=${id}`

  await ctx.editMessageText(
    `👥 *Tus referidos*\n
Total: *${u.referidos}*\n
Activos: *${u.refValidos}*\n
\n*Tu link de invitación:*\n${link}`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [{ text: "⬅️ Regresar", callback_data: "back_main" }]
        ]
      }
    }
  )
})

// ==== MENÚ: SOPORTE ====
bot.action('menu_soporte', async (ctx) => {
  await ctx.answerCbQuery()
  return sendMessage(ctx, 'Soporte → @StankingMiner')
})

// ==== SELECCIÓN DE PLAN ====
bot.action(/select_plan_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const amount = Number(ctx.match[1])
  const id = ctx.from.id.toString()

  if (!PLANES.includes(amount)) return

  ctx.session.pendingPlan = { amount, step: 'await_wallet' }

  return sendMessage(
    ctx,
    `Has elegido *${amount} USDT*.\nGanancia diaria: *${(amount * 0.1).toFixed(6)} USDT*.\n\nAhora envía la wallet BEP20 desde donde depositarás.`,
    { parse_mode: 'Markdown' }
  )
})// ==== CONFIRMAR DEPÓSITO ====
bot.action('confirm_deposit', async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const u = users[id]

  if (!u || !u.pendingDeposit) {
    return sendMessage(ctx, 'No tienes un depósito pendiente. Selecciona un plan primero.')
  }

  if (!u.wallet) {
    return sendMessage(ctx, 'No tienes wallet registrada. Vuelve a iniciar el proceso de staking.')
  }

  if (u.pendingDeposit.status === 'confirmed') {
    return sendMessage(ctx, 'Depósito ya detectado. Ahora toca "Activar plan".')
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
      '⚠️ Depósito no encontrado aún.\nEspera unos minutos y vuelve a presionar “✔️ Confirmar depósito”.'
    )
  }

  u.pendingDeposit.status = 'confirmed'
  saveDB()

  return sendMessage(
    ctx,
    `✅ Depósito de ${u.pendingDeposit.planAmount} USDT detectado.\nAhora toca *Activar plan*.`,
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
})

// ==== ACTIVAR PLAN (tras depósito confirmado) ====
bot.action(/activate_plan_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const amount = Number(ctx.match[1])
  const u = users[id]

  if (!u?.pendingDeposit) {
    return sendMessage(ctx, 'No tienes depósito pendiente.')
  }

  if (u.pendingDeposit.planAmount !== amount) {
    return sendMessage(ctx, 'El plan detectado no coincide con el que intentas activar.')
  }

  if (u.pendingDeposit.status !== 'confirmed') {
    return sendMessage(ctx, 'El depósito aún no ha sido confirmado.')
  }

  const daily = +(amount * 0.1)

  const planObj = {
    amount,
    daily,
    startTime: Date.now(),
    daysClaimed: 0,
    lastClaimTime: null,
    active: true,
    durationDays: 20
  }

  u.planes.push(planObj)

  // Marcar depósito como resuelto
  u.pendingDeposit = null

  // Referido válido
  if (u.inviter && users[u.inviter]) {
    users[u.inviter].refValidos = (users[u.inviter].refValidos || 0) + 1
  }

  saveDB()

  return sendMessage(
    ctx,
    `🎉 *PLAN ACTIVADO*\n\nMonto: ${amount} USDT\nGanancia diaria: ${daily.toFixed(6)} USDT\nDuración: 20 días.\n\nRegresa en 24 horas para recoger tu primera recompensa.`,
    { parse_mode: 'Markdown' }
  )
})// ==== RECOGER RECOMPENSA DIARIA DE STAKING ====
bot.action(/collect_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const u = users[id]
  const idx = Number(ctx.match[1])

  if (!u || !u.planes || !u.planes[idx]) {
    return sendMessage(ctx, 'Plan no encontrado.')
  }

  const p = u.planes[idx]
  const now = Date.now()

  if (!p.active) {
    return sendMessage(ctx, 'Este plan ya terminó sus 20 días.')
  }

  // Verificar si ya pasó 24h
  if (p.lastClaimTime && now - p.lastClaimTime < 24 * 3600 * 1000) {
    return sendMessage(
      ctx,
      'Aún no han pasado 24 horas desde la última recolección.'
    )
  }

  // Verificar si aún tiene días disponibles
  if ((p.daysClaimed || 0) >= p.durationDays) {
    p.active = false
    saveDB()
    return sendMessage(ctx, 'Este plan ya completó sus 20 días.')
  }

  // Recompensa
  u.balance += p.daily
  p.daysClaimed = (p.daysClaimed || 0) + 1
  p.lastClaimTime = now

  if (p.daysClaimed >= p.durationDays) {
    p.active = false
    saveDB()

    return sendMessage(
      ctx,
      `🎉 *Recompensa final recibida*\n+${p.daily.toFixed(6)} USDT\n\nEl plan completó sus 20 días.`,
      { parse_mode: 'Markdown' }
    )
  }

  saveDB()

  return sendMessage(
    ctx,
    `💰 *Recompensa recibida*\n+${p.daily.toFixed(6)} USDT\n\nDía ${p.daysClaimed}/${p.durationDays} completado.\nRegresa en 24 horas.`,
    { parse_mode: 'Markdown' }
  )
})

// ==== RECLAMAR MINERÍA ====
bot.action('mine', async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const u = users[id]

  if (!u) return sendMessage(ctx, 'Usuario no encontrado.')

  if (Date.now() - (u.lastMine || 0) < 24 * 3600 * 1000) {
    return sendMessage(ctx, 'Ya reclamaste hoy. Regresa en 24 horas.')
  }

  u.balance += 0.03
  u.lastMine = Date.now()

  saveDB()

  return sendMessage(ctx, '+0.03 USDT añadidos a tu balance.')
})// ==== CONFIRMAR RETIRO (transferencia real USDT BEP20) ====
bot.action('confirm_withdraw', async (ctx) => {
  await ctx.answerCbQuery()

  const id = ctx.from.id.toString()
  const u = users[id]

  const amount = ctx.session?.withdrawAmount
  const walletTo = ctx.session?.withdrawWallet

  if (!u || !amount || !walletTo) {
    return sendMessage(ctx, 'Error: no hay datos de retiro almacenados.')
  }

  if ((u.balance || 0) < amount) {
    return sendMessage(
      ctx,
      `Tu balance cambió.\nBalance actual: ${(u.balance || 0).toFixed(6)} USDT`
    )
  }

  await sendMessage(ctx, 'Procesando retiro en la blockchain...')

  try {
    // Transferencia real de USDT
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
      `✅ *RETIRO COMPLETADO*\n\nMonto: ${amount.toFixed(6)} USDT\nWallet: ${walletTo}\nTx: https://bscscan.com/tx/${tx.hash}`,
      { parse_mode: 'Markdown' }
    )

    return mainMenu(ctx)

  } catch (e) {
    console.error('Error retiro:', e)
    return sendMessage(ctx, 'Error al procesar el retiro. Asegúrate de que el bot tiene USDT y gas (BNB).')
  }
})

// ==== EVENTO ON-CHAIN PARA DETECTAR TRANSFERENCIAS EN TIEMPO REAL ====
const ERC20_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
])

const transferTopic = ERC20_IFACE.getEvent("Transfer").topicHash

const filter = {
  address: USDT_ADDRESS,
  topics: [transferTopic]
}

provider.on(filter, async (log) => {
  try {
    const parsed = ERC20_IFACE.parseLog(log)
    const from = parsed.args.from.toLowerCase()
    const to = parsed.args.to.toLowerCase()
    const rawValue = parsed.args.value
    const amount = Number(ethers.formatUnits(rawValue, 18))

    if (to !== BOT_WALLET.toLowerCase()) return

    console.log(`📥 Depósito detectado → ${amount} USDT desde ${from}`)

    // Buscar usuario que tiene esa wallet
    let userFound = null
    for (const uid in users) {
      if (users[uid].wallet && users[uid].wallet.toLowerCase() === from) {
        userFound = uid
        break
      }
    }

    if (!userFound) {
      console.log('Depósito recibido desde wallet NO registrada.')
      return
    }

    const u = users[userFound]

    if (
      u.pendingDeposit &&
      Math.round(amount) === Math.round(u.pendingDeposit.planAmount)
    ) {
      u.pendingDeposit.status = 'confirmed'
      saveDB()

      bot.telegram.sendMessage(
        userFound,
        `✅ *DEPÓSITO DETECTADO AUTOMÁTICAMENTE*\n${amount} USDT enviados.\n\nAhora puedes activar tu plan.`,
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
      ).catch(() => {})
    }

  } catch (err) {
    console.error('Error procesando evento on-chain:', err)
  }
})// ==== FUNCIÓN PARA CONFIRMAR DEPÓSITOS MANUALMENTE ====
const checkRecentTransfer = async (from, to, amount) => {
  try {
    const currentBlock = await provider.getBlockNumber()
    const fromBlock = Math.max(0, currentBlock - 300) // últimos ± 5 minutos

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
  } catch (err) {
    console.error('Error checkRecentTransfer:', err)
    return false
  }
}

// ==== LANZAR BOT ====
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    bot.telegram.getMe().then(me => {
      console.log(`BOT ENCENDIDO: @${me.username}`)
      console.log(`Wallet receptora: ${BOT_WALLET}`)
      console.log(`RPC: ${RPC_URL}`)
    })
  })
  .catch(err => {
    console.error('Error al lanzar bot:', err)
  })

// ==== APAGADO LIMPIO ====
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))// ==== MENSAJE DE CONFIRMACIÓN EN CONSOLA ====
console.log("STAKING MINER BOT listo y escuchando eventos en BSC...")// ==== FIN DEL ARCHIVO ====
// El bot está configurado completamente.
// Railway ahora puede ejecutarlo sin errores.
