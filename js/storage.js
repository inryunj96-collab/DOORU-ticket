// Supabase DB 연결
const SUPABASE_URL = 'https://nxpmqoglznvabcsdjsxy.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cG1xb2dsem52YWJjc2Rqc3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNTk2MzksImV4cCI6MjEwMDYzNTYzOX0.QfO21vYArfBWryyq67yewDxyGw6ThntbXesg2Nh46Tg';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

export const DB = {
  // ---- Events ----
  async getEvents() {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('date', { ascending: false });
    if (error) {
      console.error('Error fetching events:', error);
      return [];
    }
    return data || [];
  },

  async getEvent(id) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') console.error('Error fetching event:', error);
      return null;
    }
    return data;
  },

  async addEvent(data) {
    const event = {
      id: uid(),
      participants: [],
      result: '',
      leader: '',
      ...data,
      createdAt: new Date().toISOString(),
    };
    const { error } = await supabase.from('events').insert([event]);
    if (error) {
      console.error('Error adding event:', error);
      throw error;
    }
    return event;
  },

  async updateEvent(id, patch) {
    const { error } = await supabase.from('events').update(patch).eq('id', id);
    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }
    const updated = await this.getEvent(id);
    return updated;
  },

  async deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id);
    await supabase.from('tickets').delete().eq('eventId', id);
  },

  // ---- Tickets ----
  async getTickets(eventId) {
    let query = supabase.from('tickets').select('*');
    if (eventId) query = query.eq('eventId', eventId);
    const { data, error } = await query.order('registeredAt', { ascending: false });
    if (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }
    return data || [];
  },

  async getTicket(id) {
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code !== 'PGRST116') console.error('Error fetching ticket:', error);
      return null;
    }
    return data;
  },

  async addTicket(data) {
    const ticket = {
      id: uid(),
      status: 'unclaimed',
      receivedBy: null,
      receivedAt: null,
      registeredAt: new Date().toISOString(),
      ...data,
    };
    const { error } = await supabase.from('tickets').insert([ticket]);
    if (error) {
      console.error('Error adding ticket:', error);
      throw error;
    }
    return ticket;
  },

  async addTickets(dataArray) {
    const now = new Date().toISOString();
    const newTickets = dataArray.map((data) => ({
      id: uid(),
      status: 'unclaimed',
      receivedBy: null,
      receivedAt: null,
      registeredAt: now,
      ...data,
    }));
    const { error } = await supabase.from('tickets').insert(newTickets);
    if (error) {
      console.error('Error adding tickets:', error);
      throw error;
    }
    return newTickets;
  },

  async updateTicket(id, patch) {
    const { error } = await supabase.from('tickets').update(patch).eq('id', id);
    if (error) {
      console.error('Error updating ticket:', error);
      throw error;
    }
    const updated = await this.getTicket(id);
    return updated;
  },

  async deleteTicket(id) {
    await supabase.from('tickets').delete().eq('id', id);
  },

  async hasDuplicatePin(eventId, pin) {
    const { data, error } = await supabase
      .from('tickets')
      .select('id')
      .eq('eventId', eventId)
      .eq('pin', pin)
      .limit(1);
    if (error) {
      console.error('Error checking duplicate PIN:', error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  },
};
