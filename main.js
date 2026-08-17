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
let chatSubscription = null

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
  document.getElementById('eventDetailsScreen').style.display = 'none'
  document.getElementById('attendanceScreen').style.display = 'none'
  document.getElementById('standingsScreen').style.display = 'none'
  document.getElementById('chatScreen').style.display = 'none'
  document.getElementById('dmsScreen').style.display = 'none'

  selectedTeam = teamId
  const team = userTeams.find(t => t.team_id === teamId)
  if (team) {
    document.getElementById('teamName').textContent = team.team.name
  }

  // Carregar eventos
  await loadTeamEvents(teamId)

  // Adicionar botões de ação se não existirem
  const header = document.querySelector('#calendarScreen .header')

  if (!document.getElementById('dmsBtn')) {
    const dmsBtn = document.createElement('button')
    dmsBtn.id = 'dmsBtn'
    dmsBtn.className = 'btn-primary'
    dmsBtn.textContent = '✉️ DMs'
    dmsBtn.style.margin = '0 10px 0 0'
    dmsBtn.onclick = () => showDMs()
    header.appendChild(dmsBtn)
  }

  if (!document.getElementById('chatBtn')) {
    const chatBtn = document.createElement('button')
    chatBtn.id = 'chatBtn'
    chatBtn.className = 'btn-primary'
    chatBtn.textContent = '💬 Chat'
    chatBtn.style.margin = '0 10px 0 0'
    chatBtn.onclick = () => showChat()
    header.appendChild(chatBtn)
  }

  if (!document.getElementById('standingsBtn')) {
    const standingsBtn = document.createElement('button')
    standingsBtn.id = 'standingsBtn'
    standingsBtn.className = 'btn-primary'
    standingsBtn.textContent = '📊 Classificação'
    standingsBtn.style.margin = '0'
    standingsBtn.onclick = () => showStandings()
    header.appendChild(standingsBtn)
  }
}

// Voltar ao Dashboard
function goToDashboard() {
  showDashboard()
}

// Voltar ao Calendário
function goToCalendar() {
  showCalendar(selectedTeam)
}

// Mostrar detalhes do evento
async function showEventDetails(eventId) {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('dashboardScreen').style.display = 'none'
  document.getElementById('calendarScreen').style.display = 'none'
  document.getElementById('eventDetailsScreen').style.display = 'flex'

  await loadEventDetails(eventId)
}

// Mostrar Presenças
async function showAttendance(eventId) {
  document.getElementById('eventDetailsScreen').style.display = 'none'
  document.getElementById('attendanceScreen').style.display = 'flex'

  await loadAttendance(eventId)
}

// Mostrar Classificações
async function showStandings() {
  document.getElementById('calendarScreen').style.display = 'none'
  document.getElementById('standingsScreen').style.display = 'flex'

  await loadStandings(selectedTeam)
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

      const eventId = event.id
      return `
        <div class="event-card" data-event-id="${eventId}" style="cursor: pointer;">
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

    // Adicionar event listeners aos cards
    document.querySelectorAll('.event-card').forEach(card => {
      card.addEventListener('click', function() {
        const eventId = this.getAttribute('data-event-id')
        if (eventId) {
          showEventDetails(eventId)
        }
      })
    })
  } catch (error) {
    console.error('❌ Erro ao carregar eventos:', error.message)
    document.getElementById('eventsContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Carregar detalhes do evento
async function loadEventDetails(eventId) {
  try {
    const container = document.getElementById('eventDetailsContainer')
    container.innerHTML = '<p class="loading">Carregando...</p>'

    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single()

    if (error) throw error

    const event = data
    const dataObj = new Date(event.data)
    const dataFormatada = dataObj.toLocaleDateString('pt-PT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const typeDisplay = event.tipo === 'treino' ? '🏋️ Treino' : '🎯 Jogo'

    let html = `
      <span class="event-type ${event.tipo}">${typeDisplay}</span>
      <h2>${event.tipo === 'treino' ? 'Treino' : 'Jogo'}</h2>

      <div class="detail-section">
        <div class="detail-row">
          <label>Data</label>
          <value>${dataFormatada}</value>
        </div>
        <div class="detail-row">
          <label>Hora</label>
          <value>${event.hora || 'N/A'}</value>
        </div>
        <div class="detail-row">
          <label>Local</label>
          <value>${event.local || 'N/A'}</value>
        </div>
      </div>
    `

    if (event.oponente) {
      html += `
        <div class="detail-section">
          <div class="detail-row">
            <label>Adversário</label>
            <value>${event.oponente}</value>
          </div>
        </div>
      `
    }

    if (event.descricao) {
      html += `
        <div class="detail-section">
          <label>Descrição</label>
          <p style="margin-top: 10px; color: var(--text-light);">${event.descricao}</p>
        </div>
      `
    }

    if (event.sets_nós !== null && event.sets_oponente !== null) {
      const confirmed = event.resultado_confirmado ? '<span class="result-confirmed">✅ Confirmado</span>' : ''
      html += `
        <div class="detail-section">
          <h3>Resultado ${confirmed}</h3>
          <div class="result-section">
            <div class="sets-display">
              <div class="team-set">
                <div class="set-label">Nós</div>
                <div class="set-value">${event.sets_nós}</div>
              </div>
              <div class="set-divider">×</div>
              <div class="team-set">
                <div class="set-label">${event.oponente || 'Adversário'}</div>
                <div class="set-value">${event.sets_oponente}</div>
              </div>
            </div>
          </div>
        </div>
      `
    }

    html += `
      <div style="display: flex; gap: 10px; margin-top: 30px;">
        <button class="btn-primary" style="flex: 1;" onclick="showAttendance('${event.id}')">📋 Ver Presenças</button>
        <button class="btn-primary" style="flex: 1; background: var(--primary-dark);" onclick="goToCalendar()">← Voltar</button>
      </div>
    `

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar detalhes:', error.message)
    document.getElementById('eventDetailsContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
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

// Carregar presenças de um evento
async function loadAttendance(eventId) {
  try {
    const container = document.getElementById('attendanceContainer')
    container.innerHTML = '<p class="loading">Carregando presenças...</p>'

    // Get event details to show team members
    const { data: eventData, error: eventError } = await supabaseClient
      .from('events')
      .select('id, data, tipo, oponente')
      .eq('id', eventId)
      .single()

    if (eventError) throw eventError

    // Get team members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('user_teams')
      .select('user_id, users(id, email, nome, numero, posicao)')
      .eq('team_id', selectedTeam)

    if (membersError) throw membersError

    // Get attendances for this event
    const { data: attendanceData, error: attendanceError } = await supabaseClient
      .from('attendances')
      .select('user_id, status, justification_id')
      .eq('event_id', eventId)

    if (attendanceError) throw attendanceError

    // Get justifications
    const { data: justificationsData, error: justificationsError } = await supabaseClient
      .from('justifications')
      .select('id, tipo, descricao')

    if (justificationsError) throw justificationsError

    // Build attendance map
    const attendanceMap = {}
    attendanceData.forEach(a => {
      attendanceMap[a.user_id] = { status: a.status, justification_id: a.justification_id }
    })

    // Render attendance list
    const html = `
      <h2>${eventData.tipo === 'treino' ? '🏋️ Presenças - Treino' : '🎯 Presenças - Jogo'}</h2>
      <p style="color: var(--text-light); margin-bottom: 20px;">
        ${new Date(eventData.data).toLocaleDateString('pt-PT')} ${eventData.oponente ? `vs ${eventData.oponente}` : ''}
      </p>
      <div class="attendance-list">
        ${membersData.map(member => {
          const attendance = attendanceMap[member.user_id] || { status: 'não_marcado', justification_id: null }
          const justificationOptions = justificationsData.map(j =>
            `<option value="${j.id}" ${attendance.justification_id === j.id ? 'selected' : ''}>${j.tipo}</option>`
          ).join('')

          return `
            <div class="attendance-item">
              <div class="attendance-player">
                <div class="name">${member.users.nome || member.users.email}</div>
                <div class="position">${member.users.posicao || 'N/A'} #${member.users.numero || '-'}</div>
              </div>
              <div class="attendance-status">
                <button class="status-btn ${attendance.status === 'confirmado' ? 'active present' : ''}"
                  onclick="updateAttendance('${eventId}', '${member.user_id}', 'confirmado', null)">
                  ✅ Presente
                </button>
                <button class="status-btn ${attendance.status === 'ausente' ? 'active absent' : ''}"
                  onclick="updateAttendance('${eventId}', '${member.user_id}', 'ausente', null)">
                  ❌ Falta
                </button>
                <button class="status-btn ${attendance.status === 'justificado' ? 'active justified' : ''}"
                  onclick="updateAttendance('${eventId}', '${member.user_id}', 'justificado', null)">
                  📝 Justif.
                </button>
              </div>
              ${attendance.status === 'justificado' ? `
                <select onchange="updateAttendance('${eventId}', '${member.user_id}', 'justificado', this.value)"
                  style="margin-top: 10px; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                  <option value="">Escolher motivo...</option>
                  ${justificationOptions}
                </select>
              ` : ''}
            </div>
          `
        }).join('')}
      </div>
      <button class="btn-primary" onclick="goToCalendar()" style="margin-top: 30px;">← Voltar ao Calendário</button>
    `

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar presenças:', error.message)
    document.getElementById('attendanceContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Atualizar presença de um utilizador
async function updateAttendance(eventId, userId, status, justificationId) {
  try {
    // Check if attendance record exists
    const { data: existingData, error: checkError } = await supabaseClient
      .from('attendances')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', userId)

    if (checkError) throw checkError

    if (existingData && existingData.length > 0) {
      const existing = existingData[0]

      // Se clica no mesmo status (e sem justification), remove (DELETE)
      if (existing.status === status && !justificationId) {
        const { error: deleteError } = await supabaseClient
          .from('attendances')
          .delete()
          .eq('event_id', eventId)
          .eq('user_id', userId)

        if (deleteError) throw deleteError
      } else {
        // Se clica num status diferente, atualiza (UPDATE)
        const updateData = { status, confirmado_em: new Date() }
        if (justificationId) {
          updateData.justification_id = justificationId
        }

        const { error: updateError } = await supabaseClient
          .from('attendances')
          .update(updateData)
          .eq('event_id', eventId)
          .eq('user_id', userId)

        if (updateError) throw updateError
      }
    } else {
      // Se não existe, cria novo (INSERT)
      const insertData = {
        event_id: eventId,
        user_id: userId,
        status,
        marcado_em: new Date(),
        confirmado_em: new Date()
      }
      if (justificationId) {
        insertData.justification_id = justificationId
      }

      const { error: insertError } = await supabaseClient
        .from('attendances')
        .insert([insertData])

      if (insertError) throw insertError
    }

    // Reload attendance
    await loadAttendance(eventId)
  } catch (error) {
    console.error('❌ Erro ao atualizar presença:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Carregar classificações
async function loadStandings(teamId) {
  try {
    const container = document.getElementById('standingsContainer')
    container.innerHTML = '<p class="loading">Carregando classificação...</p>'

    // Get competition series for this team
    const { data: seriesData, error: seriesError } = await supabaseClient
      .from('competition_series')
      .select('id, nome, temporada')
      .eq('team_id', teamId)
      .limit(1)
      .single()

    if (seriesError || !seriesData) {
      container.innerHTML = '<p class="loading">Nenhuma série de competição encontrada</p>'
      return
    }

    // Get standings for this series
    const { data: standingsData, error: standingsError } = await supabaseClient
      .from('competition_standings')
      .select('*')
      .eq('serie_id', seriesData.id)
      .order('posicao', { ascending: true })

    if (standingsError) throw standingsError

    if (standingsData.length === 0) {
      container.innerHTML = '<p class="loading">Sem classificações registadas</p>'
      return
    }

    // Build table
    const html = `
      <h2>Classificação - ${seriesData.nome}</h2>
      <p style="color: var(--text-light); margin-bottom: 20px;">Temporada ${seriesData.temporada}</p>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Equipa</th>
            <th>Jogos</th>
            <th>V</th>
            <th>D</th>
            <th>Sets +</th>
            <th>Sets -</th>
            <th>Pontos</th>
          </tr>
        </thead>
        <tbody>
          ${standingsData.map((row, idx) => `
            <tr class="standings-row-${row.posicao}">
              <td>
                <span class="position-badge">${row.posicao}</span>
              </td>
              <td><strong>${row.equipa_nome}</strong></td>
              <td>${row.jogos}</td>
              <td>${row.vitorias}</td>
              <td>${row.derrotas}</td>
              <td>${row.sets_favor}</td>
              <td>${row.sets_contra}</td>
              <td><strong>${row.pontos}</strong></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="btn-primary" onclick="goToCalendar()" style="margin-top: 30px;">← Voltar ao Calendário</button>
    `

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar classificação:', error.message)
    document.getElementById('standingsContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// ============= CHAT =============

// Mostrar Chat
async function showChat() {
  document.getElementById('dashboardScreen').style.display = 'none'
  document.getElementById('calendarScreen').style.display = 'none'
  document.getElementById('chatScreen').style.display = 'flex'

  const team = userTeams.find(t => t.team_id === selectedTeam)
  if (team) {
    document.getElementById('chatTeamName').textContent = `💬 ${team.team.name}`
  }

  // Carregar mensagens
  await loadChatMessages(selectedTeam)

  // Subscrever a mensagens em tempo real
  subscribeToMessages(selectedTeam)
}

// Carregar mensagens do chat
async function loadChatMessages(teamId) {
  try {
    const container = document.getElementById('messagesContainer')
    container.innerHTML = '<p class="loading">Carregando mensagens...</p>'

    const { data, error } = await supabaseClient
      .from('messages')
      .select('id, autor_id, titulo, conteudo, criado_em, users:autor_id(nome, email)')
      .eq('team_id', teamId)
      .order('criado_em', { ascending: true })
      .limit(50)

    if (error) throw error

    if (data.length === 0) {
      container.innerHTML = '<p class="loading">Nenhuma mensagem ainda. Sê o primeiro a escrever!</p>'
      return
    }

    // Renderizar mensagens
    const messagesHtml = data.map(msg => {
      const isOwn = msg.autor_id === currentUser.id
      const dataFormatada = new Date(msg.criado_em).toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit'
      })

      return `
        <div class="chat-message ${isOwn ? 'own' : 'other'}">
          <div class="message-bubble">
            ${msg.conteudo}
          </div>
          <div class="message-meta">
            ${isOwn ? 'Tu' : msg.users.nome || msg.users.email} • ${dataFormatada}
          </div>
        </div>
      `
    }).join('')

    container.innerHTML = messagesHtml

    // Scroll para o final
    setTimeout(() => {
      container.scrollTop = container.scrollHeight
    }, 100)
  } catch (error) {
    console.error('❌ Erro ao carregar mensagens:', error.message)
    document.getElementById('messagesContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Subscrever a mensagens em tempo real
function subscribeToMessages(teamId) {
  // Remover subscrição anterior se houver
  if (chatSubscription) {
    supabaseClient.removeChannel(chatSubscription)
  }

  // Nova subscrição
  chatSubscription = supabaseClient
    .channel(`messages:team_id=eq.${teamId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `team_id=eq.${teamId}` },
      (payload) => {
        // Mensagem nova recebida
        loadChatMessages(teamId)
      }
    )
    .subscribe()
}

// Enviar mensagem
async function sendMessage(event) {
  event.preventDefault()

  const input = document.getElementById('messageInput')
  const conteudo = input.value.trim()

  if (!conteudo) return

  try {
    const { error } = await supabaseClient
      .from('messages')
      .insert([{
        team_id: selectedTeam,
        autor_id: currentUser.id,
        conteudo,
        tipo: 'equipa',
        criado_em: new Date()
      }])

    if (error) throw error

    // Limpar input
    input.value = ''
    input.focus()

    // Recarregar mensagens
    await loadChatMessages(selectedTeam)
  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// ============= MENSAGENS DIRETAS (DMs) =============

// Mostrar DMs
async function showDMs() {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('dashboardScreen').style.display = 'none'
  document.getElementById('calendarScreen').style.display = 'none'
  document.getElementById('chatScreen').style.display = 'none'
  document.getElementById('dmsScreen').style.display = 'flex'

  await loadDMsList()
}

// Carregar lista de conversas DM
async function loadDMsList() {
  try {
    const container = document.getElementById('dmsListContainer')
    container.innerHTML = '<p class="loading">Carregando conversas...</p>'

    // Get all DM conversations for current user
    const { data: messagesData, error: messagesError } = await supabaseClient
      .from('messages')
      .select('id, autor_id, destinatario_id, conteudo, criado_em, users:autor_id(nome, email)')
      .or(`autor_id.eq.${currentUser.id},destinatario_id.eq.${currentUser.id}`)
      .eq('tipo_mensagem', 'privada')
      .order('criado_em', { ascending: false })

    if (messagesError) throw messagesError

    // Agrupar conversas por utilizador
    const conversations = {}
    messagesData.forEach(msg => {
      const otherUserId = msg.autor_id === currentUser.id ? msg.destinatario_id : msg.autor_id
      if (!conversations[otherUserId]) {
        conversations[otherUserId] = msg
      }
    })

    // Get all team members
    const { data: membersData, error: membersError } = await supabaseClient
      .from('user_teams')
      .select('user_id, role, users(id, email, nome)')
      .eq('team_id', selectedTeam)

    if (membersError) throw membersError

    // Render conversations + available members
    let html = ''

    // Conversas existentes
    if (Object.keys(conversations).length > 0) {
      html += '<div style="padding: 10px 15px; font-weight: 600; color: var(--text-light); font-size: 12px;">CONVERSAS</div>'
      html += Object.entries(conversations)
        .map(([userId, msg]) => {
          const otherUser = msg.users
          return `
            <div class="dms-conversation" onclick="openDMChat('${userId}', '${otherUser.nome || otherUser.email}')">
              <div class="name">${otherUser.nome || otherUser.email}</div>
              <div class="last-message">${msg.conteudo.substring(0, 50)}...</div>
            </div>
          `
        })
        .join('')
    }

    // Utilizadores disponíveis (sem conversa)
    // Restrições: jogadores só podem DM com treinadores/coordenador
    const currentTeam = userTeams.find(t => t.team_id === selectedTeam)
    const isPlayerUser = currentTeam && currentTeam.role === 'jogador'

    let availableUsers = membersData.filter(member =>
      member.user_id !== currentUser.id && !conversations[member.user_id]
    )

    // Se é jogador, filtrar apenas para treinadores e coordenador
    if (isPlayerUser) {
      availableUsers = availableUsers.filter(member =>
        member.role === 'treinador' || member.role === 'coordenador'
      )
    }

    if (availableUsers.length > 0) {
      html += '<div style="padding: 10px 15px; font-weight: 600; color: var(--text-light); font-size: 12px; margin-top: 10px;">INICIAR CONVERSA</div>'
      html += availableUsers.map(member => `
        <div class="dms-conversation" onclick="openDMChat('${member.user_id}', '${member.users.nome || member.users.email}')">
          <div class="name">${member.users.nome || member.users.email}</div>
          <div class="last-message">Clica para iniciar conversa</div>
        </div>
      `).join('')
    }

    if (!html) {
      html = '<p class="loading">Nenhum utilizador disponível</p>'
    }

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar DMs:', error.message)
    document.getElementById('dmsListContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Abrir conversa DM
async function openDMChat(userId, userName) {
  document.getElementById('dmsListContainer').style.display = 'none'
  document.getElementById('dmsChatContainer').style.display = 'flex'

  document.getElementById('dmsChatName').textContent = userName
  document.getElementById('dmMessageInput').dataset.userId = userId

  await loadDMChat(userId)
}

// Carregar mensagens da conversa DM
async function loadDMChat(userId) {
  try {
    const container = document.getElementById('dmsMessagesContainer')
    container.innerHTML = '<p class="loading">Carregando mensagens...</p>'

    const { data, error } = await supabaseClient
      .from('messages')
      .select('id, autor_id, destinatario_id, conteudo, criado_em, users:autor_id(nome, email)')
      .or(
        `and(autor_id.eq.${currentUser.id},destinatario_id.eq.${userId}),and(autor_id.eq.${userId},destinatario_id.eq.${currentUser.id})`
      )
      .eq('tipo_mensagem', 'privada')
      .order('criado_em', { ascending: true })

    if (error) throw error

    if (data.length === 0) {
      container.innerHTML = '<p class="loading">Inicia a conversa!</p>'
      return
    }

    // Render messages
    const messagesHtml = data.map(msg => {
      const isOwn = msg.autor_id === currentUser.id
      const dataFormatada = new Date(msg.criado_em).toLocaleTimeString('pt-PT', {
        hour: '2-digit',
        minute: '2-digit'
      })

      return `
        <div class="chat-message ${isOwn ? 'own' : 'other'}">
          <div class="message-bubble">
            ${msg.conteudo}
          </div>
          <div class="message-meta">
            ${isOwn ? 'Tu' : msg.users.nome || msg.users.email} • ${dataFormatada}
          </div>
        </div>
      `
    }).join('')

    container.innerHTML = messagesHtml

    // Scroll para o final
    setTimeout(() => {
      container.scrollTop = container.scrollHeight
    }, 100)
  } catch (error) {
    console.error('❌ Erro ao carregar DM:', error.message)
    document.getElementById('dmsMessagesContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Enviar DM
async function sendDM(event) {
  event.preventDefault()

  const input = document.getElementById('dmMessageInput')
  const conteudo = input.value.trim()
  const destinatarioId = input.dataset.userId

  if (!conteudo) return

  try {
    const { error } = await supabaseClient
      .from('messages')
      .insert([{
        team_id: selectedTeam,
        autor_id: currentUser.id,
        destinatario_id: destinatarioId,
        conteudo,
        tipo: 'equipa',
        tipo_mensagem: 'privada',
        criado_em: new Date()
      }])

    if (error) throw error

    input.value = ''
    input.focus()

    await loadDMChat(destinatarioId)
  } catch (error) {
    console.error('❌ Erro ao enviar DM:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Fechar chat DM
function closeDmChat() {
  document.getElementById('dmsListContainer').style.display = 'block'
  document.getElementById('dmsChatContainer').style.display = 'none'
  loadDMsList()
}

// ============= INICIALIZAÇÃO =============
// Inicializa a app quando a página carrega
window.addEventListener('DOMContentLoaded', initApp)