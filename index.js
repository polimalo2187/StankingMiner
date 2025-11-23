import 'dotenv/config'
import { Telegraf, session } from 'telegraf'
import { ethers, Interface } from 'ethers'
import fs from 'fs'

// ================== LOG INICIAL ==================
console.log('STAKING MINER - INICIANDO 100% AUTOMÁTICO...')

// ================== BOT ==================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN
if (!TELEGRAM_TOKEN) {
  throw new Error('Falta TELEGRAM_TOKEN en variables de entorno')
}

const bot = new Telegraf(TELEGRAM_TOKEN)
bot.use(session())

// ================== DB USUARIOS ==================
const DB_FILE = 'users.json'
let users = {}

if (fs.existsSync(DB_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DB_FILE))
  } catch (e) {
    console.log('⚠️ DB corrupta, creando nueva.')
    users = {}
  }
} else {
  users = {}
}

const saveDB = () => {
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))
}

const getUser = (id) => {
  if (!users[id]) {
    users[id] = {
      balance: 0,
      planes: [],          // planes de staking
      referidos: 0,        // referidos totales
      refValidos: 0,       // referidos que invirtieron
      lastMine: 0,         // última vez que reclamó minería
      verified: false,     // si ya pasó el código de verificación
      code: Math.floor(1000 + Math.random() * 9000),
      inviter: null,       // quién lo invitó
      wallet: null,        // wallet que usa para depositar
      pendingDeposit: null,// { planAmount, status, createdAt }
      validRef: false      // este usuario ya cuenta como "válido" para su invitador
    }
    saveDB()
  }
  return users[id]
}
// ================== BLOCKCHAIN / WALLET / USDT ==================
const PRIVATE_KEY = process.env.PRIVATE_KEY
if (!PRIVATE_KEY) {
  throw new Error('Falta PRIVATE_KEY en variables de entorno')
}

const RPC_URL = process.env.RPC_URL || 'https://bsc-dataseed1.defibit.io/'
const provider = new ethers.JsonRpcProvider(RPC_URL)
const wallet = new ethers.Wallet(PRIVATE_KEY, provider)
const BOT_WALLET = wallet.address

console.log('Wallet receptora:', BOT_WALLET)
console.log('RPC:', RPC_URL)

// USDT BEP20 en BSC
const USDT_ADDRESS = '0x55d398326f99059fF775485246999027B3197955'
const USDT = new ethers.Contract(
  USDT_ADDRESS,
  ['function transfer(address to, uint256 amount) external returns (bool)'],
  wallet
)

// Interface para eventos Transfer
const ERC20_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)'
])
const transferTopic = ERC20_IFACE.getEvent('Transfer').topicHash


// ================== HELPERS MENSAJES ==================
let mensajesGuardados = []
const MAX_MESSAGES = 4

const sendMessage = async (ctx, text, extra = {}) => {
  const m = await ctx.reply(text, extra)

  mensajesGuardados.push({ chatId: m.chat.id, id: m.message_id })

  if (mensajesGuardados.length > MAX_MESSAGES) {
    const viejo = mensajesGuardados.shift()
    try {
      await bot.telegram.deleteMessage(viejo.chatId, viejo.id)
    } catch (e) {}
  }

  return m
}

const buildKeyboard = (rows) => ({
  inline_keyboard: [
    ...rows,
    [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
  ]
})


// ================== MENÚ PRINCIPAL ==================
const mainMenu = (ctx) => {
  return sendMessage(
    ctx,
    '<b>STAKING MINER</b>\nPagos reales — Mínimo retiro 1 USDT',
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
                                 }
  // ================== /start ==================
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message?.text || ''
  const parts = text.split(' ')
  const ref = parts[1] || null

  let u = getUser(id)

  // Si viene con referido y no tiene invitador aún
  if (ref && !u.inviter && ref !== id && users[ref]) {
    u.inviter = ref
    users[ref].referidos += 1
    users[ref].balance += 0.02

    saveDB()
    bot.telegram
      .sendMessage(ref, 'Nuevo referido registrado: +0.02 USDT')
      .catch(() => {})
  }

  // Si aún no está verificado
  if (!u.verified) {
    return sendMessage(
      ctx,
      `VERIFICACIÓN\n\nEscribe este código para activar el bot:\n<code>${u.code}</code>`,
      { parse_mode: 'HTML' }
    )
  }

  // Si ya está verificado
  return mainMenu(ctx)
})


// ================== HANDLER DE TEXTO ==================
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()
  const u = getUser(id)

  // 1) Verificación
  if (!u.verified) {
    if (text === String(u.code)) {
      u.verified = true
      delete u.code
      saveDB()
      return mainMenu(ctx)
    } else {
      return sendMessage(
        ctx,
        `Código incorrecto.\nTu código es: <code>${u.code}</code>`,
        { parse_mode: 'HTML' }
      )
    }
  }

  // 2) STAKING: esperando wallet
  if (ctx.session?.pendingStake?.step === 'await_wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return sendMessage(ctx, 'Wallet inválida. Debe ser BEP20 (0x...).')
    }

    u.wallet = text.toLowerCase()
    u.pendingDeposit = {
      planAmount: ctx.session.pendingStake.amount,
      status: 'waiting',
      createdAt: Date.now()
    }
    ctx.session.pendingStake = null
    saveDB()

    return sendMessage(
      ctx,
      `<b>Wallet registrada:</b> ${u.wallet}\n\n` +
        `Ahora envía exactamente <b>${u.pendingDeposit.planAmount} USDT</b> a esta dirección:\n\n` +
        `<code>${BOT_WALLET}</code>\n\n` +
        `Luego toca <b>"✔ Confirmar depósito"</b>.`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '✔️ Confirmar depósito', callback_data: 'confirm_deposit' }],
            [{ text: '⬅️ Regresar', callback_data: 'menu_principal' }]
          ]
        }
      }
    )
  }

  // 3) RETIRO – paso cantidad
  if (ctx.session?.withdrawStep === 'amount') {
    const amount = Number(text.replace(',', '.'))

    if (isNaN(amount) || amount <= 0) {
      return sendMessage(ctx, 'Cantidad inválida. Escribe solo números.')
    }
    if (amount < 1) {
      return sendMessage(ctx, 'El mínimo de retiro es 1 USDT.')
    }
    if (u.balance < amount) {
      return sendMessage(
        ctx,
        `Saldo insuficiente.\nActualmente tienes ${u.balance.toFixed(6)} USDT`
      )
    }

    ctx.session.withdrawAmount = amount
    ctx.session.withdrawStep = 'wallet'

    return sendMessage(
      ctx,
      `Perfecto.\nVas a retirar <b>${amount} USDT</b>.\n\nAhora envía tu wallet BEP20 (0x...).`,
      { parse_mode: 'HTML' }
    )
  }

  // 4) RETIRO – paso wallet
  if (ctx.session?.withdrawStep === 'wallet') {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return sendMessage(ctx, 'Wallet inválida. Debe ser BEP20 (0x...).')
    }

    ctx.session.withdrawWallet = text
    ctx.session.withdrawStep = 'confirm'

    return sendMessage(
      ctx,
      `Confirma tu retiro:\n\n` +
        `Monto: <b>${ctx.session.withdrawAmount} USDT</b>\n` +
        `Wallet: <code>${ctx.session.withdrawWallet}</code>\n\n` +
        `¿Deseas continuar?`,
      {
        parse_mode: 'HTML',
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
      // ================== MENÚ PRINCIPAL (callback) ==================
bot.action('menu_principal', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})
  return mainMenu(ctx)
})


// ================== MENÚ: STAKING ==================
bot.action('menu_staking', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

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
    'Selecciona un plan de staking (10% diario durante 20 días):',
    { reply_markup: buildKeyboard(rows) }
  )
})


// ================== SELECCIÓN DEL PLAN ==================
bot.action(/select_plan_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const amount = Number(ctx.match[1])
  const u = getUser(id)

  if (![1, 3, 5, 10, 20, 50].includes(amount)) {
    return sendMessage(ctx, 'Plan inválido.')
  }

  // Guardamos temporalmente el plan y pasamos a pedir wallet
  ctx.session.pendingStake = { amount, step: 'await_wallet' }

  return sendMessage(
    ctx,
    `<b>Has elegido el plan de ${amount} USDT.</b>\n` +
      `Ganancia diaria: <b>${(amount * 0.1).toFixed(6)} USDT</b>\n` +
      `Duración: 20 días.\n\n` +
      `Ahora envía la <b>wallet BEP20</b> desde la que harás el depósito.`,
    { parse_mode: 'HTML' }
  )
})
      // ================== MENÚ: MINERÍA ==================
bot.action('menu_mineria', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  // Minería requiere 5 referidos válidos
  if ((u.refValidos || 0) < 5) {
    return sendMessage(
      ctx,
      `Necesitas 5 referidos válidos para activar la minería.\n` +
        `Referidos válidos actuales: ${u.refValidos}/5`
    )
  }

  const now = Date.now()
  const canClaim = now - (u.lastMine || 0) >= 24 * 3600 * 1000

  if (!canClaim) {
    return sendMessage(
      ctx,
      'Ya reclamaste minería hoy. Vuelve dentro de 24 horas.'
    )
  }

  return sendMessage(
    ctx,
    'Minería disponible: puedes reclamar <b>0.03 USDT</b> ahora.',
    {
      parse_mode: 'HTML',
      reply_markup: buildKeyboard([
        [{ text: 'RECLAMAR 0.03 USDT', callback_data: 'mine' }]
      ])
    }
  )
})

bot.action('mine', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  const now = Date.now()
  if (now - (u.lastMine || 0) < 24 * 3600 * 1000) {
    return sendMessage(ctx, 'Ya reclamaste hoy. Inténtalo mañana.')
  }

  // Recompensa de minería
  u.balance += 0.03
  u.lastMine = now
  saveDB()

  return sendMessage(
    ctx,
    '✔ <b>Has recibido 0.03 USDT</b> de minería.',
    { parse_mode: 'HTML' }
  )
})


// ================== MENÚ: GANANCIAS ==================
bot.action('menu_ganancias', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  let text =
    `<b>GANANCIAS TOTALES</b>\n\n` +
    `Balance disponible: <b>${u.balance.toFixed(6)} USDT</b>\n\n`

  if (u.planes.length === 0) {
    text += 'No tienes planes de staking activos.'
  } else {
    text += '<b>Planes de staking:</b>\n'
    u.planes.forEach((p, i) => {
      text += `\n#${i + 1} — ${p.amount} USDT\n` +
              `Diario: ${p.daily.toFixed(6)} USDT\n` +
              `Días cobrados: ${p.daysClaimed}/${p.durationDays}\n` +
              `Estado: ${p.active ? 'Activo ✅' : 'Finalizado ❌'}\n`
    })
  }

  const rows = []
  u.planes.forEach((p, i) => {
    if (p.active) {
      rows.push([
        { text: `Recoger plan #${i + 1}`, callback_data: `collect_${i}` }
      ])
    }
  })

  return sendMessage(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: buildKeyboard(rows)
  })
})


// ================== RECOGER GANANCIA DIARIA DEL PLAN ==================
bot.action(/collect_(\d+)/, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)
  const idx = Number(ctx.match[1])

  if (!u.planes[idx]) {
    return sendMessage(ctx, 'Plan no encontrado.')
  }

  const p = u.planes[idx]
  const now = Date.now()

  if (!p.active) {
    return sendMessage(ctx, 'Este plan ya terminó sus 20 días.')
  }

  // Revisar si han pasado 24 horas
  if (p.lastClaimTime && now - p.lastClaimTime < 24 * 3600 * 1000) {
    return sendMessage(ctx, 'Aún no han pasado 24 horas desde tu último cobro.')
  }

  // Revisar si se agotaron los 20 días
  if (p.daysClaimed >= p.durationDays) {
    p.active = false
    saveDB()
    return sendMessage(ctx, 'Este plan ya completó los 20 días.')
  }

  // Añadir ganancia diaria
  u.balance += p.daily
  p.daysClaimed += 1
  p.lastClaimTime = now

  if (p.daysClaimed >= p.durationDays) {
    p.active = false
  }

  saveDB()

  return sendMessage(
    ctx,
    `✔ Recompensa del plan recibida:\n` +
      `+${p.daily.toFixed(6)} USDT\n` +
      `Día ${p.daysClaimed}/${p.durationDays} completado.`,
    { parse_mode: 'HTML' }
  )
})
    // ================== MENÚ: RETIRO ==================
bot.action('menu_retiro', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  if (u.balance < 1) {
    return sendMessage(
      ctx,
      `El mínimo de retiro es 1 USDT.\nTu balance actual: <b>${u.balance.toFixed(6)} USDT</b>`,
      { parse_mode: 'HTML' }
    )
  }

  // Inicio del flujo
  ctx.session.withdrawStep = 'amount'
  ctx.session.withdrawAmount = null
  ctx.session.withdrawWallet = null

  return sendMessage(
    ctx,
    '💸 <b>RETIRO</b>\n\nEscribe la cantidad que deseas retirar (en USDT):',
    { parse_mode: 'HTML' }
  )
})


// ================== CONFIRMAR RETIRO ==================
bot.action('confirm_withdraw', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  const amount = ctx.session?.withdrawAmount
  const walletTo = ctx.session?.withdrawWallet

  if (!amount || !walletTo) {
    return sendMessage(ctx, 'No hay datos de retiro pendientes.')
  }

  if (u.balance < amount) {
    return sendMessage(
      ctx,
      `Saldo insuficiente. Tu balance cambió.\nBalance actual: <b>${u.balance.toFixed(6)} USDT</b>`,
      { parse_mode: 'HTML' }
    )
  }

  await sendMessage(ctx, 'Procesando retiro en la blockchain...')

  try {
    // Enviar USDT automáticamente desde la wallet del bot
    const tx = await USDT.transfer(
      walletTo,
      ethers.parseUnits(amount.toFixed(6), 18)
    )
    await tx.wait()

    // Descontar del balance del usuario
    u.balance -= amount
    if (u.balance < 0) u.balance = 0
    saveDB()

    // Reset de la sesión de retiro
    ctx.session.withdrawAmount = null
    ctx.session.withdrawWallet = null
    ctx.session.withdrawStep = null

    await sendMessage(
      ctx,
      `✅ <b>RETIRO COMPLETADO</b>\n\n` +
        `Monto: <b>${amount.toFixed(6)} USDT</b>\n` +
        `Wallet: <code>${walletTo}</code>\n` +
        `Tx: https://bscscan.com/tx/${tx.hash}`,
      { parse_mode: 'HTML' }
    )

    return mainMenu(ctx)
  } catch (e) {
    console.error('Error en retiro automático:', e)
    return sendMessage(
      ctx,
      '❌ Error procesando el retiro.\nAsegúrate de que la wallet del bot tiene USDT y BNB para gas.',
      { parse_mode: 'HTML' }
    )
  }
})
  // ================== MENÚ: REFERIDOS ==================
bot.action('menu_referidos', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  // Obtener username del bot
  const me = await bot.telegram.getMe()
  const link = `https://t.me/${me.username}?start=${id}`

  let text =
    `<b>REFERIDOS</b>\n\n` +
    `Referidos totales: <b>${u.referidos}</b>\n` +
    `Referidos válidos: <b>${u.refValidos}</b>\n\n` +
    `<b>Tu enlace de invitación:</b>\n` +
    `<a href="${link}">${link}</a>\n\n` +
    `• Ganas <b>0.02 USDT</b> por cada invitado\n` +
    `• Un referido válido es aquel que invierte en un plan\n` +
    `• Necesitas 5 referidos válidos para activar la minería`

  return sendMessage(ctx, text, {
    parse_mode: 'HTML',
    reply_markup: buildKeyboard([])
  })
})


// ================== MARCAR REFERIDO COMO VÁLIDO ==================
// Esto se activa cuando el depósito se confirma y se activa el plan.
// De esta manera no se pierde ningún referido válido.
const marcarReferidoValido = (userId) => {
  const u = getUser(userId)
  const ref = u.inviter
  if (!ref || !users[ref]) return

  // Si este usuario YA era válido, no sumamos doble
  if (u.validRef) return

  u.validRef = true
  users[ref].refValidos += 1
  saveDB()

  bot.telegram
    .sendMessage(
      ref,
      `🎉 Tu referido ha invertido.\nReferido válido +1\nVálidos totales: ${users[ref].refValidos}`
    )
    .catch(() => {})
      }
  // ================== CONFIRMAR DEPÓSITO (BOTÓN) ==================
bot.action('confirm_deposit', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  const id = ctx.from.id.toString()
  const u = getUser(id)

  if (!u.pendingDeposit) {
    return sendMessage(ctx, 'No tienes ningún depósito pendiente.')
  }

  return sendMessage(
    ctx,
    `🔎 Verificando depósito en blockchain...\n\n` +
      `Plan: <b>${u.pendingDeposit.planAmount} USDT</b>\n` +
      `Wallet del bot:\n<code>${BOT_WALLET}</code>\n\n` +
      `Si ya enviaste el pago, espera unos segundos.`,
    { parse_mode: 'HTML' }
  )
})


// ================== DETECTOR AUTOMÁTICO DE DEPÓSITOS ==================
let lastBlock = 0

setInterval(async () => {
  try {
    const block = await provider.getBlockNumber()
    if (block <= lastBlock) return
    lastBlock = block

    const blockData = await provider.getBlock(block, true)
    if (!blockData || !blockData.transactions) return

    for (const tx of blockData.transactions) {
      // Solo analizamos transacciones hacia la wallet del bot
      if (!tx.to) continue
      if (tx.to.toLowerCase() !== BOT_WALLET.toLowerCase()) continue

      // Es transferencia USDT BEP20 (función transfer)
      if (!tx.data || tx.data.slice(0, 10) !== '0xa9059cbb') continue

      // Extraer datos
      const receptor = '0x' + tx.data.slice(34, 74)
      const amountHex = '0x' + tx.data.slice(74)
      const amount = Number(ethers.formatUnits(amountHex, 18))

      // Validar que el usuario existe
      const userId = Object.keys(users).find(
        (k) => users[k].wallet?.toLowerCase() === receptor.toLowerCase()
      )
      if (!userId) continue

      const u = users[userId]
      if (!u.pendingDeposit) continue

      // Debe coincidir con el plan que el usuario seleccionó
      if (amount !== u.pendingDeposit.planAmount) continue

      // Activar plan
      const daily = amount * 0.1

      u.planes.push({
        amount,
        daily,
        lastClaimTime: 0,
        daysClaimed: 0,
        durationDays: 20,
        active: true,
        start: Date.now()
      })

      // Marcar al usuario como referido válido
      marcarReferidoValido(userId)

      // Limpiar depósito pendiente
      u.pendingDeposit = null
      saveDB()

      // Notificar al usuario
      bot.telegram
        .sendMessage(
          userId,
          `🎉 <b>Depósito confirmado</b>\n` +
            `Plan activado: <b>${amount} USDT</b>\n` +
            `Ganancia diaria: <b>${daily.toFixed(6)} USDT</b>\n` +
            `Duración: 20 días.`,
          { parse_mode: 'HTML' }
        )
        .catch(() => {})
    }
  } catch (err) {
    console.error('Error al verificar depósitos:', err)
  }
}, 8000)
    // ================== MENÚ: SOPORTE ==================
bot.action('menu_soporte', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})

  return sendMessage(
    ctx,
    '📞 <b>Soporte oficial</b>\n\n' +
      'Para cualquier duda o ayuda, escribe aquí:\n\n' +
      '<b>@StankingMiner</b>',
    {
      parse_mode: 'HTML',
      reply_markup: buildKeyboard([])
    }
  )
})


// ================== BOTÓN REGRESAR (FALLBACK) ==================
bot.action(/regresar|volver|atras/i, async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})
  return mainMenu(ctx)
})


// ================== CALLBACKS DESCONOCIDOS ==================
bot.on('callback_query', async (ctx) => {
  try {
    const data = ctx.callbackQuery.data

    // Si ya existe un handler específico, no intervenir
    const allowed = [
      'menu_principal',
      'menu_staking',
      'menu_mineria',
      'menu_ganancias',
      'menu_retiro',
      'menu_referidos',
      'menu_soporte',
      'confirm_deposit',
      'confirm_withdraw',
      'mine'
    ]

    if (
      allowed.includes(data) ||
      data.startsWith('select_plan_') ||
      data.startsWith('collect_')
    ) {
      return
    }

    // Si llega un callback desconocido → no romper el bot
    await ctx.answerCbQuery('⚠️ Acción no válida', { show_alert: false })
  } catch (e) {
    console.error('Error en callback desconocido:', e)
  }
})


// ================== MENSAJE POR DEFECTO ==================
bot.on('message', (ctx) => {
  // Evitar que mensajes de texto rompan la sesión
  if (!ctx.session) ctx.session = {}
})
  // ================== GANANCIAS AUTOMÁTICAS (cada minuto) ==================
setInterval(() => {
  let cambios = false
  const ahora = Date.now()

  for (const id in users) {
    const u = users[id]
    if (!u.planes) continue

    u.planes.forEach((p) => {
      if (!p.active) return

      // Ganancia cada 24 horas EXACTO
      if (!p.lastClaimTime || ahora - p.lastClaimTime >= 24 * 3600 * 1000) {
        // NO reclamamos automático, eso lo hace el usuario.
        // Solo verificamos si ya no queda duración.
        const diasTranscurridos = Math.floor((ahora - p.start) / (24 * 3600 * 1000))

        if (diasTranscurridos >= p.durationDays) {
          p.active = false
          cambios = true
        }
      }
    })
  }

  if (cambios) saveDB()
}, 60 * 1000)


// ================== INICIO DEL BOT ==================
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    bot.telegram.getMe().then((info) => {
      console.log(`🤖 BOT ENCENDIDO: @${info.username}`)
      console.log(`📥 Wallet del bot: ${BOT_WALLET}`)
      console.log(`⛓ RPC conectado: ${RPC_URL}`)
      console.log('🔥 Sistema de staking y minería activo.')
    })
  })
  .catch((err) => {
    console.error('❌ Error al iniciar el bot:', err)
  })


// ================== MANEJO DE CIERRE ==================
process.once('SIGINT', () => {
  console.log('Bot apagado por SIGINT')
  bot.stop('SIGINT')
})
process.once('SIGTERM', () => {
  console.log('Bot apagado por SIGTERM')
  bot.stop('SIGTERM')
})
      
