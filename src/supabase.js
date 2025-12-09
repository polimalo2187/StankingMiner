// src/supabase.js
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ ERROR: Variables de entorno de Supabase no configuradas.");
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

console.log("📦 Supabase conectado correctamente");
