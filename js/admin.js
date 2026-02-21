// ============================================================
// CLOUDFLIX – Admin JS
// ============================================================

let currentPanel = 'dashboard';
let editingItem = null;
let editingType = null;

document.addEventListener('DOMContentLoaded', () => {
  // Setup CLOUDFLIX_DATA if not defined
  if (typeof CLOUDFLIX_DATA === 'undefined') {
    window.CLOUDFLIX_DATA = { channels: [], movies: [], series: [] };
  }

  // If already logged in as admin (e.g. page refresh), init immediately
  const user = getCurrentUser();
  if (user && user.role === 'admin') {
    initAdmin();
  }
  // Otherwise, the login overlay in admin.html will call initAdmin() after auth
});

// Called by admin.html login overlay after successful admin login
async function initAdmin() {
  if (typeof CLOUDFLIX_DATA === 'undefined') {
    window.CLOUDFLIX_DATA = { channels: [], movies: [], series: [] };
  }
  await loadDashboardStats();
  renderAll();
}

// ── TOAST ─────────────────────────────────────────────────
function showToast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── PANELS ────────────────────────────────────────────────
function showPanel(name, el) {
  const panels = document.querySelectorAll('.panel-section');
  panels.forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name)?.classList.add('active');

  document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
  if (el) el.classList.add('active');

  currentPanel = name;
  const titles = {
    dashboard: ['Dashboard', 'Visão geral da plataforma'],
    channels: ['Canais ao Vivo', 'Gerencie os canais disponíveis'],
    movies: ['Filmes', 'Gerencie o catálogo de filmes'],
    series: ['Séries', 'Gerencie o catálogo de séries'],
    users: ['Usuários', 'Gerencie os membros da plataforma'],
  };
  const [title, subtitle] = titles[name] || ['—', ''];
  document.getElementById('panel-title').textContent = title;
  document.getElementById('panel-subtitle').textContent = subtitle;

  const showAdd = ['channels', 'movies', 'series'].includes(name);
  document.getElementById('add-btn').style.display = showAdd ? 'flex' : 'none';
}

// ── RENDER ALL ────────────────────────────────────────────
function renderAll() {
  updateCounts();
  renderDashboard();
  renderChannelsTable(CLOUDFLIX_DATA.channels);
  renderMoviesTable(CLOUDFLIX_DATA.movies);
  renderSeriesTable(CLOUDFLIX_DATA.series);
  renderUsersTable(getUsers());
}

async function loadDashboardStats() {
  try {
    const live = await getLiveCategories();
    const vod = await getVodCategories();
    const ser = await getSeriesCategories();

    document.getElementById('count-channels').textContent = live.length + ' cat';
    document.getElementById('count-movies').textContent = vod.length + ' cat';
    document.getElementById('count-series').textContent = ser.length + ' cat';
    document.getElementById('count-users').textContent = getUsers().length;
  } catch (e) {
    console.warn('Failed to load admin stats', e);
  }
}

// ── DASHBOARD ─────────────────────────────────────────────
async function renderDashboard() {
  const users = getUsers();

  // We show categories counts for the dashboard cards
  const stats = [
    { label: 'Categorias TV', value: (await getLiveCategories()).length, icon: '📺', color: '#e50914' },
    { label: 'Categorias VOD', value: (await getVodCategories()).length, icon: '🎬', color: '#f5c518' },
    { label: 'Categorias Séries', value: (await getSeriesCategories()).length, icon: '🎭', color: '#1db954' },
    { label: 'Usuários Registrados', value: users.length, icon: '👥', color: '#6c5ce7' },
  ];

  const grid = document.getElementById('stats-grid');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card" style="--c:${s.color}">
      <div class="stat-icon">${s.icon}</div>
      <div class="stat-value">${s.value}</div>
      <div class="stat-label">${s.label}</div>
    </div>
  `).join('');

  // Dashboard Recent Table: Show first few live categories or items if already cached
  const tbody = document.getElementById('recent-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="table-empty">O conteúdo é gerenciado via servidor Xtream API.</td></tr>';
}

// ── CHANNELS TABLE ────────────────────────────────────────
function renderChannelsTable(items) {
  const tbody = document.getElementById('channels-table-body');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="5" class="table-empty">Nenhum canal cadastrado.</td></tr>'; return; }
  tbody.innerHTML = items.map(c => `
    <tr>
      <td><img class="td-thumb" src="${c.thumb || ''}" alt="" onerror="this.style.visibility='hidden'" style="border-radius:4px" /></td>
      <td class="td-title">${c.title}</td>
      <td>${c.category}</td>
      <td><code style="font-size:11px;color:var(--text-muted)">${c.slug}</code></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick='openEditModal(${JSON.stringify(c)}, "canal")'>✏️ Editar</button>
          <button class="action-btn delete" onclick="deleteItem('canal','${c.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderMoviesTable(items) {
  const tbody = document.getElementById('movies-table-body');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhum filme cadastrado.</td></tr>'; return; }
  tbody.innerHTML = items.map(m => `
    <tr>
      <td><img class="td-thumb" src="${m.thumb || ''}" alt="" onerror="this.style.visibility='hidden'" /></td>
      <td class="td-title">${m.title}</td>
      <td>${m.category}</td>
      <td>${m.year || '—'}</td>
      <td><code style="font-size:11px;color:var(--text-muted)">${m.slug}</code></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick='openEditModal(${JSON.stringify(m)}, "filme")'>✏️ Editar</button>
          <button class="action-btn delete" onclick="deleteItem('filme','${m.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderSeriesTable(items) {
  const tbody = document.getElementById('series-table-body');
  if (!items.length) { tbody.innerHTML = '<tr><td colspan="6" class="table-empty">Nenhuma série cadastrada.</td></tr>'; return; }
  tbody.innerHTML = items.map(s => `
    <tr>
      <td><img class="td-thumb" src="${s.thumb || ''}" alt="" onerror="this.style.visibility='hidden'" /></td>
      <td class="td-title">${s.title}</td>
      <td>${s.category}</td>
      <td>${s.seasons || '—'} temp.</td>
      <td><code style="font-size:11px;color:var(--text-muted)">${s.slug}</code></td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick='openEditModal(${JSON.stringify(s)}, "serie")'>✏️ Editar</button>
          <button class="action-btn delete" onclick="deleteItem('serie','${s.id}')">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderUsersTable(users) {
  const tbody = document.getElementById('users-table-body');
  tbody.innerHTML = users.map(u => `
    <tr>
      <td>
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#e50914,#ff6b6b);display:flex;align-items:center;justify-content:center;font-weight:700">
          ${u.name.charAt(0)}
        </div>
      </td>
      <td class="td-title">${u.name}</td>
      <td style="color:var(--text-secondary)">${u.email}</td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-live' : 'badge-hd'}">${u.role}</span></td>
      <td>${u.plan}</td>
      <td>
        <div class="action-btns">
          <button class="action-btn edit" onclick='openUserModal(${JSON.stringify(u)})'>✏️ Editar</button>
          <button class="action-btn delete" onclick="deleteUser(${u.id})">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');
}

// ── FILTER ────────────────────────────────────────────────
function filterTable(type, q) {
  q = q.toLowerCase();
  if (type === 'channel') {
    renderChannelsTable(CLOUDFLIX_DATA.channels.filter(c => c.title.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)));
  } else if (type === 'movie') {
    renderMoviesTable(CLOUDFLIX_DATA.movies.filter(m => m.title.toLowerCase().includes(q) || m.category.toLowerCase().includes(q)));
  } else if (type === 'serie') {
    renderSeriesTable(CLOUDFLIX_DATA.series.filter(s => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)));
  }
}

// ── CONTENT MODAL ─────────────────────────────────────────
function openAddModal() {
  editingItem = null;
  editingType = currentPanel === 'channels' ? 'canal' : currentPanel === 'movies' ? 'filme' : 'serie';
  document.getElementById('modal-title').textContent = 'Adicionar Conteúdo';
  document.getElementById('content-form').reset();
  document.getElementById('f-type').value = editingType;
  updateFormForType();
  document.getElementById('content-modal').style.display = 'flex';
}

function openEditModal(item, type) {
  editingItem = item;
  editingType = type;
  document.getElementById('modal-title').textContent = 'Editar: ' + item.title;
  document.getElementById('f-type').value = type;
  document.getElementById('f-title').value = item.title || '';
  document.getElementById('f-slug').value = item.slug || '';
  document.getElementById('f-category').value = item.category || '';
  document.getElementById('f-year').value = item.year || '';
  document.getElementById('f-seasons').value = item.seasons || '';
  document.getElementById('f-thumb').value = item.thumb || '';
  document.getElementById('f-desc').value = item.description || '';
  updateFormForType();
  document.getElementById('content-modal').style.display = 'flex';
}

function closeModal() {
  document.getElementById('content-modal').style.display = 'none';
}

function updateFormForType() {
  const type = document.getElementById('f-type').value;
  document.getElementById('f-year-group').style.display = type === 'filme' ? 'block' : 'none';
  document.getElementById('f-seasons-group').style.display = type === 'serie' ? 'block' : 'none';
  editingType = type;
}

function saveContent(e) {
  e.preventDefault();
  const type = document.getElementById('f-type').value;
  const item = {
    id: editingItem?.id || Date.now().toString(),
    title: document.getElementById('f-title').value.trim(),
    slug: document.getElementById('f-slug').value.trim(),
    category: document.getElementById('f-category').value.trim(),
    thumb: document.getElementById('f-thumb').value.trim(),
    description: document.getElementById('f-desc').value.trim(),
  };
  if (type === 'filme') item.year = parseInt(document.getElementById('f-year').value) || null;
  if (type === 'serie') item.seasons = parseInt(document.getElementById('f-seasons').value) || null;

  const map = { canal: 'channels', filme: 'movies', serie: 'series' };
  const arr = CLOUDFLIX_DATA[map[type]];

  if (editingItem) {
    const idx = arr.findIndex(i => i.id === editingItem.id);
    if (idx >= 0) arr[idx] = item;
  } else {
    arr.push(item);
  }

  saveData();
  closeModal();
  renderAll();
  showToast(editingItem ? '✅ Conteúdo atualizado!' : '✅ Conteúdo adicionado!');
  editingItem = null;
}

function deleteItem(type, id) {
  if (!confirm('Remover este item?')) return;
  const map = { canal: 'channels', filme: 'movies', serie: 'series' };
  const arr = CLOUDFLIX_DATA[map[type]];
  const idx = arr.findIndex(i => i.id === id);
  if (idx >= 0) arr.splice(idx, 1);
  saveData();
  renderAll();
  showToast('🗑️ Item removido.', 'error');
}

// ── USER MODAL ────────────────────────────────────────────
function openUserModal(user) {
  document.getElementById('user-modal-title').textContent = 'Editar Usuário: ' + user.name;
  document.getElementById('u-id').value = user.id;
  document.getElementById('u-name').value = user.name;
  document.getElementById('u-email').value = user.email;
  document.getElementById('u-password').value = '';
  document.getElementById('u-role').value = user.role;
  document.getElementById('u-plan').value = user.plan;
  document.getElementById('user-modal').style.display = 'flex';
}

function closeUserModal() {
  document.getElementById('user-modal').style.display = 'none';
}

function saveUser(e) {
  e.preventDefault();
  const users = getUsers();
  const id = parseInt(document.getElementById('u-id').value);
  const idx = users.findIndex(u => u.id === id);
  if (idx < 0) return;

  users[idx].name = document.getElementById('u-name').value.trim();
  users[idx].email = document.getElementById('u-email').value.trim();
  users[idx].role = document.getElementById('u-role').value;
  users[idx].plan = document.getElementById('u-plan').value;
  const pw = document.getElementById('u-password').value;
  if (pw) users[idx].password = pw;

  saveUsers(users);
  closeUserModal();
  renderUsersTable(getUsers());
  updateCounts();
  showToast('✅ Usuário atualizado!');
}

function deleteUser(id) {
  if (!confirm('Remover este usuário?')) return;
  const current = getCurrentUser();
  if (current && current.id === id) { showToast('⚠️ Não pode remover o usuário atual.', 'error'); return; }
  const users = getUsers().filter(u => u.id !== id);
  saveUsers(users);
  renderUsersTable(getUsers());
  updateCounts();
  showToast('🗑️ Usuário removido.', 'error');
}
