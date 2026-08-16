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
let userTeams = []
let selectedTeam = null

// ============= AUTENTICAÇÃO =============

// Inicializar app - verificar se já há utilizador autenticado
async function initApp() {
  try {
    const { data: { user }, error } = await supabaseClient.auth.getUser()

    if (user) {
      currentUser = user
      showDashboard()
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
        showDashboard()
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

// ============= NAVEGAÇÃO =============

// Mostrar Dashboard
async function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('dashboardScreen').style.display = 'flex'
  document.getElementById('calendarScreen').style.display = 'none'

  if (currentUser) {
    document.getElementById('userEmail').textContent = currentUser.email
  }

  // Carregar equipas
  await loadUserTeams()
}

// Mostrar Calendário
async function showCalendar(teamId) {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('dashboardScreen').style.display = 'none'
  document.getElementById('calendarScreen').style.display = 'flex'

  selectedTeam = teamId
  const team = userTeams.find(t => t.team_id === teamId)
  if (team) {
    document.getElementById('teamName').textContent = team.team.name
  }

  // Carregar eventos
  await loadTeamEvents(teamId)
}

// Voltar ao Dashboard
function goToDashboard() {
  showDashboard()
}

// Carregar equipas do utilizador
async function loadUserTeams() {
  try {
    const teamsContainer = document.getElementById('teamsContainer')
    teamsContainer.innerHTML = '<p class="loading">Carregando equipas...</p>'

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) throw new Error('Utilizador não autenticado')

    // Query 1: Get user_teams associations
    const { data: userTeamsData, error: userTeamsError } = await supabaseClient
      .from('user_teams')
      .select('team_id, role')
      .eq('user_id', user.id)

    if (userTeamsError) throw userTeamsError

    if (userTeamsData.length === 0) {
      teamsContainer.innerHTML = '<p class="loading">Nenhuma equipa associada</p>'
      return
    }

    // Query 2: Get team details
    const teamIds = userTeamsData.map(ut => ut.team_id)
    const { data: teamsData, error: teamsError } = await supabaseClient
      .from('teams')
      .select('id, name, escalao, descricao, ativo')
      .in('id', teamIds)

    if (teamsError) throw teamsError

    // Combinar dados
    userTeams = userTeamsData.map(ut => ({
      team_id: ut.team_id,
      role: ut.role,
      team: teamsData.find(t => t.id === ut.team_id)
    }))

    // Render teams
    teamsContainer.innerHTML = userTeams.map(ut => `
      <div class="team-card">
        <h3>${ut.team.name}</h3>
        <span class="team-badge">${ut.team.escalao}</span>
        <div class="team-info">
          <div><strong>Papel:</strong> ${ut.role}</div>
          <div><strong>Status:</strong> ${ut.team.ativo ? '✅ Ativo' : '❌ Inativo'}</div>
        </div>
        <button class="btn-select" onclick="showCalendar('${ut.team_id}')">Ver Eventos</button>
      </div>
    `).join('')
  } catch (error) {
    console.error('❌ Erro ao carregar equipas:', error.message)
    document.getElementById('teamsContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Carregar eventos da equipa
async function loadTeamEvents(teamId) {
  try {
    const eventsContainer = document.getElementById('eventsContainer')
    eventsContainer.innerHTML = '<p class="loading">Carregando eventos...</p>'

    const { data, error } = await supabaseClient
      .from('events')
      .select('id, tipo, data, hora, local, oponente, descricao')
      .eq('team_id', teamId)
      .order('data', { ascending: true })

    if (error) throw error

    if (data.length === 0) {
      eventsContainer.innerHTML = '<p class="loading">Nenhum evento agendado</p>'
      return
    }

    // Formatar e renderizar eventos
    const formatted = data.map(event => {
      const dataObj = new Date(event.data)
      const dataFormatada = dataObj.toLocaleDateString('pt-PT', {
        weekday: 'short',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })

      return `
        <div class="event-card">
          <div class="event-header">
            <span class="event-type ${event.tipo}">${event.tipo === 'treino' ? '🏋️ Treino' : '🎯 Jogo'}</span>
            <span class="event-date">${dataFormatada}</span>
          </div>
          <div class="event-details">
            <div><strong>Hora:</strong> ${event.hora || 'N/A'}</div>
            <div><strong>Local:</strong> ${event.local || 'N/A'}</div>
            ${event.descricao ? `<div><strong>Descrição:</strong> ${event.descricao}</div>` : ''}
          </div>
          ${event.oponente ? `<div class="event-opponent">vs ${event.oponente}</div>` : ''}
        </div>
      `
    }).join('')

    eventsContainer.innerHTML = formatted
  } catch (error) {
    console.error('❌ Erro ao carregar eventos:', error.message)
    document.getElementById('eventsContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
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

// Testar getMyTeams (2 queries separadas)
window.testGetMyTeams = async function() {
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) {
      alert("❌ Utilizador não autenticado. Faz login primeiro.")
      return
    }

    // Query 1: Get user_teams associations
    const { data: userTeamsData, error: userTeamsError } = await supabaseClient
      .from('user_teams')
      .select('team_id, role')
      .eq('user_id', user.id)

    if (userTeamsError) throw userTeamsError

    // Query 2: Get team details for each team_id
    if (userTeamsData.length === 0) {
      console.log("✅ Minhas equipas:", [])
      alert("✅ Nenhuma equipa associada")
      return
    }

    const teamIds = userTeamsData.map(ut => ut.team_id)
    const { data: teamsData, error: teamsError } = await supabaseClient
      .from('teams')
      .select('id, name, escalao, descricao, ativo')
      .in('id', teamIds)

    if (teamsError) throw teamsError

    // Combinar dados
    const myTeams = userTeamsData.map(ut => ({
      team_id: ut.team_id,
      role: ut.role,
      team: teamsData.find(t => t.id === ut.team_id)
    }))

    console.log("✅ Minhas equipas:", myTeams)
    alert(`✅ Encontradas ${myTeams.length} equipa(s)!`)
  } catch (error) {
    console.error("❌ Erro:", error.message)
    alert(`❌ Erro: ${error.message}`)
  }
}

// Testar getTeamInfo (simplificado - sem .single())
window.testGetTeamInfo = async function() {
  const teamId = prompt("Introduz o UUID da equipa (ou leave empty para usar UUID exemplo):")
  const id = teamId || '2287a93d-ccd0-4af6-85ea-89bd0e20f658'

  try {
    // Query 1: Get team info
    const { data: teamData, error: teamError } = await supabaseClient
      .from('teams')
      .select('id, name, escalao, descricao, ativo, criado_em')
      .eq('id', id)

    if (teamError) throw teamError
    if (!teamData || teamData.length === 0) throw new Error('Equipa não encontrada')

    const team = teamData[0]

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

    console.log("✅ Info da equipa:", team)
    console.log("✅ Membros:", membersData)
    alert(`✅ Equipa "${team.name}" (${team.escalao}) - ${membersData.length} membros`)
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