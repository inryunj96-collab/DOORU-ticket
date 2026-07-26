import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

// Event 변환 함수 (DB → App)
function eventFromDB(event) {
  if (!event) return null;
  return {
    ...event,
    participants: typeof event.participants === 'string'
      ? JSON.parse(event.participants || '[]')
      : (event.participants || []),
  };
}

// Ticket 변환 함수 (snake_case → camelCase)
function ticketFromDB(ticket) {
  if (!ticket) return null;
  return {
    ...ticket,
    eventId: ticket.eventid,
    registeredBy: ticket.registeredby,
    receivedBy: ticket.receivedby,
    receivedAt: ticket.receivedat,
    registeredAt: ticket.registeredat,
  };
}

// REST API 헬퍼 함수
async function apiCall(path, method = 'GET', body = null) {
  const options = {
    method,
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(`${SUPABASE_URL}/rest/v1${path}`, options);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || `API error: ${response.status}`);
  }

  // 204 No Content 또는 빈 응답 처리
  if (response.status === 204) return null;

  const text = await response.text();
  if (!text) return null;

  return JSON.parse(text);
}

export const DB = {
  // ---- Events ----
  async getEvents() {
    try {
      const data = await apiCall('/events?order=date.desc') || [];
      return data.map(eventFromDB);
    } catch (err) {
      console.error('getEvents error:', err);
      return [];
    }
  },

  async getEvent(id) {
    try {
      const results = await apiCall(`/events?id=eq.${id}&limit=1`);
      return eventFromDB(results?.[0] || null);
    } catch (err) {
      console.error('getEvent error:', err);
      return null;
    }
  },

  async addEvent(data) {
    try {
      const { participants, ...rest } = data;
      const event = {
        id: uid(),
        result: data.result || '',
        leader: data.leader || '',
        ...rest,
        participants: JSON.stringify(participants || []),
        createdat: new Date().toISOString(),
      };
      console.log('Adding event:', event);
      await apiCall('/events', 'POST', [event]);
      return event;
    } catch (err) {
      console.error('addEvent error:', err);
      throw new Error('경기 등록 실패: ' + err.message);
    }
  },

  async updateEvent(id, patch) {
    try {
      const { participants, ...rest } = patch;
      const dbPatch = {
        ...rest,
        participants: typeof participants === 'string'
          ? participants
          : JSON.stringify(participants || []),
      };
      console.log('Updating event:', dbPatch);
      await apiCall(`/events?id=eq.${id}`, 'PATCH', dbPatch);
      return this.getEvent(id);
    } catch (err) {
      console.error('updateEvent error:', err);
      throw err;
    }
  },

  async deleteEvent(id) {
    try {
      await apiCall(`/events?id=eq.${id}`, 'DELETE');
      await apiCall(`/tickets?eventid=eq.${id}`, 'DELETE');
    } catch (err) {
      console.error('deleteEvent error:', err);
      throw err;
    }
  },

  // ---- Tickets ----
  async getTickets(eventId) {
    try {
      const query = eventId
        ? `/tickets?eventid=eq.${eventId}&order=registeredat.desc`
        : '/tickets?order=registeredat.desc';
      const data = await apiCall(query) || [];
      return data.map(ticketFromDB);
    } catch (err) {
      console.error('getTickets error:', err);
      return [];
    }
  },

  async getTicket(id) {
    try {
      const results = await apiCall(`/tickets?id=eq.${id}&limit=1`);
      return ticketFromDB(results?.[0] || null);
    } catch (err) {
      console.error('getTicket error:', err);
      return null;
    }
  },

  async addTicket(data) {
    try {
      const ticket = {
        id: uid(),
        eventid: data.eventId || data.eventid,
        registeredby: data.registeredBy || data.registeredby,
        pin: data.pin,
        url: data.url,
        status: 'unclaimed',
        receivedby: null,
        receivedat: null,
        registeredat: new Date().toISOString(),
      };
      console.log('Adding ticket:', ticket);
      await apiCall('/tickets', 'POST', [ticket]);
      return ticket;
    } catch (err) {
      console.error('addTicket error:', err);
      throw err;
    }
  },

  async addTickets(dataArray) {
    try {
      const now = new Date().toISOString();
      const tickets = dataArray.map((data) => ({
        id: uid(),
        eventid: data.eventId,  // camelCase → snake_case
        registeredby: data.registeredBy || data.registeredby,
        pin: data.pin,
        url: data.url,
        status: 'unclaimed',
        receivedby: null,
        receivedat: null,
        registeredat: now,
      }));
      console.log('Adding tickets:', tickets);
      await apiCall('/tickets', 'POST', tickets);
      return tickets;
    } catch (err) {
      console.error('addTickets error:', err);
      throw new Error('티켓 등록 실패: ' + err.message);
    }
  },

  async updateTicket(id, patch) {
    try {
      // camelCase → snake_case 변환
      const dbPatch = {};
      if (patch.receivedBy !== undefined) dbPatch.receivedby = patch.receivedBy;
      if (patch.receivedAt !== undefined) dbPatch.receivedat = patch.receivedAt;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      // 다른 필드들은 그대로 복사
      Object.keys(patch).forEach(key => {
        if (!['receivedBy', 'receivedAt'].includes(key)) {
          dbPatch[key] = patch[key];
        }
      });
      console.log('Updating ticket:', dbPatch);
      await apiCall(`/tickets?id=eq.${id}`, 'PATCH', dbPatch);
      return this.getTicket(id);
    } catch (err) {
      console.error('updateTicket error:', err);
      throw err;
    }
  },

  async deleteTicket(id) {
    try {
      await apiCall(`/tickets?id=eq.${id}`, 'DELETE');
    } catch (err) {
      console.error('deleteTicket error:', err);
      throw err;
    }
  },

  async hasDuplicatePin(eventId, pin) {
    try {
      const results = await apiCall(
        `/tickets?eventid=eq.${eventId}&pin=eq.${encodeURIComponent(pin)}&limit=1`
      );
      return (results?.length ?? 0) > 0;
    } catch (err) {
      console.error('hasDuplicatePin error:', err);
      return false;
    }
  },
};
