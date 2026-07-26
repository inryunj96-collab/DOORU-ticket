import { APP_PASSWORD, ADMIN_PASSWORD, TEAMS, getStadium } from './config.js';
import { DB } from './storage.js';
import { parseNolMessages } from './parser.js';

// ---------- 공통 유틸 ----------

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function norm(str) {
  return String(str ?? '').trim().toLowerCase();
}

function todayStr() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function isPastEvent(event) {
  return event.date < todayStr();
}

function formatDateTime(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', {
    month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatEventDate(event) {
  const date = new Date(event.date + 'T00:00:00');
  const dow = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()];
  const [, m, d] = event.date.split('-');
  return `${Number(m)}월 ${Number(d)}일(${dow}) · ${event.time || ''}`;
}

function getDayString(eventDate) {
  const today = todayStr();
  const diff = new Date(eventDate) - new Date(today);
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return '경기 당일';
  if (days > 0) return `D-${days}`;
  return `D+${Math.abs(days)}`;
}

function toast(message) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = message;
  root.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 2200);
}

function closeModal() {
  document.getElementById('modal-root').innerHTML = '';
}

function openModal(html) {
  document.getElementById('modal-root').innerHTML = `
    <div class="modal-backdrop" id="modal-backdrop">
      <div class="modal">${html}</div>
    </div>
  `;
  document.getElementById('modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });
}

// 관리자 암호 확인 모달. 성공 시 onSubmit() 호출.
function openAdminPasswordModal(onSubmit) {
  openModal(`
    <h3>관리자 인증</h3>
    <label class="field-label" for="admin-pw">관리자 암호</label>
    <input id="admin-pw" class="input" type="password" placeholder="암호 입력" inputmode="numeric" />
    <p id="admin-error" class="error-text" hidden>암호가 올바르지 않습니다.</p>
    <div class="modal-actions">
      <button id="admin-cancel" class="btn btn-ghost">취소</button>
      <button id="admin-submit" class="btn btn-primary">확인</button>
    </div>
  `);
  const pwInput = document.getElementById('admin-pw');
  pwInput.focus();

  const submit = () => {
    const pw = pwInput.value;
    if (pw !== ADMIN_PASSWORD) {
      document.getElementById('admin-error').hidden = false;
      return;
    }
    closeModal();
    onSubmit();
  };

  document.getElementById('admin-cancel').addEventListener('click', closeModal);
  document.getElementById('admin-submit').addEventListener('click', submit);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

// 이름 + 공용 암호 확인 모달. 성공 시 onSubmit(name) 호출.
async function openAuthModal(title, onSubmit, eventId) {
  const nameLabel = title.includes('등록') ? '등록자 이름' : title.includes('수령') ? '수령자 이름' : '이름';

  let ticketInfo = '';
  if (eventId) {
    const tickets = await DB.getTickets(eventId);
    if (title.includes('등록')) {
      ticketInfo = `<p class="hint" style="text-align: center; font-weight: 500;">현재 등록된 티켓: <strong>${tickets.length}장</strong></p>`;
    } else if (title.includes('수령')) {
      const unclaimedCount = tickets.filter((t) => t.status === 'unclaimed').length;
      ticketInfo = `<p class="hint" style="text-align: center; font-weight: 500;">미수령 티켓: <strong>${unclaimedCount}장</strong></p>`;
    }
  }

  openModal(`
    <h3>${escapeHtml(title)}</h3>
    ${ticketInfo}
    <label class="field-label" for="auth-name">${nameLabel}</label>
    <input id="auth-name" class="input" type="text" placeholder="${nameLabel} 입력" autocomplete="name" />
    <label class="field-label" for="auth-pw">공용 암호</label>
    <input id="auth-pw" class="input" type="password" placeholder="암호 입력" inputmode="numeric" />
    <p id="auth-error" class="error-text" hidden>이름과 암호를 다시 확인해주세요.</p>
    <div class="modal-actions">
      <button id="auth-cancel" class="btn btn-ghost">취소</button>
      <button id="auth-submit" class="btn btn-primary">확인</button>
    </div>
  `);
  const nameInput = document.getElementById('auth-name');
  const pwInput = document.getElementById('auth-pw');
  nameInput.focus();

  const submit = () => {
    const name = nameInput.value.trim();
    const pw = pwInput.value;
    if (!name || pw !== APP_PASSWORD) {
      document.getElementById('auth-error').hidden = false;
      return;
    }
    closeModal();
    onSubmit(name);
  };

  document.getElementById('auth-cancel').addEventListener('click', closeModal);
  document.getElementById('auth-submit').addEventListener('click', submit);
  pwInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') pwInput.focus(); });
}

// ---------- 라우팅 ----------

const app = document.getElementById('app');
const backBtn = document.getElementById('btn-back');

let current = { view: 'home' };
const stack = [];

function navigate(route, opts = {}) {
  if (!opts.replace) stack.push(current);
  current = route;
  render();
}

function goBack() {
  if (stack.length === 0) return;
  current = stack.pop();
  render();
}

backBtn.addEventListener('click', goBack);

function updateBackButton() {
  backBtn.hidden = stack.length === 0;
}

async function render() {
  updateBackButton();
  window.scrollTo(0, 0);
  switch (current.view) {
    case 'home': return renderHome();
    case 'event-manage': return renderEventManage();
    case 'event-form': return renderEventForm(current.eventId ?? null);
    case 'past-events': return renderPastEvents();
    case 'event-detail': return renderEventDetail(current.eventId);
    case 'ticket-register': return renderTicketRegister(current.eventId, current.actorName);
    case 'ticket-receive': return renderTicketReceive(current.eventId, current.actorName);
    case 'status': return renderStatus(current.eventId);
    default: return renderHome();
  }
}

// ---------- 홈 (경기 목록) ----------

async function renderHome() {
  const events = await DB.getEvents();
  const upcoming = events.filter((e) => !isPastEvent(e)).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter(isPastEvent).sort((a, b) => b.date.localeCompare(a.date));

  let upcomingHtml = '';
  if (upcoming.length) {
    const cards = await Promise.all(upcoming.map((e) => eventCardHtml(e)));
    upcomingHtml = cards.join('');
  } else {
    upcomingHtml = '<p class="empty">등록된 예정 경기가 없습니다.</p>';
  }

  let pastHtml = '';
  if (past.length) {
    const cards = await Promise.all(past.map((e) => pastEventCardHtml(e)));
    pastHtml = cards.join('');
  }

  app.innerHTML = `
    <section class="view">
      <div class="toolbar">
        <button id="btn-new-event-home" class="btn btn-primary">+ 새 경기 등록</button>
        <button id="btn-manage-events" class="btn btn-secondary">경기 관리</button>
      </div>
      <h2 class="section-title">진행 예정 경기</h2>
      <div class="event-list">
        ${upcomingHtml}
      </div>
      ${past.length ? `
        <h2 class="section-title">지난 경기</h2>
        <div class="event-list">
          ${pastHtml}
        </div>
      ` : ''}
    </section>
  `;

  document.getElementById('btn-new-event-home').addEventListener('click', () => navigate({ view: 'event-form', eventId: null }));
  document.getElementById('btn-manage-events').addEventListener('click', () => navigate({ view: 'event-manage' }));
  app.querySelectorAll('.event-card').forEach((card) => {
    card.addEventListener('click', () => navigate({ view: 'event-detail', eventId: card.dataset.id }));
  });
}

async function eventCardHtml(event) {
  const dayStr = getDayString(event.date);
  const tickets = await DB.getTickets(event.id);
  const receivedCount = tickets.filter((t) => t.status === 'claimed').length;
  const totalCount = tickets.length;

  return `
    <button class="event-card" data-id="${event.id}">
      <div class="event-card-main">
        <div class="event-card-title">${escapeHtml(event.title)}</div>
        <div class="event-card-meta">${escapeHtml(formatEventDate(event))}</div>
        <div class="event-card-meta">${escapeHtml(event.stadium)}</div>
      </div>
      <div class="event-card-stats">${totalCount}장 (${receivedCount}건)</div>
      <div class="event-card-dday">${escapeHtml(dayStr)}</div>
    </button>
  `;
}

async function pastEventCardHtml(event) {
  return `
    <button class="event-card event-card-past" data-id="${event.id}">
      <div class="event-card-main">
        <div class="event-card-title">${escapeHtml(event.title)}</div>
        <div class="event-card-meta">${escapeHtml(formatEventDate(event))}</div>
        <div class="event-card-meta">${escapeHtml(event.stadium)}</div>
      </div>
      ${event.result ? `<div class="event-card-result">${escapeHtml(event.result)}</div>` : '<div class="event-card-result-empty">결과 미등록</div>'}
    </button>
  `;
}

// ---------- 과거 경기 내역 ----------

async function renderPastEvents() {
  const events = await DB.getEvents();
  const past = events.filter(isPastEvent).sort((a, b) => b.date.localeCompare(a.date));

  app.innerHTML = `
    <section class="view">
      <h2 class="section-title">지난 경기 내역</h2>
      <div class="event-list">
        ${past.length ? past.map(pastEventCardHtml).join('') : '<p class="empty">지난 경기가 없습니다.</p>'}
      </div>
    </section>
  `;

  app.querySelectorAll('.event-card').forEach((card) => {
    card.addEventListener('click', () => navigate({ view: 'event-detail', eventId: card.dataset.id }));
  });
}

// ---------- 경기 관리 (목록) ----------

async function renderEventManage() {
  const events = await DB.getEvents();
  events.sort((a, b) => b.date.localeCompare(a.date));

  app.innerHTML = `
    <section class="view">
      <button id="btn-new-event" class="btn btn-primary btn-block">+ 새 경기 등록</button>
      <h2 class="section-title">전체 경기</h2>
      <div class="manage-list">
        ${events.length ? events.map(manageRowHtml).join('') : '<p class="empty">등록된 경기가 없습니다.</p>'}
      </div>
    </section>
  `;

  document.getElementById('btn-new-event').addEventListener('click', () => navigate({ view: 'event-form', eventId: null }));
  app.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eventId = btn.dataset.edit;
      openAdminPasswordModal(() => {
        navigate({ view: 'event-form', eventId });
      });
    });
  });
  app.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const eventId = btn.dataset.delete;
      openAdminPasswordModal(async () => {
        const event = await DB.getEvent(eventId);
        if (!confirm(`"${event?.title ?? ''}" 경기를 삭제할까요? 등록된 티켓도 함께 삭제됩니다.`)) return;
        await DB.deleteEvent(eventId);
        toast('경기를 삭제했습니다.');
        renderEventManage();
      });
    });
  });
}

function manageRowHtml(event) {
  const past = isPastEvent(event);
  return `
    <div class="manage-row">
      <div class="manage-row-info">
        <span class="badge ${past ? 'badge-past' : 'badge-upcoming'}">${past ? '지난 경기' : '예정'}</span>
        <div class="manage-row-title">${escapeHtml(event.title)}</div>
        <div class="manage-row-meta">${escapeHtml(formatEventDate(event))} · ${escapeHtml(event.stadium)}</div>
      </div>
      <div class="manage-row-actions">
        <button class="btn btn-small btn-ghost" data-edit="${event.id}">수정</button>
        <button class="btn btn-small btn-danger" data-delete="${event.id}">삭제</button>
      </div>
    </div>
  `;
}

// ---------- 경기 등록/수정 폼 ----------

async function renderEventForm(eventId) {
  const event = eventId ? await DB.getEvent(eventId) : null;
  const isEdit = !!event;

  let homeTeam = '';
  let awayTeam = '';
  if (event?.title) {
    const [h, a] = event.title.split(' vs ').map((s) => s.trim());
    homeTeam = h || '';
    awayTeam = a || '';
  }

  const teamOptions = TEAMS.map((t) => `<option value="${escapeHtml(t.name)}" ${t.name === homeTeam ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');

  app.innerHTML = `
    <section class="view">
      <h2 class="section-title">${isEdit ? '경기 정보 수정' : '새 경기 등록'}</h2>
      <form id="event-form" class="form">
        <label class="field-label" for="f-home">홈팀 *</label>
        <select id="f-home" class="input" required>
          <option value="">선택...</option>
          ${teamOptions}
        </select>

        <label class="field-label" for="f-away">원정팀 *</label>
        <select id="f-away" class="input" required>
          <option value="">선택...</option>
          ${teamOptions}
        </select>

        <label class="field-label" for="f-date">날짜 *</label>
        <input id="f-date" class="input" type="date" required value="${event?.date ?? ''}" />

        <label class="field-label" for="f-time">시간 *</label>
        <input id="f-time" class="input" type="time" required value="${event?.time ?? ''}" />

        <label class="field-label" for="f-stadium">구장 *</label>
        <input id="f-stadium" class="input" required placeholder="예: 잠실야구장" value="${escapeHtml(event?.stadium ?? '')}" />

        <label class="field-label" for="f-leader">리더(담당자) *</label>
        <input id="f-leader" class="input" required placeholder="담당자 이름" value="${escapeHtml(event?.leader ?? '')}" />

        <label class="field-label" for="f-participants">참석자 명단 (선택, 한 줄에 한 명)</label>
        <textarea id="f-participants" class="input textarea" rows="4" placeholder="홍길동&#10;김철수">${escapeHtml((event?.participants ?? []).join('\n'))}</textarea>

        <div class="modal-actions">
          <button type="button" id="f-cancel" class="btn btn-ghost">취소</button>
          <button type="submit" class="btn btn-primary">${isEdit ? '저장' : '등록'}</button>
        </div>
      </form>
    </section>
  `;

  const homeSelect = document.getElementById('f-home');
  const awaySelect = document.getElementById('f-away');
  const stadiumInput = document.getElementById('f-stadium');

  homeSelect.value = homeTeam;
  awaySelect.value = awayTeam;

  const updateStadium = () => {
    const home = homeSelect.value;
    if (home) {
      const stadium = getStadium(home);
      if (!isEdit || stadiumInput.value === getStadium(homeTeam)) {
        stadiumInput.value = stadium;
      }
    }
  };

  homeSelect.addEventListener('change', updateStadium);

  document.getElementById('f-cancel').addEventListener('click', goBack);
  document.getElementById('event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const home = homeSelect.value.trim();
    const away = awaySelect.value.trim();
    if (!home || !away || home === away) {
      toast('홈팀과 원정팀을 다르게 선택해주세요.');
      return;
    }
    const data = {
      title: `${home} vs ${away}`,
      date: document.getElementById('f-date').value,
      time: document.getElementById('f-time').value,
      stadium: stadiumInput.value.trim(),
      leader: document.getElementById('f-leader').value.trim(),
      participants: document.getElementById('f-participants').value
        .split('\n').map((s) => s.trim()).filter(Boolean),
    };
    if (isEdit) {
      await DB.updateEvent(eventId, data);
      toast('경기 정보를 저장했습니다.');
    } else {
      await DB.addEvent(data);
      toast('새 경기를 등록했습니다.');
    }
    goBack();
  });
}

// ---------- 경기 상세 ----------

async function renderEventDetail(eventId) {
  const event = await DB.getEvent(eventId);
  if (!event) { navigate({ view: 'home' }, { replace: true }); return; }
  const past = isPastEvent(event);

  app.innerHTML = `
    <section class="view">
      <div class="event-detail-header">
        <h2>${escapeHtml(event.title)}</h2>
        <p class="event-detail-meta">${escapeHtml(formatEventDate(event))} · ${escapeHtml(event.stadium)}</p>
        <p class="event-detail-meta">리더: ${escapeHtml(event.leader)}</p>
        ${event.result ? `<p class="result-badge">${escapeHtml(event.result)}</p>` : ''}
      </div>
      <div class="detail-actions">
        ${!past ? '<button id="btn-register" class="btn btn-primary btn-large">🎫 티켓 등록하기</button>' : ''}
        ${!past ? '<button id="btn-receive" class="btn btn-primary btn-large">✅ 티켓 수령하기</button>' : ''}
        <button id="btn-status" class="btn btn-secondary btn-large">📊 현황 조회</button>
      </div>
    </section>
  `;

  document.getElementById('btn-status').addEventListener('click', () => navigate({ view: 'status', eventId }));

  const registerBtn = document.getElementById('btn-register');
  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      openAuthModal('티켓 등록하기', (name) => navigate({ view: 'ticket-register', eventId, actorName: name }), eventId);
    });
  }
  const receiveBtn = document.getElementById('btn-receive');
  if (receiveBtn) {
    receiveBtn.addEventListener('click', () => {
      openAuthModal('티켓 수령하기', (name) => navigate({ view: 'ticket-receive', eventId, actorName: name }), eventId);
    });
  }
}

// ---------- 티켓 등록 ----------

async function renderTicketRegister(eventId, actorName) {
  const event = await DB.getEvent(eventId);
  if (!event) { navigate({ view: 'home' }, { replace: true }); return; }
  const tickets = await DB.getTickets(eventId);
  const ticketCount = tickets.length;

  app.innerHTML = `
    <section class="view">
      <h2 class="section-title">티켓 등록 — ${escapeHtml(event.title)}</h2>
      <p class="hint">등록 진행자: ${escapeHtml(actorName)}</p>
      <p class="hint">현재 등록된 티켓: <strong>${ticketCount}장</strong></p>

      <div class="card">
        <h3>자동 파싱 등록 (일괄 가능)</h3>
        <p class="hint">카톡으로 받은 NOL티켓 메시지를 통째로 붙여넣으세요. 여러 명 것을 한 번에 붙여넣어도 됩니다.</p>
        <textarea id="paste-area" class="input textarea" rows="8" placeholder="[NOL티켓 모바일티켓이 도착했어요]&#10;홍길동님이 모바일티켓을 보냈어요!&#10;- 받은티켓: 두산 vs LG&#10;- PIN번호: 1234&#10;- 티켓받기: https://..."></textarea>
        <button id="btn-parse" class="btn btn-secondary btn-block">파싱하기</button>
        <div id="parse-preview"></div>
      </div>

      <div class="card">
        <h3>수동 입력 (예외용)</h3>
        <label class="field-label" for="manual-name">등록자 이름</label>
        <input id="manual-name" class="input" value="${escapeHtml(actorName)}" />
        <label class="field-label" for="manual-pin">PIN번호</label>
        <input id="manual-pin" class="input" placeholder="PIN번호" />
        <label class="field-label" for="manual-url">티켓 수령 링크</label>
        <input id="manual-url" class="input" placeholder="https://..." />
        <button id="btn-manual-add" class="btn btn-secondary btn-block">추가</button>
      </div>
    </section>
  `;

  let parsedRows = [];

  function renderPreview() {
    const preview = document.getElementById('parse-preview');
    if (parsedRows.length === 0) {
      preview.innerHTML = '';
      return;
    }
    preview.innerHTML = `
      <div class="preview-list">
        ${parsedRows.map((row, i) => `
          <div class="preview-row" data-idx="${i}">
            <div class="preview-row-fields">
              <input class="input input-small" data-field="registeredBy" value="${escapeHtml(row.registeredBy)}" placeholder="등록자" />
              <input class="input input-small" data-field="pin" value="${escapeHtml(row.pin)}" placeholder="PIN" />
              <input class="input input-small" data-field="url" value="${escapeHtml(row.url)}" placeholder="링크" />
            </div>
            <button type="button" class="icon-btn preview-remove" data-remove="${i}">✕</button>
          </div>
        `).join('')}
      </div>
      <button id="btn-commit-bulk" class="btn btn-primary btn-block">일괄 등록 (${parsedRows.length}건)</button>
    `;

    preview.querySelectorAll('[data-field]').forEach((input) => {
      const row = input.closest('.preview-row');
      const idx = Number(row.dataset.idx);
      input.addEventListener('input', () => {
        parsedRows[idx][input.dataset.field] = input.value;
      });
    });
    preview.querySelectorAll('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        parsedRows.splice(Number(btn.dataset.remove), 1);
        renderPreview();
      });
    });
    document.getElementById('btn-commit-bulk').addEventListener('click', async () => {
      const toAdd = parsedRows
        .filter((r) => r.pin && r.url)
        .map((r) => ({ eventId, pin: r.pin, url: r.url, registeredBy: actorName }));
      if (toAdd.length === 0) { toast('등록할 항목이 없습니다.'); return; }

      const duplicates = [];
      for (const item of toAdd) {
        if (await DB.hasDuplicatePin(eventId, item.pin)) {
          duplicates.push(item.pin);
        }
      }
      if (duplicates.length > 0) {
        toast(`PIN ${duplicates.join(', ')}은 이미 등록된 티켓입니다.`);
        return;
      }

      await DB.addTickets(toAdd);
      toast(`${toAdd.length}건 등록 완료`);
      parsedRows = [];
      document.getElementById('paste-area').value = '';
      renderPreview();
    });
  }

  document.getElementById('btn-parse').addEventListener('click', () => {
    const text = document.getElementById('paste-area').value;
    const found = parseNolMessages(text);
    if (found.length === 0) {
      toast('메시지에서 티켓 정보를 찾지 못했습니다. 수동 입력을 이용해주세요.');
      return;
    }
    parsedRows = found;
    renderPreview();
  });

  document.getElementById('btn-manual-add').addEventListener('click', async () => {
    const registeredBy = document.getElementById('manual-name').value.trim();
    const pin = document.getElementById('manual-pin').value.trim();
    const url = document.getElementById('manual-url').value.trim();
    if (!registeredBy || !pin || !url) { toast('등록자/PIN/링크를 모두 입력해주세요.'); return; }
    if (await DB.hasDuplicatePin(eventId, pin)) {
      toast(`PIN ${pin}은 이미 등록된 티켓입니다.`);
      return;
    }
    await DB.addTicket({ eventId, pin, url, registeredBy });
    toast('티켓을 등록했습니다.');
    document.getElementById('manual-pin').value = '';
    document.getElementById('manual-url').value = '';
  });
}

// ---------- 티켓 수령 ----------

async function renderTicketReceive(eventId, actorName) {
  const event = await DB.getEvent(eventId);
  if (!event) { navigate({ view: 'home' }, { replace: true }); return; }

  app.innerHTML = `<section class="view"><p class="hint">배정 중...</p></section>`;

  const tickets = await DB.getTickets(eventId);
  const totalCount = tickets.length;
  const unclaimedCount = tickets.filter((t) => t.status === 'unclaimed').length;
  let mine = tickets.find((t) => t.status === 'claimed' && norm(t.receivedBy) === norm(actorName));

  if (!mine) {
    mine = tickets.find((t) => t.status === 'unclaimed');
    if (!mine) {
      app.innerHTML = `
        <section class="view">
          <h2 class="section-title">티켓 수령 — ${escapeHtml(event.title)}</h2>
          <p class="hint">총 ${totalCount}장 중 0장 남음</p>
          <p class="empty">현재 미수령 티켓이 없습니다. 등록자에게 문의해주세요.</p>
        </section>
      `;
      return;
    }
  }

  renderAssignedTicket(event, mine, actorName, totalCount, unclaimedCount, eventId);
}

function renderAssignedTicket(event, ticket, actorName, totalCount, remainCount, eventId) {
  app.innerHTML = `
    <section class="view ticket-display">
      <h2 class="section-title">${escapeHtml(event.title)}</h2>
      <p class="hint">수령자: ${escapeHtml(actorName)}</p>
      ${totalCount !== undefined ? `<p class="hint">총 <strong>${totalCount}장</strong> 중 <strong>${remainCount}장</strong> 남음</p>` : ''}
      <div class="ticket-card">
        <div class="pin-label">PIN 번호</div>
        <div class="pin-display">${escapeHtml(ticket.pin)}</div>
        <a href="${escapeHtml(ticket.url)}" target="_blank" rel="noopener" class="btn btn-primary btn-large btn-block">🎟 티켓 받기 (링크 열기)</a>
      </div>
      <button id="btn-confirm-received" class="btn btn-secondary btn-large btn-block">✓ 수령 완료</button>
      <button id="btn-swap" class="btn btn-ghost btn-block">다른 티켓 받기</button>
    </section>
  `;

  const confirmBtn = document.getElementById('btn-confirm-received');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      await DB.updateTicket(ticket.id, {
        status: 'claimed',
        receivedBy: actorName,
        receivedAt: new Date().toISOString(),
      });
      toast('티켓 수령을 완료했습니다.');
      navigate({ view: 'event-detail', eventId: eventId }, { replace: true });
    });
  }

  const swapBtn = document.getElementById('btn-swap');
  swapBtn.addEventListener('click', async () => {
    swapBtn.disabled = true;
    try {
      await DB.updateTicket(ticket.id, { status: 'unclaimed', receivedBy: null, receivedAt: null });
      const allTickets = await DB.getTickets(event.id);
      const newTotal = allTickets.length;
      const newRemain = allTickets.filter((t) => t.status === 'unclaimed').length;
      const free = allTickets.find((t) => t.status === 'unclaimed' && t.id !== ticket.id);
      if (!free) {
        await DB.updateTicket(ticket.id, {
          status: 'claimed', receivedBy: actorName, receivedAt: new Date().toISOString(),
        });
        toast('다른 미수령 티켓이 없습니다.');
        renderAssignedTicket(event, ticket, actorName, newTotal, newRemain - 1, eventId);
        return;
      }
      const newTicket = await DB.updateTicket(free.id, {
        status: 'claimed', receivedBy: actorName, receivedAt: new Date().toISOString(),
      });
      toast('다른 티켓이 배정되었습니다.');
      renderAssignedTicket(event, newTicket, actorName, newTotal, newRemain - 1, eventId);
    } catch (err) {
      toast('오류가 발생했습니다. 다시 시도해주세요.');
      renderAssignedTicket(event, ticket, actorName, totalCount, remainCount, eventId);
    }
  });
}

// ---------- 현황 조회 ----------

async function renderStatus(eventId) {
  const event = await DB.getEvent(eventId);
  if (!event) { navigate({ view: 'home' }, { replace: true }); return; }
  const tickets = await DB.getTickets(eventId);
  tickets.sort((a, b) => a.registeredAt.localeCompare(b.registeredAt));

  const total = tickets.length;
  const receivedCount = tickets.filter((t) => t.status === 'claimed').length;
  const unclaimedCount = total - receivedCount;

  const receivedNames = new Set(
    tickets.filter((t) => t.status === 'claimed').map((t) => norm(t.receivedBy))
  );
  const notReceived = (event.participants || []).filter((p) => !receivedNames.has(norm(p)));

  app.innerHTML = `
    <section class="view">
      <h2 class="section-title">현황 조회 — ${escapeHtml(event.title)}</h2>

      <div class="summary-card">
        총 <strong>${total}</strong>장 중 <strong class="text-success">${receivedCount}장 수령완료</strong>,
        <strong class="text-danger">${unclaimedCount}장 미수령</strong>
      </div>

      ${(event.participants || []).length ? `
        <div class="card">
          <h3>아직 안 받은 사람 (참고용)</h3>
          ${notReceived.length
            ? `<ul class="name-list">${notReceived.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`
            : '<p class="hint">참석자 명단 기준으로 전원 수령 완료로 보입니다 🎉</p>'}
        </div>
      ` : ''}

      <div class="card table-card">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <h3>티켓 목록 (${total})</h3>
          <button id="btn-admin-auth" class="btn btn-small btn-secondary">🔐 관리자 권한</button>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr><th>등록자</th><th>PIN</th><th>등록일시</th><th>수령자</th><th>수령일시</th><th></th></tr>
            </thead>
            <tbody>
              ${tickets.length ? tickets.map(ticketRowHtml).join('') : '<tr><td colspan="6" class="empty">등록된 티켓이 없습니다.</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3>경기 결과</h3>
        ${event.result ? `
          <div style="display: flex; gap: 8px; align-items: center;">
            <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(event.title.split(' vs ')[0])}</span>
            <span style="flex: 1; text-align: center; font-weight: 700; font-size: 1.1rem;" id="result-display"></span>
            <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(event.title.split(' vs ')[1])}</span>
          </div>
          <button id="btn-edit-result" class="btn btn-secondary btn-block">수정</button>
        ` : `
          ${event.date > todayStr() ? `
            <p class="hint">경기 당일 이후에 결과를 입력할 수 있습니다.</p>
          ` : `
            <div style="display: flex; gap: 8px; align-items: center;">
              <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(event.title.split(' vs ')[0])}</span>
              <input id="result-home" class="input" type="number" inputmode="numeric" min="0" placeholder="점수" style="flex: 1; text-align: center;" />
              <span style="flex-shrink: 0; font-size: 1.1rem;">:</span>
              <input id="result-away" class="input" type="number" inputmode="numeric" min="0" placeholder="점수" style="flex: 1; text-align: center;" />
              <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(event.title.split(' vs ')[1])}</span>
            </div>
            <button id="btn-save-result" class="btn btn-secondary btn-block">저장</button>
          `}
        `}
      </div>
    </section>
  `;

  if (event.result) {
    const resultDisplay = document.getElementById('result-display');
    if (resultDisplay) {
      resultDisplay.textContent = event.result.replace(/ vs /, ' ');
    }
    const editBtn = document.getElementById('btn-edit-result');
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        openResultEditModal(eventId, event);
      });
    }
  } else if (event.date <= todayStr()) {
    const saveBtn = document.getElementById('btn-save-result');
    const homeInput = document.getElementById('result-home');
    const awayInput = document.getElementById('result-away');
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const home = homeInput.value.trim();
        const away = awayInput.value.trim();
        if (!home || !away) {
          toast('홈팀과 원정팀 점수를 모두 입력해주세요.');
          return;
        }
        const [homeTeam, awayTeam] = event.title.split(' vs ').map((s) => s.trim());
        const result = `${homeTeam} ${home} : ${awayTeam} ${away}`;
        await DB.updateEvent(eventId, { result });
        toast('경기 결과를 저장했습니다.');
        renderStatus(eventId);
      });
    }
  }

  const adminAuthBtn = document.getElementById('btn-admin-auth');
  if (adminAuthBtn) {
    adminAuthBtn.addEventListener('click', () => {
      openAdminPasswordModal(() => {
        app.querySelectorAll('.ticket-action-btn').forEach((btn) => {
          btn.removeAttribute('hidden');
        });
        toast('관리자 권한이 활성화되었습니다.');
      });
    });
  }

  app.querySelectorAll('[data-edit-ticket]').forEach((btn) => {
    btn.addEventListener('click', () => openTicketEditModal(btn.dataset.editTicket, eventId));
  });
  app.querySelectorAll('[data-reset-ticket]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('티켓 수령 내역을 초기화하시겠습니까?')) return;
      await DB.updateTicket(btn.dataset.resetTicket, {
        status: 'unclaimed',
        receivedBy: null,
        receivedAt: null,
      });
      toast('수령 상태를 초기화했습니다.');
      renderStatus(eventId);
    });
  });
  app.querySelectorAll('[data-delete-ticket]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('이 티켓을 삭제할까요?')) return;
      await DB.deleteTicket(btn.dataset.deleteTicket);
      toast('티켓을 삭제했습니다.');
      renderStatus(eventId);
    });
  });
}

function openResultEditModal(eventId, event) {
  const parseResult = (result) => {
    if (!result) return { home: '', away: '' };
    const match = result.match(/^([^:]+)\s+(\d+)\s*:\s*(.+)\s+(\d+)$/);
    return match ? { home: match[2], away: match[4] } : { home: '', away: '' };
  };

  const { home: homeScore, away: awayScore } = parseResult(event.result);
  const [homeTeam, awayTeam] = event.title.split(' vs ').map((s) => s.trim());

  openModal(`
    <h3>경기 결과 수정</h3>
    <div style="display: flex; gap: 8px; align-items: center;">
      <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(homeTeam)}</span>
      <input id="edit-home" class="input" type="number" inputmode="numeric" min="0" value="${homeScore}" style="flex: 1; text-align: center;" />
      <span style="flex-shrink: 0; font-size: 1.1rem;">:</span>
      <input id="edit-away" class="input" type="number" inputmode="numeric" min="0" value="${awayScore}" style="flex: 1; text-align: center;" />
      <span style="flex-shrink: 0; font-weight: 600;">${escapeHtml(awayTeam)}</span>
    </div>
    <div class="modal-actions">
      <button id="edit-cancel" class="btn btn-ghost">취소</button>
      <button id="edit-save" class="btn btn-primary">저장</button>
    </div>
  `);

  document.getElementById('edit-cancel').addEventListener('click', closeModal);
  document.getElementById('edit-save').addEventListener('click', async () => {
    const home = document.getElementById('edit-home').value.trim();
    const away = document.getElementById('edit-away').value.trim();
    if (!home || !away) {
      toast('점수를 모두 입력해주세요.');
      return;
    }
    const result = `${homeTeam} ${home} : ${awayTeam} ${away}`;
    await DB.updateEvent(eventId, { result });
    closeModal();
    toast('경기 결과를 수정했습니다.');
    renderStatus(eventId);
  });
}

function ticketRowHtml(ticket) {
  const unclaimed = ticket.status === 'unclaimed';
  const claimed = ticket.status === 'claimed';
  return `
    <tr class="${unclaimed ? 'row-unclaimed' : ''}">
      <td>${escapeHtml(ticket.registeredBy)}</td>
      <td>${escapeHtml(ticket.pin)}</td>
      <td>${formatDateTime(ticket.registeredAt)}</td>
      <td>${ticket.receivedBy ? escapeHtml(ticket.receivedBy) : '<span class="text-danger">미수령</span>'}</td>
      <td>${formatDateTime(ticket.receivedAt)}</td>
      <td class="row-actions">
        ${ticket.url ? `<a href="${escapeHtml(ticket.url)}" target="_blank" rel="noopener" class="icon-btn" aria-label="티켓보기" title="새 탭에서 열기">🎟</a>` : ''}
        <button class="icon-btn ticket-action-btn" data-edit-ticket="${ticket.id}" aria-label="수정" hidden>✎</button>
        ${claimed ? `<button class="icon-btn ticket-action-btn" data-reset-ticket="${ticket.id}" aria-label="초기화" title="수령 초기화" hidden>↺</button>` : ''}
        <button class="icon-btn ticket-action-btn" data-delete-ticket="${ticket.id}" aria-label="삭제" hidden>🗑</button>
      </td>
    </tr>
  `;
}

async function openTicketEditModal(ticketId, eventId) {
  const ticket = await DB.getTicket(ticketId);
  if (!ticket) return;
  openModal(`
    <h3>티켓 정보 수정</h3>
    <label class="field-label" for="et-registered">등록자</label>
    <input id="et-registered" class="input" value="${escapeHtml(ticket.registeredBy)}" />
    <label class="field-label" for="et-pin">PIN번호</label>
    <input id="et-pin" class="input" value="${escapeHtml(ticket.pin)}" />
    <label class="field-label" for="et-url">티켓 수령 링크</label>
    <input id="et-url" class="input" value="${escapeHtml(ticket.url)}" />
    <label class="field-label" for="et-received">수령자 (비워두면 미수령 처리)</label>
    <input id="et-received" class="input" value="${escapeHtml(ticket.receivedBy ?? '')}" />
    <div class="modal-actions">
      <button id="et-cancel" class="btn btn-ghost">취소</button>
      <button id="et-save" class="btn btn-primary">저장</button>
    </div>
  `);
  document.getElementById('et-cancel').addEventListener('click', closeModal);
  document.getElementById('et-save').addEventListener('click', async () => {
    const receivedBy = document.getElementById('et-received').value.trim();
    const patch = {
      registeredBy: document.getElementById('et-registered').value.trim(),
      pin: document.getElementById('et-pin').value.trim(),
      url: document.getElementById('et-url').value.trim(),
      receivedBy: receivedBy || null,
      status: receivedBy ? 'claimed' : 'unclaimed',
      receivedAt: receivedBy ? (ticket.receivedAt ?? new Date().toISOString()) : null,
    };
    await DB.updateTicket(ticketId, patch);
    closeModal();
    toast('티켓 정보를 저장했습니다.');
    renderStatus(eventId);
  });
}

// ---------- 시작 ----------

navigate({ view: 'home' }, { replace: true });
