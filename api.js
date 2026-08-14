import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

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