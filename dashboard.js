const firebaseConfig = {
  apiKey: "AIzaSyDOzjmwm5ub4FUe2oATTMQ_UtPqKP4RZWo",
  authDomain: "dished2026.firebaseapp.com",
  projectId: "dished2026",
  storageBucket: "dished2026.firebasestorage.app",
  messagingSenderId: "767578060689",
  appId: "1:767578060689:web:6982e440d6077d8b5f4c30",
  measurementId: "G-GTGEC6F1FG"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// Extended Recipe Dataset
const recipes = [
  {
    id: "r1",
    title: "Classic Spaghetti Carbonara",
    tag: "Italian",
    image: "path/to/recipe1.jpg",
    videoUrl: "https://www.youtube.com/embed/D_2DBLAt57c", // Replace with your video or embed URL
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
      { author: "Maria G.", rating: 5, comment: "Turned out creamy and perfect! AI swapped the pork with mushrooms nicely." }
    ]
  },
  {
    id: "r2",
    title: "Avocado & Egg Toast",
    tag: "Breakfast",
    image: "path/to/recipe2.jpg",
    videoUrl: "",
    desc: "Crispy sourdough topped with mashed fresh avocado, poached egg, and chili flakes.",
    time: "10 mins",
    difficulty: "Easy",
    price: 6.00,
    ingredients: [
      { name: "Sourdough Bread", price: 2.00 },
      { name: "Avocado", price: 2.00 },
      { name: "Eggs", price: 1.00 },
      { name: "Chili Flakes", price: 0.50 },
      { name: "Olive Oil", price: 0.50 }
    ],
    steps: [
      "Toast sourdough slices until golden brown.",
      "Mash avocado with lemon juice, salt, and pepper in a small bowl.",
      "Poach or fry your egg to desired temperature.",
      "Spread avocado on toast, top with egg and a pinch of chili flakes."
    ],
    reviews: [
      { author: "Alex K.", rating: 4, comment: "Quick and super delicious breakfast!" }
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

let activeRecipe = null;
let currentCollectionFilter = 'all';

document.addEventListener('DOMContentLoaded', () => {
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  if (!currentUser) {
    window.location.href = 'index.html';
    return;
  }

  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('userInitials').textContent = currentUser.name.charAt(0).toUpperCase();

  renderRecipes(recipes);
  updateCollectionCounts();
  updateCartBadge();
});

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
  document.getElementById('countFavourites').textContent = getCollection('favourites').length;
  document.getElementById('countTried').textContent = getCollection('tried').length;
  document.getElementById('countWantToTry').textContent = getCollection('wantToTry').length;
}

function filterByCollection(collectionName, element) {
  currentCollectionFilter = collectionName;
  document.querySelectorAll('.sidebar-lists li').forEach(el => el.classList.remove('active'));
  element.classList.add('active');

  const titles = {
    all: "Featured Recipes",
    favourites: "❤️ Favourites",
    tried: "✅ Tried Recipes",
    wantToTry: "📌 Want to Try"
  };
  document.getElementById('pageTitle').textContent = titles[collectionName];
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
        
        <!-- Collection Quick Toggles -->
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
  const query = document.getElementById('searchInput').value.toLowerCase();
  const category = document.getElementById('categoryFilter').value;
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
  const favs = getCollection('favourites').includes(activeRecipe.id);
  const tried = getCollection('tried').includes(activeRecipe.id);
  const want = getCollection('wantToTry').includes(activeRecipe.id);

  content.innerHTML = `
    <div class="modal-header">
      <h2>${activeRecipe.title}</h2>
      <span class="price-tag">Estimated Cost: $${activeRecipe.price.toFixed(2)}</span>
    </div>

    <!-- Collection Toggle Buttons -->
    <div class="modal-collection-btns">
      <button class="${favs ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'favourites')">❤️ ${favs ? 'In Favourites' : 'Add to Favourites'}</button>
      <button class="${tried ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'tried')">✅ ${tried ? 'Tried It' : 'Mark as Tried'}</button>
      <button class="${want ? 'active' : ''}" onclick="toggleInCollection('${activeRecipe.id}', 'wantToTry')">📌 ${want ? 'Saved to Try' : 'Want to Try'}</button>
    </div>

    <!-- Media Section (Video or Large Photo) -->
    <div class="media-container">
      ${activeRecipe.videoUrl ? 
        `<iframe src="${activeRecipe.videoUrl}" title="Recipe Video" frameborder="0" allowfullscreen></iframe>` : 
        `<img src="${activeRecipe.image}" alt="${activeRecipe.title}" class="large-recipe-img">`
      }
    </div>

    <!-- AI Box -->
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

    <!-- Ingredients with Pricing -->
    <h3>Ingredients</h3>
    <ul class="ingredient-list">
      ${currentIngredients.map(ing => `
        <li>
          <span>${ing.name} <strong>($${ing.price.toFixed(2)})</strong></span>
          <button class="add-single-btn" onclick="addToCart('${ing.name.replace(/'/g, "\\'")}', ${ing.price})">+ Add to Cart</button>
        </li>
      `).join('')}
    </ul>

    <!-- Steps -->
    <h3>Step-by-Step Instructions</h3>
    <ol class="steps-list">
      ${activeRecipe.steps.map(step => `<li>${step}</li>`).join('')}
    </ol>

    <!-- Reviews Section -->
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

      <!-- Submit Review Form -->
      <form class="review-form" onsubmit="submitReview(event)">
        <h4>Add Your Review</h4>
        <select id="reviewRating" required>
          <option value="5">⭐⭐⭐⭐⭐ (5/5)</option>
          <option value="4">⭐⭐⭐⭐ (4/5)</option>
          <option value="3">⭐⭐⭐ (3/5)</option>
          <option value="2">⭐⭐ (2/5)</option>
          <option value="1">⭐ (1/5)</option>
        </select>
        <textarea id="reviewComment" placeholder="How did it taste? Did you make any changes?" required></textarea>
        <button type="submit" class="submit-btn">Post Review</button>
      </form>
    </div>
  `;
}

// AI Substitutions
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

// Review Submission
function submitReview(e) {
  e.preventDefault();
  const currentUser = JSON.parse(localStorage.getItem('currentUser'));
  const rating = parseInt(document.getElementById('reviewRating').value);
  const comment = document.getElementById('reviewComment').value;

  activeRecipe.reviews.push({
    author: currentUser ? currentUser.name : "Anonymous",
    rating,
    comment
  });

  renderModalContent(activeRecipe.ingredients);
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
  const cart = getCart();
  document.getElementById('cartCount').textContent = cart.length;
}

function renderCartModal() {
  const cart = getCart();
  const container = document.getElementById('cartItemsContainer');
  const totalPriceEl = document.getElementById('cartTotalPrice');

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

// Modal Handlers
function toggleRecipeModal(show) {
  document.getElementById('recipeModal').classList.toggle('hidden', !show);
}

function toggleCartModal(show) {
  if (show) renderCartModal();
  document.getElementById('cartModal').classList.toggle('hidden', !show);
}

function closeModalOnOverlay(e, modalId) {
  if (e.target.id === modalId) {
    document.getElementById(modalId).classList.add('hidden');
  }
}

function handleLogout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'index.html';
}
