import { supabase } from "../supabase.js";
import Web3 from "web3";

const web3 = new Web3(process.env.BSC_NODE);

// Dirección donde los usuarios deben depositar:
const BOT_WALLET = process.env.BOT_WALLET_ADDRESS;

// Contrato USDT BEP-20
const TOKEN_CONTRACT = process.env.TOKEN_CONTRACT;

// ABI mínimo para balanceOf y transfer
const MIN_ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  }
];

export default {
  command: "deposit",
  handler: async (ctx) => {
    try {
      const userId = ctx.from.id;

      // 1️⃣ Obtener datos del usuario
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (error || !user) {
        return ctx.reply("❌ No pudimos encontrar tu cuenta. Usa /start primero.");
      }

      // 2️⃣ Mostrar dirección del bot donde debe depositar
      await ctx.reply(
        "💰 *DEPÓSITOS USDT (BEP-20)*\n\n" +
        "Envía cualquier cantidad a esta dirección:\n\n" +
        `\`${BOT_WALLET}\`\n\n` +
        "Después de enviar, presiona el botón *Verificar Depósito*.",
        {
          parse_mode: "Markdown",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "🔍 Verificar Depósito", callback_data: "verify_deposit" }
              ]
            ]
          }
        }
      );
    } catch (e) {
      console.error("Error en deposit handler:", e);
      ctx.reply("⚠️ Ocurrió un error interno. Intenta más tarde.");
    }
  },

  callback: async (ctx) => {
    try {
      if (ctx.callbackQuery.data !== "verify_deposit") return;

      const userId = ctx.from.id;

      // 1️⃣ Leer último hash del usuario (si ya verificó antes)
      const { data: record } = await supabase
        .from("deposits")
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(1)
        .single();

      // 2️⃣ Buscar transacción nueva en la blockchain
      const latestTx = await findTxToBot(userId);

      if (!latestTx) {
        return ctx.reply("❌ No se encontró ningún depósito reciente hacia el bot.\n\nAsegúrate de enviar a:\n`" + BOT_WALLET + "`", { parse_mode: "Markdown" });
      }

      // 3️⃣ Guardar registro del depósito
      await supabase.from("deposits").insert({
        user_id: userId,
        amount: latestTx.amount,
        tx_hash: latestTx.hash,
        confirmed: true
      });

      // 4️⃣ Sumar balance al usuario automáticamente
      await supabase
        .from("users")
        .update({
          balance: (record?.balance || 0) + latestTx.amount
        })
        .eq("user_id", userId);

      ctx.reply(
        `✅ *Depósito recibido*\n\n` +
        `Monto: *${latestTx.amount} USDT*\n` +
        `Hash: \`${latestTx.hash}\``,
        { parse_mode: "Markdown" }
      );
    } catch (e) {
      console.error("Error verificando depósito:", e);
      ctx.reply("⚠️ No se pudo verificar el depósito.");
    }
  }
};

// Función para buscar depósitos entrantes a la wallet del bot
async function findTxToBot(userId) {
  try {
    const apiKey = process.env.BSCSCAN_API_KEY;

    const url =
      `https://api.bscscan.com/api?module=account&action=tokentx&address=${BOT_WALLET}&contractaddress=${TOKEN_CONTRACT}&apikey=${apiKey}`;

    const res = await fetch(url);
    const data = await res.json();

    if (!data.result || !Array.isArray(data.result)) return null;

    // Última transacción válida
    const tx = data.result[0];

    if (!tx) return null;

    // Validar que fue hacia el bot
    if (tx.to.toLowerCase() !== BOT_WALLET.toLowerCase()) return null;

    const amount = Number(tx.value) / 1e18;

    return {
      amount,
      hash: tx.hash
    };
  } catch (e) {
    console.error("Error en findTxToBot:", e);
    return null;
  }
        }
