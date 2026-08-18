function switchTab(tab) {
  document.getElementById('loginForm').classList.toggle('active', tab === 'login');
  document.getElementById('signupForm').classList.toggle('active', tab === 'signup');
  document.getElementById('loginTabBtn').classList.toggle('active', tab === 'login');
  document.getElementById('signupTabBtn').classList.toggle('active', tab === 'signup');
}

function handleSignUp(event) {
  event.preventDefault();
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim().toLowerCase();
  const password = document.getElementById('signupPassword').value;

  const users = JSON.parse(localStorage.getItem('users') || '[]');
  
  if (users.some(u => u.email === email)) {
    document.getElementById('signupError').textContent = 'Email is already registered.';
    return;
  }

  const newUser = { name, email, password };
  users.push(newUser);
  
  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(newUser));
  
  window.location.href = 'dashboard.html';
}

function handleLogin(event) {
  event.preventDefault();

  const email = document.getElementById('loginEmail').value.trim().toLowerCase();
  const password = document.getElementById('loginPassword').value;

  const users = JSON.parse(localStorage.getItem('users')) || [];
  const user = users.find(u => u.email === email && u.password === password);

  if (!user) {
    document.getElementById('loginError').textContent = 'Invalid email or password.';
    return;
  }

  // Save session & redirect inside the function
  localStorage.setItem('currentUser', JSON.stringify(user));
  window.location.href = 'dashboard.html';
} 
