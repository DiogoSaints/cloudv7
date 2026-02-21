// ============================================================
// CLOUDFLIX – Auth Module
// Members log in with email only. Admins use email + password.
// ============================================================

const DEFAULT_USERS = [];

function getUsers() {
    try {
        const u = localStorage.getItem('cloudflix_users');
        return u ? JSON.parse(u) : DEFAULT_USERS;
    } catch (e) { return DEFAULT_USERS; }
}

function saveUsers(users) {
    localStorage.setItem('cloudflix_users', JSON.stringify(users));
}

function getCurrentUser() {
    try {
        const u = localStorage.getItem('cloudflix_current_user');
        return u ? JSON.parse(u) : null;
    } catch (e) { return null; }
}

// Members login by email only; this function is used by index.html
function loginByEmail(email) {
    if (!email || !email.includes('@')) {
        return { success: false, message: 'Por favor, informe um e-mail válido.' };
    }

    // Create a dynamic member user for any email provided
    const user = {
        id: Date.now(),
        name: email.split('@')[0],
        email: email.toLowerCase(),
        role: 'member',
        avatar: email.charAt(0).toUpperCase(),
        plan: 'Premium'
    };

    localStorage.setItem('cloudflix_current_user', JSON.stringify(user));
    // Clear any previous credentials to force refresh
    sessionStorage.removeItem('cloudflix_creds');
    return { success: true, user };
}

// Full login (email + password) – used by admin panel
function login(email, password) {
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
        const { password: _, ...safeUser } = user;
        localStorage.setItem('cloudflix_current_user', JSON.stringify(safeUser));
        return { success: true, user: safeUser };
    }
    return { success: false, message: 'E-mail ou senha incorretos.' };
}

function logout() {
    localStorage.removeItem('cloudflix_current_user');
    // Clear session API creds on logout
    sessionStorage.removeItem('cloudflix_creds');
    window.location.href = 'index.html';
}

function requireAuth() {
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return null; }
    return user;
}

function requireAdmin() {
    const user = requireAuth();
    if (user && user.role !== 'admin') { window.location.href = 'home.html'; return null; }
    return user;
}
