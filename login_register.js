document.addEventListener("DOMContentLoaded", () => {
  const registerForm = document.getElementById("registerForm");
  const loginForm = document.getElementById("loginForm");

  if (registerForm) {
    registerForm.addEventListener("submit", registerUser);
  }

  if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
  }
});

// -------------------- REGISTER --------------------
async function registerUser(e) {
  e.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const confirmPassword = document
    .getElementById("confirmPassword")
    .value.trim();
  const errorEl = document.getElementById("registerError");

  // валидация фронтенда
  if (!fullName || !email || !password || !confirmPassword) {
    errorEl.textContent = "All fields are required.";
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    errorEl.textContent = "Please enter a valid email.";
    return;
  }

  if (password.length < 6) {
    errorEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirmPassword) {
    errorEl.textContent = "Passwords do not match.";
    return;
  }

  errorEl.textContent = "";

  // отправка на backend
  try {
    const res = await fetch("http://localhost:5001/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, password }),
    });

    const data = await res.json();

    if (data.success) {
      alert("Registration successful! Please login.");
      window.location.href = "login.html";
    } else {
      errorEl.textContent = data.message;
    }
  } catch (err) {
    errorEl.textContent = "Server error. Try again later.";
    console.error(err);
  }
}

// -------------------- LOGIN --------------------
async function loginUser(e) {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const errorEl = document.getElementById("loginError");

  if (!email || !password) {
    errorEl.textContent = "Please fill in all fields.";
    return;
  }

  if (!email.includes("@") || !email.includes(".")) {
    errorEl.textContent = "Invalid email format.";
    return;
  }

  try {
    const res = await fetch("http://localhost:5001/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (data.success) {
      // можно сохранять email в localStorage для сессии
      localStorage.setItem("userEmail", email);
      window.location.href = "index.html"; // редирект на главную
    } else {
      errorEl.textContent = data.message;
    }
  } catch (err) {
    errorEl.textContent = "Server error. Try again later.";
    console.error(err);
  }
}
