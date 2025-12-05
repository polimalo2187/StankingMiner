import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

// Validación de variables (opcional pero útil)
if (!process.env.SUPABASE_URL) {
  throw new Error("❌ ERROR: Falta SUPABASE_URL en variables de entorno.");
}

if (!process.env.SUPABASE_KEY) {
  throw new Error("❌ ERROR: Falta SUPABASE_KEY en variables de entorno.");
}

// Crear cliente Supabase
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

console.log("📦 Supabase conectado correctamente");
