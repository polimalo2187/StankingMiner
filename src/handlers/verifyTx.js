import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const BSCSCAN = "https://api.bscscan.com/api";
const TOKEN_CONTRACT = process.env.TOKEN_CONTRACT; // USDT BEP20
const BOT_WALLET = process.env.BOT_WALLET.toLowerCase();

// Función principal
export default async function verifyTx(txhash, amountRequired) {
  try {
    if (!txhash || txhash.length < 20) {
      return { ok: false, error: "TXHASH inválido o vacío." };
    }

    // Obtener datos de la transacción
    const { data } = await axios.get(BSCSCAN, {
      params: {
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash,
        apikey: process.env.BSCSCAN_API_KEY,
      }
    });

    if (!data.result) {
      return { ok: false, error: "Transacción no encontrada en BSCScan." };
    }

    const tx = data.result;

    // Confirmar que fue enviado a contrato USDT
    if (tx.to.toLowerCase() !== TOKEN_CONTRACT.toLowerCase()) {
      return { ok: false, error: "La transacción no es USDT-BEP20." };
    }

    // Analizar datos del input
    const inputData = tx.input.toLowerCase();

    // Extraer wallet destino (últimos 40 caracteres antes del monto)
    const destination = "0x" + inputData.slice(10 + 64 - 40, 10 + 64);

    if (destination.toLowerCase() !== BOT_WALLET) {
      return { ok: false, error: "El depósito NO fue enviado a la wallet del bot." };
    }

    // Extraer monto (últimos 64 chars)
    const amountHex = inputData.slice(-64);
    const amount = parseInt(amountHex, 16) / 1e18;

    if (amount < amountRequired) {
      return { ok: false, error: "Monto insuficiente para activar el plan." };
    }

    return {
      ok: true,
      amount: amount,
      wallet: destination
    };

  } catch (e) {
    console.log("Error verificando TX:", e);
    return { ok: false, error: "Error interno verificando la transacción." };
  }
}
