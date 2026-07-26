import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

// Supabase 클라이언트 초기화
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

// DB의 snake_case를 앱의 camelCase로 변환
function eventFromDB(dbEvent) {
  if (!dbEvent) return null;
  return {
    ...dbEvent,
    createdAt: dbEvent.createdat,
  };
}

function eventToDB(appEvent) {
  const { createdat, createdAt, ...rest } = appEvent;
  return {
    ...rest,
    createdat: createdAt || createdat,
  };
}

function ticketFromDB(dbTicket) {
  if (!dbTicket) return null;
  return {
    ...dbTicket,
    eventId: dbTicket.eventid,
    registeredBy: dbTicket.registeredby,
    receivedBy: dbTicket.receivedby,
    receivedAt: dbTicket.receivedat,
    registeredAt: dbTicket.registeredat,
  };
}

function ticketToDB(appTicket) {
  const { eventid, registeredby, receivedby, receivedat, registeredat, ...rest } = appTicket;
  return {
    ...rest,
    eventid: appTicket.eventId,
    registeredby: appTicket.registeredBy,
    receivedby: appTicket.receivedBy,
    receivedat: appTicket.receivedAt,
    registeredat: appTicket.registeredAt,
  };
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
    return (data || []).map(eventFromDB);
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
    return eventFromDB(data);
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
    const dbEvent = eventToDB(event);
    const { error } = await supabase.from('events').insert([dbEvent]);
    if (error) {
      console.error('Error adding event:', error);
      throw error;
    }
    return event;
  },

  async updateEvent(id, patch) {
    const dbPatch = eventToDB(patch);
    const { error } = await supabase.from('events').update(dbPatch).eq('id', id);
    if (error) {
      console.error('Error updating event:', error);
      throw error;
    }
    const updated = await this.getEvent(id);
    return updated;
  },

  async deleteEvent(id) {
    await supabase.from('events').delete().eq('id', id);
    await supabase.from('tickets').delete().eq('eventid', id);
  },

  // ---- Tickets ----
  async getTickets(eventId) {
    let query = supabase.from('tickets').select('*');
    if (eventId) query = query.eq('eventid', eventId);
    const { data, error } = await query.order('registeredat', { ascending: false });
    if (error) {
      console.error('Error fetching tickets:', error);
      return [];
    }
    return (data || []).map(ticketFromDB);
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
    return ticketFromDB(data);
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
    const dbTicket = ticketToDB(ticket);
    const { error } = await supabase.from('tickets').insert([dbTicket]);
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
    const dbTickets = newTickets.map(ticketToDB);
    const { error } = await supabase.from('tickets').insert(dbTickets);
    if (error) {
      console.error('Error adding tickets:', error);
      throw error;
    }
    return newTickets;
  },

  async updateTicket(id, patch) {
    const dbPatch = ticketToDB(patch);
    const { error } = await supabase.from('tickets').update(dbPatch).eq('id', id);
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
      .eq('eventid', eventId)
      .eq('pin', pin)
      .limit(1);
    if (error) {
      console.error('Error checking duplicate PIN:', error);
      return false;
    }
    return (data?.length ?? 0) > 0;
  },
};
