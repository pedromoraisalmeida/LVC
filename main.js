console.log("✅ SummerCup App iniciada");

// Variáveis de ambiente (hardcoded por agora)
const supabaseUrl = 'https://nthbfuqptsahmhtlqymd.supabase.co'
const supabaseKey = 'sb_publishable_wxDX9GFgki2I701eWa5hNQ_kHbV4f5X' // Cole a chave completa aqui

console.log("Supabase URL:", supabaseUrl ? "✅" : "❌")
console.log("Supabase Key:", supabaseKey ? "✅" : "❌")

// Inicializar Supabase (via CDN)
const { createClient } = window.supabase
const supabaseClient = createClient(supabaseUrl, supabaseKey)

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
  
  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('team_id', teamUUID)
    
    if (error) throw error
    
    console.log("✅ Events carregados:", data)
    alert(`✅ API funcionando! ${data.length} eventos encontrados.`)
  } catch (error) {
    console.error("❌ Erro:", error.message)
    alert(`❌ Erro: ${error.message}`)
  }
}