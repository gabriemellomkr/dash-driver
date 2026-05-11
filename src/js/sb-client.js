/**
 * DashDriver - Supabase Client
 * Initializing the official Supabase JS client.
 */

const SB_URL = "https://db-dash.nucleocriativo.com.br";
const SB_KEY = "uSLPst+6To2N5BXF3VipCYxUYkzL133Oy0bscyopivY=";

// Official client
window.supabase = supabase.createClient(SB_URL, SB_KEY);

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
