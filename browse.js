// ============================================
// js/browse.js — 3 tabs: Found / Lost / Claimed Today
// ============================================

let session = null
let allFoundItems = []
let allLostItems = []
let claimedToday = []   // { item, claim } pairs
let claimedItemIds = new Set()  // found_item_ids that are confirmed

  ; (async () => {
    session = await requireAuth()
    await showUserEmail()
    await loadClaimedToday()   // load this first so we know which IDs to exclude
    await Promise.all([loadFoundItems(), loadLostItems()])
  })()

// ---- TAB SWITCHING ----
function switchTab(tab) {
  ['found', 'lost', 'claimed'].forEach(t => {
    document.getElementById(`tab-${t}`).classList.toggle('active', t === tab)
    document.getElementById(`${t}-section`).style.display = t === tab ? 'block' : 'none'
  })
}

// ============================================
// LOAD CLAIMED TODAY
// ============================================
async function loadClaimedToday() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await db
    .from('claims')
    .select(`
      id,
      confirmed_at,
      found_item_id,
      found_items ( id, type, colour, location, notes, photo_url, kept_by_finder, handover_info, created_at ),
      users!claims_lost_user_id_fkey ( id, name, email )
    `)
    .eq('status', 'confirmed')
    .gte('confirmed_at', since)
    .order('confirmed_at', { ascending: false })

  if (error || !data) return

  claimedToday = data.filter(c => c.found_items)
  claimedItemIds = new Set(claimedToday.map(c => c.found_item_id))

  renderClaimedToday()
  document.getElementById('claimed-badge').textContent = claimedToday.length
}

function renderClaimedToday() {
  const grid = document.getElementById('claimed-grid')

  if (claimedToday.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"></div>
        <p>No items have been claimed in the last 24 hours.</p>
      </div>`
    return
  }

  grid.innerHTML = claimedToday.map(c => {
    const item = c.found_items
    const user = c.users

    return `
      <div class="item-card item-claimed">
        ${item.photo_url
        ? `<img class="item-photo" src="${item.photo_url}" alt="${item.type}" loading="lazy" />`
        : `<div class="no-photo"></div>`
      }
        <div class="claimed-banner">
          <span class="claimed-badge-pill">Claimed ${timeAgo(c.confirmed_at)}</span>
          <div class="claimed-by">
            Claimed by: <strong>${user ? user.name || user.email : 'Unknown'}</strong>
          </div>
          <div class="claimed-email">${user ? user.email : ''}</div>
          <div class="fraud-note">Not you? Contact your admin immediately.</div>
        </div>
        <div class="item-info">
          <div class="item-tags">
            <span class="tag accent">${item.type}</span>
            <span class="tag">${item.colour}</span>
            <span class="tag">${item.location}</span>
          </div>
          <div class="item-title">${item.type} — ${item.colour}</div>
          <div class="item-notes">${item.notes || 'No extra details'}</div>
          <div class="item-date">Found ${formatDate(item.created_at)}</div>
        </div>
      </div>`
  }).join('')
}

// ============================================
// LOAD FOUND ITEMS (exclude claimed)
// ============================================
async function loadFoundItems() {
  const grid = document.getElementById('found-grid')
  grid.innerHTML = '<div style="color:var(--muted);padding:2rem">Loading…</div>'

  const { data, error } = await db
    .from('found_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    grid.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`
    return
  }

  // Exclude items that have been claimed
  allFoundItems = (data || []).filter(item => !claimedItemIds.has(item.id))
  renderFoundItems(allFoundItems)
  updateCount('found-count', allFoundItems.length)
}

function renderFoundItems(items) {
  const grid = document.getElementById('found-grid')

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"></div>
        <p>No unclaimed found items match your filters.</p>
      </div>`
    return
  }

  grid.innerHTML = items.map(item => `
    <div class="item-card">
      ${item.photo_url
      ? `<img class="item-photo" src="${item.photo_url}" alt="${item.type}" loading="lazy" />`
      : `<div class="no-photo">${itemEmoji(item.type)}</div>`
    }
      <div class="item-info">
        <div class="item-tags">
          <span class="tag accent">${item.type}</span>
          <span class="tag">${item.colour}</span>
          <span class="tag">${item.location}</span>
        </div>
        <div class="item-title">${item.type} — ${item.colour}</div>
        <div class="item-notes">${item.notes || 'No extra details'}</div>
        <div class="item-date">Found ${formatDate(item.created_at)}</div>
        ${item.user_id !== session.user.id
      ? `<button class="btn btn-primary btn-sm btn-full" onclick="openFoundModal(${item.id})">View & Claim</button>`
      : `<span style="font-size:0.8rem;color:var(--muted)">Your report</span>`
    }
      </div>
    </div>
  `).join('')
}

// ============================================
// LOAD LOST ITEMS (exclude claimed)
// ============================================
async function loadLostItems() {
  const grid = document.getElementById('lost-grid')
  grid.innerHTML = '<div style="color:var(--muted);padding:2rem">Loading…</div>'

  const { data, error } = await db
    .from('lost_items')
    .select('*, users(name, email)')
    .order('created_at', { ascending: false })

  if (error) {
    grid.innerHTML = `<div class="empty-state"><p>Error: ${error.message}</p></div>`
    return
  }

  allLostItems = data || []
  renderLostItems(allLostItems)
  updateCount('lost-count', allLostItems.length)
}

function renderLostItems(items) {
  const grid = document.getElementById('lost-grid')

  if (items.length === 0) {
    grid.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon"></div>
        <p>No lost item reports match your filters.</p>
      </div>`
    return
  }

  grid.innerHTML = items.map(item => `
    <div class="item-card">
      ${item.photo_url
      ? `<img class="item-photo" src="${item.photo_url}" alt="${item.type}" loading="lazy" />`
      : `<div class="no-photo">${itemEmoji(item.type)}</div>`
    }
      <div class="item-info">
        <div class="item-tags">
          <span class="tag" style="background:#4a1a1a;color:#f87171">${item.type}</span>
          <span class="tag">${item.colour}</span>
          <span class="tag">${item.location}</span>
        </div>
        <div class="item-title">${item.type} — ${item.colour}</div>
        <div class="item-notes">${item.notes || 'No extra details'}</div>
        <div class="item-date">Lost ${formatDate(item.created_at)}</div>
        ${item.user_id !== session.user.id
      ? `<button class="btn btn-secondary btn-sm btn-full" onclick="openLostModal(${item.id})">View & Contact Owner</button>`
      : `<span style="font-size:0.8rem;color:var(--muted)">Your report</span>`
    }
      </div>
    </div>
  `).join('')
}

// ---- FILTERS ----
function filterFoundItems() {
  const type = document.getElementById('filter-type').value
  const colour = document.getElementById('filter-colour').value
  const location = document.getElementById('filter-location').value
  const filtered = allFoundItems.filter(item =>
    (!type || item.type === type)
    && (!colour || item.colour === colour)
    && (!location || item.location === location)
  )
  renderFoundItems(filtered)
  updateCount('found-count', filtered.length)
}

function filterLostItems() {
  const type = document.getElementById('lost-filter-type').value
  const colour = document.getElementById('lost-filter-colour').value
  const location = document.getElementById('lost-filter-location').value
  const filtered = allLostItems.filter(item =>
    (!type || item.type === type)
    && (!colour || item.colour === colour)
    && (!location || item.location === location)
  )
  renderLostItems(filtered)
  updateCount('lost-count', filtered.length)
}

function updateCount(elId, n) {
  const el = document.getElementById(elId)
  if (el) el.textContent = `${n} item${n !== 1 ? 's' : ''}`
}

// ============================================
// FOUND ITEM MODAL
// ============================================
let activeFoundItem = null

function openFoundModal(id) {
  activeFoundItem = allFoundItems.find(i => i.id === id)
  if (!activeFoundItem) return

  const kept = activeFoundItem.kept_by_finder
    ? `Kept by finder — ${activeFoundItem.handover_info || 'contact for handover'}`
    : 'Left at location'

  document.getElementById('modal-title').textContent = `${activeFoundItem.type} — ${activeFoundItem.colour}`
  document.getElementById('modal-photo-wrap').innerHTML = activeFoundItem.photo_url
    ? `<img class="modal-photo" src="${activeFoundItem.photo_url}" alt="${activeFoundItem.type}" />`
    : `<div class="modal-no-photo"></div>`

  document.getElementById('modal-type').textContent = activeFoundItem.type
  document.getElementById('modal-colour').textContent = activeFoundItem.colour
  document.getElementById('modal-location').textContent = activeFoundItem.location
  document.getElementById('modal-kept').textContent = kept
  document.getElementById('modal-notes').textContent = activeFoundItem.notes || '—'
  document.getElementById('modal-date').textContent = formatDate(activeFoundItem.created_at)

  const claimBtn = document.getElementById('claim-btn')
  claimBtn.style.display = activeFoundItem.user_id === session.user.id ? 'none' : 'flex'

  document.getElementById('modal-overlay').classList.add('open')
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open')
  activeFoundItem = null
}

document.getElementById('modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal()
})

async function claimItem() {
  if (!activeFoundItem) return
  const btn = document.getElementById('claim-btn')
  btn.disabled = true
  btn.innerHTML = '<span class="spinner"></span>'

  try {
    const { data: existing } = await db
      .from('claims')
      .select('id')
      .eq('found_item_id', activeFoundItem.id)
      .eq('lost_user_id', session.user.id)
      .maybeSingle()

    if (existing) {
      alert('You already have a pending claim for this item.')
      btn.disabled = false
      btn.textContent = 'Claim This Item'
      return
    }

    const { error } = await db.from('claims').insert({
      lost_user_id: session.user.id,
      found_user_id: activeFoundItem.user_id,
      found_item_id: activeFoundItem.id,
      status: 'pending'
    })
    if (error) throw error

    closeModal()
    window.location.href = 'dashboard.html'

  } catch (e) {
    alert('Error: ' + e.message)
    btn.disabled = false
    btn.textContent = 'Claim This Item'
  }
}

// ============================================
// LOST ITEM MODAL
// ============================================
let activeLostItem = null

function openLostModal(id) {
  activeLostItem = allLostItems.find(i => i.id === id)
  if (!activeLostItem) return

  document.getElementById('lost-modal-title').textContent = `${activeLostItem.type} — ${activeLostItem.colour}`
  document.getElementById('lost-modal-photo-wrap').innerHTML = activeLostItem.photo_url
    ? `<img class="modal-photo" src="${activeLostItem.photo_url}" alt="${activeLostItem.type}" />`
    : `<div class="modal-no-photo"></div>`

  document.getElementById('lost-modal-type').textContent = activeLostItem.type
  document.getElementById('lost-modal-colour').textContent = activeLostItem.colour
  document.getElementById('lost-modal-location').textContent = activeLostItem.location
  document.getElementById('lost-modal-notes').textContent = activeLostItem.notes || '—'
  document.getElementById('lost-modal-date').textContent = formatDate(activeLostItem.created_at)

  const owner = activeLostItem.users
  document.getElementById('lost-modal-owner').textContent =
    owner ? `${owner.name || 'Unknown'} — ${owner.email}` : 'Unknown'

  document.getElementById('lost-modal-overlay').classList.add('open')
}

function closeLostModal() {
  document.getElementById('lost-modal-overlay').classList.remove('open')
  activeLostItem = null
}

document.getElementById('lost-modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeLostModal()
})

// ---- HELPERS ----
function itemEmoji(type) {
  const map = {
    'Wallet': '👜', 'Phone': '📱', 'Keys': '🔑',
    'Bag / Backpack': '🎒', 'Water Bottle': '🍶',
    'Laptop': '💻', 'Earphones / AirPods': '🎧',
    'ID Card': '🪪', 'Glasses': '👓', 'Umbrella': '☂️',
    'Jacket / Hoodie': '🧥', 'Notebook': '📓'
  }
  return map[type] || '📦'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  })
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}