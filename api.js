// Supabase client será inicializado no main.js via CDN
// Este ficheiro contém apenas as definições das funções de API

// ============= TEAMS API (GRUPO 1) =============

// Retorna todas as equipas do utilizador autenticado
export async function getMyTeams(supabaseClient) {
  try {
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()

    if (authError || !user) throw new Error('Utilizador não autenticado')

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

    // Transformar para formato mais limpo
    const teams = data.map(ut => ({
      team_id: ut.team_id,
      role: ut.role,
      team: ut.teams
    }))

    return { success: true, data: teams }
  } catch (error) {
    console.error('Error fetching my teams:', error.message)
    return { success: false, error: error.message }
  }
}

// Retorna informações detalhadas de uma equipa específica
export async function getTeamInfo(supabaseClient, teamId) {
  try {
    const { data, error } = await supabaseClient
      .from('teams')
      .select(`
        id,
        name,
        escalao,
        descricao,
        ativo,
        criado_em,
        atualizado_em,
        user_teams (
          user_id,
          role,
          users:user_id (
            id,
            email,
            nome,
            numero,
            posicao
          )
        )
      `)
      .eq('id', teamId)
      .single()

    if (error) throw error

    // Transformar user_teams para formato mais limpo
    const teamWithMembers = {
      ...data,
      members: data.user_teams.map(ut => ({
        user_id: ut.user_id,
        role: ut.role,
        user: ut.users
      }))
    }
    delete teamWithMembers.user_teams

    return { success: true, data: teamWithMembers }
  } catch (error) {
    console.error('Error fetching team info:', error.message)
    return { success: false, error: error.message }
  }
}

// ============= EVENTS API =============

export async function getEvents(teamId) {
  try {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('team_id', teamId)
      .order('data', { ascending: true })
    
    if (error) throw error
    return { success: true, data }
  } catch (error) {
    console.error('Error fetching events:', error.message)
    return { success: false, error: error.message }
  }
}

export async function createEvent(eventData) {
  try {
    const { data, error } = await supabase
      .from('events')
      .insert([eventData])
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error creating event:', error.message)
    return { success: false, error: error.message }
  }
}

export async function updateEvent(eventId, updates) {
  try {
    const { data, error } = await supabase
      .from('events')
      .update(updates)
      .eq('id', eventId)
      .select()
    
    if (error) throw error
    return { success: true, data: data[0] }
  } catch (error) {
    console.error('Error updating event:', error.message)
    return { success: false, error: error.message }
  }
}

export async function deleteEvent(eventId) {
  try {
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId)
    
    if (error) throw error
    return { success: true }
  } catch (error) {
    console.error('Error deleting event:', error.message)
    return { success: false, error: error.message }
  }
}