console.log("✅ Lousã Volei App iniciada");

// Variáveis de ambiente
const supabaseUrl = window.ENV?.SUPABASE_URL || ''
const supabaseKey = window.ENV?.SUPABASE_KEY || ''

console.log("Supabase URL:", supabaseUrl ? "✅" : "❌")
console.log("Supabase Key:", supabaseKey ? "✅" : "❌")

// Inicializar Supabase (via CDN)
const { createClient } = window.supabase
const supabaseClient = createClient(supabaseUrl, supabaseKey)

// Estado da app
let isSignUp = false
let currentUser = null

// ============= AUTENTICAÇÃO =============

// Inicializar app - verificar se já há utilizador autenticado
async function initApp() {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser()

    if (user) {
      currentUser = user
      showMainScreen()
    } else {
      showLoginScreen()
    }
  } catch (error) {
    console.error("Erro ao inicializar:", error.message)
    showLoginScreen()
  }
}

// Alternar entre Login e Signup
window.toggleAuthMode = function(e) {
  e.preventDefault()
  isSignUp = !isSignUp

  const authBtn = document.getElementById('authBtn')
  const toggleText = document.getElementById('toggleText')
  const form = document.getElementById('authForm')

  if (isSignUp) {
    authBtn.textContent = 'Criar Conta'
    toggleText.innerHTML = 'Já tens conta? <a href="#" onclick="toggleAuthMode(event)">Entrar</a>'
  } else {
    authBtn.textContent = 'Entrar'
    toggleText.innerHTML = 'Não tens conta? <a href="#" onclick="toggleAuthMode(event)">Criar nova</a>'
  }
}

// Gerir autenticação (login ou signup)
window.handleAuth = async function(e) {
  e.preventDefault()

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value
  const errorDiv = document.getElementById('authError')
  const successDiv = document.getElementById('authSuccess')
  const authBtn = document.getElementById('authBtn')

  errorDiv.style.display = 'none'
  successDiv.style.display = 'none'
  authBtn.disabled = true

  try {
    if (isSignUp) {
      // Signup
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password
      })

      if (error) throw error

      successDiv.textContent = '✅ Conta criada! Agora faz login.'
      successDiv.style.display = 'block'
      isSignUp = false
      document.getElementById('authForm').reset()

      setTimeout(() => {
        toggleAuthMode({ preventDefault: () => {} })
      }, 2000)
    } else {
      // Login
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      })

      if (error) throw error

      currentUser = data.user
      successDiv.textContent = '✅ Login realizado com sucesso!'
      successDiv.style.display = 'block'

      setTimeout(() => {
        showMainScreen()
      }, 1000)
    }
  } catch (error) {
    errorDiv.textContent = `❌ Erro: ${error.message}`
    errorDiv.style.display = 'block'
    console.error("Auth error:", error)
  } finally {
    authBtn.disabled = false
  }
}

// Logout
window.handleLogout = async function() {
  try {
    await supabaseClient.auth.signOut()
    currentUser = null
    showLoginScreen()
  } catch (error) {
    alert(`❌ Erro ao sair: ${error.message}`)
  }
}

// Mostrar tela de login
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex'
  document.getElementById('mainScreen').style.display = 'none'
  isSignUp = false
  document.getElementById('authForm').reset()
  document.getElementById('authBtn').textContent = 'Entrar'
}

// Mostrar tela principal
function showMainScreen() {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('mainScreen').style.display = 'block'

  if (currentUser) {
    document.getElementById('userEmail').textContent = currentUser.email
  }
}

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

// ============= INICIALIZAÇÃO =============
// Inicializa a app quando a página carrega
window.addEventListener('DOMContentLoaded', initApp)