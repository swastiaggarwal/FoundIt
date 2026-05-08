// ============================================
// js/dashboard.js
// ============================================

let session = null

;(async () => {
  session = await requireAuth()
  if (!session) return
  await showUserEmail()
  await Promise.all([
    loadLostItems(),
    loadFoundItems(),
    loadMyClaims(),
    loadIncomingClaims()
  ])
})()

// ============================================
// LOST ITEMS I REPORTED
// ============================================
async function loadLostItems() {
  const list  = document.getElementById('lost-list')
  const badge = document.getElementById('lost-badge')

  const { data, error } = await db
    .from('lost_items')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    list.innerHTML = '<p style="color:var(--muted)">Error loading items.</p>'
    return
  }

  badge.textContent = data.length

  if (data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📋</div>
        <p>No lost item reports yet.</p>
      </div>`
    return
  }

  list.innerHTML = data.map(item => `
    <div class="dash-item">
      ${item.photo_url
        ? `<img class="dash-photo" src="${item.photo_url}" alt="${item.type}" />`
        : `<div class="dash-no-photo">${itemEmoji(item.type)}</div>`
      }
      <div class="dash-info">
        <div class="dash-title">${item.type} — ${item.colour}</div>
        <div class="dash-meta">${item.location} · ${formatDate(item.created_at)}</div>
        ${item.notes ? `<div class="dash-meta">${item.notes}</div>` : ''}
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteLostItem(${item.id})">Delete</button>
    </div>
  `).join('')
}

// ============================================
// FOUND ITEMS I POSTED
// ============================================
async function loadFoundItems() {
  const list  = document.getElementById('found-list')
  const badge = document.getElementById('found-badge')

  const { data, error } = await db
    .from('found_items')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    list.innerHTML = '<p style="color:var(--muted)">Error loading items.</p>'
    return
  }

  badge.textContent = data.length

  if (data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>You haven't logged any found items yet.</p>
      </div>`
    return
  }

  list.innerHTML = data.map(item => `
    <div class="dash-item">
      ${item.photo_url
        ? `<img class="dash-photo" src="${item.photo_url}" alt="${item.type}" />`
        : `<div class="dash-no-photo">${itemEmoji(item.type)}</div>`
      }
      <div class="dash-info">
        <div class="dash-title">${item.type} — ${item.colour}</div>
        <div class="dash-meta">${item.location} · ${formatDate(item.created_at)}</div>
        <div class="dash-meta">${item.kept_by_finder ? '📦 Kept with me' : '📍 Left at location'}</div>
        ${item.handover_info ? `<div class="dash-meta">Handover: ${item.handover_info}</div>` : ''}
      </div>
      <button class="btn btn-danger btn-sm" onclick="deleteFoundItem(${item.id})">Delete</button>
    </div>
  `).join('')
}

// ============================================
// MY CLAIMS — claims I submitted (I am the lost person)
// ============================================
async function loadMyClaims() {
  const list  = document.getElementById('claims-list')
  const badge = document.getElementById('claims-badge')

  const { data, error } = await db
    .from('claims')
    .select(`
      id,
      status,
      created_at,
      contact_number,
      found_items ( type, colour, location, photo_url, kept_by_finder, handover_info )
    `)
    .eq('lost_user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    list.innerHTML = '<p style="color:var(--muted)">Error loading claims.</p>'
    return
  }

  badge.textContent = data.length

  if (data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🤝</div>
        <p>No claims yet. <a href="browse.html">Browse found items</a> to claim one.</p>
      </div>`
    return
  }

  list.innerHTML = data.map(claim => {
    const item = claim.found_items
    if (!item) return ''

    const handoverNote = (claim.status === 'confirmed' && item.handover_info)
      ? `<div class="dash-meta confirmed-note">📍 Collect at: ${item.handover_info}</div>`
      : ''

    const contactNote = (claim.status === 'confirmed' && claim.contact_number)
      ? `<div class="dash-meta confirmed-note">📞 Finder's contact: ${claim.contact_number}</div>`
      : ''

    const pendingNote = claim.status === 'pending'
      ? `<div class="dash-meta" style="color:var(--muted)">Waiting for finder to confirm…</div>`
      : ''

    return `
      <div class="dash-item">
        ${item.photo_url
          ? `<img class="dash-photo" src="${item.photo_url}" alt="${item.type}" />`
          : `<div class="dash-no-photo">${itemEmoji(item.type)}</div>`
        }
        <div class="dash-info">
          <div class="dash-title">${item.type} — ${item.colour}</div>
          <div class="dash-meta">${item.location} · Claimed ${formatDate(claim.created_at)}</div>
          ${pendingNote}
          ${handoverNote}
          ${contactNote}
        </div>
        <span class="status-badge status-${claim.status}">${claim.status}</span>
      </div>
    `
  }).join('')
}

// ============================================
// INCOMING CLAIMS — people claiming items I found (I am the finder)
// Two-step fetch avoids brittle FK alias with users table referenced twice in claims
// ============================================
async function loadIncomingClaims() {
  const list  = document.getElementById('incoming-claims-list')
  const badge = document.getElementById('incoming-claims-badge')

  const { data, error } = await db
    .from('claims')
    .select(`
      id,
      status,
      created_at,
      contact_number,
      lost_user_id,
      found_items ( type, colour, location, photo_url, handover_info )
    `)
    .eq('found_user_id', session.user.id)
    .order('created_at', { ascending: false })

  if (error || !data) {
    list.innerHTML = '<p style="color:var(--muted)">Error loading incoming claims.</p>'
    return
  }

  badge.textContent = data.length

  if (data.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📬</div>
        <p>No one has claimed your found items yet.</p>
      </div>`
    return
  }

  // Fetch claimant profiles in one query using their IDs
  const claimantIds = [...new Set(data.map(c => c.lost_user_id))]
  const { data: claimants } = await db
    .from('users')
    .select('id, name, email')
    .in('id', claimantIds)

  const claimantMap = {}
  if (claimants) claimants.forEach(u => { claimantMap[u.id] = u })

  list.innerHTML = data.map(claim => {
    const item     = claim.found_items
    const claimant = claimantMap[claim.lost_user_id]
    if (!item) return ''

    const claimantInfo = claimant
      ? `${claimant.name || 'Unknown'} &nbsp;·&nbsp; ${claimant.email}`
      : 'Unknown user'

    const contactShown = (claim.status === 'confirmed' && claim.contact_number)
      ? `<div class="dash-meta confirmed-note">📞 Your number shared: ${claim.contact_number}</div>`
      : ''

    const actions = claim.status === 'pending'
      ? `
        <div class="claim-actions">
          <button class="btn btn-primary btn-sm" onclick="confirmClaim(${claim.id})">✅ Confirm</button>
          <button class="btn btn-secondary btn-sm" onclick="openContactModal(${claim.id})">📞 Suggest Time</button>
        </div>`
      : `<span class="status-badge status-${claim.status}">${claim.status}</span>`

    return `
      <div class="dash-item" style="flex-wrap:wrap;gap:0.75rem">
        ${item.photo_url
          ? `<img class="dash-photo" src="${item.photo_url}" alt="${item.type}" />`
          : `<div class="dash-no-photo">${itemEmoji(item.type)}</div>`
        }
        <div class="dash-info" style="flex:1;min-width:0">
          <div class="dash-title">${item.type} — ${item.colour}</div>
          <div class="dash-meta">${item.location} · ${formatDate(claim.created_at)}</div>
          <div class="dash-meta">Claimed by: <strong>${claimantInfo}</strong></div>
          ${contactShown}
        </div>
        ${actions}
      </div>
    `
  }).join('')
}

// ============================================
// CONFIRM CLAIM
// ============================================
async function confirmClaim(claimId) {
  if (!confirm('Confirm this claim? This marks the item as handed over.')) return

  const { error } = await db
    .from('claims')
    .update({ status: 'confirmed', confirmed_at: new Date().toISOString() })
    .eq('id', claimId)
    .eq('found_user_id', session.user.id)

  if (error) { alert('Error confirming claim: ' + error.message); return }
  await loadIncomingClaims()
  await loadMyClaims()
}

// ============================================
// CONTACT MODAL — Suggest Time (reveal phone number)
// ============================================
let activeClaimId = null

function openContactModal(claimId) {
  activeClaimId = claimId
  document.getElementById('contact-modal-overlay').classList.add('open')
}

function closeContactModal() {
  activeClaimId = null
  document.getElementById('contact-modal-overlay').classList.remove('open')
  document.getElementById('contact-number-input').value = ''
}

async function submitContactNumber() {
  const number = document.getElementById('contact-number-input').value.trim()
  if (!number) { alert('Please enter your contact number.'); return }

  const { error } = await db
    .from('claims')
    .update({ status: 'confirmed', contact_number: number, confirmed_at: new Date().toISOString() })
    .eq('id', activeClaimId)
    .eq('found_user_id', session.user.id)

  if (error) { alert('Error sharing contact: ' + error.message); return }
  closeContactModal()
  await loadIncomingClaims()
  await loadMyClaims()
}

// Close contact modal on backdrop click
document.getElementById('contact-modal-overlay').addEventListener('click', function (e) {
  if (e.target === this) closeContactModal()
})

// ============================================
// DELETE HANDLERS
// ============================================
async function deleteLostItem(id) {
  if (!confirm('Delete this lost item report?')) return
  const { error } = await db.from('lost_items').delete().eq('id', id).eq('user_id', session.user.id)
  if (error) { alert('Error: ' + error.message); return }
  await loadLostItems()
}

async function deleteFoundItem(id) {
  if (!confirm('Delete this found item report?')) return
  const { error } = await db.from('found_items').delete().eq('id', id).eq('user_id', session.user.id)
  if (error) { alert('Error: ' + error.message); return }
  await loadFoundItems()
}

// ============================================
// HELPERS
// ============================================
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