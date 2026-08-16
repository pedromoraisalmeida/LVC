console.log("✅ SummerCup App iniciada");

// Variáveis de ambiente (hardcoded por agora)
//const supabaseUrl = 'https://nthbfuqptsahmhtlqymd.supabase.co'
//const supabaseKey = 'sb_publishable_wxDX9GFgki2I701eWa5hNQ_kHbV4f5X' // Cole a chave completa aqui
const supabaseUrl = window.ENV?.SUPABASE_URL || ''
const supabaseKey = window.ENV?.SUPABASE_KEY || ''

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

// ============= GRUPO 1: TEAMS API (TESTES) =============

// Testar getMyTeams
window.testGetMyTeams = async function() {
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      alert("❌ Utilizador não autenticado. Faz login primeiro.")
      return
    }

    const { data, error } = await supabaseClient
      .from('user_teams')
      .select(`
        team_id,
        role,
        teams:team_id (
          id,
          name,
          escalao,
          descricao,
          ativo
        )
      `)
      .eq('user_id', user.id)

    if (error) throw error

    console.log("✅ Minhas equipas:", data)
    alert(`✅ Encontradas ${data.length} equipa(s)!`)
  } catch (error) {
    console.error("❌ Erro:", error.message)
    alert(`❌ Erro: ${error.message}`)
  }
}

// Testar getTeamInfo (simplificado)
window.testGetTeamInfo = async function() {
  const teamId = prompt("Introduz o UUID da equipa (ou leave empty para usar UUID exemplo):")
  const id = teamId || '2287a93d-ccd0-4af6-85ea-89bd0e20f658'

  try {
    // Query 1: Get team info
    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select('id, name, escalao, descricao, ativo, criado_em')
      .eq('id', id)
      .single()

    if (teamError) throw teamError

    // Query 2: Get team members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('user_teams')
      .select(`
        user_id,
        role,
        users (
          id,
          email,
          nome,
          numero,
          posicao
        )
      `)
      .eq('team_id', id)

    if (membersError) throw membersError

    console.log("✅ Info da equipa:", teamData)
    console.log("✅ Membros:", membersData)
    alert(`✅ Equipa "${teamData.name}" (${teamData.escalao}) - ${membersData.length} membros`)
  } catch (error) {
    console.error("❌ Erro:", error.message)
    alert(`❌ Erro: ${error.message}`)
  }
}

// ============= EVENTOS API (TESTES) =============

// Função global para testar Events API
window.testEventsAPI = async function() {
  const teamUUID = prompt("Introduz o UUID da equipa (ou leave empty para usar UUID exemplo):")
  const id = teamUUID || '2287a93d-ccd0-4af6-85ea-89bd0e20f658'

  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('id, tipo, data, hora, local, oponente, descricao')
      .eq('team_id', id)
      .order('data', { ascending: true })

    if (error) throw error

    console.log("✅ Events carregados:", data)
    alert(`✅ API funcionando! ${data.length} evento(s) encontrado(s).`)
  } catch (error) {
    console.error("❌ Erro:", error.message)
    alert(`❌ Erro: ${error.message}`)
  }
}