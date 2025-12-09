import axios from "axios";

const BSCSCAN = "https://api.bscscan.com/api";
const TOKEN_CONTRACT = process.env.TOKEN_CONTRACT;
const BOT_WALLET = process.env.BOT_WALLET_ADDRESS
  ? process.env.BOT_WALLET_ADDRESS.toLowerCase()
  : null;

export default async function verifyTx(txhash, amountRequired) {
  try {
    // Validar que TX existe
    if (!txhash || txhash.length < 20) {
      return { ok: false, error: "TXHASH inválido o vacío." };
    }

    if (!TOKEN_CONTRACT) {
      return { ok: false, error: "TOKEN_CONTRACT no está configurado." };
    }

    if (!BOT_WALLET) {
      return { ok: false, error: "BOT_WALLET_ADDRESS no está configurado." };
    }

    // Solicitud a BSCscan
    const { data } = await axios.get(BSCSCAN, {
      params: {
        module: "proxy",
        action: "eth_getTransactionByHash",
        txhash,
        apikey: process.env.BSCSCAN_API_KEY
      }
    });

    // Validar respuesta
    if (!data.result) {
      return { ok: false, error: "Transacción no encontrada." };
    }

    const tx = data.result;

    // Validar tx.to
    if (!tx.to) {
      return { ok: false, error: "La transacción no tiene destinatario (to)." };
    }

    // Validar que es USDT-BEP20
    if (tx.to.toLowerCase() !== TOKEN_CONTRACT.toLowerCase()) {
      return { ok: false, error: "La transacción NO es USDT-BEP20." };
    }

    // Validar input
    if (!tx.input || tx.input.length < 138) {
      return { ok: false, error: "La transacción no contiene datos suficientes." };
    }

    const inputData = tx.input.toLowerCase();

    // Extraer wallet destino — método transfer (_to, _value)
    const destination = "0x" + inputData.slice(10 + 64 - 40, 10 + 64);

    if (destination.toLowerCase() !== BOT_WALLET) {
      return { ok: false, error: "El depósito NO fue enviado al bot." };
    }

    // Extraer monto
    const amountHex = inputData.slice(-64);
    const amount = parseInt(amountHex, 16) / 1e18;

    if (isNaN(amount)) {
      return { ok: false, error: "Error leyendo monto de la transacción." };
    }

    if (amount < amountRequired) {
      return { ok: false, error: "Monto insuficiente." };
    }

    // Todo OK
    return { ok: true, amount, wallet: destination };

  } catch (e) {
    console.error("Error verificando TX:", e);
    return { ok: false, error: "Error interno verificando la transacción." };
  }
}
