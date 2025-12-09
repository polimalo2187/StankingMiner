import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Validaciones de entorno
if (!SUPABASE_URL) {
  throw new Error("❌ ERROR: Falta SUPABASE_URL en variables de entorno.");
}

if (!SUPABASE_ANON_KEY) {
  throw new Error("❌ ERROR: Falta SUPABASE_ANON_KEY en variables de entorno.");
}

// Crear cliente de supabase
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("📦 Supabase conectado correctamente");
