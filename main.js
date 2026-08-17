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
  const usernameInput = document.getElementById('username')

  if (isSignUp) {
    authBtn.textContent = 'Criar Conta'
    usernameInput.placeholder = 'escolhe um username'
    toggleText.innerHTML = 'Já tens conta? <a href="#" onclick="toggleAuthMode(event)">Entrar</a>'
  } else {
    authBtn.textContent = 'Entrar'
    usernameInput.placeholder = 'seu username'
    toggleText.innerHTML = 'Não tens conta? <a href="#" onclick="toggleAuthMode(event)">Criar nova</a>'
  }
}

// Gerir autenticação (login ou signup)
window.handleAuth = async function(e) {
  e.preventDefault()

  const username = document.getElementById('username').value
  const password = document.getElementById('password').value
  const errorDiv = document.getElementById('authError')
  const successDiv = document.getElementById('authSuccess')
  const authBtn = document.getElementById('authBtn')

  errorDiv.style.display = 'none'
  successDiv.style.display = 'none'
  authBtn.disabled = true

  try {
    if (isSignUp) {
      // Signup - converter username para email válido
      const email = `${username}@LVC.local`

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
      // Login - converter username para email válido
      const email = `${username}@LVC.local`

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

  // Adicionar botão de gestão se for super_admin
  const userRole = userTeams.length > 0 ? userTeams[0].role : null
  const currentUserRole = currentUser ? currentUser.user_metadata?.role : null

  // Verificar role via BD (melhor abordagem)
  const { data: userData } = await supabaseClient
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single()

  if (userData && userData.role === 'super_admin') {
    const header = document.querySelector('#dashboardScreen .header')
    if (!document.getElementById('managementBtn')) {
      const btn = document.createElement('button')
      btn.id = 'managementBtn'
      btn.className = 'btn-primary'
      btn.textContent = '⚙️ Gestão'
      btn.style.margin = '0'
      btn.onclick = () => showManagement()
      header.appendChild(btn)
    }
  }
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

    // Mostrar botão de gerenciar eventos apenas para treinadores, coordenadores e super_admin
    const manageBtn = document.getElementById('manageEventsBtn')
    if (manageBtn && ['treinador', 'coordenador', 'super_admin'].includes(team.role)) {
      manageBtn.style.display = 'block'
    } else if (manageBtn) {
      manageBtn.style.display = 'none'
    }
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

// ============= GESTÃO DE UTILIZADORES (Super Admin) =============

// Mostrar screen de gestão
async function showManagement() {
  document.getElementById('loginScreen').style.display = 'none'
  document.getElementById('dashboardScreen').style.display = 'none'
  document.getElementById('calendarScreen').style.display = 'none'
  document.getElementById('managementScreen').style.display = 'flex'

  await loadUsersList()
}

// Carregar lista de utilizadores
async function loadUsersList() {
  try {
    const container = document.getElementById('usersListContainer')
    container.innerHTML = '<p class="loading">Carregando utilizadores...</p>'

    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, email, role, nome')
      .order('email', { ascending: true })

    if (usersError) throw usersError

    // Carregar equipas de cada utilizador
    const { data: teamData, error: teamError } = await supabaseClient
      .from('user_teams')
      .select('user_id, team_id, role, teams(name)')

    if (teamError) throw teamError

    if (users.length === 0) {
      container.innerHTML = '<p class="loading">Nenhum utilizador</p>'
      return
    }

    // Agrupar equipas por utilizador
    const userTeamsMap = {}
    teamData.forEach(ut => {
      if (!userTeamsMap[ut.user_id]) {
        userTeamsMap[ut.user_id] = []
      }
      // Verificar se teams existe antes de ler name
      if (ut.teams && ut.teams.name) {
        userTeamsMap[ut.user_id].push(ut.teams.name)
      }
    })

    const html = `
      <table>
        <thead>
          <tr>
            <th>Username</th>
            <th>Nome</th>
            <th>Papel</th>
            <th>Equipas</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${users.map(user => `
            <tr>
              <td><strong>${user.email}</strong></td>
              <td>${user.nome || '-'}</td>
              <td>
                <span class="role-badge ${user.role}">
                  ${user.role === 'super_admin' ? '👑 Super Admin' :
                    user.role === 'coordenador' ? '📊 Coordenador' :
                    user.role === 'treinador' ? '🏋️ Treinador' :
                    user.role === 'jogador' ? '⚽ Jogador' : user.role}
                </span>
              </td>
              <td>${(userTeamsMap[user.id] || []).join(', ') || '-'}</td>
              <td>
                <div class="user-actions">
                  <button class="btn-edit" onclick="editUserTeams('${user.id}', '${user.email}')">Equipas</button>
                  <button class="btn-edit" onclick="editUser('${user.id}')">Papel</button>
                  <button class="btn-delete" onclick="deleteUser('${user.id}')">Remover</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar utilizadores:', error.message)
    document.getElementById('usersListContainer').innerHTML = `<p class="loading">❌ Erro: ${error.message}</p>`
  }
}

// Mostrar form de criar novo utilizador
function showCreateUserForm() {
  const container = document.getElementById('usersListContainer')

  const html = `
    <div class="create-user-form">
      <h2>Criar Novo Utilizador</h2>
      <form onsubmit="createUser(event)">
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="newUsername" required placeholder="username">
        </div>

        <div class="form-group">
          <label>Nome</label>
          <input type="text" id="newName" placeholder="Nome completo">
        </div>

        <div class="form-group">
          <label>Password</label>
          <input type="password" id="newPassword" required placeholder="••••••••">
        </div>

        <div class="form-group">
          <label>Papel</label>
          <select id="newRole" required>
            <option value="">Seleciona um papel</option>
            <option value="jogador">⚽ Jogador</option>
            <option value="treinador">🏋️ Treinador</option>
            <option value="coordenador">📊 Coordenador</option>
          </select>
        </div>

        <button type="submit" class="btn-primary" style="width: 100%;">Criar Utilizador</button>
        <button type="button" class="btn-primary" style="width: 100%; background: var(--text-light); margin-top: 10px;" onclick="loadUsersList()">Cancelar</button>
      </form>
    </div>
  `

  container.innerHTML = html
}

// Criar novo utilizador
async function createUser(event) {
  event.preventDefault()

  const username = document.getElementById('newUsername').value
  const password = document.getElementById('newPassword').value
  const nome = document.getElementById('newName').value
  const role = document.getElementById('newRole').value

  if (!username || !password || !role) {
    alert('Preenche todos os campos obrigatórios')
    return
  }

  try {
    const email = `${username}@LVC.local`

    // Criar em auth.users
    const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirmed: true
    })

    if (authError) throw authError

    // Criar em users
    const { error: userError } = await supabaseClient
      .from('users')
      .insert([{
        id: authData.user.id,
        email,
        role,
        nome: nome || username
      }])

    if (userError) throw userError

    alert('✅ Utilizador criado com sucesso!')
    await loadUsersList()
  } catch (error) {
    console.error('❌ Erro:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Editar utilizador (por enquanto apenas role)
async function editUser(userId) {
  const newRole = prompt('Novo papel (jogador/treinador/coordenador/super_admin):')
  if (!newRole) return

  try {
    const { error } = await supabaseClient
      .from('users')
      .update({ role: newRole })
      .eq('id', userId)

    if (error) throw error

    alert('✅ Utilizador atualizado!')
    await loadUsersList()
  } catch (error) {
    console.error('❌ Erro:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Remover utilizador
async function deleteUser(userId) {
  if (!confirm('Tens a certeza que queres remover este utilizador?')) return

  try {
    const { error } = await supabaseClient
      .from('users')
      .delete()
      .eq('id', userId)

    if (error) throw error

    alert('✅ Utilizador removido!')
    await loadUsersList()
  } catch (error) {
    console.error('❌ Erro:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Editar equipas do utilizador
async function editUserTeams(userId, userEmail) {
  try {
    const container = document.getElementById('usersListContainer')

    // Carregar todas as equipas (sem RLS para super_admin conseguir ver todas)
    const { data: teams, error: teamsError } = await supabaseClient
      .from('teams')
      .select('id, name')
      .order('name', { ascending: true })

    if (teamsError) {
      console.error('Erro ao carregar equipas:', teamsError)
      throw teamsError
    }

    console.log('Equipas carregadas:', teams)

    // Carregar equipas do utilizador
    const { data: userTeams, error: userTeamsError } = await supabaseClient
      .from('user_teams')
      .select('team_id, role')
      .eq('user_id', userId)

    if (userTeamsError) {
      console.error('Erro ao carregar user_teams:', userTeamsError)
      throw userTeamsError
    }

    const userTeamsMap = {}
    userTeams.forEach(ut => {
      userTeamsMap[ut.team_id] = ut.role
    })

    if (!teams || teams.length === 0) {
      alert('Nenhuma equipa disponível. Cria uma equipa primeiro!')
      return
    }

    const html = `
      <div class="create-user-form">
        <h2>Associar Equipas - ${userEmail}</h2>
        <form onsubmit="saveUserTeams(event, '${userId}')">
          <div id="teamsCheckboxes">
            ${teams.map(team => `
              <div style="margin-bottom: 15px; padding: 12px; background: var(--light-gray); border-radius: 6px;">
                <div style="display: flex; align-items: center; margin-bottom: 8px;">
                  <input type="checkbox" id="team_${team.id}" name="team_${team.id}" value="${team.id}"
                    ${userTeamsMap[team.id] ? 'checked' : ''}
                    style="margin-right: 10px; cursor: pointer;">
                  <label for="team_${team.id}" style="cursor: pointer; font-weight: 600;">
                    ${team.name}
                  </label>
                </div>
                <select name="role_${team.id}" style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid var(--border-color);">
                  <option value="jogador" ${userTeamsMap[team.id] === 'jogador' || !userTeamsMap[team.id] ? 'selected' : ''}>⚽ Jogador</option>
                  <option value="treinador" ${userTeamsMap[team.id] === 'treinador' ? 'selected' : ''}>🏋️ Treinador</option>
                  <option value="coordenador" ${userTeamsMap[team.id] === 'coordenador' ? 'selected' : ''}>📊 Coordenador</option>
                </select>
              </div>
            `).join('')}
          </div>

          <button type="submit" class="btn-primary" style="width: 100%;">Guardar Equipas</button>
          <button type="button" class="btn-primary" style="width: 100%; background: var(--text-light); margin-top: 10px;" onclick="loadUsersList()">Cancelar</button>
        </form>
      </div>
    `

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro:', error.message)
    alert(`Erro: ${error.message}`)
  }
}

// Guardar equipas do utilizador
async function saveUserTeams(event, userId) {
  event.preventDefault()

  try {
    const form = event.target
    const selectedTeams = Array.from(form.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value)

    console.log('Utilizador ID:', userId)
    console.log('Equipas selecionadas:', selectedTeams)

    // Remover associações antigas
    const { error: deleteError } = await supabaseClient
      .from('user_teams')
      .delete()
      .eq('user_id', userId)

    if (deleteError) {
      console.error('Erro ao deletar:', deleteError)
      throw deleteError
    }

    console.log('Associações antigas removidas')

    // Adicionar novas associações com os papéis selecionados
    if (selectedTeams.length > 0) {
      const newAssociations = selectedTeams.map(teamId => {
        const roleSelect = form.querySelector(`select[name="role_${teamId}"]`)
        const role = roleSelect ? roleSelect.value : 'jogador'

        console.log(`Equipa ${teamId} com role ${role}`)

        return {
          user_id: userId,
          team_id: teamId,
          role: role
        }
      })

      console.log('Associações a inserir:', newAssociations)

      const { error: insertError } = await supabaseClient
        .from('user_teams')
        .insert(newAssociations)

      if (insertError) {
        console.error('Erro ao inserir:', insertError)
        throw insertError
      }

      console.log('Associações inseridas com sucesso')
    }

    alert('✅ Equipas atualizadas!')
    await loadUsersList()
  } catch (error) {
    console.error('❌ Erro:', error)
    alert(`Erro: ${error.message}`)
  }
}

// ============= GERENCIAR EVENTOS =============

let editingEventId = null

// Função helper para mostrar uma screen
function showScreen(screenId) {
  // Esconder todas as screens
  const allScreens = [
    'loginScreen',
    'dashboardScreen',
    'calendarScreen',
    'eventDetailsScreen',
    'attendanceScreen',
    'standingsScreen',
    'chatScreen',
    'dmsScreen',
    'managementScreen',
    'eventsManagementScreen'
  ]

  allScreens.forEach(id => {
    const screen = document.getElementById(id)
    if (screen) {
      screen.style.display = 'none'
      screen.style.visibility = 'hidden'
      screen.style.position = 'absolute'
      screen.style.left = '-9999px'
    }
  })

  // Mostrar screen pedida
  const screen = document.getElementById(screenId)
  if (screen) {
    screen.style.display = 'flex'
    screen.style.visibility = 'visible'
    screen.style.position = 'relative'
    screen.style.left = 'auto'
  }
}

// Mostrar screen de gestão de eventos
async function showEventManagement() {
  showScreen('eventsManagementScreen')
  await loadEventsList()
}

// Carregar lista de eventos da equipa
async function loadEventsList() {
  try {
    if (!selectedTeam) {
      alert('❌ Nenhuma equipa selecionada')
      return
    }

    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('team_id', selectedTeam)
      .order('data', { ascending: true })

    if (error) throw error

    const container = document.getElementById('eventsListContainer')

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="loading">Nenhum evento criado. <a href="#" onclick="showCreateEventForm(event)">Criar um!</a></p>'
      return
    }

    let html = ''
    data.forEach(event => {
      const eventDate = new Date(event.data)
      const formattedDate = eventDate.toLocaleDateString('pt-PT')
      const formattedTime = event.hora || '??:??'

      html += `
        <div class="event-item ${event.tipo}">
          <div class="event-info">
            <div class="event-title">
              <span class="event-type-badge ${event.tipo}">${event.tipo === 'jogo' ? '⚽ JOGO' : '🏐 TREINO'}</span>
              ${event.titulo}
            </div>
            <div class="event-meta">📅 ${formattedDate} às ${formattedTime}</div>
            <div class="event-meta">📍 ${event.local || 'Local não especificado'}</div>
            ${event.adversario ? `<div class="event-meta">⚔️ vs ${event.adversario}</div>` : ''}
            ${event.descricao ? `<div class="event-meta">📝 ${event.descricao}</div>` : ''}
          </div>
          <div class="event-actions">
            <button class="btn-edit" onclick="editEvent('${event.id}')">Editar</button>
            <button class="btn-delete" onclick="deleteEvent('${event.id}')">Apagar</button>
          </div>
        </div>
      `
    })

    container.innerHTML = html
  } catch (error) {
    console.error('❌ Erro ao carregar eventos:', error)
    alert(`Erro: ${error.message}`)
  }
}

// Mostrar formulário de criar evento
window.showCreateEventForm = function(e) {
  if (e) e.preventDefault()

  editingEventId = null
  document.getElementById('eventFormTitle').textContent = 'Novo Evento'
  document.getElementById('eventTitle').value = ''
  document.getElementById('eventType').value = ''
  document.getElementById('eventDate').value = ''
  document.getElementById('eventTime').value = ''
  document.getElementById('eventLocation').value = ''
  document.getElementById('eventDescription').value = ''
  document.getElementById('eventOpponent').value = ''
  document.getElementById('eventOpponentGroup').style.display = 'none'
  document.getElementById('eventFormContainer').style.display = 'flex'
}

// Editar evento
async function editEvent(eventId) {
  try {
    const { data, error } = await supabaseClient
      .from('events')
      .select('*')
      .eq('id', eventId)

    if (error) throw error
    if (!data || data.length === 0) {
      alert('❌ Evento não encontrado')
      return
    }

    const event = data[0]
    editingEventId = eventId

    // Preencher formulário
    document.getElementById('eventFormTitle').textContent = 'Editar Evento'
    document.getElementById('eventTitle').value = event.titulo
    document.getElementById('eventType').value = event.tipo
    document.getElementById('eventDate').value = event.data
    document.getElementById('eventTime').value = event.hora
    document.getElementById('eventLocation').value = event.local || ''
    document.getElementById('eventDescription').value = event.descricao || ''
    document.getElementById('eventOpponent').value = event.adversario || ''

    // Mostrar/esconder campo adversário
    if (event.tipo === 'jogo') {
      document.getElementById('eventOpponentGroup').style.display = 'block'
    } else {
      document.getElementById('eventOpponentGroup').style.display = 'none'
    }

    document.getElementById('eventFormContainer').style.display = 'flex'
  } catch (error) {
    console.error('❌ Erro ao editar evento:', error)
    alert(`Erro: ${error.message}`)
  }
}

// Fechar formulário
window.closeEventForm = function() {
  document.getElementById('eventFormContainer').style.display = 'none'
  editingEventId = null
}

// Guardar evento (criar ou editar)
async function saveEvent(event) {
  event.preventDefault()

  try {
    if (!selectedTeam) {
      alert('❌ Nenhuma equipa selecionada')
      return
    }

    const eventData = {
      titulo: document.getElementById('eventTitle').value,
      tipo: document.getElementById('eventType').value,
      data: document.getElementById('eventDate').value,
      hora: document.getElementById('eventTime').value,
      local: document.getElementById('eventLocation').value,
      descricao: document.getElementById('eventDescription').value,
      adversario: document.getElementById('eventOpponent').value,
      team_id: selectedTeam
    }

    console.log('Guardando evento:', eventData)

    let result

    if (editingEventId) {
      // Editar evento existente
      const { error } = await supabaseClient
        .from('events')
        .update(eventData)
        .eq('id', editingEventId)

      if (error) throw error
      console.log('Evento atualizado com sucesso')
    } else {
      // Criar novo evento
      const { error } = await supabaseClient
        .from('events')
        .insert([eventData])

      if (error) throw error
      console.log('Evento criado com sucesso')
    }

    closeEventForm()
    await loadEventsList()
    alert('✅ Evento guardado!')
  } catch (error) {
    console.error('❌ Erro ao guardar evento:', error)
    alert(`Erro: ${error.message}`)
  }
}

// Apagar evento
async function deleteEvent(eventId) {
  if (!confirm('Tem a certeza que quer apagar este evento?')) {
    return
  }

  try {
    console.log('Apagando evento:', eventId)

    const { error } = await supabaseClient
      .from('events')
      .delete()
      .eq('id', eventId)

    if (error) throw error

    console.log('Evento apagado com sucesso')
    await loadEventsList()
    alert('✅ Evento apagado!')
  } catch (error) {
    console.error('❌ Erro ao apagar evento:', error)
    alert(`Erro: ${error.message}`)
  }
}

// Listener para mostrar/esconder campo de adversário
document.addEventListener('DOMContentLoaded', () => {
  const eventTypeSelect = document.getElementById('eventType')
  if (eventTypeSelect) {
    eventTypeSelect.addEventListener('change', () => {
      const opponentGroup = document.getElementById('eventOpponentGroup')
      if (eventTypeSelect.value === 'jogo') {
        opponentGroup.style.display = 'block'
      } else {
        opponentGroup.style.display = 'none'
      }
    })
  }
})

// ============= INICIALIZAÇÃO =============
// Inicializa a app quando a página carrega
window.addEventListener('DOMContentLoaded', initApp)