// ============================================
// js/report-found.js
// ============================================

let session = null

;(async () => {
  session = await requireAuth()
  if (!session) return
  await showUserEmail()
})()

// Show/hide handover textarea when "kept" toggle changes
// HTML id: #kept → #handover-section
document.getElementById('kept').addEventListener('change', function () {
  document.getElementById('handover-section').style.display =
    this.value === 'yes' ? 'block' : 'none'
})

// Live photo preview
// HTML ids: #photo, #photo-preview, #preview-img, #file-name
document.getElementById('photo').addEventListener('change', function () {
  const file = this.files[0]
  if (!file) return
  document.getElementById('file-name').textContent  = file.name
  document.getElementById('preview-img').src        = URL.createObjectURL(file)
  document.getElementById('photo-preview').style.display = 'block'
})

// Called by: onclick="submitFoundReport()" on #submit-btn
async function submitFoundReport() {
  const btn      = document.getElementById('submit-btn')
  const alertBox = document.getElementById('alert')

  const type     = document.getElementById('type').value
  const colour   = document.getElementById('colour').value
  const location = document.getElementById('location').value
  const notes    = document.getElementById('notes').value.trim()
  const kept     = document.getElementById('kept').value
  const handover = document.getElementById('handover').value.trim()
  const file     = document.getElementById('photo').files[0]

  // ---- Validation ----
  if (!type || !colour || !location || !kept) {
    alertBox.textContent = 'Please fill in item type, colour, location, and whether you kept it.'
    alertBox.className   = 'alert alert-error show'
    return
  }

  if (file && file.size > 5 * 1024 * 1024) {
    alertBox.textContent = 'Photo must be under 5 MB.'
    alertBox.className   = 'alert alert-error show'
    return
  }

  if (!session || !session.user) {
    alertBox.textContent = 'You must be logged in to submit a report.'
    alertBox.className   = 'alert alert-error show'
    return
  }

  btn.disabled   = true
  btn.innerHTML  = '<span class="spinner"></span> &nbsp;Saving...'
  alertBox.className = 'alert'

  let photoUrl = null

  try {
    // ---- Upload photo ----
    if (file) {
      const ext      = file.name.split('.').pop()
      const fileName = `found_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await db.storage
        .from('item-photos')
        .upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = db.storage
        .from('item-photos')
        .getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }

    // ---- Insert into found_items ----
    const { error } = await db.from('found_items').insert([{
      user_id:        session.user.id,
      type,
      colour,
      location,
      notes:          notes || null,
      kept_by_finder: kept === 'yes',
      handover_info:  kept === 'yes' ? (handover || null) : null,
      photo_url:      photoUrl
    }])

    if (error) throw error

    // ---- Redirect to dashboard on success ----
    window.location.href = 'dashboard.html'

  } catch (e) {
    alertBox.textContent = e.message
    alertBox.className   = 'alert alert-error show'
    btn.disabled         = false
    btn.textContent      = 'Submit Report'
  }
}