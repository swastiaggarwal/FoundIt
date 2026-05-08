// ============================================
// js/report-lost.js
// ============================================

let session = null

;(async () => {
  session = await requireAuth()
  if (!session) return
  await showUserEmail()
})()

// Live photo preview
// HTML ids: #photo, #photo-preview, #preview-img, #file-name
document.getElementById('photo').addEventListener('change', function () {
  const file = this.files[0]
  if (!file) return
  document.getElementById('file-name').textContent       = file.name
  document.getElementById('preview-img').src             = URL.createObjectURL(file)
  document.getElementById('photo-preview').style.display = 'block'
})

// Called by: onclick="submitLostReport()" on #submit-btn
async function submitLostReport() {
  const btn      = document.getElementById('submit-btn')
  const alertBox = document.getElementById('alert')

  const type     = document.getElementById('type').value
  const colour   = document.getElementById('colour').value
  const location = document.getElementById('location').value
  const notes    = document.getElementById('notes').value.trim()
  const file     = document.getElementById('photo').files[0]

  // ---- Validation ----
  if (!type || !colour || !location) {
    alertBox.textContent = 'Please fill in item type, colour, and location.'
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
      const fileName = `lost_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error: uploadError } = await db.storage
        .from('item-photos')
        .upload(fileName, file)
      if (uploadError) throw uploadError

      const { data: urlData } = db.storage
        .from('item-photos')
        .getPublicUrl(fileName)
      photoUrl = urlData.publicUrl
    }

    // ---- Insert into lost_items ----
    const { error } = await db.from('lost_items').insert({
      user_id:   session.user.id,
      type,
      colour,
      location,
      notes:     notes || null,
      photo_url: photoUrl
    })
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