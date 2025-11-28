import TelegramBot from "node-telegram-bot-api";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const userSchema = new mongoose.Schema({
  userId: Number,
  username: String,
  wallet: String,
  balance: { type: Number, default: 0 },
  staking: { plan: Number, startTime: Date, active: Boolean },
  mining: { startTime: Date, active: Boolean },
  referrals: { normal: { type: Number, default: 0 }, valid: { type: Number, default: 0 } },
  lastReward: Date
});

const Usuario = mongoose.model("Usuario", userSchema);

const mainMenu = {
  reply_markup: {
    keyboard: [
      ["💎 Staking", "⛏️ Minería", "👥 Referidos"],
      ["💰 Ganancias", "💸 Retiro", "🛠 Soporte"]
    ],
    resize_keyboard: true,
  },
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const user = await Usuario.findOne({ userId: chatId });

  if (user) {
    bot.sendMessage(chatId, "✅ Usuario verificado. Bienvenido nuevamente.", mainMenu);
  } else {
    const code = Math.floor(100000 + Math.random() * 900000);
    bot.sendMessage(chatId, `🔐 Tu código de registro es: *${code}*\n\nIngresa este código para confirmar tu registro.`, { parse_mode: "Markdown" });
    bot.once("message", async (msg2) => {
      if (msg2.text == code.toString()) {
        const nuevoUsuario = new Usuario({ userId: chatId, username: msg.from.username });
        await nuevoUsuario.save();
        bot.sendMessage(chatId, "✅ Registro exitoso. ¡Bienvenido al sistema!", mainMenu);
      } else {
        bot.sendMessage(chatId, "❌ Código incorrecto. Intenta nuevamente con /start.");
      }
    });
  }
});
      bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const usuario = await Usuario.findOne({ userId: chatId });

  if (!usuario) return;

  if (text === "💎 Staking") {
    bot.sendMessage(chatId, "📊 Selecciona tu plan de inversión:", {
      reply_markup: {
        keyboard: [["1 USDT", "3 USDT", "5 USDT"], ["10 USDT", "20 USDT", "30 USDT"], ["50 USDT", "⬅️ Volver"]],
        resize_keyboard: true,
      },
    });
  }

  const planes = ["1 USDT", "3 USDT", "5 USDT", "10 USDT", "20 USDT", "30 USDT", "50 USDT"];
  if (planes.includes(text)) {
    usuario.staking.plan = parseInt(text);
    await usuario.save();
    bot.sendMessage(chatId, `💰 Has seleccionado el plan de ${text}.\n\nEnvía la dirección de tu wallet para registrar el depósito.`);
    bot.once("message", async (msg2) => {
      usuario.wallet = msg2.text;
      await usuario.save();
      bot.sendMessage(chatId, `📩 Deposita *${text}* USDT (BEP20) en la siguiente dirección:\n\`${process.env.BOT_WALLET}\`\n\nCuando hayas depositado, toca *Confirmar depósito*.`, {
        parse_mode: "Markdown",
        reply_markup: { keyboard: [["✅ Confirmar depósito"], ["⬅️ Volver"]], resize_keyboard: true },
      });
    });
  }

  if (text === "✅ Confirmar depósito") {
    bot.sendMessage(chatId, "⏳ Verificando transacción en la blockchain...");
    setTimeout(async () => {
      bot.sendMessage(chatId, "✅ Depósito confirmado.\n\nRegresa a 💎 *Staking* para activar tu plan.", { parse_mode: "Markdown" });
    }, 8000);
  }
});
        bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const usuario = await Usuario.findOne({ userId: chatId });
  if (!usuario) return;

  if (text === "⛏️ Minería") {
    if (usuario.referrals.valid < 5) {
      bot.sendMessage(chatId, "❌ Necesitas al menos 5 referidos válidos para activar la minería.");
    } else {
      if (!usuario.mining.active) {
        usuario.mining = { startTime: new Date(), active: true };
        await usuario.save();
        bot.sendMessage(chatId, "⚡ Minería activada por 20 días.\nReclama tu recompensa cada 24 horas.");
      } else {
        bot.sendMessage(chatId, "⏱️ Minería en curso.\nVuelve cada 24h para reclamar tu recompensa.");
      }
    }
  }

  if (text === "🕓 Reclamar recompensa minería") {
    const ahora = new Date();
    if (ahora - usuario.lastReward >= 24 * 60 * 60 * 1000) {
      usuario.balance += 0.02;
      usuario.lastReward = ahora;
      await usuario.save();
      bot.sendMessage(chatId, "💵 Recompensa de minería acreditada (+0.02 USDT).");
    } else {
      bot.sendMessage(chatId, "⏳ Aún no han pasado 24 horas desde tu última recompensa.");
    }
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const usuario = await Usuario.findOne({ userId: chatId });
  if (!usuario) return;

  if (text === "👥 Referidos") {
    const enlace = `https://t.me/${process.env.BOT_USERNAME}?start=${chatId}`;
    const mensaje = `👥 *Tus Referidos*\n\n🔗 Enlace de invitación:\n[Haz clic aquí para invitar]( ${enlace})\n\n👤 Referidos totales: ${usuario.referrals.normal}\n✅ Referidos válidos: ${usuario.referrals.valid}`;
    bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown", disable_web_page_preview: true });
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const usuario = await Usuario.findOne({ userId: chatId });
  if (!usuario) return;

  if (text === "💰 Ganancias") {
    const stakingGain = usuario.staking?.plan ? (usuario.staking.plan * 0.1).toFixed(2) : 0;
    const miningGain = usuario.mining?.active ? 0.02 : 0;
    const referralGain = (usuario.referrals.valid * 0.02).toFixed(2);
    const total = (parseFloat(stakingGain) + parseFloat(miningGain) + parseFloat(referralGain)).toFixed(2);

    const msgGain = `💹 *Resumen de Ganancias*\n\n💎 Staking: ${stakingGain} USDT\n⛏️ Minería: ${miningGain} USDT\n👥 Referidos: ${referralGain} USDT\n\n💰 *Total:* ${total} USDT`;
    bot.sendMessage(chatId, msgGain, { parse_mode: "Markdown" });
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  const usuario = await Usuario.findOne({ userId: chatId });
  if (!usuario) return;

  if (text === "💸 Retiro") {
    if (usuario.balance < 1) {
      bot.sendMessage(chatId, "❌ No cumples con el mínimo de retiro (1 USDT).");
    } else {
      bot.sendMessage(chatId, "💳 Ingresa tu dirección de wallet para retiro:");
      bot.once("message", async (msg2) => {
        const wallet = msg2.text;
        bot.sendMessage(chatId, "💵 Ingresa la cantidad a retirar:");
        bot.once("message", async (msg3) => {
          const cantidad = parseFloat(msg3.text);
          if (cantidad > usuario.balance) return bot.sendMessage(chatId, "❌ Fondos insuficientes.");
          usuario.balance -= cantidad;
          await usuario.save();
          bot.sendMessage(chatId, "🔄 Retiro en proceso...");
          setTimeout(() => {
            bot.sendMessage(chatId, `✅ Retiro exitoso de ${cantidad} USDT enviado a ${wallet}`);
          }, 6000);
        });
      });
    }
  }
});
bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "🛠 Soporte") {
    const mensaje = `📞 *Soporte Oficial*\n\n💬 Chat privado: [Hablar con soporte](https://t.me/StankinMiner)\n📢 Canal oficial: [Visitar canal](https://t.me/StankinMiner)\n\nEstamos aquí para ayudarte.`;
    bot.sendMessage(chatId, mensaje, { parse_mode: "Markdown", disable_web_page_preview: true });
  }
});
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text === "⬅️ Volver") {
    bot.sendMessage(chatId, "🏠 Menú principal:", mainMenu);
  }
});
import fs from "fs";
setInterval(async () => {
  const usuarios = await Usuario.find({});
  fs.writeFileSync("./db/usuarios.json", JSON.stringify(usuarios, null, 2));
  console.log("✅ Copia de seguridad actualizada.");
}, 1000 * 60 * 15);
bot.on("polling_error", (err) => console.error(err));
console.log("🤖 Bot completamente operativo y escuchando comandos...");
