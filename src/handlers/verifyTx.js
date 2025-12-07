import axios from "axios";

const BSCSCAN = "https://api.bscscan.com/api";

// Validación segura de variables de entorno
const TOKEN_CONTRACT = (process.env.TOKEN_CONTRACT || "").toLowerCase();
const BOT_WALLET = (process.env.BOT_WALLET_ADDRESS || "").toLowerCase();
const API_KEY = process.env.BSCSCAN_API_KEY;

export default async function verifyTx(txhash, amountRequired) {
  try {
    if (!txhash || txhash.length < 20) {
      return { ok: false, error: "TXHASH inválido o vacío." };
    }

    // 🔥 LLAMADA CORRECTA A BSCSCAN EN MODO ESM
    const response = await axios.get(BSCSCAN, {
      params: {
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash,
        apikey: API_KEY
      }
    });

    const data = response.data;

    if (!data || !data.result) {
      return { ok: false, error: "Transacción no encontrada." };
    }

    const tx = data.result;

    // 🔥 COMPARACIÓN CORREGIDA: tx.to puede venir en null al inicio
    if (!tx.to || tx.to.toLowerCase() !== TOKEN_CONTRACT) {
      return { ok: false, error: "La transacción NO es USDT-BEP20." };
    }

    // Decodificación del input
    const inputData = tx.input || "";
    if (inputData.length < 138) {
      return { ok: false, error: "Datos incompletos en la transacción." };
    }

    // Dirección destino dentro del input (transfer)
    const destination = "0x" + inputData.slice(10 + 64 - 40, 10 + 64);

    if (destination.toLowerCase() !== BOT_WALLET) {
      return { ok: false, error: "El depósito NO fue enviado al bot." };
    }

    // Monto enviado
    const amountHex = inputData.slice(-64);
    const amount = parseInt(amountHex, 16) / 1e18;

    if (amount < amountRequired) {
      return { ok: false, error: "Monto insuficiente." };
    }

    return { ok: true, amount, wallet: destination };
  } catch (e) {
    console.log("Error verificando TX:", e.message);
    return { ok: false, error: "Error interno verificando la transacción." };
  }
}
