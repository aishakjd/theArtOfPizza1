// File URL (uploaded asset): /mnt/data/Снимок экрана 2025-11-25 в 19.35.46.png
// Updated frontend JS with authFetch helper and all protected requests switched to use it.

// // --- 1. DATA (Simulating a database) ---
const allRecipes = [];
async function fetchRecipesFromAPI() {
  try {
    const res = await fetch(
      "https://forkify-api.jonas.io/api/v2/recipes?search=pizza"
    );
    if (!res.ok) throw new Error("Network response not OK");
    const data = await res.json();
    return data.data.recipes.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      img: recipe.image_url,
      publisher: recipe.publisher,
      tags: recipe.title.toLowerCase().split(" "), // ← простой вариант
    })); // <- теперь можно использовать
  } catch (err) {
    console.error("Error fetching recipes:", err);
    return []; // возвращаем пустой массив, если не удалось
  }
}

let savedRecipes = [];
let currentRecipeId = null;

// --- AUTH FETCH HELPER ---
function getStoredEmail() {
  return localStorage.getItem("userEmail");
}

// authFetch attaches X-User-Email if present and safe-parses responses
async function authFetch(url, opts = {}) {
  const headers = opts.headers ? { ...opts.headers } : {};
  const storedEmail = getStoredEmail();
  if (storedEmail) headers["X-User-Email"] = storedEmail;

  // If body is FormData, don't set Content-Type (browser will set multipart boundary)
  const finalOpts = { ...opts, headers };

  const res = await fetch(url, finalOpts);

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (err) {
    console.warn("authFetch: response is not JSON:", text);
  }

  return { res, data, text };
}

// --- 2. RECIPE RENDERING FUNCTIONS ---

// Function to create an individual recipe card HTML
function createRecipeCard(recipe, style = "home") {
  let imgBorder =
    style === "full"
      ? "5px solid var(--card-background)"
      : "2px solid var(--background-light)";
  let cardClass = "recipe-card";

  if (style === "saved") {
    cardClass += " saved-card"; // <— мини-режим
  }

  // NOTE: publisher is missing in savedRecipes, so we use a fallback if needed
  const publisherText =
    recipe.publisher || (style === "saved" ? "Saved" : "Recipe");

  return `
    <div class="${cardClass}" onclick="loadRecipeDetail('${recipe.id}')">
      <div class="recipe-image-wrapper">
        <img src="${recipe.img}" alt="${recipe.title}" class="recipe-card-image" style="border: ${imgBorder};">
      </div>
      <h4>${recipe.title}</h4>
      <p>${publisherText}</p>
    </div>
  `;
}

// Function to render all cards in a specified grid
function renderRecipes(recipes, containerId, style = "home") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = recipes
    .map((recipe) => createRecipeCard(recipe, style))
    .join("");

  // Show/hide "No recipes saved" message
  if (containerId === "saved-recipes-grid") {
    const msg = document.getElementById("no-saved-msg");
    if (recipes.length === 0) {
      if (!msg) {
        container.innerHTML +=
          '<p style="grid-column: 1 / -1; color: #888; margin-top: 15px;" id="no-saved-msg">No recipes saved yet.</p>';
      }
    } else if (msg) {
      msg.remove();
    }
  }
}

async function loginUser(email, password) {
  try {
    const res = await fetch("http://localhost:5001/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    // Always read text first to avoid "Unexpected end of JSON input"
    const text = await res.text();
    console.log("Login response status:", res.status, "text:", text);

    // Try to parse JSON only when there is a non-empty body
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch (parseErr) {
      console.warn("loginUser: response not valid JSON:", parseErr, text);
    }

    // If server returned success and an email, store it and load profile
    if (res.ok && data && data.success) {
      // server returns { success: true, email: '...' }
      if (data.email) {
        localStorage.setItem("userEmail", data.email);
      }
      await loadUserProfile(); // uses X-User-Email header from localStorage
      alert("Logged in!");
    } else {
      // If server returned JSON with a message, show it; otherwise show status
      const msg = data && data.message ? data.message : `Login failed (status ${res.status})`;
      alert(msg);
    }
  } catch (err) {
    console.error("Login failed network/error:", err);
    alert("Login failed due to network or server error.");
  }
}

// УДАЛЕНА ФУНКЦИЯ getCurrentUser

async function getCurrentUserEmail() {
  try {
    const { res, data } = await authFetch("http://localhost:5001/current-user", {
      method: "GET",
    });
    if (!res.ok) throw new Error("Failed to fetch current user");
    console.log("CURRENT USER DATA:", data);
    return data ? data.email : null; // null если не залогинен
  } catch (err) {
    console.error("Error fetching current user email:", err);
    return null;
  }
}

// --- 3. CORE FUNCTIONALITY ---

// LIVE SEARCH FILTERING (Applied to Home & Recipes Grid)
function handleSearch(containerId, query) {
  const normalizedQuery = query.toLowerCase().trim();
  const filteredRecipes = allRecipes.filter((recipe) => {
    const titleMatch = recipe.title.toLowerCase().includes(normalizedQuery);
    const tagMatch = recipe.tags.some((tag) => tag.includes(normalizedQuery));
    return titleMatch || tagMatch;
  });

  // Determine card style based on container
  const style = containerId === "recipes-grid-page-grid" ? "full" : "home";
  renderRecipes(filteredRecipes, containerId, style);
}

// TOGGLE SAVE RECIPE (For Recipe Detail Page)
async function toggleSaveRecipe(button) {
  if (!currentRecipeId) return;

  const recipe = allRecipes.find((r) => r.id === currentRecipeId);
  const isSaved = savedRecipes.some((r) => r.id === currentRecipeId);

  if (!isSaved) {
    // --- SAVE TO SERVER ---
    const { res, data } = await authFetch("http://localhost:5001/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipe: {
          id: recipe.id,
          title: recipe.title,
          image: recipe.img,
        },
      }),
    });

    if (res.status === 401) {
      alert("Please log in to save recipes! (Session expired or not found)");
      return;
    }

    if (data && data.success) {
      savedRecipes.push(recipe);
      button.classList.add("saved");
      button.textContent = "Saved";
    } else {
      alert((data && data.message) || "Ошибка при сохранении: сервер отклонил запрос.");
    }
  } else {
    // --- DELETE FROM SERVER ---
    const { res, data } = await authFetch("http://localhost:5001/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipeId: currentRecipeId }),
    });

    if (res.status === 401) {
      alert("Please log in to save recipes! (Session expired or not found)");
      return;
    }

    if (data && data.success) {
      savedRecipes = savedRecipes.filter((r) => r.id !== currentRecipeId);
      button.classList.remove("saved");
      button.textContent = "Save";
    } else {
      alert((data && data.message) || "Ошибка при удалении: сервер отклонил запрос.");
    }
  }

  renderSavedRecipes();
}

//LOADING SAVINGS
async function loadSavedFromServer() {
  const { res, data } = await authFetch(`http://localhost:5001/saved`, {
    method: "GET",
  });

  if (res.status === 401) {
    savedRecipes = [];
    return;
  }

  if (!res.ok) {
    console.error("Failed to fetch saved recipes.");
    savedRecipes = [];
    return;
  }

  if (Array.isArray(data)) {
    savedRecipes = data.map((recipe) => ({
      id: recipe.id,
      title: recipe.title,
      img: recipe.image, // Сервер возвращает поле image
    }));
  } else {
    savedRecipes = [];
  }
}

function renderSavingsPage() {
  const container = document.getElementById("saved-recipes-grid");
  // Получаем email из localStorage, который был установлен loadUserProfile
  const userEmail = localStorage.getItem("userEmail");

  container.innerHTML = "";

  // 1 — пользователь не вошёл
  if (!userEmail) {
    container.innerHTML = `
      <p class="empty-message">Войдите в аккаунт, чтобы увидеть сохранённые рецепты 🍕</p>
    `;
    return;
  }

  // 2 — пользователь вошёл, но нет рецептов
  if (savedRecipes.length === 0) {
    container.innerHTML = `
      <p class="empty-message">You don't have any saved recipes 👀</p>
    `;
    return;
  }

  // 3 — есть рецепты → рендерим
  renderRecipes(savedRecipes, "saved-recipes-grid", "saved");
}

// LOAD RECIPE DETAIL PAGE (Clicking a card)
function loadRecipeDetail(id) {
  currentRecipeId = id;
  const recipe = allRecipes.find((r) => r.id === id);

  // Update the detail page image
  document.getElementById("detail-recipe-title").textContent = recipe.title;
  document.getElementById("detail-recipe-img").src = recipe.img;

  // Update the save button state
  const saveButton = document.querySelector("#recipe-detail-page .save-button");
  const isSaved = savedRecipes.some((r) => r.id === id);

  if (saveButton) {
    if (isSaved) {
      saveButton.classList.add("saved");
      saveButton.textContent = "Saved";
    } else {
      saveButton.classList.remove("saved");
      saveButton.textContent = "Save";
    }
  }

  showPage("recipe-detail-page");
}

// RENDER SAVED RECIPES (For Profile/Savings Page)
function renderSavedRecipes() {
  renderRecipes(savedRecipes, "saved-recipes-grid", "saved");
}

// --- 4. NAVIGATION AND INITIALIZATION ---

const headerLogoContainer = document.getElementById("header-logo-container");

function updateHeader(pageId) {
  headerLogoContainer.innerHTML = "";
  const element = document.createElement("a");
  element.href = "#";
  element.className = "logo";
  element.innerHTML = '<i class="fas fa-pizza-slice"></i> Art of pizza';
  element.onclick = () => showPage("home-page");
  headerLogoContainer.appendChild(element);
}

function showPage(pageId) {
  document.querySelectorAll(".page-content").forEach((page) => {
    page.classList.remove("active");
  });
  document.getElementById(pageId).classList.add("active");

  // Special rendering for specific pages
  if (pageId === "recipes-grid-page") {
    renderRecipes(allRecipes, "recipes-grid-page-grid", "full");
  } else if (pageId === "profile-page") {
    // ВАЖНО: При переходе на профиль, нужно обновить данные и рендерить
    loadUserProfile().then(() => {
      loadSavedFromServer().then(() => {
        renderSavingsPage();
      });
    });
  } else if (pageId === "home-page") {
    // Clear the search bar when returning home
    const input = document.getElementById("home-search-input");
    if (input) input.value = "";
    renderRecipes(allRecipes, "home-page-grid", "home");
  }

  // Update active navigation link
  document.querySelectorAll(".nav ul li a").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === pageId) {
      link.classList.add("active");
    }
  });

  updateHeader(pageId);
}

//EDIT PROFILE MODAL
const editButton = document.querySelector(".edit-button");
if (editButton) {
  editButton.onclick = () => {
    const fullName = localStorage.getItem("userFullName") || "";
    document.getElementById("edit-fullname").value = fullName;
    document.getElementById("edit-modal").style.display = "flex";
  };
}

function closeEditModal() {
  document.getElementById("edit-modal").style.display = "none";
}

async function saveProfileChanges() {
  const fullName = document.getElementById("edit-fullname").value;
  const avatarFile = document.getElementById("edit-avatar").files[0];
  const userEmail = localStorage.getItem("userEmail");

  const form = new FormData();
  form.append("email", userEmail);
  form.append("fullName", fullName);
  if (avatarFile) form.append("avatar", avatarFile);

  const { res, data } = await authFetch("http://localhost:5001/profile/update", {
    method: "POST",
    body: form,
  });

  if (!data || !data.user) {
    alert("Failed to update profile. Try again!");
    return;
  }

  // Обновляем UI и данные
  await loadUserProfile();
  closeEditModal();
}

// обновляем локально(уже не локалли)

async function loadUserProfile() {
  try {
    const storedEmail = localStorage.getItem("userEmail");
    const headers = {};
    if (storedEmail) headers["X-User-Email"] = storedEmail;

    const { res, data } = await authFetch("http://localhost:5001/profile", {
      method: "GET",
      headers,
    });

    if (res.status === 401) {
      throw new Error("Unauthorized or session expired");
    }

    const welcomeEl = document.getElementById("welcome-message");

    if (data && data.success) {
      window.isLoggedIn = true;

      localStorage.setItem("userEmail", data.email);
      localStorage.setItem("userFullName", data.fullName);

      const avatarUrl = (data.avatar || "").startsWith("http")
        ? data.avatar
        : `http://localhost:5001${data.avatar && data.avatar.startsWith("/") ? data.avatar : "/" + (data.avatar || "avatar.jpeg")}`;

      localStorage.setItem("userAvatar", avatarUrl);

      const profileNameEl = document.getElementById("profile-name");
      const profileEmailEl = document.getElementById("profile-email");

      if (profileNameEl) profileNameEl.textContent = data.fullName;
      if (profileEmailEl) profileEmailEl.textContent = data.email;
      if (welcomeEl) welcomeEl.textContent = `Welcome, ${data.email}! 🍕`;

      updateProfileCard();
    } else {
      throw new Error("Profile fetch failed: " + (data && data.message ? data.message : "Unknown"));
    }
  } catch (err) {
    console.warn("loadUserProfile failed:", err.message);
    window.isLoggedIn = false;
    localStorage.removeItem("userEmail");
    localStorage.removeItem("userFullName");
    localStorage.removeItem("userAvatar");

    const welcomeEl = document.getElementById("welcome-message");
    if (welcomeEl) welcomeEl.textContent = `Welcome, Guest! 🍕`;
    const profileNameEl = document.getElementById("profile-name");
    const profileEmailEl = document.getElementById("profile-email");
    if (profileNameEl) profileNameEl.textContent = "Guest";
    if (profileEmailEl) profileEmailEl.textContent = "Please log in";

    updateProfileCard();
  }
}

function updateProfileCard() {
  // Используем дефолтный аватар, если нет сохраненного в localStorage
  const defaultAvatar = "avatar.jpeg";

  const name = localStorage.getItem("userFullName") || "Guest";
  const avatar = localStorage.getItem("userAvatar") || defaultAvatar;

  const nameEl = document.querySelector(".profile-card h3");
  const picEl = document.querySelector(".profile-pic");

  if (nameEl) nameEl.textContent = name;

  // Убедимся, что путь к аватару корректен
  if (picEl) {
    // Если это полный URL (сохраненный в loadUserProfile) или дефолтный файл
    picEl.src = avatar;
  }
}

//LOGOUT
const logoutLink = document.getElementById("logout-link");
if (logoutLink) {
  logoutLink.onclick = async () => {
    await authFetch("http://localhost:5001/logout", { method: "POST" });

    // Clear local stored email and saved recipes
    localStorage.removeItem("userEmail");
    savedRecipes = [];
    await loadUserProfile();

    // Возвращаемся на главную
    showPage("home-page");
  };
}

function transitionToPage(newPageId) {
  const currentPage = document.querySelector(".page-content.active");
  const newPage = document.getElementById(newPageId);

  if (currentPage) {
    currentPage.classList.remove("active");
  }

  setTimeout(() => {
    if (newPage) {
      newPage.classList.add("active");
      window.scrollTo(0, 0);
    }
  }, 500);
}

// Initial setup: Render the cards and show the home page
document.addEventListener("DOMContentLoaded", async () => {
  // 1. Устанавливаем статус авторизации и обновляем UI
  await loadUserProfile();

  // 2. Загружаем сохраненные рецепты
  await loadSavedFromServer();

  // 3. Загружаем рецепты с API и рендерим
  try {
    const recipes = await fetchRecipesFromAPI();
    if (recipes && recipes.length) {
      allRecipes.splice(0, allRecipes.length, ...recipes); // обновляем массив
      renderRecipes(allRecipes, "home-page-grid", "home"); // рендерим
    }
  } catch (err) {
    console.error("Failed to load API recipes:", err);
    renderRecipes(allRecipes, "home-page-grid", "home"); // fallback
  }

  showPage("home-page");
});
