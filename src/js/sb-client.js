/**
 * DashDriver - Supabase Client
 * Initializing the official Supabase JS client.
 */

const SB_URL = "https://amkekvavjsdwekthnwzu.supabase.co";
const SB_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFta2VrdmF2anNkd2VrdGhud3p1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0NDQwNjcsImV4cCI6MjA5OTAyMDA2N30.WQ9mNe3KLyvN40uvmKClBfPbBAgJ-s_69SabzGF8hwQ";

// Official client
window.supabase = supabase.createClient(SB_URL, SB_KEY);

// Headers autenticados para chamadas às nossas APIs (/api/*).
// Anexa o access_token do Supabase como Bearer para o backend validar o usuário.
window.ddAuthHeaders = async function (extra = {}) {
  let token = null;
  try {
    const { data } = await supabase.auth.getSession();
    token = data?.session?.access_token || null;
  } catch (_) {}
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};

// Legacy wrapper for compatibility with existing modules
window.sb = {
  async get(table, params = '') {
    // Basic parser for simple queries like '?id=eq.123'
    let query = supabase.from(table).select('*');
    
    if (params.includes('order=')) {
      const order = params.split('order=')[1].split('&')[0];
      const [col, dir] = order.split('.');
      query = query.order(col, { ascending: dir === 'asc' });
    }
    
    const { data, error } = await query;
    return { data, error };
  },

  async post(table, body) {
    return await supabase.from(table).insert(body).select();
  },

  async patch(table, body, params) {
    const id = params.split('eq.')[1];
    return await supabase.from(table).update(body).eq('id', id).select();
  },

  async delete(table, params) {
    const id = params.split('eq.')[1];
    return await supabase.from(table).delete().eq('id', id);
  }
};
