import { supabase, getEvents } from './api.js'

console.log("✅ SummerCup App iniciada");

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

console.log("Supabase URL:", supabaseUrl ? "✅" : "❌")
console.log("Supabase Key:", supabaseKey ? "✅" : "❌")

// Função global para testar Supabase
window.testConnection = function() {
  if (supabaseUrl && supabaseKey) {
    alert("✅ Supabase configurado com sucesso!")
  } else {
    alert("❌ Variáveis Supabase não encontradas.")
  }
}

// Função global para testar Events API
window.testEventsAPI = async function() {
  const teamUUID = '2287a93d-ccd0-4af6-85ea-89bd0e20f658' // Substitui com UUID real
  const result = await getEvents(teamUUID)
  
  if (result.success) {
    console.log("✅ Events carregados:", result.data)
    alert(`✅ API funcionando! ${result.data.length} eventos encontrados.`)
  } else {
    console.error("❌ Erro:", result.error)
    alert(`❌ Erro na API: ${result.error}`)
  }
}