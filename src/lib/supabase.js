import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// ── AUTH ─────────────────────────────────────────────────────

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signUpWithEmail(email, password, nome) {
  const { data, error } = await supabase.auth.signUp({
    email, password,
    options: { data: { full_name: nome } }
  })
  if (error) throw error
  return data
}

export async function signInWithGoogle() {
  // Usa la variabile d'ambiente se disponibile, altrimenti usa l'origin corrente
  const redirectTo = import.meta.env.VITE_APP_URL || window.location.origin
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo }
  })
  if (error) throw error
}

export async function signOut() {
  await supabase.auth.signOut()
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}

// ── SEGNALAZIONI ─────────────────────────────────────────────

export async function getSegnalazioni() {
  const { data, error } = await supabase
    .from('segnalazioni')
    .select('*, profiles(nome, email)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export async function insertSegnalazione(payload) {
  const { data, error } = await supabase
    .from('segnalazioni')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateSegnalazione(id, updates) {
  const { data, error } = await supabase
    .from('segnalazioni')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

// ── STORAGE ──────────────────────────────────────────────────

export async function uploadFoto(file, userId) {
  // file può essere un File (con .name) o un Blob compresso (senza .name)
  const ext = file.name ? file.name.split('.').pop() : 'jpg'
  const path = `${userId}/${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from('foto-buche')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data } = supabase.storage.from('foto-buche').getPublicUrl(path)
  return data.publicUrl
}
