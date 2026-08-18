// Firebase Configuration & Real-Time Sync Setup
const firebaseConfig = {
  apiKey: "AIzaSyDOzjmwm5ub4FUe2oATTMQ_UtPqKP4RZWo",
  authDomain: "dished2026.firebaseapp.com",
  projectId: "dished2026",
  storageBucket: "dished2026.firebasestorage.app",
  messagingSenderId: "767578060689",
  appId: "1:767578060689:web:6982e440d6077d8b5f4c30",
  measurementId: "G-GTGEC6F1FG"
};

let db = null;
if (typeof firebase !== 'undefined' && firebase.initializeApp) {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
}

let recipes = [];
let activeRecipe = null;
let currentCollectionFilter = 'all';

// Default Fallback Dataset
const defaultRecipes = [
  {
    id: "r1",
    title: "Classic Spaghetti Carbonara",
    tag: "Italian",
    image: "https://images.unsplash.com/photo-1612874742237-6526221588e3?w=500",
    videoUrl: "https://www.youtube.com/embed/D_2DBLAt57c",
    desc: "A rich, savory pasta dish made with eggs, cheese, cured pork, and black pepper.",
    time: "20 mins",
    difficulty: "Easy",
    price: 12.50,
    ingredients: [
      { name: "Spaghetti", price: 2.00 },
      { name: "Eggs", price: 2.50 },
      { name: "Pecorino Cheese", price: 4.00 },
      { name: "Guanciale (Pork)", price: 3.50 },
      { name: "Black Pepper", price: 0.50 }
    ],
    steps: [
      "Bring a large pot of salted water to a boil and cook spaghetti until al dente.",
      "In a bowl, whisk together eggs and grated Pecorino Romano cheese until smooth.",
      "Fry cured pork in a pan until crispy, then remove from heat.",
      "Toss hot pasta with pork fat, stir in egg mixture quickly off heat to create a creamy sauce, and top with pepper."
    ],
    reviews: [
      { author: "Maria G.", rating: 5, comment: "Turned out creamy and perfect!" }
    ]
  }
];

// Allergy Rules Engine
const allergyRules = {
  dairy: { "Pecorino Cheese": "Nutritional Yeast", "Heavy Cream": "Coconut Cream", "Butter": "Olive Oil" },
  gluten: { "Spaghetti": "Gluten-Free Zucchini Noodles", "Sourdough Bread": "Gluten-Free Bread" },
  eggs: { "Eggs": "Flax Eggs (Flaxseed + Water)" },
  meat: { "Guanciale (Pork)": "Smoked Mushrooms", "Chicken Breast": "Tofu" }
};

// DOM Initialization & Realtime Firebase Sync
document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser')) || {
    name: "Guest",
    email: "guest@example.com"
  };

  const profileName = document.getElementById('profileName');
  const profileEmail = document.getElementById('profileEmail');
  const userInitials = document.getElementById('userInitials');

  if (profileName) profileName.textContent = currentUser.name;
  if (profileEmail) profileEmail.textContent = currentUser.email;
  if (userInitials) userInitials.textContent = currentUser.name.charAt(0).toUpperCase();

  updateCollectionCounts();
  updateCartBadge();

  // Connect to Firebase Firestore to stream public recipes in real time
  if (db) {
    db.collection("recipes").onSnapshot((snapshot) => {
      const cloudRecipes = [];
      snapshot.forEach(doc => {
        cloudRecipes.push({ id: doc.id, ...doc.data() });
      });

      if (cloudRecipes.length === 0) {
        recipes = defaultRecipes;
      } else {
        recipes = cloudRecipes;
      }
      filterRecipes();
    }, (error) => {
      console.warn("Firestore access error, falling back to local dataset:", error);
      recipes = defaultRecipes;
      filterRecipes();
    });
  } else {
    recipes = defaultRecipes;
    filterRecipes();
  }
});

// Add New Public Recipe directly to Firebase
async function handleAddNewRecipe(e) {
  e.preventDefault();

  const title = document.getElementById('newTitle').value.trim();
  const tag = document.getElementById('newTag').value;
  const image = document.getElementById('newImage').value.trim();
  const videoUrl = document.getElementById('newVideo').value.trim();
  const desc = document.getElementById('newDesc').value.trim();
  const time = document.getElementById('newTime').value.trim();
  const difficulty = document.getElementById('newDifficulty').value.trim();
  const price = parseFloat(document.getElementById('newPrice').value) || 10.00;

  const rawIngredients = document.getElementById('newIngredients').value.split(',');
  const ingredients = rawIngredients.map(item => {
    return { name: item.trim(), price: parseFloat((price / rawIngredients.length).toFixed(2)) };
  });

  const steps = document.getElementById('newSteps').value.split('\n').filter(s => s.trim().length > 0);

  const newRecipeObj = {
    title,
    tag,
    image,
    videoUrl,
    desc,
    time,
    difficulty,
    price,
    ingredients,
    steps,
    reviews: []
  };

  if (db) {
    try {
      await db.collection("recipes").add(newRecipeObj);
      alert("Recipe successfully published to the community!");
      toggleAddRecipeModal(false);
      document.getElementById('addRecipeForm').reset();
    } catch (err) {
      alert("Error adding recipe: " + err.message);
    }
  } else {
    newRecipeObj.id = "local_" + Date.now();
    recipes.push(newRecipeObj);
    filterRecipes();
    toggleAddRecipeModal(false);
  }
}

// Post Review to Firebase
async function submitReview(e) {
  e.preventDefault();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value;

  const newReview = {
    author: currentUser ? currentUser.name : "Anonymous",
    rating,
    comment
  };

  activeRecipe.reviews.push(newReview);

  // Update in Firestore cloud
  if (db && activeRecipe.id && !activeRecipe.id.startsWith("r") && !activeRecipe.id.startsWith("local_")) {
    try {
      await db.collection("recipes").doc(activeRecipe.id).update({
        reviews: activeRecipe.reviews
      });
    } catch (err) {
      console.error("Failed to update cloud review:", err);
    }
  }

  renderModalContent(activeRecipe.ingredients);
}

// Sidebar Collections Engine
function getCollection(listName) {
  return JSON.parse(localStorage.getItem(`list_${listName}`) || '[]');
}

function toggleInCollection(recipeId, listName) {
  let list = getCollection(listName);
  if (list.includes(recipeId)) {
    list = list.filter(id => id !== recipeId);
  } else {
    list.push(recipeId);
  }
  localStorage.setItem(`list_${listName}`, JSON.stringify(list));
  updateCollectionCounts();
  filterRecipes();
  if (activeRecipe && activeRecipe.id === recipeId) {
    openRecipeModal(recipeId);
  }
}

function updateCollectionCounts() {
  const favEl = document.getElementById('countFavourites');
  const triedEl = document.getElementById('countTried');
  const wantEl = document.getElementById('countWantToTry');

  if (favEl) favEl.textContent = getCollection('favourites').length;
  if (triedEl) triedEl.textContent = getCollection('tried').length;
  if (wantEl) wantEl.textContent = getCollection('wantToTry').length;
}

function filterByCollection(collectionName, element) {
  currentCollectionFilter = collectionName;
  document.querySelectorAll('.sidebar-lists li').forEach(el => el.classList.remove('active'));
  if (element) element.classList.add('active');

  const titles = {
    all: "Featured Recipes",
    favourites: "❤️ Favourites",
    tried: "✅ Tried Recipes",
    wantToTry: "📌 Want to Try"
  };
  const titleEl = document.getElementById('pageTitle');
  if (titleEl) titleEl.textContent = titles[collectionName];
  filterRecipes();
}

// Search & Rendering
function renderRecipes(list) {
  const container = document.getElementById('recipeGrid');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `<p class="no-results">No recipes found in this view.</p>`;
    return;
  }

  const favs = getCollection('favourites');
  const tried = getCollection('tried');
  const want = getCollection('wantToTry');

  container.innerHTML = list.map(r => `
    <article class="recipe-card">
      <div class="recipe-image-container" onclick="openRecipeModal('${r.id}')">
        <img src="${r.image}" alt="${r.title}" class="recipe-img">
        <span class="price-badge">$${r.price.toFixed(2)}</span>
      </div>
      <div class="recipe-details">
        <span class="recipe-tag">${r.tag}</span>
        <h3 onclick="openRecipeModal('${r.id}')">${r.title}</h3>
        <p>${r.desc}</p>
        <div class="card-list-actions">
          <button class="${favs.includes(r.id) ? 'active' : ''}" onclick="toggleInCollection('${r.id}', 'favourites')">❤️</button>
          <button class="${tried.includes(r.id) ? 'active' : ''}" onclick="toggleInCollection('${r.id}', 'tried')">✅</button>
          <button class="${want.includes(r.id) ? 'active' : ''}" onclick="toggleInCollection('${r.id}', 'wantToTry')">📌</button>
        </div>
        <div class="recipe-meta" onclick="openRecipeModal('${r.id}')">
          <span>⏱️ ${r.time}</span>
          <span>🔥 ${r.difficulty}</span>
        </div>
      </div>
    </article>
  `).join('');
}

function filterRecipes() {
  const searchEl = document.getElementById('searchInput');
  const categoryEl = document.getElementById('categoryFilter');
  if (!searchEl || !categoryEl) return;

  const query = searchEl.value.toLowerCase();
  const category = categoryEl.value;
  const collectionIds = getCollection(currentCollectionFilter);

  const filtered = recipes.filter(r => {
    const matchesCollection = (currentCollectionFilter === 'all') || collectionIds.includes(r.id);
    const matchesCategory = (category === 'All' || r.tag === category);
    const matchesSearch = r.title.toLowerCase().includes(query) || 
                          r.desc.toLowerCase().includes(query) ||
                          r.ingredients.some(i => i.name.toLowerCase().includes(query));
    return matchesCollection && matchesCategory && matchesSearch;
  });

  renderRecipes(filtered);
}

// Modal View Engine
function openRecipeModal(recipeId) {
  activeRecipe = recipes.find(r => r.id === recipeId);
  if (!activeRecipe) return;
  renderModalContent(activeRecipe.ingredients);
  toggleRecipeModal(true);
}

function renderModalContent(currentIngredients, aiApplied = false) {
  const content = document.getElementById('modalRecipeContent');
  if (!content) return;

  const favs = getCollection('favourites').includes(activeRecipe.id);
  const tried = getCollection('tried').includes(activeRecipe.id);
  const want = getCollection('wantToTry').includes(activeRecipe.id);

  content.innerHTML = `
    <div class="modal-header">
      <h2>${activeRecipe.title}</h2>
      <span class="price-tag">Estimated Cost: $${activeRecipe.price.toFixed(2)}</span>
    </div>

    <div class="modal-collection-btns">
      <button class="${favs ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'favourites')">❤️ ${favs ? 'In Favourites' : 'Add to Favourites'}</button>
      <button class="${tried ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'tried')">✅ ${tried ? 'Tried It' : 'Mark as Tried'}</button>
      <button class="${want ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'wantToTry')">📌 ${want ? 'Saved to Try' : 'Want to Try'}</button>
    </div>

    <div class="media-container">
      ${activeRecipe.videoUrl ? 
        `<iframe src="${activeRecipe.videoUrl}" title="Recipe Video" frameborder="0" allowfullscreen></iframe>` : 
        `<img src="${activeRecipe.image}" alt="${activeRecipe.title}" class="large-recipe-img">`
      }
    </div>

    <div class="ai-box">
      <h4>🤖 AI Allergy Assistant</h4>
      <div class="allergy-tags">
        <button class="allergy-btn" onclick="applyAISubstitution('dairy')">Dairy-Free</button>
        <button class="allergy-btn" onclick="applyAISubstitution('gluten')">Gluten-Free</button>
        <button class="allergy-btn" onclick="applyAISubstitution('eggs')">Egg-Free</button>
        <button class="allergy-btn" onclick="applyAISubstitution('meat')">Vegetarian</button>
        ${aiApplied ? `<button class="allergy-btn reset" onclick="resetIngredients()">Reset Original</button>` : ''}
      </div>
    </div>

    <h3>Ingredients</h3>
    <ul class="ingredient-list">
      ${currentIngredients.map(ing => `
        <li>
          <span>${ing.name} <strong>($${ing.price.toFixed(2)})</strong></span>
          <button class="add-single-btn" onclick="addToCart('${ing.name.replace(/'/g, "\\'")}', ${ing.price})">+ Add to Cart</button>
        </li>
      `).join('')}
    </ul>

    <h3>Step-by-Step Instructions</h3>
    <ol class="steps-list">
      ${activeRecipe.steps.map(step => `<li>${step}</li>`).join('')}
    </ol>

    <h3>Reviews & Ratings</h3>
    <div class="reviews-container">
      <div id="reviewsList">
        ${activeRecipe.reviews.length === 0 ? '<p>No reviews yet. Be the first!</p>' : ''}
        ${activeRecipe.reviews.map(rev => `
          <div class="review-item">
            <strong>${rev.author}</strong> - ${'⭐'.repeat(rev.rating)}
            <p>${rev.comment}</p>
          </div>
        `).join('')}
      </div>

      <form class="review-form" onsubmit="submitReview(event)">
        <h4>Add Your Review</h4>
        <select id="reviewRating" required>
          <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
          <option value="4">⭐⭐⭐⭐ (4/5)</option>
          <option value="3">⭐⭐⭐ (3/5)</option>
          <option value="2">⭐⭐ (2/5)</option>
          <option value="1">⭐ (1/5)</option>
        </select>
        <textarea id="reviewComment" placeholder="How did it taste?" required></textarea>
        <button type="submit" class="submit-btn">Post Review</button>
      </form>
    </div>
  `;
}

function applyAISubstitution(allergyType) {
  const rule = allergyRules[allergyType];
  if (!rule || !activeRecipe) return;

  const modified = activeRecipe.ingredients.map(ing => {
    return rule[ing.name] ? { name: `✨ ${rule[ing.name]} (AI Swap)`, price: ing.price } : ing;
  });

  renderModalContent(modified, true);
}

function resetIngredients() {
  if (activeRecipe) renderModalContent(activeRecipe.ingredients, false);
}

// Shopping Cart Functions
function getCart() {
  return JSON.parse(localStorage.getItem('recipeCart') || '[]');
}

function addToCart(name, price) {
  const cart = getCart();
  cart.push({ name, price });
  localStorage.setItem('recipeCart', JSON.stringify(cart));
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById('cartCount');
  if (badge) badge.textContent = getCart().length;
}

function renderCartModal() {
  const cart = getCart();
  const container = document.getElementById('cartItemsContainer');
  const totalPriceEl = document.getElementById('cartTotalPrice');

  if (!container || !totalPriceEl) return;

  if (cart.length === 0) {
    container.innerHTML = `<p style="text-align:center; color: #888;">Your cart is empty.</p>`;
    totalPriceEl.textContent = "$0.00";
    return;
  }

  let total = 0;
  container.innerHTML = cart.map((item, index) => {
    total += item.price;
    return `
      <div class="cart-item">
        <span>${item.name} - <strong>$${item.price.toFixed(2)}</strong></span>
        <button onclick="removeFromCart(${index})" class="remove-btn">&times;</button>
      </div>
    `;
  }).join('');

  totalPriceEl.textContent = `$${total.toFixed(2)}`;
}

function removeFromCart(index) {
  const cart = getCart();
  cart.splice(index, 1);
  localStorage.setItem('recipeCart', JSON.stringify(cart));
  updateCartBadge();
  renderCartModal();
}

function clearCart() {
  localStorage.removeItem('recipeCart');
  updateCartBadge();
  renderCartModal();
}

// Global UI Actions
function toggleRecipeModal(show) {
  const modal = document.getElementById('recipeModal');
  if (modal) modal.classList.toggle('hidden', !show);
}

function toggleAddRecipeModal(show) {
  const modal = document.getElementById('addRecipeModal');
  if (modal) modal.classList.toggle('hidden', !show);
}

function toggleCartModal(show) {
  if (show) renderCartModal();
  const modal = document.getElementById('cartModal');
  if (modal) modal.classList.toggle('hidden', !show);
}

function closeModalOnOverlay(e, modalId) {
  if (e.target.id === modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('hidden');
  }
}

function handleLogout() {
  localStorage.removeItem('currentUser');
  window.location.href = "./index.html";
}
}