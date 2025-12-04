import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const BSCSCAN = "https://api.bscscan.com/api";
const TOKEN_CONTRACT = process.env.TOKEN_CONTRACT;
const BOT_WALLET = process.env.BOT_WALLET_ADDRESS.toLowerCase();

export default async function verifyTx(txhash, amountRequired) {
  try {
    if (!txhash || txhash.length < 20) {
      return { ok: false, error: "TXHASH inválido o vacío." };
    }

    const { data } = await axios.get(BSCSCAN, {
      params: {
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash,
        apikey: process.env.BSCSCAN_API_KEY
      }
    });

    if (!data.result) {
      return { ok: false, error: "Transacción no encontrada." };
    }

    const tx = data.result;

    if (tx.to.toLowerCase() !== TOKEN_CONTRACT.toLowerCase()) {
      return { ok: false, error: "La transacción NO es USDT-BEP20." };
    }

    const inputData = tx.input.toLowerCase();
    const destination = "0x" + inputData.slice(10 + 24, 10 + 64);

    if (destination.toLowerCase() !== BOT_WALLET) {
      return { ok: false, error: "El depósito NO fue enviado a la wallet del bot." };
    }

    const amountHex = inputData.slice(-64);
    const amount = parseInt(amountHex, 16) / 1e18;

    if (amount < amountRequired) {
      return { ok: false, error: "Monto insuficiente." };
    }

    return { ok: true, amount, wallet: destination };

  } catch (error) {
    console.log("Error verificando TX:", error);
    return { ok: false, error: "Error interno verificando la transacción." };
  }
}
