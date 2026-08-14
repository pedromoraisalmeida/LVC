console.log("✅ SummerCup App iniciada");

// Variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

console.log("Supabase URL:", supabaseUrl ? "✅" : "❌");
console.log("Supabase Key:", supabaseKey ? "✅" : "❌");

// Função global (expõe no window para HTML onclick)
window.testConnection = function() {
  if (supabaseUrl && supabaseKey) {
    alert("✅ Supabase configurado com sucesso!");
    console.log("URL:", supabaseUrl);
  } else {
    alert("❌ Variáveis Supabase não encontradas. Configura no Vercel.");
  }
}