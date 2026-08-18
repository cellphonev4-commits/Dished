// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDOzjmwm5ub4FUe2oATTMQ_UtPqKP4RZWo",
  authDomain: "dished2026.firebaseapp.com",
  projectId: "dished2026",
  storageBucket: "dished2026.firebasestorage.app",
  messagingSenderId: "767578060689",
  appId: "1:767578060689:web:6982e440d6077d8b5f4c30",
  measurementId: "G-GTGEC6F1FG"
};

if (typeof firebase !== 'undefined' && !firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

function switchTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginBtn = document.getElementById('loginTabBtn');
  const signupBtn = document.getElementById('signupTabBtn');

  if (tab === 'login') {
    loginForm.classList.add('active');
    signupForm.classList.remove('active');
    loginBtn.classList.add('active');
    signupBtn.classList.remove('active');
  } else {
    signupForm.classList.add('active');
    loginForm.classList.remove('active');
    signupBtn.classList.add('active');
    loginBtn.classList.remove('active');
  }
}

function handleLogin(event) {
  event.preventDefault();
  
  const emailInput = document.getElementById('loginEmail').value.trim().toLowerCase();
  const passwordInput = document.getElementById('loginPassword').value;
  const errorMsg = document.getElementById('loginError');

  if (errorMsg) errorMsg.textContent = "";

  const users = JSON.parse(localStorage.getItem('users')) || [];
  const existingUser = users.find(u => u.email === emailInput && u.password === passwordInput);

  const userName = existingUser ? existingUser.name : (emailInput.split('@')[0] || "User");
  const currentUser = { name: userName, email: emailInput };

  localStorage.setItem('currentUser', JSON.stringify(currentUser));

  // Redirect cleanly
  window.location.href = "dashboard.html";
}

function handleSignUp(event) {
  event.preventDefault();

  const nameInput = document.getElementById('signupName').value.trim();
  const emailInput = document.getElementById('signupEmail').value.trim().toLowerCase();
  const passwordInput = document.getElementById('signupPassword').value;

  const newUser = {
    name: nameInput || "User",
    email: emailInput,
    password: passwordInput
  };

  const users = JSON.parse(localStorage.getItem('users')) || [];
  users.push(newUser);

  localStorage.setItem('users', JSON.stringify(users));
  localStorage.setItem('currentUser', JSON.stringify(newUser));

  // Redirect cleanly
  window.location.href = "dashboard.html";
}
