// ============================================
// js/auth.js — Login, Signup, Logout, Auth guard
// ============================================

// ---- CHECK IF LOGGED IN (call on every protected page) ----
async function requireAuth() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) {
    window.location.href = 'index.html'
    return null
  }
  return session
}

// ---- SHOW USER EMAIL IN NAVBAR ----
async function showUserEmail() {
  const { data: { session } } = await db.auth.getSession()
  if (!session) return
  const el = document.getElementById('user-email')
  if (el) el.textContent = session.user.email
}

// ---- LOGOUT ----
async function logout() {
  await db.auth.signOut()
  window.location.href = 'index.html'
}

// ---- SIGN UP ----
// NOTE: We do NOT manually insert into users here.
// The SQL trigger handle_new_user() does it automatically
// when the user confirms their email. Doing it here causes
// an RLS violation because the session is not active yet.
async function signUp(email, password, name) {
  const { data, error } = await db.auth.signUp({
    email,
    password,
    options: { data: { name } }
  })
  if (error) throw error
  return data
}

// ---- LOGIN ----
async function login(email, password) {
  const { data, error } = await db.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

// ---- INTERACTIVE BLOB MOVEMENT ----
document.addEventListener('mousemove', (e) => {
  const { clientX, clientY } = e;

  // Select all blobs
  const blobs = document.querySelectorAll('.blob');

  blobs.forEach((blob, index) => {
    // Different coefficients make them move at different speeds
    const speed = (index + 1) * 0.02;
    const x = (window.innerWidth / 2 - clientX) * speed;
    const y = (window.innerHeight / 2 - clientY) * speed;

    blob.style.transform = `translate(${x}px, ${y}px)`;
  });
});