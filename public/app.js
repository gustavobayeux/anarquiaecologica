const API_BASE = '';

function $(id) {
  return document.getElementById(id);
}

function formatPriceBRL(value) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

function loadFavorites() {
  try {
    return JSON.parse(localStorage.getItem('ae_favorites') || '[]');
  } catch {
    return [];
  }
}

function saveFavorites(favs) {
  localStorage.setItem('ae_favorites', JSON.stringify(favs));
}

function getAuth() {
  try {
    const raw = localStorage.getItem('ae_auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setAuth(auth) {
  if (!auth) {
    localStorage.removeItem('ae_auth');
  } else {
    localStorage.setItem('ae_auth', JSON.stringify(auth));
  }
}

function loadTheme() {
  const saved = localStorage.getItem('ae_theme');
  if (saved === 'dark' || saved === 'light') {
    return saved;
  }
  return 'light';
}

function setTheme(theme) {
  localStorage.setItem('ae_theme', theme);
  applyTheme(theme);
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    document.body.classList.remove('light-mode');
    $('theme-toggle-btn').textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    document.body.classList.add('light-mode');
    $('theme-toggle-btn').textContent = '🌙';
  }
}

function applyFrutigerFromStorage() {
  const flag = localStorage.getItem('ae_frutiger');
  if (flag === '1') {
    document.body.classList.add('frutiger-aero');
  } else {
    document.body.classList.remove('frutiger-aero');
  }
}

// State
let properties = [];
let favorites = loadFavorites();
let currentFilterStatus = 'todos';
let socket;
let currentTheme = loadTheme();
let chatChannels = {}; // {propertyId: {enabled: bool, messages: []}}

async function fetchProperties() {
  const q = $('#search-query').value.trim();
  const city = $('#search-city').value.trim();
  const params = new URLSearchParams();
  if (currentFilterStatus) params.append('status', currentFilterStatus);
  if (q) params.append('q', q);
  if (city) params.append('city', city);

  const res = await fetch(`/api/properties?${params.toString()}`);
  const data = await res.json();
  properties = data;
  renderProperties();
}

function renderProperties() {
  const grid = $('properties-grid');
  grid.innerHTML = '';

  properties.forEach(p => {
    const card = document.createElement('article');
    card.className = 'property-card';

    const boosted =
      p.boost_expires_at && new Date(p.boost_expires_at) > new Date();
    const isFav = favorites.includes(p.id);
    const chatEnabled = chatChannels[p.id]?.enabled || false;

    card.innerHTML = `
      <div class="property-image-wrapper">
        <img src="${p.image_url ||
          'https://images.pexels.com/photos/106399/pexels-photo-106399.jpeg'}" alt="${p.title}">
        <div class="property-badge">${
          p.status === 'lancamento' ? 'Lançamento' : 'À venda'
        }</div>
        <button class="property-fav ${isFav ? 'favorited' : ''}" data-id="${
      p.id
    }" aria-label="Favoritar imóvel">
          ${isFav ? '❤' : '♡'}
        </button>
      </div>
      <div class="property-body">
        <div class="property-title">${p.title}</div>
        <div class="property-location">${p.neighborhood} · ${p.city}, ${
      p.state
    }</div>
        <div class="property-price-row">
          <div>
            <div class="property-price">${formatPriceBRL(p.price)}</div>
            ${
              p.price_old
                ? `<div class="property-price-old">${formatPriceBRL(
                    p.price_old
                  )}</div>`
                : ''
            }
          </div>
        </div>
        <div class="property-tags">
          <span class="badge cash">À vista</span>
          <span class="badge installments">Estuda parcelamento</span>
        </div>
        <div class="property-meta">
          <span>🛏 ${p.bedrooms ?? 0} </span>
          <span>🛁 ${p.bathrooms ?? 0}</span>
          <span>📐 ${p.area ?? 0}m²</span>
        </div>
      </div>
      <div class="property-footer">
        <button class="btn outline small">Ver mais</button>
        <div style="display: flex; gap: 0.4rem; flex: 1; justify-content: flex-end;">
          <span class="chat-enable-toggle ${chatEnabled ? '' : 'disabled'}" data-id="${p.id}" title="Chat ativo" style="cursor: pointer;">
            💬 ${chatEnabled ? 'Ativo' : 'Off'}
          </span>
          <button class="btn ghost small boost-btn" data-id="${
            p.id
          }">Destaque R$ 2</button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  $('results-count').textContent =
    properties.length === 0
      ? 'Nenhum imóvel encontrado'
      : `${properties.length} imóveis encontrados`;
}

function handleGridClick(e) {
  const favBtn = e.target.closest('.property-fav');
  if (favBtn) {
    const id = Number(favBtn.dataset.id);
    const idx = favorites.indexOf(id);
    if (idx >= 0) favorites.splice(idx, 1);
    else favorites.push(id);
    saveFavorites(favorites);
    renderProperties();
    return;
  }

  const boostBtn = e.target.closest('.boost-btn');
  if (boostBtn) {
    const id = Number(boostBtn.dataset.id);
    startBoostFlow(id);
    return;
  }

  const chatToggle = e.target.closest('.chat-enable-toggle');
  if (chatToggle) {
    const propertyId = Number(chatToggle.dataset.id);
    togglePropertyChat(propertyId);
    return;
  }
}

function togglePropertyChat(propertyId) {
  if (!chatChannels[propertyId]) {
    chatChannels[propertyId] = { enabled: true, messages: [] };
  } else {
    chatChannels[propertyId].enabled = !chatChannels[propertyId].enabled;
  }
  localStorage.setItem('ae_chat_channels', JSON.stringify(chatChannels));
  renderProperties();
}

async function startBoostFlow(propertyId) {
  const auth = getAuth();
  if (!auth || auth.user.role !== 'advertiser') {
    alert('Entre como anunciante para solicitar destaque.');
    openLoginModal();
    return;
  }

  const confirmed = confirm(
    'Destaque de 7 dias por R$ 2 via PIX.\n\n1. Envie R$ 2 para o PIX: gustavobayeux@gmail.com\n2. Depois, envie o comprovante.\n\nContinuar?'
  );
  if (!confirmed) return;

  const res = await fetch('/api/boosts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`
    },
    body: JSON.stringify({ propertyId })
  });

  if (!res.ok) {
    alert('Erro ao solicitar destaque.');
    return;
  }
  const data = await res.json();

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,application/pdf';
  input.onchange = async () => {
    if (!input.files || !input.files[0]) return;
    const form = new FormData();
    form.append('receipt', input.files[0]);
    const upRes = await fetch(`/api/boosts/${data.id}/receipt`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` },
      body: form
    });
    if (!upRes.ok) {
      alert('Erro ao enviar comprovante.');
    } else {
      alert('Comprovante enviado! Aguarde o admin aprovar o destaque.');
    }
  };
  input.click();
}

function initFilters() {
  const chips = Array.from(document.querySelectorAll('.hero-filters .chip'));
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentFilterStatus = chip.dataset.status || 'todos';
      fetchProperties();
    });
  });
}

function openLoginModal() {
  $('login-modal').classList.remove('hidden');
}

function closeLoginModal() {
  $('login-modal').classList.add('hidden');
}

function renderUserButtons() {
  const auth = getAuth();
  const createBtn = $('create-listing-btn');
  const loginBtn = $('advertiser-login-btn');
  if (!createBtn || !loginBtn) return;
  if (auth && auth.user && auth.user.role === 'advertiser') {
    createBtn.classList.remove('hidden');
    loginBtn.classList.add('hidden');
  } else {
    createBtn.classList.add('hidden');
    loginBtn.classList.remove('hidden');
  }
}

function initLogin() {
  $('advertiser-login-btn').addEventListener('click', openLoginModal);
  const loginClose = $('login-close');
  const loginBackdrop = $('login-backdrop');
  if (loginClose) loginClose.addEventListener('click', closeLoginModal);
  if (loginBackdrop) loginBackdrop.addEventListener('click', closeLoginModal);

  $('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('login-email').value.trim();
    const password = $('login-password').value;
    const errorBox = $('login-error');
    errorBox.classList.add('hidden');
    errorBox.textContent = '';

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, role: 'advertiser' })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Falha no login');
      }
      const data = await res.json();
      setAuth(data);
      closeLoginModal();
      renderUserButtons();
      alert('Login de anunciante realizado com sucesso!');
    } catch (err) {
      errorBox.textContent = err.message;
      errorBox.classList.remove('hidden');
    }
  });
}

// Create listing modal and flow
function initCreateListing() {
  const createBtn = $('create-listing-btn');
  const modal = $('create-listing-modal');
  if (!createBtn || !modal) return;
  const close = $('create-close');
  const backdrop = $('create-backdrop');
  createBtn.addEventListener('click', () => modal.classList.remove('hidden'));
  close.addEventListener('click', () => modal.classList.add('hidden'));
  backdrop.addEventListener('click', () => modal.classList.add('hidden'));

  $('create-listing-form').addEventListener('submit', async e => {
    e.preventDefault();
    const auth = getAuth();
    if (!auth || auth.user.role !== 'advertiser') {
      alert('Entre como anunciante para criar anúncios.');
      return;
    }
    const payload = {
      title: $('create-title').value.trim(),
      neighborhood: $('create-neighborhood').value.trim(),
      city: $('create-city').value.trim(),
      state: $('create-state').value.trim(),
      price: Number($('create-price').value) || 0,
      status: $('create-status').value,
      image_url: $('create-image').value.trim() || null
    };
    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auth.token}`
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      alert('Erro ao criar anúncio');
      return;
    }
    modal.classList.add('hidden');
    await fetchProperties();
    alert('Anúncio criado com sucesso!');
  });
}

function showAdminView() {
  const landingView = $('landing-view');
  const adminView = $('admin-view');
  if (landingView) landingView.classList.add('hidden');
  if (adminView) adminView.classList.remove('hidden');
}

function showLandingView() {
  const landingView = $('landing-view');
  const adminView = $('admin-view');
  if (landingView) landingView.classList.remove('hidden');
  if (adminView) adminView.classList.add('hidden');
}

function initAdminRouting() {
  if (window.location.pathname === '/admin') {
    const auth = getAuth();
    if (!auth || auth.user.role !== 'admin') {
      const overlay = $('admin-login-overlay');
      if (overlay) overlay.classList.remove('hidden');
    } else {
      const overlay = $('admin-login-overlay');
      if (overlay) overlay.classList.add('hidden');
      const label = $('admin-user-label');
      if (label) label.textContent = `${auth.user.name} · ${auth.user.email}`;
      showAdminView();
      loadBoosts();
      loadUsers();
    }
  } else {
    showLandingView();
  }

  const adminLink = $('admin-link-btn');
  if (adminLink) {
    adminLink.addEventListener('click', () => {
      window.location.href = '/admin';
    });
  }

  const loginForm = $('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async e => {
      e.preventDefault();
      const email = $('admin-login-email').value.trim();
      const password = $('admin-login-password').value;
      const errorBox = $('admin-login-error');
      errorBox.classList.add('hidden');
      errorBox.textContent = '';
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role: 'admin' })
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Falha no login');
        }
        const data = await res.json();
        setAuth(data);
        const overlay = $('admin-login-overlay');
        const label = $('admin-user-label');
        if (overlay) overlay.classList.add('hidden');
        if (label) label.textContent = `${data.user.name} · ${data.user.email}`;
        showAdminView();
        loadBoosts();
        loadUsers();
      } catch (err) {
        errorBox.textContent = err.message;
        errorBox.classList.remove('hidden');
      }
    });
  }

  const logoutBtn = $('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      setAuth(null);
      window.location.href = '/';
    });
  }
}

async function loadBoosts() {
  const auth = getAuth();
  if (!auth || auth.user.role !== 'admin') return;

  const res = await fetch('/api/boosts', {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  const list = $('boosts-list');
  if (!list) return;
  list.innerHTML = '';
  if (data.length === 0) {
    list.innerHTML = '<p class="muted small">Nenhuma solicitação até o momento.</p>';
    return;
  }

  data.forEach(b => {
    const item = document.createElement('div');
    item.className = 'boost-item';
    item.innerHTML = `
      <div>
        <div><strong>${b.title}</strong></div>
        <div class="muted small">Anunciante: ${b.advertiser_name}</div>
      </div>
      <div>
        <div><span class="status-pill ${b.status}">${b.status}</span></div>
        ${
          b.receipt_path
            ? `<a href="${b.receipt_path}" target="_blank" class="small">Ver comprovante</a>`
            : '<span class="small muted">Aguardando comprovante</span>'
        }
      </div>
      <div class="boost-actions">
        <button class="btn small primary approve-boost" data-id="${b.id}">Aprovar</button>
        <button class="btn small ghost reject-boost" data-id="${b.id}">Rejeitar</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.onclick = async e => {
    const approve = e.target.closest('.approve-boost');
    const reject = e.target.closest('.reject-boost');
    if (!approve && !reject) return;
    const id = approve
      ? Number(approve.dataset.id)
      : Number(reject.dataset.id);
    const action = approve ? 'approve' : 'reject';
    const url = `/api/boosts/${id}/${action}`;
    const res2 = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    if (!res2.ok) {
      alert('Erro ao atualizar boost');
      return;
    }
    await loadBoosts();
    await fetchProperties();
  };
}

async function loadUsers() {
  const auth = getAuth();
  if (!auth || auth.user.role !== 'admin') return;
  const res = await fetch('/api/users', {
    headers: { Authorization: `Bearer ${auth.token}` }
  });
  if (!res.ok) return;
  const data = await res.json();
  const list = $('users-list');
  if (!list) return;
  list.innerHTML = '';
  if (!data || data.length === 0) {
    list.innerHTML = '<p class="muted small">Nenhuma conta encontrada.</p>';
    return;
  }
  data.forEach(u => {
    const item = document.createElement('div');
    item.className = 'boost-item';
    item.innerHTML = `
      <div>
        <div><strong>${u.name}</strong></div>
        <div class="muted small">${u.email} · ${u.role}</div>
      </div>
      <div>
        <div class="small muted">Criado: ${new Date(u.created_at).toLocaleString()}</div>
      </div>
      <div class="boost-actions">
        <button class="btn small ghost delete-user" data-id="${u.id}">Remover</button>
      </div>
    `;
    list.appendChild(item);
  });

  list.onclick = async e => {
    const del = e.target.closest('.delete-user');
    if (!del) return;
    if (!confirm('Remover usuário? Esta ação é irreversível.')) return;
    const id = Number(del.dataset.id);
    const res2 = await fetch(`/api/users/${id}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auth.token}` }
    });
    if (!res2.ok) {
      alert('Erro ao remover usuário');
      return;
    }
    await loadUsers();
  };
}

function initChat() {
  socket = io();

  const chatPanel = $('chat-panel');
  const chatToggle = $('chat-toggle');
  const chatClose = $('chat-close');
  const chatMessages = $('chat-messages');
  const chatForm = $('chat-form');
  const chatInput = $('chat-input');

  if (!chatToggle || !chatPanel) return;

  chatToggle.addEventListener('click', () => {
    chatPanel.classList.toggle('hidden');
  });
  if (chatClose) {
    chatClose.addEventListener('click', () => {
      chatPanel.classList.add('hidden');
    });
  }

  function appendChatMessage(target, msg, fromAdmin) {
    const wrap = document.createElement('div');
    wrap.className = `chat-message ${fromAdmin ? 'admin' : 'me'}`;
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${fromAdmin ? 'admin' : 'me'}`;
    bubble.textContent = msg.text;
    const meta = document.createElement('div');
    meta.className = 'chat-meta';
    meta.textContent = fromAdmin ? 'Admin' : 'Você';
    wrap.appendChild(bubble);
    wrap.appendChild(meta);
    target.appendChild(wrap);
    target.scrollTop = target.scrollHeight;
  }

  if (chatForm) {
    chatForm.addEventListener('submit', e => {
      e.preventDefault();
      const text = chatInput.value.trim();
      if (!text) return;
      const payload = { from: 'visitor', text };
      socket.emit('chat:message', payload);
      chatInput.value = '';
    });
  }

  const adminMessages = $('admin-chat-messages');

  const adminChatForm = $('admin-chat-form');
  if (adminChatForm) {
    adminChatForm.addEventListener('submit', e => {
      e.preventDefault();
      const input = $('admin-chat-input');
      const text = input.value.trim();
      if (!text) return;
      const payload = { from: 'admin', text };
      socket.emit('chat:message', payload);
      input.value = '';
    });
  }

  socket.on('chat:message', msg => {
    if (msg.from === 'admin') {
      if (chatMessages) appendChatMessage(chatMessages, msg, true);
      if (adminMessages) appendChatMessage(adminMessages, msg, true);
    } else {
      if (chatMessages) appendChatMessage(chatMessages, msg, false);
      if (adminMessages) appendChatMessage(adminMessages, msg, false);
    }
  });
}

function initSearch() {
  const searchBtn = $('search-btn');
  const searchQuery = $('search-query');
  const searchCity = $('search-city');

  if (searchBtn) {
    searchBtn.addEventListener('click', () => {
      fetchProperties();
    });
  }
  if (searchQuery) {
    searchQuery.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchProperties();
      }
    });
  }
  if (searchCity) {
    searchCity.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        fetchProperties();
      }
    });
  }
}

function initThemeToggle() {
  const themeBtn = $('theme-toggle-btn');
  if (!themeBtn) return;
  applyTheme(currentTheme);
  themeBtn.addEventListener('click', () => {
    currentTheme = currentTheme === 'light' ? 'dark' : 'light';
    setTheme(currentTheme);
  });
}

function initFrutigerToggle() {
  applyFrutigerFromStorage();
  const toggle = $('toggle-frutiger-btn');
  if (!toggle) return;
  toggle.addEventListener('click', () => {
    const current = localStorage.getItem('ae_frutiger') === '1';
    localStorage.setItem('ae_frutiger', current ? '0' : '1');
    applyFrutigerFromStorage();
  });
}

window.addEventListener('DOMContentLoaded', () => {
  // Load chat channels from storage
  try {
    const saved = localStorage.getItem('ae_chat_channels');
    if (saved) chatChannels = JSON.parse(saved);
  } catch (e) {
    chatChannels = {};
  }

  initFilters();
  initSearch();
  initLogin();
  initAdminRouting();
  initThemeToggle();
  renderUserButtons();
  initCreateListing();
  initFrutigerToggle();
  initChat();
  const grid = $('properties-grid');
  if (grid) grid.addEventListener('click', handleGridClick);
  const loadMoreBtn = $('load-more-btn');
  if (loadMoreBtn) loadMoreBtn.addEventListener('click', fetchProperties);
  fetchProperties();
});

