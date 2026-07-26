// 데이터 저장 계층. 현재는 localStorage 구현이며, 모든 메서드가 Promise를 반환하도록
// 맞춰뒀습니다 — 추후 Supabase 등 원격 DB로 교체할 때 이 파일만 바꾸면 되도록 하기 위함입니다.

const EVENTS_KEY = 'dooru_events_v1';
const TICKETS_KEY = 'dooru_tickets_v1';

function uid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
}

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

export const DB = {
  // ---- Events ----
  async getEvents() {
    return read(EVENTS_KEY);
  },
  async getEvent(id) {
    return read(EVENTS_KEY).find((e) => e.id === id) || null;
  },
  async addEvent(data) {
    const events = read(EVENTS_KEY);
    const event = {
      id: uid(),
      participants: [],
      result: '',
      leader: '',
      ...data,
      createdAt: new Date().toISOString(),
    };
    events.push(event);
    write(EVENTS_KEY, events);
    return event;
  },
  async updateEvent(id, patch) {
    const events = read(EVENTS_KEY);
    const idx = events.findIndex((e) => e.id === id);
    if (idx === -1) throw new Error('Event not found');
    events[idx] = { ...events[idx], ...patch };
    write(EVENTS_KEY, events);
    return events[idx];
  },
  async deleteEvent(id) {
    write(EVENTS_KEY, read(EVENTS_KEY).filter((e) => e.id !== id));
    write(TICKETS_KEY, read(TICKETS_KEY).filter((t) => t.eventId !== id));
  },

  // ---- Tickets ----
  async getTickets(eventId) {
    const tickets = read(TICKETS_KEY);
    return eventId ? tickets.filter((t) => t.eventId === eventId) : tickets;
  },
  async getTicket(id) {
    return read(TICKETS_KEY).find((t) => t.id === id) || null;
  },
  async addTicket(data) {
    const tickets = read(TICKETS_KEY);
    const ticket = {
      id: uid(),
      status: 'unclaimed',
      receivedBy: null,
      receivedAt: null,
      registeredAt: new Date().toISOString(),
      ...data,
    };
    tickets.push(ticket);
    write(TICKETS_KEY, tickets);
    return ticket;
  },
  async addTickets(dataArray) {
    const tickets = read(TICKETS_KEY);
    const now = new Date().toISOString();
    const newTickets = dataArray.map((data) => ({
      id: uid(),
      status: 'unclaimed',
      receivedBy: null,
      receivedAt: null,
      registeredAt: now,
      ...data,
    }));
    write(TICKETS_KEY, [...tickets, ...newTickets]);
    return newTickets;
  },
  async updateTicket(id, patch) {
    const tickets = read(TICKETS_KEY);
    const idx = tickets.findIndex((t) => t.id === id);
    if (idx === -1) throw new Error('Ticket not found');
    tickets[idx] = { ...tickets[idx], ...patch };
    write(TICKETS_KEY, tickets);
    return tickets[idx];
  },
  async deleteTicket(id) {
    write(TICKETS_KEY, read(TICKETS_KEY).filter((t) => t.id !== id));
  },
  async hasDuplicatePin(eventId, pin) {
    const tickets = read(TICKETS_KEY);
    return tickets.some((t) => t.eventId === eventId && t.pin === pin);
  },
};
