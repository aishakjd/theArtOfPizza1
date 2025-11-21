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
      tags: recipe.title.toLowerCase().split(" "), 
    }));
  } catch (err) {
    console.error("Error fetching recipes:", err);
    return [];
  }
}

let savedRecipes = [];
let currentRecipeId = null;

function createRecipeCard(recipe, style = "home") {
  let imgBorder =
    style === "full"
      ? "5px solid var(--card-background)"
      : "2px solid var(--background-light)";
  let cardClass = "recipe-card";

  if (style === "saved") {
    cardClass += " saved-card"; 
  }

  return `
    <div class="${cardClass}" onclick="loadRecipeDetail('${recipe.id}')">
      <div class="recipe-image-wrapper">
        <img src="${recipe.img}" alt="${recipe.title}" class="recipe-card-image" style="border: ${imgBorder};">
      </div>
      <h4>${recipe.title}</h4>
      <p>${recipe.publisher}</p>
    </div>
  `;
}

function renderRecipes(recipes, containerId, style = "home") {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = recipes
    .map((recipe) => createRecipeCard(recipe, style))
    .join("");

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

// script.js

async function loginUser(email, password) {
  try {
    const res = await fetch("http://localhost:5000/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", 
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (data.success) {
      const currentEmail = await getCurrentUserEmail();
      if (currentEmail) {
        localStorage.setItem("userEmail", currentEmail); 
        await loadUserProfile(); 
        alert("Logged in!");
      } else {
        alert("Login failed: no session found.");
      }
    } else {
      alert(data.message);
    }
  } catch (err) {
    console.error("Login failed:", err);
  }
}

async function getCurrentUser() {
  try {
    const email = localStorage.getItem("userEmail"); 
    if (!email) return null;

    const res = await fetch(`http://localhost:5000/profile/${email}`);
    if (!res.ok) throw new Error("Failed to fetch user");

    const data = await res.json();
    return data.user; 
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function getCurrentUserEmail() {
  try {
    const res = await fetch("http://localhost:5000/current-user", {
      credentials: "include", 
    });
    if (!res.ok) throw new Error("Failed to fetch current user");
    const data = await res.json();
    return data.email;
  } catch (err) {
    console.error("Error fetching current user email:", err);
    return null;
  }
}

function handleSearch(containerId, query) {
  const normalizedQuery = query.toLowerCase().trim();
  const filteredRecipes = allRecipes.filter((recipe) => {
    const titleMatch = recipe.title.toLowerCase().includes(normalizedQuery);
    const tagMatch = recipe.tags.some((tag) => tag.includes(normalizedQuery));
    return titleMatch || tagMatch;
  });

  const style = containerId === "recipes-grid-page-grid" ? "full" : "home";
  renderRecipes(filteredRecipes, containerId, style);
}

async function toggleSaveRecipe(button) {
  const userEmail = await getCurrentUserEmail();
  if (!userEmail) {
    alert("Please log in to save recipes!");
    return;
  }
  if (!currentRecipeId) return;

  const recipe = allRecipes.find((r) => r.id === currentRecipeId);
  const isSaved = savedRecipes.some((r) => r.id === currentRecipeId);

  if (!isSaved) {
    const res = await fetch("http://localhost:5000/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        recipe: {
          id: recipe.id,
          title: recipe.title,
          image: recipe.img,
        },
      }),
    });
    const data = await res.json();
    if (data.success) {
      savedRecipes.push(recipe);
      button.classList.add("saved");
      button.textContent = "Saved";
    } else {
      alert("Ошибка при сохранении");
    }
  } else {
    const res = await fetch("http://localhost:5000/saved", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ recipeId: currentRecipeId }),
    });
    const data = await res.json();
    if (data.success) {
      savedRecipes = savedRecipes.filter((r) => r.id !== currentRecipeId);
      button.classList.remove("saved");
      button.textContent = "Save";
    } else {
      alert("Ошибка при удалении");
    }
  }

  renderSavedRecipes();
}

async function loadSavedFromServer() {
  const userEmail = await getCurrentUserEmail();
  if (!userEmail) return;

  const res = await fetch(`http://localhost:5000/saved/${userEmail}`);
  const data = await res.json();

  savedRecipes = data.map((recipe) => ({
    id: recipe.id,
    title: recipe.title,
    img: recipe.image,
  }));
}

function renderSavingsPage() {
  const container = document.getElementById("saved-recipes-grid");
  const userEmail = localStorage.getItem("userEmail");

  container.innerHTML = ""; 

  if (!userEmail) {
    container.innerHTML = `
      <p class="empty-message">Log in to the account for seeing the recipes 🍕</p>
    `;
    return;
  }

  if (savedRecipes.length === 0) {
    container.innerHTML = `
      <p class="empty-message">You don't have any saved recipes 👀</p>
    `;
    return;
  }

  renderRecipes(savedRecipes, "saved-recipes-grid", "saved");
}

function loadRecipeDetail(id) {
  currentRecipeId = id;
  const recipe = allRecipes.find((r) => r.id === id);

  document.getElementById("detail-recipe-title").textContent = recipe.title;
  document.getElementById("detail-recipe-img").src = recipe.img;

  const saveButton = document.querySelector("#recipe-detail-page .save-button");
  const isSaved = savedRecipes.some((r) => r.id === id);

  if (isSaved) {
    saveButton.classList.add("saved");
    saveButton.textContent = "Saved";
  } else {
    saveButton.classList.remove("saved");
    saveButton.textContent = "Save";
  }

  showPage("recipe-detail-page");
}

function renderSavedRecipes() {
  renderRecipes(savedRecipes, "saved-recipes-grid", "saved");
}

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

  if (pageId === "recipes-grid-page") {
    renderRecipes(allRecipes, "recipes-grid-page-grid", "full");
  } else if (pageId === "profile-page") {
    renderSavingsPage();
  } else if (pageId === "home-page") {
    document.getElementById("home-search-input").value = "";
    renderRecipes(allRecipes, "home-page-grid", "home");
  }

  document.querySelectorAll(".nav ul li a").forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === pageId) {
      link.classList.add("active");
    }
  });

  updateHeader(pageId);
}

document.querySelector(".edit-button").onclick = () => {
  const fullName = localStorage.getItem("userFullName") || "";
  document.getElementById("edit-fullname").value = fullName;
  document.getElementById("edit-modal").style.display = "flex";
};

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

  const res = await fetch("http://localhost:5000/profile/update", {
    method: "POST",
    body: form,
    credentials: "include",
  });

  const data = await res.json().catch(() => null);
  if (!data || !data.user) {
    alert("Failed to update profile. Try again!");
    return;
  }

  await loadUserProfile();
  closeEditModal();
}

async function loadUserProfile() {
  const userEmail = await getCurrentUserEmail();
  const profileName = document.querySelector(".profile-card h3");
  const profilePic = document.querySelector(".profile-pic");
  if (!userEmail) {
    profileName.textContent = "User";
    profilePic.src = "avatar.jpeg";
    return;
  }

  const user = await getCurrentUser();
  profileName.textContent = user.fullName || "User";
  profilePic.src = user.avatar
    ? `http://localhost:5000${user.avatar}`
    : "avatar.jpeg";
}

function updateProfileCard() {
  const name = localStorage.getItem("userFullName") || "User";
  const avatar = localStorage.getItem("userAvatar") || "avatar.jpeg";

  document.querySelector(".profile-card h3").textContent = name;
  document.querySelector(".profile-pic").src = avatar;
}

document.addEventListener("DOMContentLoaded", () => {
  updateProfileCard();
});

const logoutLink = document.getElementById("logout-link");
logoutLink.onclick = async () => {
  await fetch("http://localhost:5000/logout", {
    method: "POST",
    credentials: "include",
  }); 
  await loadUserProfile(); 

  showPage("home-page");

  updateProfileCard();
};

document.addEventListener("DOMContentLoaded", async () => {
  await loadUserProfile();
  updateProfileCard();
  const welcomeEl = document.getElementById("welcome-message");
  const userEmail = localStorage.getItem("userEmail");
  await loadSavedFromServer();

  if (userEmail && welcomeEl) {
    welcomeEl.textContent = `Welcome, ${userEmail}! 🍕`;
  }

  try {
    const recipes = await fetchRecipesFromAPI();
    if (recipes && recipes.length) {
      allRecipes.splice(0, allRecipes.length, ...recipes); 
      renderRecipes(allRecipes, "home-page-grid", "home"); 
    }
  } catch (err) {
    console.error("Failed to load API recipes:", err);
    renderRecipes(allRecipes, "home-page-grid", "home"); 
  }

  showPage("home-page");
});

function transitionToPage(newPageId) {
  const currentPage = document.querySelector('.page-content.active');
  const newPage = document.getElementById(newPageId);
  
  if (currentPage) {
      currentPage.classList.remove('active');
  }

  setTimeout(() => {
      if (newPage) {
          newPage.classList.add('active');
          window.scrollTo(0, 0); 
      }
  }, 500); 
}

