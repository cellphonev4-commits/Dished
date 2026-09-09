/* =============================================================================
   dished shared app runtime

   Every page used to carry its own copy of the sidebar markup, the cart
   drawer, the profile-picture uploader, the seed recipes and the cart logic.
   All of that lives here once. A page now boots with:

       Dished.mountShell({ active: 'home' });

   and gets the sidebar, cart drawer, recipe composer and toast stack for free.
   ========================================================================== */
window.Dished = (function () {
    'use strict';

    /* ---------------------------------------------------------------------
       Storage keys
       ------------------------------------------------------------------ */
    var K = {
        recipes: 'dishedRecipes',
        featured: 'featuredRecipes',
        cart: 'dishedCart',
        liked: 'likedRecipes',
        avatar: 'userProfilePic',
        accounts: 'dishedAccounts',
        seed: 'dishedSeedVersion',
        remember: 'dishedRemember',
        lists: 'dishedLists',
        settings: 'dishedSettings',
        checkout: 'dishedCheckout',
        orders: 'dishedOrders',
        alerts: 'dishedAlerts'
    };
    var SEED_VERSION = 5;

    /* ---------------------------------------------------------------------
       Small helpers
       ------------------------------------------------------------------ */
    function esc(str) {
        return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function qs(sel, root) { return (root || document).querySelector(sel); }
    function qsa(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

    function icon(name, cls, weight) {
        return '<i class="ph' + (weight ? '-' + weight : '') + ' ph-' + name + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>';
    }

    /* DiceBear "slice" avatars stand in for photos, so nobody is a grey blank.
       An uploaded picture always wins over the generated one. */
    function avatar(seed, opts) {
        opts = opts || {};
        return 'https://api.dicebear.com/10.x/slice/svg?seed=' +
            encodeURIComponent(String(seed || 'dished')) +
            '&radius=50&backgroundColor=' + (opts.bg || '5b8266,4a6b53,7ba68d,cfe0d5');
    }

    var store = {
        get: function (key, fallback) {
            try {
                var raw = localStorage.getItem(key);
                return raw === null ? fallback : JSON.parse(raw);
            } catch (e) { return fallback; }
        },
        set: function (key, value) {
            try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* quota */ }
        }
    };

    /* Tiny event bus so pages can react to shared state changes */
    var listeners = {};
    function on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); }
    function emit(evt, payload) { (listeners[evt] || []).forEach(function (fn) { fn(payload); }); }

    /* ---------------------------------------------------------------------
       Money: the whole app prices in Iraqi Dinar
       ------------------------------------------------------------------ */
    var IQD_PER_USD = 1450;
    var money = {
        format: function (n) {
            var rounded = Math.ceil((Number(n) || 0) / 500) * 500;
            return rounded.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') + ' IQD';
        },
        /* Ingredients may carry an inline price ("1 lb Beef - $5.99"). When they
           don't, derive a stable pretend price from the text so the cart adds up. */
        parse: function (text) {
            var m = text.match(/-\s*\$?\s*([\d,]+(?:\.\d{1,2})?)\s*(?:IQD)?/i);
            if (m) {
                var val = parseFloat(m[1].replace(/,/g, ''));
                if (m[0].indexOf('$') > -1) val *= IQD_PER_USD;
                return { name: text.replace(m[0], '').trim(), price: Math.ceil(val / 500) * 500 };
            }
            return { name: text, price: Math.ceil(((text.length % 5) + 1.99) * IQD_PER_USD / 500) * 500 };
        }
    };

    /* ---------------------------------------------------------------------
       Fake auth: no server, everything lives in the browser
       ------------------------------------------------------------------ */
    var DEMO = { name: 'Nora Kareem', username: 'nora@dished.app', password: 'dished123' };

    var auth = {
        demo: DEMO,
        accounts: function () {
            var list = store.get(K.accounts, null);
            if (!list) { list = [DEMO]; store.set(K.accounts, list); }
            return list;
        },
        find: function (username) {
            var u = String(username || '').trim().toLowerCase();
            return auth.accounts().filter(function (a) { return a.username.toLowerCase() === u; })[0];
        },
        register: function (account) {
            var list = auth.accounts();
            list.push(account);
            store.set(K.accounts, list);
            return account;
        },
        start: function (account, remember) {
            sessionStorage.setItem('loggedInName', account.name);
            sessionStorage.setItem('loggedInUser', account.username);
            sessionStorage.setItem('loggedInPassword', account.password);
            if (remember) store.set(K.remember, account.username);
        },
        current: function () {
            var username = sessionStorage.getItem('loggedInUser');
            if (!username) return { name: 'Guest', username: 'guest', isGuest: true };
            return {
                name: sessionStorage.getItem('loggedInName') || 'Cook',
                username: username,
                password: sessionStorage.getItem('loggedInPassword') || '',
                isGuest: false
            };
        },
        signOut: function () {
            sessionStorage.clear();
            window.location.href = 'sign.html';
        }
    };

    /* ---------------------------------------------------------------------
       Recipe data
       ------------------------------------------------------------------ */
    var SEED_RECIPES = [
        {
            id: 1, title: 'Spaghetti Carbonara', imgUrl: 'pasta.jfif',
            ingredients: '1 lb Spaghetti, 6 oz Guanciale or Pancetta, 4 Egg yolks, 1 cup Pecorino Romano, 1 tsp Black pepper',
            instructions: 'Cook pasta. Fry pork until crispy. Whisk yolks with cheese and pepper. Combine pasta with pork, then toss with egg-cheese mixture off the heat.',
            creator: 'Chef Maria', prepTime: '10 mins', cookTime: '15 mins', servings: '4 servings',
            difficulty: 'Medium', tags: 'Pasta, Italian, Dinner, Creamy',
            description: 'Rich, creamy, and authentic Roman pasta. Perfect for a cozy Italian dinner night at home.',
            category: 'Pasta'
        },
        {
            id: 2, title: 'Classic Avocado Toast', imgUrl: 'avacado.jfif',
            ingredients: '2 slices Sourdough bread, 1 Ripe Avocado, 1 tbsp Lemon juice, 1/2 tsp Red pepper flakes, 1/4 tsp Salt, 1 tbsp Olive oil',
            instructions: 'Toast the bread. Mash avocado with lemon juice and salt. Spread on toast, drizzle with olive oil, and top with red pepper flakes.',
            creator: 'Alex Green', prepTime: '5 mins', cookTime: '5 mins', servings: '2 servings',
            difficulty: 'Easy', tags: 'Healthy, Quick, Breakfast, Vegan',
            description: 'Crispy sourdough topped with creamy mashed avocado, red pepper flakes, and a fresh squeeze of lemon.',
            category: 'Breakfast'
        },
        {
            id: 3, title: 'Chocolate Chip Cookies', imgUrl: 'cookies.jfif',
            ingredients: '1 cup Butter, 1 cup White sugar, 1/2 cup Brown sugar, 2 Eggs, 1 tsp Vanilla extract, 3 cups Flour, 1 tsp Baking soda, 2 cups Chocolate chips',
            instructions: 'Preheat oven to 350F (175C). Cream butter and sugars. Add eggs and vanilla. Mix dry ingredients, stir into batter. Fold in chocolate chips. Bake for 10-12 minutes.',
            creator: "Sally's Baking Recipes", prepTime: '15 mins', cookTime: '12 mins', servings: '24 cookies',
            difficulty: 'Easy', tags: 'Cookies, Easy, Dessert, Popular',
            description: 'Crispy edges, soft center, and loaded with chocolate chips. The perfect classic cookie!',
            category: 'Dessert'
        },
        {
            id: 4, title: 'Fluffy Pancakes', imgUrl: 'american pancakes ✧_˚ ⁺ ｡ﾟ‧.jfif',
            ingredients: '1.5 cups Flour, 3.5 tsp Baking powder, 1 tsp Salt, 1 tbsp White sugar, 1.25 cups Milk, 1 Egg, 3 tbsp Melted butter',
            instructions: 'Sift together the flour, baking powder, salt and sugar. Make a well in the centre and pour in the milk, egg and melted butter; mix until smooth. Heat a lightly oiled griddle over medium-high heat. Pour the batter onto the griddle. Brown on both sides and serve hot.',
            creator: 'Breakfast King', prepTime: '5 mins', cookTime: '15 mins', servings: '8 pancakes',
            difficulty: 'Easy', tags: 'Breakfast, Sweet, Classic',
            description: 'Tall, fluffy pancakes that are a weekend breakfast staple.',
            category: 'Breakfast'
        },
        {
            id: 5, title: 'Chicken Caesar Salad', imgUrl: 'Caesar Salad.jfif',
            ingredients: '2 heads Romaine lettuce, 1 cup Croutons, 1/2 cup Parmesan cheese, 2 Chicken breasts, 1/2 cup Caesar dressing',
            instructions: 'Season and grill the chicken breasts until cooked through, then slice. Chop the romaine lettuce. Toss lettuce with Caesar dressing, croutons, and parmesan cheese. Top with sliced grilled chicken.',
            creator: 'Healthy Eats', prepTime: '10 mins', cookTime: '15 mins', servings: '2 servings',
            difficulty: 'Easy', tags: 'Healthy, Salad, Lunch',
            description: 'A classic Caesar salad topped with freshly grilled chicken breast.',
            category: 'Lunch'
        }
    ];

    var FEATURED_RECIPES = [
        {
            id: 101, title: 'Beef Stroganoff', imgUrl: 'beef.jfif',
            ingredients: '1 lb Beef sirloin, 1 tbsp Olive oil, 1 cup Mushrooms, 1/2 cup Onions, 1 cup Beef broth, 1/2 cup Sour cream, 2 cups Egg noodles',
            instructions: 'Slice beef into thin strips. Saute onions and mushrooms in oil. Add beef and brown. Pour in broth and simmer. Stir in sour cream off heat. Serve over cooked egg noodles.',
            creator: 'Dished Editors', prepTime: '15 mins', cookTime: '20 mins', servings: '4 servings',
            difficulty: 'Medium', tags: 'Dinner, Beef, Classic',
            description: "A rich and creamy classic beef stroganoff that's quick enough for a weeknight dinner.",
            category: 'Dinner'
        },
        {
            id: 102, title: 'Margherita Pizza', imgUrl: 'pizza.jfif',
            ingredients: '1 lb Pizza dough, 1 cup Tomato sauce, 8 oz Fresh mozzarella, 1/4 cup Fresh basil leaves, 1 tbsp Olive oil',
            instructions: 'Preheat oven to 500F (260C). Stretch dough onto a pizza stone. Spread tomato sauce evenly. Top with slices of fresh mozzarella. Bake for 10-12 minutes. Garnish with fresh basil and a drizzle of olive oil.',
            creator: 'Dished Editors', prepTime: '20 mins', cookTime: '12 mins', servings: '2 servings',
            difficulty: 'Medium', tags: 'Pizza, Italian, Vegetarian',
            description: 'The classic Neapolitan pizza with fresh mozzarella, basil, and a perfectly blistered crust.',
            category: 'Dinner'
        },
        {
            id: 103, title: 'Shrimp Scampi', imgUrl: 'shrimp.jfif',
            ingredients: '1 lb Large shrimp, 4 tbsp Butter, 3 cloves Garlic, 1/4 cup White wine, 2 tbsp Lemon juice, 1/4 cup Parsley, 8 oz Linguine',
            instructions: 'Cook linguine according to package directions. In a skillet, melt butter and saute minced garlic. Add shrimp and cook until pink. Stir in wine and lemon juice, simmering for 2 minutes. Toss with pasta and fresh parsley.',
            creator: 'Dished Editors', prepTime: '10 mins', cookTime: '10 mins', servings: '2 servings',
            difficulty: 'Easy', tags: 'Seafood, Pasta, Quick',
            description: 'Garlicky, buttery shrimp tossed with linguine and a splash of bright lemon.',
            category: 'Dinner'
        },
        {
            id: 104, title: 'Chicken Tikka Masala', imgUrl: 'tikka.jfif',
            ingredients: '1 lb Chicken breast, 1 cup Plain yogurt, 2 tbsp Garam masala, 1 tbsp Turmeric, 1 cup Tomato puree, 1/2 cup Heavy cream, 1 tbsp Ginger, 2 cloves Garlic',
            instructions: 'Marinate chicken in yogurt and spices for 1 hour. Broil chicken until charred. In a pot, saute garlic and ginger. Add tomato puree and simmer. Stir in heavy cream and cooked chicken. Serve with rice and naan.',
            creator: 'Dished Editors', prepTime: '1 hour', cookTime: '30 mins', servings: '4 servings',
            difficulty: 'Medium', tags: 'Indian, Curry, Chicken',
            description: 'Tender chunks of marinated chicken in a creamy, spiced tomato sauce.',
            category: 'Dinner'
        },
        {
            id: 105, title: 'Vegetable Stir Fry', imgUrl: 'veg.jfif',
            ingredients: '2 cups Broccoli florets, 1 cup Bell peppers, 1 cup Snap peas, 2 tbsp Soy sauce, 1 tbsp Sesame oil, 1 tbsp Ginger, 2 cloves Garlic',
            instructions: 'Heat sesame oil in a wok or large skillet. Stir fry garlic and ginger until fragrant. Add vegetables and cook until tender-crisp. Pour in soy sauce and toss to coat. Serve over steamed rice.',
            creator: 'Dished Editors', prepTime: '15 mins', cookTime: '10 mins', servings: '2 servings',
            difficulty: 'Easy', tags: 'Vegan, Vegetarian, Healthy, Quick',
            description: 'A quick and healthy vegetable medley tossed in a savoury soy-ginger sauce.',
            category: 'Dinner'
        },
        {
            id: 106, title: 'Blueberry Muffins', imgUrl: 'bluberry muffins.jfif',
            ingredients: '1.5 cups Flour, 3/4 cup White sugar, 1/2 tsp Salt, 2 tsp Baking powder, 1/3 cup Vegetable oil, 1 Egg, 1/3 cup Milk, 1 cup Fresh blueberries',
            instructions: 'Preheat oven to 400F (200C). Combine dry ingredients. Mix oil, egg, and milk in another bowl. Fold wet ingredients into dry, then gently fold in blueberries. Fill muffin tins and bake for 20-25 minutes.',
            creator: 'Dished Editors', prepTime: '10 mins', cookTime: '20 mins', servings: '8 muffins',
            difficulty: 'Easy', tags: 'Baking, Breakfast, Sweet',
            description: 'Classic, fluffy blueberry muffins with a golden-brown sugary top.',
            category: 'Breakfast'
        },
        {
            id: 107, title: 'Greek Salad', imgUrl: 'Caesar Salad.jfif',
            ingredients: '2 cups Cucumbers, 2 cups Cherry tomatoes, 1/2 cup Red onion, 1/2 cup Kalamata olives, 4 oz Feta cheese, 2 tbsp Olive oil, 1 tbsp Red wine vinegar, 1 tsp Dried oregano',
            instructions: 'Chop cucumbers, tomatoes, and red onion. Combine in a large bowl with olives and chunks of feta cheese. Whisk together olive oil, vinegar, and oregano. Toss the salad with the dressing.',
            creator: 'Dished Editors', prepTime: '15 mins', cookTime: '0 mins', servings: '2 servings',
            difficulty: 'Easy', tags: 'Salad, Healthy, Vegetarian, Greek',
            description: 'A crisp and refreshing traditional Greek salad bursting with Mediterranean flavours.',
            category: 'Lunch'
        }
    ];

    var SEED_IDS = SEED_RECIPES.map(function (r) { return r.id; });
    var FEATURED_IDS = FEATURED_RECIPES.map(function (r) { return r.id; });

    /* Starter collections. The sidebar badges, the lists page and the
       "save to list" buttons all read from here. */
    var DEFAULT_LISTS = [
        { id: 'want-to-try', name: 'Want to try', glyph: 'bookmark-simple',
          note: 'Saved for a quiet weekend', recipes: [104, 102, 106, 1, 107, 101, 3, 105] },
        { id: 'made-it', name: 'Made it', glyph: 'check-circle',
          note: 'Cooked, eaten, approved', recipes: [2, 3, 5, 1, 103, 4] },
        { id: 'favourites', name: 'Favourites', glyph: 'heart-straight',
          note: 'The ones on repeat', recipes: [3, 2, 103, 106, 104] },
        { id: 'quick-easy', name: 'Quick & easy', glyph: 'lightning',
          note: 'On the table in half an hour', recipes: [2, 103, 105, 5] }
    ];

    var DEFAULT_SETTINGS = {
        displayName: '',
        bio: 'Home cook, weekend baker, permanent snack enthusiast.',
        avoid: ['dairy'],
        units: 'us',
        defaultFilter: 'all',
        notifyReviews: true,
        notifyFollowers: true,
        notifyWeekly: false,
        reduceMotion: false
    };

    /* Reviews other cooks left, plus a few marked `mine` so the reviews page
       has something to show on a fresh browser. */
    var STOCK_REVIEWS = [
        { user: 'Layla', date: '2 days ago', rating: 5, comment: 'Super easy and delicious! My family loved it. Will make again.' },
        { user: 'Omar', date: '1 week ago', rating: 4, comment: 'Great recipe. I added a pinch of sea salt on top and it was amazing.' },
        { user: 'Hana', date: '2 weeks ago', rating: 5, comment: 'Turned out perfect, and the dairy-free swap worked a treat.' }
    ];

    /* Pretend delivery details. Nothing here is a real card: the numbers are
       masked placeholders and there is nowhere to type a real one. */
    var DEFAULT_CHECKOUT = {
        addressId: 'home',
        methodId: 'cod',
        slot: 0,
        addresses: [
            { id: 'home', label: 'Home', name: 'Nora Kareem', phone: '+964 770 000 0000',
              line: 'Al-Mansour, Street 14, House 22', city: 'Baghdad' },
            { id: 'work', label: 'Work', name: 'Nora Kareem', phone: '+964 770 000 0000',
              line: 'Karrada, Office Tower B, Floor 3', city: 'Baghdad' }
        ],
        methods: [
            { id: 'cod', label: 'Cash on delivery', glyph: 'money', hint: 'Pay the driver when it arrives' },
            { id: 'visa', label: 'Demo Visa', glyph: 'credit-card', hint: 'Ends 4242, expires 09/29' },
            { id: 'mastercard', label: 'Demo Mastercard', glyph: 'credit-card', hint: 'Ends 8210, expires 04/28' },
            { id: 'wallet', label: 'dished wallet', glyph: 'wallet', hint: 'Demo balance 75,000 IQD' }
        ],
        slots: ['Today, 6:00 to 7:00 PM', 'Today, 8:00 to 9:00 PM', 'Tomorrow, 9:00 to 10:00 AM']
    };

    var DELIVERY_FEE = 2500;

    var DEMO_ALERTS = [
        { id: 1, glyph: 'star', tone: 'honey', unread: true, time: '12 minutes ago',
          title: 'Layla rated your Blueberry Muffins', body: 'Five stars. "Lovely crumb, exactly what I wanted."' },
        { id: 2, glyph: 'users', tone: 'sage', unread: true, time: '2 hours ago',
          title: 'Omar started following you', body: 'They have cooked three of your recipes this month.' },
        { id: 3, glyph: 'motorcycle', tone: 'sage', unread: true, time: 'Yesterday',
          title: 'Order DSH-10248 delivered', body: 'Four ingredients dropped off at Home.' },
        { id: 4, glyph: 'chat-circle-text', tone: 'sage', unread: false, time: '3 days ago',
          title: 'New comment on Shrimp Scampi', body: 'Hana asked which mushrooms you used for the swap.' },
        { id: 5, glyph: 'sparkle', tone: 'sage', unread: false, time: 'Last week',
          title: 'Your recipe was featured', body: 'Classic Avocado Toast made the editors\u2019 picks.' }
    ];

    var DEMO_ORDERS = [
        { id: 'DSH-10248', date: '2 weeks ago', status: 'Delivered', method: 'Demo Visa', address: 'Home',
          items: [{ name: '1 lb Large shrimp', price: 9000 }, { name: '8 oz Linguine', price: 4500 },
                  { name: '4 tbsp Butter', price: 4500 }, { name: '1/4 cup Parsley', price: 7500 }], total: 28000 },
        { id: 'DSH-10193', date: '1 month ago', status: 'Delivered', method: 'Cash on delivery', address: 'Work',
          items: [{ name: '3 cups Flour', price: 4500 }, { name: '2 cups Chocolate chips', price: 9000 },
                  { name: '1 cup Butter', price: 4500 }], total: 20500 }
    ];

    var MY_DEMO_REVIEWS = {
        2: { mine: true, date: '3 days ago', rating: 5, comment: 'My go-to breakfast. I swap the sourdough for gluten-free bread and it still holds up.' },
        3: { mine: true, date: '1 week ago', rating: 4, comment: 'Chilled the dough overnight and the texture was so much better. Coconut oil works instead of butter.' },
        103: { mine: true, date: '2 weeks ago', rating: 5, comment: 'Made this for guests and everyone asked for the recipe. The mushroom swap is genuinely good too.' },
        106: { mine: true, date: '3 weeks ago', rating: 4, comment: 'Lovely crumb. Needed five extra minutes in my oven.' }
    };

    var data = {
        seed: function () {
            var stored = store.get(K.recipes, null);
            if (!stored || store.get(K.seed) !== SEED_VERSION) {
                /* Keep anything the cook added themselves, refresh the samples */
                var mine = (stored || []).filter(function (r) { return SEED_IDS.indexOf(r.id) === -1; });
                store.set(K.recipes, SEED_RECIPES.concat(mine));
                store.set(K.seed, SEED_VERSION);
            }
            store.set(K.featured, FEATURED_RECIPES);

            if (!store.get(K.lists, null)) store.set(K.lists, DEFAULT_LISTS);
            if (!store.get(K.settings, null)) store.set(K.settings, DEFAULT_SETTINGS);
            if (!store.get(K.checkout, null)) store.set(K.checkout, DEFAULT_CHECKOUT);
            if (!store.get(K.orders, null)) store.set(K.orders, DEMO_ORDERS);
            if (!store.get(K.alerts, null)) store.set(K.alerts, DEMO_ALERTS);

            /* Give a handful of recipes a review history */
            Object.keys(MY_DEMO_REVIEWS).forEach(function (id) {
                if (ratings.reviewsFor(id)) return;
                ratings.saveReviews(id, [MY_DEMO_REVIEWS[id]].concat(STOCK_REVIEWS.slice(0, 2)));
            });
        },
        community: function () { return store.get(K.recipes, []); },
        featured: function () { return store.get(K.featured, FEATURED_RECIPES); },
        all: function () { return data.community().concat(data.featured()); },
        byId: function (id) {
            var n = Number(id);
            return data.all().filter(function (r) { return Number(r.id) === n; })[0];
        },
        add: function (recipe) {
            var list = data.community();
            list.unshift(recipe);
            store.set(K.recipes, list);
            emit('recipes:change');
            return recipe;
        },
        remove: function (id) {
            var list = data.community();
            var idx = -1;
            list.forEach(function (r, i) { if (Number(r.id) === Number(id)) idx = i; });
            if (idx === -1) return null;
            var removed = list.splice(idx, 1)[0];
            store.set(K.recipes, list);
            emit('recipes:change');
            return { recipe: removed, index: idx };
        },
        restore: function (snapshot) {
            if (!snapshot) return;
            var list = data.community();
            list.splice(snapshot.index, 0, snapshot.recipe);
            store.set(K.recipes, list);
            emit('recipes:change');
        },
        /* True for recipes the signed-in cook actually created. Those are the
           only ones the feed offers to delete. */
        isCustom: function (recipe) {
            var id = Number(recipe.id);
            return SEED_IDS.indexOf(id) === -1 && FEATURED_IDS.indexOf(id) === -1;
        }
    };

    /* ---------------------------------------------------------------------
       Likes
       ------------------------------------------------------------------ */
    var likes = {
        list: function () { return store.get(K.liked, []); },
        has: function (id) { return likes.list().indexOf(Number(id)) > -1; },
        toggle: function (id) {
            var list = likes.list();
            var i = list.indexOf(Number(id));
            if (i > -1) list.splice(i, 1); else list.push(Number(id));
            store.set(K.liked, list);
            emit('likes:change');
            return i === -1;
        }
    };

    /* ---------------------------------------------------------------------
       Lists
       ------------------------------------------------------------------ */
    var lists = {
        all: function () { return store.get(K.lists, DEFAULT_LISTS); },
        byId: function (id) { return lists.all().filter(function (l) { return l.id === id; })[0]; },
        save: function (all) { store.set(K.lists, all); emit('lists:change'); },
        create: function (name) {
            var all = lists.all();
            var item = {
                id: 'list-' + Date.now(),
                name: name,
                glyph: 'notepad',
                note: 'Your collection',
                recipes: []
            };
            all.push(item);
            lists.save(all);
            return item;
        },
        remove: function (id) {
            lists.save(lists.all().filter(function (l) { return l.id !== id; }));
        },
        toggleRecipe: function (id, recipeId) {
            var all = lists.all();
            var list = all.filter(function (l) { return l.id === id; })[0];
            if (!list) return false;
            var i = list.recipes.indexOf(Number(recipeId));
            if (i > -1) list.recipes.splice(i, 1); else list.recipes.unshift(Number(recipeId));
            lists.save(all);
            return i === -1;
        },
        recipesIn: function (id) {
            var list = lists.byId(id);
            if (!list) return [];
            return list.recipes.map(function (rid) { return data.byId(rid); }).filter(Boolean);
        }
    };

    /* ---------------------------------------------------------------------
       Settings
       ------------------------------------------------------------------ */
    var settings = {
        get: function () {
            var saved = store.get(K.settings, {}) || {};
            var merged = {};
            Object.keys(DEFAULT_SETTINGS).forEach(function (key) {
                merged[key] = saved[key] === undefined ? DEFAULT_SETTINGS[key] : saved[key];
            });
            return merged;
        },
        set: function (patch) {
            var next = settings.get();
            Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
            store.set(K.settings, next);
            emit('settings:change', next);
            return next;
        },
        reset: function () { store.set(K.settings, DEFAULT_SETTINGS); emit('settings:change', DEFAULT_SETTINGS); }
    };

    /* ---------------------------------------------------------------------
       Checkout and orders
       ------------------------------------------------------------------ */
    var checkoutData = {
        get: function () { return store.get(K.checkout, DEFAULT_CHECKOUT); },
        set: function (patch) {
            var next = checkoutData.get();
            Object.keys(patch).forEach(function (k) { next[k] = patch[k]; });
            store.set(K.checkout, next);
            return next;
        }
    };

    var orders = {
        fee: DELIVERY_FEE,
        list: function () { return store.get(K.orders, DEMO_ORDERS); },
        place: function (order) {
            var all = orders.list();
            all.unshift(order);
            store.set(K.orders, all);
            emit('orders:change');
            return order;
        }
    };

    /* ---------------------------------------------------------------------
       Ratings
       ------------------------------------------------------------------ */
    var ratings = {
        reviewsFor: function (id) { return store.get('reviews_recipe_' + id, null); },
        saveReviews: function (id, list) { store.set('reviews_recipe_' + id, list); emit('reviews:change'); },
        /* Every recipe page starts with a few reviews rather than an empty shell */
        ensure: function (id) {
            var existing = ratings.reviewsFor(id);
            if (existing) return existing;
            var seeded = STOCK_REVIEWS.slice();
            ratings.saveReviews(id, seeded);
            return seeded;
        },
        /* Reviews written by whoever is signed in, newest first */
        mine: function () {
            var out = [];
            data.all().forEach(function (recipe) {
                (ratings.reviewsFor(recipe.id) || []).forEach(function (review, index) {
                    if (review.mine) out.push({ recipe: recipe, review: review, index: index });
                });
            });
            return out;
        },
        removeMine: function (recipeId, index) {
            var list = ratings.reviewsFor(recipeId) || [];
            list.splice(index, 1);
            ratings.saveReviews(recipeId, list);
        },
        summary: function (recipe) {
            var saved = ratings.reviewsFor(recipe.id);
            if (saved && saved.length) {
                var sum = saved.reduce(function (a, r) { return a + (Number(r.rating) || 0); }, 0);
                return { rating: sum / saved.length, count: saved.length };
            }
            var seedNum = Number(recipe.id) || 0;
            return { rating: Math.round((4.1 + (seedNum % 7) * 0.1) * 10) / 10, count: 0 };
        },
        stars: function (value, size) {
            var full = Math.round(Number(value) || 0);
            var out = '';
            for (var i = 1; i <= 5; i++) {
                out += icon('star', (size || '') + (i <= full ? ' text-honey-400' : ' text-cream-500'), i <= full ? 'fill' : null);
            }
            return out;
        }
    };

    /* ---------------------------------------------------------------------
       Toasts, replacing every alert() in the old build
       ------------------------------------------------------------------ */
    function toast(message, opts) {
        opts = opts || {};
        var stack = qs('#toast-stack');
        if (!stack) {
            stack = document.createElement('div');
            stack.id = 'toast-stack';
            stack.className = 'toast-stack';
            document.body.appendChild(stack);
        }
        var kind = opts.type || 'success';
        var glyph = kind === 'error' ? 'warning-circle' : (kind === 'info' ? 'info' : 'check-circle');
        var node = document.createElement('div');
        node.className = 'toast toast-' + kind;
        node.setAttribute('role', 'status');
        node.innerHTML = icon(glyph, '', 'fill') + '<span class="flex-1">' + esc(message) + '</span>';

        if (opts.action) {
            var btn = document.createElement('button');
            btn.className = 'font-semibold underline underline-offset-2 shrink-0';
            btn.textContent = opts.action.label;
            btn.addEventListener('click', function () { opts.action.fn(); dismiss(); });
            node.appendChild(btn);
        }

        stack.appendChild(node);
        var timer = setTimeout(dismiss, opts.duration || (opts.action ? 6000 : 3200));

        function dismiss() {
            clearTimeout(timer);
            if (!node.parentNode) return;
            node.classList.add('is-leaving');
            setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 250);
        }
        return dismiss;
    }

    function soon(feature) {
        toast(feature + ' is on the way. This build is a design demo.', { type: 'info' });
    }

    /* ---------------------------------------------------------------------
       Cart
       ------------------------------------------------------------------ */
    var cart = {
        items: function () { return store.get(K.cart, []); },
        count: function () { return cart.items().length; },
        total: function () { return cart.items().reduce(function (a, i) { return a + (Number(i.price) || 0); }, 0); },
        add: function (name, price, quiet) {
            var items = cart.items();
            items.push({ name: name, price: Number(price) || 0 });
            store.set(K.cart, items);
            cart.render();
            if (!quiet) toast(name + ' added to your basket');
            return items.length;
        },
        addMany: function (entries) {
            var items = cart.items();
            entries.forEach(function (e) { items.push({ name: e.name, price: Number(e.price) || 0 }); });
            store.set(K.cart, items);
            cart.render();
            toast(entries.length + ' ingredients added to your basket');
        },
        remove: function (index) {
            var items = cart.items();
            var removed = items.splice(index, 1)[0];
            store.set(K.cart, items);
            cart.render();
            if (removed) {
                toast(removed.name + ' removed', {
                    action: { label: 'Undo', fn: function () { cart.add(removed.name, removed.price, true); } }
                });
            }
        },
        clear: function () {
            var snapshot = cart.items();
            store.set(K.cart, []);
            cart.render();
            toast('Basket emptied', {
                action: { label: 'Undo', fn: function () { store.set(K.cart, snapshot); cart.render(); } }
            });
        },
        open: function () { setDrawer(true); },
        close: function () { setDrawer(false); },
        toggle: function () { var d = qs('#cart-drawer'); setDrawer(!(d && d.classList.contains('is-open'))); },
        render: function () {
            var list = qs('#cart-items');
            var badge = qs('#cart-badge');
            var totalEl = qs('#cart-total');
            var items = cart.items();

            if (badge) {
                badge.textContent = items.length;
                badge.style.display = items.length ? 'flex' : 'none';
            }
            if (totalEl) totalEl.textContent = money.format(cart.total());
            if (!list) return;

            if (!items.length) {
                list.innerHTML =
                    '<div class="flex flex-col items-center justify-center h-full text-center px-8 py-16 text-muted">' +
                    icon('basket', 'text-5xl text-sage-300 mb-3', 'duotone') +
                    '<p class="font-display text-xl text-ink mb-1">Your basket is empty</p>' +
                    '<p class="text-sm">Open any recipe and add its ingredients in one tap.</p>' +
                    '</div>';
                return;
            }

            list.innerHTML = items.map(function (item, i) {
                return '<div class="flex items-center gap-3 p-3 bg-white rounded-2xl border border-sage-100 animate-pop">' +
                    '<span class="w-9 h-9 rounded-xl bg-sage-50 text-sage-500 flex items-center justify-center shrink-0">' + icon('bowl-food', 'text-lg') + '</span>' +
                    '<div class="flex-1 min-w-0">' +
                    '<p class="text-sm font-medium truncate">' + esc(item.name) + '</p>' +
                    '<p class="text-xs text-muted">' + money.format(item.price) + '</p>' +
                    '</div>' +
                    '<button class="btn-icon !w-8 !h-8 !text-base !border-transparent hover:!bg-berry-500 hover:!text-white" data-cart-remove="' + i + '" aria-label="Remove ' + esc(item.name) + '">' + icon('x') + '</button>' +
                    '</div>';
            }).join('');

            qsa('[data-cart-remove]', list).forEach(function (btn) {
                btn.addEventListener('click', function () { cart.remove(Number(btn.dataset.cartRemove)); });
            });
        }
    };

    function setDrawer(open) {
        var drawer = qs('#cart-drawer');
        var scrim = qs('#app-scrim');
        if (!drawer) return;
        drawer.classList.toggle('is-open', open);
        drawer.setAttribute('aria-hidden', open ? 'false' : 'true');
        if (scrim) scrim.classList.toggle('is-open', open || isSidebarOpen());
    }

    function isSidebarOpen() {
        var s = qs('#app-sidebar');
        return !!(s && s.classList.contains('is-open'));
    }

    function setSidebar(open) {
        var sidebar = qs('#app-sidebar');
        var scrim = qs('#app-scrim');
        if (!sidebar) return;
        sidebar.classList.toggle('is-open', open);
        if (scrim) scrim.classList.toggle('is-open', open || !!qs('#cart-drawer.is-open'));
    }

    /* ---------------------------------------------------------------------
       Recipe cards, used by the feed and by profiles
       ------------------------------------------------------------------ */
    function recipeCard(recipe, opts) {
        opts = opts || {};
        var summary = ratings.summary(recipe);
        var firstTag = String(recipe.tags || '').split(',')[0].trim();
        var liked = likes.has(recipe.id);
        var deletable = typeof opts.deletable === 'function' ? opts.deletable(recipe) : !!opts.deletable;

        var card = document.createElement('article');
        card.className = 'recipe-card group';
        card.tabIndex = 0;
        card.setAttribute('role', 'link');
        card.setAttribute('aria-label', recipe.title);

        card.innerHTML =
            '<img src="' + esc(recipe.imgUrl || FALLBACK_IMG) + '" class="recipe-card-img" alt="' + esc(recipe.title) + '" loading="lazy" onerror="this.src=\'' + FALLBACK_IMG + '\'">' +
            '<div class="card-rating">' + icon('star', '', 'fill') + '<b>' + summary.rating.toFixed(1) + '</b>' +
            (summary.count ? '<span class="count">(' + summary.count + ')</span>' : '') + '</div>' +
            (deletable
                ? '<button class="card-action" data-action="delete" aria-label="Delete ' + esc(recipe.title) + '">' + icon('trash') + '</button>'
                : '<button class="card-action' + (liked ? ' is-on' : '') + '" data-action="like" aria-label="Like ' + esc(recipe.title) + '">' + icon('heart', '', liked ? 'fill' : null) + '</button>') +
            '<div class="recipe-card-overlay">' +
            '<h3 class="recipe-card-title">' + esc(recipe.title) + '</h3>' +
            '<div class="recipe-card-meta">' +
            '<span>' + icon('clock') + esc(recipe.prepTime || '15 mins') + '</span>' +
            '<span>' + icon('chart-bar') + esc(recipe.difficulty || 'Easy') + '</span>' +
            '</div>' +
            (firstTag ? '<span class="chip mt-2 !bg-cream-100/90 !text-sage-600">' + icon('tag', 'text-xs') + esc(firstTag) + '</span>' : '') +
            '</div>';

        function open() {
            sessionStorage.setItem('activeRecipeId', recipe.id);
            window.location.href = 'recipe.html';
        }

        card.addEventListener('click', function (e) {
            var action = e.target.closest('[data-action]');
            if (!action) return open();
            e.stopPropagation();
            if (action.dataset.action === 'delete' && opts.onDelete) opts.onDelete(recipe);
            if (action.dataset.action === 'like') {
                var nowLiked = likes.toggle(recipe.id);
                action.classList.toggle('is-on', nowLiked);
                action.innerHTML = icon('heart', '', nowLiked ? 'fill' : null);
                toast(nowLiked ? 'Saved to your liked recipes' : 'Removed from liked recipes');
                if (opts.onLike) opts.onLike(recipe, nowLiked);
            }
        });
        card.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });

        return card;
    }

    var FALLBACK_IMG = 'https://images.unsplash.com/photo-1498837167922-ddd27525d352?w=600&auto=format&fit=crop';

    function emptyState(container, glyph, title, body) {
        container.innerHTML =
            '<div class="col-span-full flex flex-col items-center text-center py-14 px-6 rounded-2xl border border-dashed border-sage-200 bg-white/60">' +
            icon(glyph, 'text-5xl text-sage-300 mb-3', 'duotone') +
            '<p class="font-display text-2xl text-ink mb-1">' + esc(title) + '</p>' +
            '<p class="text-sm text-muted max-w-sm">' + esc(body) + '</p>' +
            '</div>';
    }

    /* ---------------------------------------------------------------------
       Recipe composer (modal), replacing the cramped sidebar form
       ------------------------------------------------------------------ */
    var TAG_SUGGESTIONS = ['Gluten-Free', 'Dairy-Free', 'Nut-Free', 'Vegan', 'Vegetarian', 'Quick', 'Breakfast', 'Dinner', 'Dessert'];

    function composerMarkup() {
        return '' +
        '<div class="modal" id="recipe-modal" role="dialog" aria-modal="true" aria-labelledby="composer-title">' +
          '<div class="modal-panel scroll-slim">' +
            '<div class="sticky top-0 z-10 flex items-center justify-between gap-4 px-7 py-5 bg-cream-100/95 backdrop-blur border-b border-sage-100">' +
              '<div>' +
                '<h2 id="composer-title" class="font-display text-2xl text-ink flex items-center gap-2">' + icon('chef-hat', 'text-sage-500', 'duotone') + 'Share a recipe</h2>' +
                '<p class="text-sm text-muted mt-0.5">It lands in the community feed straight away.</p>' +
              '</div>' +
              '<button class="btn-icon" data-close-modal aria-label="Close">' + icon('x') + '</button>' +
            '</div>' +
            '<form id="composer-form" class="px-7 py-6" novalidate>' +
              '<div class="field">' +
                '<label class="field-label" for="c-title">Recipe name</label>' +
                '<div class="field-wrap">' + icon('bowl-food') + '<input id="c-title" class="input" placeholder="Grandma\'s lemon orzo" required></div>' +
                '<p class="field-error">' + icon('warning-circle') + 'Give your recipe a name.</p>' +
              '</div>' +
              '<div class="grid sm:grid-cols-2 gap-x-4">' +
                '<div class="field"><label class="field-label" for="c-prep">Prep time</label>' +
                  '<div class="field-wrap">' + icon('timer') + '<input id="c-prep" class="input" placeholder="15 mins"></div></div>' +
                '<div class="field"><label class="field-label" for="c-cook">Cook time</label>' +
                  '<div class="field-wrap">' + icon('cooking-pot') + '<input id="c-cook" class="input" placeholder="20 mins"></div></div>' +
                '<div class="field"><label class="field-label" for="c-servings">Servings</label>' +
                  '<div class="field-wrap">' + icon('users') + '<input id="c-servings" class="input" placeholder="4 servings"></div></div>' +
                '<div class="field"><label class="field-label" for="c-difficulty">Difficulty</label>' +
                  '<select id="c-difficulty" class="select"><option>Easy</option><option>Medium</option><option>Hard</option></select></div>' +
              '</div>' +
              '<div class="field">' +
                '<label class="field-label">Dietary tags</label>' +
                '<div class="flex flex-wrap gap-2 mb-2" id="c-tag-picker">' +
                  TAG_SUGGESTIONS.map(function (t) { return '<button type="button" class="pill btn-sm" data-tag="' + t + '">' + t + '</button>'; }).join('') +
                '</div>' +
                '<div class="field-wrap">' + icon('tag') + '<input id="c-tags" class="input" placeholder="Comma separated: Vegan, Quick, Dinner"></div>' +
              '</div>' +
              '<div class="field">' +
                '<label class="field-label" for="c-img">Photo URL <span class="text-muted font-normal">(optional)</span></label>' +
                '<div class="field-wrap">' + icon('image-square') + '<input id="c-img" class="input" placeholder="https://... or avacado.jfif"></div>' +
              '</div>' +
              '<div class="field">' +
                '<label class="field-label" for="c-description">Short description</label>' +
                '<textarea id="c-description" class="textarea !min-h-[70px]" rows="2" placeholder="One line that makes people hungry."></textarea>' +
              '</div>' +
              '<div class="field">' +
                '<label class="field-label" for="c-ingredients">Ingredients</label>' +
                '<textarea id="c-ingredients" class="textarea" rows="3" placeholder="1 lb Beef, 2 cups Flour, 1 tbsp Olive oil" required></textarea>' +
                '<p class="text-xs text-muted mt-1.5 flex items-center gap-1.5">' + icon('info') + 'Separate with commas. Each one becomes a basket item.</p>' +
                '<p class="field-error">' + icon('warning-circle') + 'List at least one ingredient.</p>' +
              '</div>' +
              '<div class="field">' +
                '<label class="field-label" for="c-instructions">Instructions</label>' +
                '<textarea id="c-instructions" class="textarea" rows="4" placeholder="Preheat the oven. Mix the dry ingredients. Bake for 20 minutes." required></textarea>' +
                '<p class="text-xs text-muted mt-1.5 flex items-center gap-1.5">' + icon('info') + 'One sentence per step. They get numbered automatically.</p>' +
                '<p class="field-error">' + icon('warning-circle') + 'Tell people how to cook it.</p>' +
              '</div>' +
              '<div class="flex items-center justify-end gap-3 pt-2">' +
                '<button type="button" class="btn btn-ghost" data-close-modal>Cancel</button>' +
                '<button type="submit" class="btn btn-primary">' + icon('paper-plane-tilt') + 'Publish recipe</button>' +
              '</div>' +
            '</form>' +
          '</div>' +
        '</div>';
    }

    /* ---------------------------------------------------------------------
       Checkout (demo). No real payment details are collected anywhere: the
       cards are pre-saved placeholders and there is no field to type one in.
       ------------------------------------------------------------------ */
    function checkoutMarkup() {
        return '' +
        '<div class="modal" id="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkout-title">' +
          '<div class="modal-panel scroll-slim">' +
            '<div class="sticky top-0 z-10 flex items-center justify-between gap-4 px-7 py-5 bg-cream-100/95 backdrop-blur border-b border-sage-100">' +
              '<div>' +
                '<h2 id="checkout-title" class="font-display text-2xl text-ink flex items-center gap-2">' +
                  icon('receipt', 'text-sage-500', 'duotone') + 'Checkout</h2>' +
                '<p class="text-sm text-muted mt-0.5 flex items-center gap-1.5">' + icon('flask') +
                  'Demo order. No money moves and nothing ships.</p>' +
              '</div>' +
              '<button class="btn-icon" data-close-checkout aria-label="Close">' + icon('x') + '</button>' +
            '</div>' +
            '<div id="checkout-body" class="px-7 py-6"></div>' +
          '</div>' +
        '</div>';
    }

    function orderSummaryRows(items) {
        var subtotal = items.reduce(function (a, i) { return a + (Number(i.price) || 0); }, 0);
        return {
            subtotal: subtotal,
            fee: items.length ? DELIVERY_FEE : 0,
            total: subtotal + (items.length ? DELIVERY_FEE : 0)
        };
    }

    var checkout = {
        open: function () {
            var modal = qs('#checkout-modal');
            if (!modal) return;
            checkout.render();
            modal.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        },
        close: function () {
            var modal = qs('#checkout-modal');
            if (!modal) return;
            modal.classList.remove('is-open');
            document.body.style.overflow = '';
        },

        render: function () {
            var body = qs('#checkout-body');
            var conf = checkoutData.get();
            var items = cart.items();
            var totals = orderSummaryRows(items);

            body.innerHTML = '' +
            '<section class="mb-7">' +
              '<h3 class="font-display text-xl text-ink mb-3 flex items-center gap-2">' + icon('map-pin', 'text-sage-500') + 'Deliver to</h3>' +
              '<div class="grid sm:grid-cols-2 gap-3">' +
                conf.addresses.map(function (a) {
                    var on = a.id === conf.addressId;
                    return '<button type="button" data-address="' + a.id + '" class="text-left p-4 rounded-2xl border-[1.5px] transition ' +
                        (on ? 'border-sage-500 bg-sage-50' : 'border-sage-100 bg-white hover:border-sage-300') + '">' +
                        '<div class="flex items-center justify-between mb-1">' +
                          '<span class="font-medium flex items-center gap-2">' + icon(a.id === 'work' ? 'storefront' : 'house', 'text-sage-500') + esc(a.label) + '</span>' +
                          (on ? icon('check-circle', 'text-sage-500', 'fill') : '') +
                        '</div>' +
                        '<p class="text-[13.5px] text-muted leading-relaxed">' + esc(a.line) + '<br>' + esc(a.city) + ' &middot; ' + esc(a.phone) + '</p>' +
                        '</button>';
                }).join('') +
              '</div>' +
            '</section>' +

            '<section class="mb-7">' +
              '<h3 class="font-display text-xl text-ink mb-3 flex items-center gap-2">' + icon('truck', 'text-sage-500') + 'Delivery slot</h3>' +
              '<div class="flex flex-wrap gap-2">' +
                conf.slots.map(function (slot, i) {
                    return '<button type="button" data-slot="' + i + '" class="pill btn-sm' + (i === conf.slot ? ' is-active' : '') + '">' +
                        icon('clock') + esc(slot) + '</button>';
                }).join('') +
              '</div>' +
            '</section>' +

            '<section class="mb-7">' +
              '<h3 class="font-display text-xl text-ink mb-1 flex items-center gap-2">' + icon('credit-card', 'text-sage-500') + 'Payment</h3>' +
              '<p class="text-[13px] text-muted mb-3">Saved demo methods. There is nowhere to enter a real card, on purpose.</p>' +
              '<div class="grid sm:grid-cols-2 gap-3">' +
                conf.methods.map(function (m) {
                    var on = m.id === conf.methodId;
                    return '<button type="button" data-method="' + m.id + '" class="flex items-center gap-3 text-left p-4 rounded-2xl border-[1.5px] transition ' +
                        (on ? 'border-sage-500 bg-sage-50' : 'border-sage-100 bg-white hover:border-sage-300') + '">' +
                        '<span class="w-10 h-10 rounded-xl bg-sage-50 text-sage-500 flex items-center justify-center shrink-0">' + icon(m.glyph, 'text-xl', 'duotone') + '</span>' +
                        '<span class="flex-1 min-w-0"><span class="block font-medium">' + esc(m.label) + '</span>' +
                        '<span class="block text-[12.5px] text-muted">' + esc(m.hint) + '</span></span>' +
                        (on ? icon('check-circle', 'text-sage-500 shrink-0', 'fill') : '') +
                        '</button>';
                }).join('') +
              '</div>' +
            '</section>' +

            '<section class="mb-6">' +
              '<h3 class="font-display text-xl text-ink mb-3 flex items-center gap-2">' + icon('basket', 'text-sage-500') + 'Your basket (' + items.length + ')</h3>' +
              (items.length
                ? '<div class="rounded-2xl border border-sage-100 bg-white divide-y divide-sage-100 max-h-52 overflow-y-auto scroll-slim">' +
                    items.map(function (i) {
                        return '<div class="flex items-center justify-between gap-3 px-4 py-2.5 text-[14.5px]">' +
                            '<span class="truncate">' + esc(i.name) + '</span>' +
                            '<span class="text-muted shrink-0">' + money.format(i.price) + '</span></div>';
                    }).join('') +
                  '</div>'
                : '<p class="text-muted text-sm">Your basket is empty, so there is nothing to order yet.</p>') +
            '</section>' +

            '<dl class="rounded-2xl bg-sage-50 border border-sage-100 p-4 mb-6 text-[15px]">' +
              '<div class="flex justify-between py-1"><dt class="text-muted">Subtotal</dt><dd>' + money.format(totals.subtotal) + '</dd></div>' +
              '<div class="flex justify-between py-1"><dt class="text-muted">Delivery</dt><dd>' + money.format(totals.fee) + '</dd></div>' +
              '<div class="flex justify-between pt-2 mt-2 border-t border-sage-200 font-display text-xl">' +
                '<dt>Total</dt><dd class="text-sage-600">' + money.format(totals.total) + '</dd></div>' +
            '</dl>' +

            '<div class="flex items-center justify-end gap-3">' +
              '<button type="button" class="btn btn-ghost" data-close-checkout>Keep shopping</button>' +
              '<button type="button" class="btn btn-primary btn-lg" id="place-order"' + (items.length ? '' : ' disabled') + '>' +
                icon('check-circle') + 'Place demo order</button>' +
            '</div>';

            /* Wiring */
            qsa('[data-address]', body).forEach(function (b) {
                b.addEventListener('click', function () { checkoutData.set({ addressId: b.dataset.address }); checkout.render(); });
            });
            qsa('[data-slot]', body).forEach(function (b) {
                b.addEventListener('click', function () { checkoutData.set({ slot: Number(b.dataset.slot) }); checkout.render(); });
            });
            qsa('[data-method]', body).forEach(function (b) {
                b.addEventListener('click', function () { checkoutData.set({ methodId: b.dataset.method }); checkout.render(); });
            });
            var place = qs('#place-order', body);
            if (place) place.addEventListener('click', checkout.place);
        },

        place: function () {
            var btn = qs('#place-order');
            var items = cart.items();
            if (!items.length) return;

            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.innerHTML = '<span class="flex items-center gap-2">' + icon('spinner-gap', 'animate-spin') + 'Placing your order…</span>';

            setTimeout(function () {
                var conf = checkoutData.get();
                var totals = orderSummaryRows(items);
                var method = conf.methods.filter(function (m) { return m.id === conf.methodId; })[0];
                var address = conf.addresses.filter(function (a) { return a.id === conf.addressId; })[0];

                var order = {
                    id: 'DSH-' + Math.floor(10250 + Math.random() * 700),
                    date: 'Just now',
                    status: 'On the way',
                    method: method ? method.label : 'Cash on delivery',
                    address: address ? address.label : 'Home',
                    slot: conf.slots[conf.slot],
                    items: items,
                    total: totals.total
                };
                orders.place(order);
                store.set(K.cart, []);
                cart.render();
                checkout.success(order);
            }, 900);
        },

        success: function (order) {
            qs('#checkout-body').innerHTML = '' +
            '<div class="text-center py-6 animate-pop">' +
              '<span class="inline-flex w-20 h-20 rounded-full bg-sage-50 text-sage-500 items-center justify-center mb-5">' +
                icon('check-circle', 'text-5xl', 'duotone') + '</span>' +
              '<h3 class="font-display text-3xl text-ink mb-2">Order placed</h3>' +
              '<p class="text-muted mb-6">Order <b class="text-ink">' + esc(order.id) + '</b> is on its way to ' + esc(order.address) + '.</p>' +

              '<div class="text-left rounded-2xl border border-sage-100 bg-white p-5 mb-6">' +
                '<div class="flex items-center gap-3 mb-4">' +
                  '<span class="w-10 h-10 rounded-xl bg-sage-50 text-sage-500 flex items-center justify-center">' + icon('motorcycle', 'text-xl', 'duotone') + '</span>' +
                  '<div><div class="font-medium">' + esc(order.slot) + '</div>' +
                  '<div class="text-[13px] text-muted">Paid with ' + esc(order.method) + '</div></div>' +
                '</div>' +
                '<ol class="flex items-center text-[12.5px] text-muted">' +
                  ['Confirmed', 'Packing', 'On the way', 'Delivered'].map(function (step, i) {
                      var done = i < 3;
                      return '<li class="flex-1 flex items-center gap-2">' +
                          '<span class="w-6 h-6 rounded-full flex items-center justify-center shrink-0 ' +
                          (done ? 'bg-sage-500 text-cream-100' : 'bg-sage-100 text-sage-400') + '">' +
                          (done ? icon('check', 'text-xs', 'bold') : '<span class="w-1.5 h-1.5 rounded-full bg-current"></span>') + '</span>' +
                          '<span class="' + (done ? 'text-ink' : '') + '">' + step + '</span>' +
                          (i < 3 ? '<span class="flex-1 h-px bg-sage-100 mx-1"></span>' : '') +
                          '</li>';
                  }).join('') +
                '</ol>' +
              '</div>' +

              '<div class="flex flex-wrap justify-center gap-3">' +
                '<a href="settings.html#orders" class="btn btn-outline">' + icon('clock-counter-clockwise') + 'Order history</a>' +
                '<button type="button" class="btn btn-primary" data-close-checkout>' + icon('fork-knife') + 'Back to cooking</button>' +
              '</div>' +
            '</div>';
            toast('Demo order ' + order.id + ' placed. Nothing was charged.');
        }
    };

    var composer = {
        open: function () {
            var modal = qs('#recipe-modal');
            if (!modal) return;
            modal.classList.add('is-open');
            document.body.style.overflow = 'hidden';
            setTimeout(function () { var t = qs('#c-title'); if (t) t.focus(); }, 60);
        },
        close: function () {
            var modal = qs('#recipe-modal');
            if (!modal) return;
            modal.classList.remove('is-open');
            document.body.style.overflow = '';
        }
    };

    function wireComposer() {
        var modal = qs('#recipe-modal');
        if (!modal) return;
        var form = qs('#composer-form', modal);

        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.closest('[data-close-modal]')) composer.close();
        });

        qsa('#c-tag-picker [data-tag]', modal).forEach(function (btn) {
            btn.addEventListener('click', function () {
                var input = qs('#c-tags');
                var current = input.value.split(',').map(function (s) { return s.trim(); }).filter(Boolean);
                var tag = btn.dataset.tag;
                var i = current.indexOf(tag);
                if (i > -1) current.splice(i, 1); else current.push(tag);
                input.value = current.join(', ');
                btn.classList.toggle('is-active', i === -1);
            });
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var required = [['c-title', 'title'], ['c-ingredients', 'ingredients'], ['c-instructions', 'instructions']];
            var ok = true;
            required.forEach(function (pair) {
                var input = qs('#' + pair[0]);
                var field = input.closest('.field');
                var valid = input.value.trim().length > 0;
                field.classList.toggle('is-invalid', !valid);
                if (!valid && ok) { input.focus(); ok = false; }
            });
            if (!ok) return;

            var me = auth.current();
            var recipe = {
                id: Date.now(),
                title: qs('#c-title').value.trim(),
                prepTime: qs('#c-prep').value.trim() || '15 mins',
                cookTime: qs('#c-cook').value.trim() || '20 mins',
                servings: qs('#c-servings').value.trim() || '4 servings',
                difficulty: qs('#c-difficulty').value,
                tags: qs('#c-tags').value.trim() || 'Home Cooked',
                imgUrl: qs('#c-img').value.trim(),
                description: qs('#c-description').value.trim() || 'A delicious, freshly shared home-cooked recipe.',
                ingredients: qs('#c-ingredients').value.trim(),
                instructions: qs('#c-instructions').value.trim(),
                creator: me.isGuest ? 'Guest Cook' : me.name,
                category: 'Main Dish'
            };
            data.add(recipe);
            form.reset();
            qsa('#c-tag-picker .is-active', modal).forEach(function (b) { b.classList.remove('is-active'); });
            qsa('.field.is-invalid', modal).forEach(function (f) { f.classList.remove('is-invalid'); });
            composer.close();
            toast('"' + recipe.title + '" is live in the feed');
        });

        /* Clear the error state as soon as the cook starts typing */
        qsa('.input, .textarea', modal).forEach(function (input) {
            input.addEventListener('input', function () {
                var field = input.closest('.field');
                if (field) field.classList.remove('is-invalid');
            });
        });
    }

    /* ---------------------------------------------------------------------
       Notifications
       ------------------------------------------------------------------ */
    var alerts = {
        all: function () { return store.get(K.alerts, DEMO_ALERTS); },
        unread: function () { return alerts.all().filter(function (a) { return a.unread; }).length; },
        markAllRead: function () {
            store.set(K.alerts, alerts.all().map(function (a) { a.unread = false; return a; }));
            emit('alerts:change');
        },
        toggleRead: function (id) {
            store.set(K.alerts, alerts.all().map(function (a) {
                if (a.id === id) a.unread = !a.unread;
                return a;
            }));
            emit('alerts:change');
        }
    };

    function alertsMarkup() {
        return '<div id="alerts-panel" class="fixed z-[90] hidden w-[min(360px,calc(100vw-24px))] rounded-2xl border border-sage-100 bg-cream-50 shadow-lift overflow-hidden animate-pop">' +
            '<div class="flex items-center justify-between gap-3 px-4 py-3 border-b border-sage-100">' +
              '<h3 class="font-display text-lg text-ink flex items-center gap-2">' + icon('bell', 'text-sage-500', 'duotone') + 'Notifications</h3>' +
              '<button class="text-[12.5px] text-sage-600 hover:underline" id="alerts-read-all">Mark all read</button>' +
            '</div>' +
            '<div id="alerts-rows" class="max-h-[min(420px,60vh)] overflow-y-auto scroll-slim divide-y divide-sage-100"></div>' +
          '</div>';
    }

    function renderAlerts() {
        var rows = qs('#alerts-rows');
        if (!rows) return;
        var list = alerts.all();
        var badge = qs('#alerts-badge');
        var count = alerts.unread();
        if (badge) {
            badge.textContent = count;
            badge.style.display = count ? 'flex' : 'none';
        }
        if (!list.length) {
            rows.innerHTML = '<p class="p-6 text-center text-sm text-muted">Nothing new right now.</p>';
            return;
        }
        rows.innerHTML = list.map(function (a) {
            return '<button class="w-full flex gap-3 p-3.5 text-left transition hover:bg-sage-50 ' +
                (a.unread ? 'bg-sage-50/60' : '') + '" data-alert="' + a.id + '">' +
                '<span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ' +
                  (a.tone === 'honey' ? 'bg-honey-400/20 text-honey-500' : 'bg-sage-100 text-sage-600') + '">' +
                  icon(a.glyph, 'text-lg', 'duotone') + '</span>' +
                '<span class="flex-1 min-w-0">' +
                  '<span class="block text-[14px] font-medium leading-snug">' + esc(a.title) + '</span>' +
                  '<span class="block text-[13px] text-muted leading-snug mt-0.5">' + esc(a.body) + '</span>' +
                  '<span class="block text-[11.5px] text-muted mt-1">' + esc(a.time) + '</span>' +
                '</span>' +
                (a.unread ? '<span class="w-2 h-2 rounded-full bg-sage-500 shrink-0 mt-2"></span>' : '') +
                '</button>';
        }).join('');

        qsa('[data-alert]', rows).forEach(function (btn) {
            btn.addEventListener('click', function () { alerts.toggleRead(Number(btn.dataset.alert)); });
        });
    }

    function toggleAlerts(anchor) {
        var panel = qs('#alerts-panel');
        if (!panel) return;
        var open = panel.classList.contains('hidden');
        panel.classList.toggle('hidden', !open);
        if (!open) return;
        var box = anchor.getBoundingClientRect();
        panel.style.top = (box.bottom + 10) + 'px';
        panel.style.right = Math.max(12, window.innerWidth - box.right) + 'px';
        renderAlerts();
    }

    /* ---------------------------------------------------------------------
       Save to list picker, shared by the recipe page and the cards
       ------------------------------------------------------------------ */
    function pickerMarkup() {
        return '' +
        '<div class="modal" id="list-modal" role="dialog" aria-modal="true" aria-labelledby="picker-title">' +
          '<div class="modal-panel !max-w-md scroll-slim" style="width:min(440px,100%)">' +
            '<div class="flex items-center justify-between gap-4 px-6 py-5 border-b border-sage-100">' +
              '<h2 id="picker-title" class="font-display text-xl text-ink flex items-center gap-2">' +
                icon('bookmarks-simple', 'text-sage-500', 'duotone') + 'Save to a list</h2>' +
              '<button class="btn-icon" data-close-picker aria-label="Close">' + icon('x') + '</button>' +
            '</div>' +
            '<div class="p-4 flex flex-col gap-2" id="picker-rows"></div>' +
            '<form class="flex gap-2 p-4 pt-0" id="picker-new">' +
              '<div class="field-wrap flex-1">' + icon('plus') +
                '<input class="input !py-2.5" id="picker-name" placeholder="New list name"></div>' +
              '<button class="btn btn-primary btn-sm" type="submit">Create</button>' +
            '</form>' +
          '</div>' +
        '</div>';
    }

    var picker = {
        recipeId: null,
        open: function (recipeId) {
            picker.recipeId = Number(recipeId);
            picker.render();
            var modal = qs('#list-modal');
            modal.classList.add('is-open');
            document.body.style.overflow = 'hidden';
        },
        close: function () {
            var modal = qs('#list-modal');
            if (!modal) return;
            modal.classList.remove('is-open');
            document.body.style.overflow = '';
        },
        render: function () {
            var rows = qs('#picker-rows');
            rows.innerHTML = lists.all().map(function (l) {
                var on = l.recipes.indexOf(picker.recipeId) > -1;
                return '<button type="button" data-list="' + esc(l.id) + '" class="flex items-center gap-3 p-3 rounded-2xl border-[1.5px] text-left transition ' +
                    (on ? 'border-sage-500 bg-sage-50' : 'border-sage-100 bg-white hover:border-sage-300') + '">' +
                    '<span class="w-9 h-9 rounded-xl bg-sage-50 text-sage-500 flex items-center justify-center shrink-0">' + icon(l.glyph) + '</span>' +
                    '<span class="flex-1 min-w-0"><span class="block font-medium truncate">' + esc(l.name) + '</span>' +
                    '<span class="block text-[12.5px] text-muted">' + l.recipes.length + (l.recipes.length === 1 ? ' recipe' : ' recipes') + '</span></span>' +
                    icon(on ? 'check-circle' : 'circle', 'text-xl ' + (on ? 'text-sage-500' : 'text-sage-200'), on ? 'fill' : null) +
                    '</button>';
            }).join('');

            qsa('[data-list]', rows).forEach(function (btn) {
                btn.addEventListener('click', function () {
                    var added = lists.toggleRecipe(btn.dataset.list, picker.recipeId);
                    var list = lists.byId(btn.dataset.list);
                    picker.render();
                    toast(added ? 'Saved to ' + list.name : 'Removed from ' + list.name);
                });
            });
        }
    };

    function wirePicker() {
        var modal = qs('#list-modal');
        if (!modal) return;
        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.closest('[data-close-picker]')) picker.close();
        });
        qs('#picker-new').addEventListener('submit', function (e) {
            e.preventDefault();
            var input = qs('#picker-name');
            var name = input.value.trim();
            if (!name) return toast('Give the list a name first.', { type: 'error' });
            var list = lists.create(name);
            lists.toggleRecipe(list.id, picker.recipeId);
            input.value = '';
            picker.render();
            toast('Saved to ' + name);
        });
    }

    function wireCheckout() {
        var modal = qs('#checkout-modal');
        if (!modal) return;
        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.closest('[data-close-checkout]')) checkout.close();
        });
    }

    /* ---------------------------------------------------------------------
       App shell: sidebar, scrim, cart drawer, composer, toast stack
       ------------------------------------------------------------------ */
    var NAV = [
        { key: 'home', label: 'Home', glyph: 'house', href: 'home.html' },
        { key: 'explore', label: 'Explore', glyph: 'compass', href: 'home.html#feed' },
        { key: 'add', label: 'Add recipe', glyph: 'plus-circle', action: 'compose' },
        { key: 'liked', label: 'Liked recipes', glyph: 'heart', href: 'home.html?filter=liked' },
        { key: 'lists', label: 'My lists', glyph: 'bookmarks-simple', href: 'lists.html' },
        { key: 'reviews', label: 'My reviews', glyph: 'chat-circle-text', href: 'reviews.html' },
        { key: 'settings', label: 'Settings', glyph: 'gear', href: 'settings.html' }
    ];

    function sidebarMarkup(active) {
        var me = auth.current();
        var picture = store.get(K.avatar, null) || avatar(me.name);
        var mine = data.community().filter(function (r) { return r.creator === me.name; }).length;
        var myLists = lists.all();

        return '' +
        '<aside class="app-sidebar scroll-slim-light" id="app-sidebar">' +
          '<a href="index.html" class="brand justify-center py-1" aria-label="dished home">' +
            '<img src="logo-cream.png" alt="dished" class="h-16"></a>' +

          '<div class="flex flex-col items-center">' +
            '<div class="relative group">' +
              '<img id="sidebar-avatar" src="' + esc(picture) + '" alt="Your profile picture" class="w-24 h-24 rounded-full object-cover border-4 border-cream-100/80 shadow-lg bg-cream-100">' +
              '<button id="avatar-trigger" class="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-cream-100 text-sage-600 flex items-center justify-center shadow-md hover:scale-110 transition" aria-label="Change profile picture" title="Change profile picture">' + icon('camera', 'text-lg') + '</button>' +
              '<input type="file" id="avatar-input" accept="image/*" class="hidden">' +
            '</div>' +
            '<h2 class="font-display text-2xl mt-3 leading-tight text-center">' + esc(me.name) + '</h2>' +
            '<p class="text-sm text-cream-100/75 flex items-center gap-1">' + icon('at', 'text-xs') + esc(me.username) + '</p>' +
            (me.isGuest
              ? '<a href="sign.html" class="chip mt-2 !bg-cream-100/15 !text-cream-100">' + icon('user-circle', 'text-sm') + 'Browsing as guest</a>'
              : '<span class="chip mt-2 !bg-cream-100/15 !text-cream-100">' + icon('seal-check', 'text-sm', 'fill') + 'Recipe creator</span>') +
          '</div>' +

          '<div class="grid grid-cols-3 text-center sidebar-panel !py-3">' +
            '<div><div class="font-display text-xl" id="stat-recipes">' + mine + '</div><div class="text-[11px] uppercase tracking-wide text-cream-100/70">Recipes</div></div>' +
            '<div class="border-x border-cream-100/15"><div class="font-display text-xl" id="stat-liked">' + likes.list().length + '</div><div class="text-[11px] uppercase tracking-wide text-cream-100/70">Liked</div></div>' +
            '<div><div class="font-display text-xl">18</div><div class="text-[11px] uppercase tracking-wide text-cream-100/70">Reviews</div></div>' +
          '</div>' +

          '<nav class="flex flex-col gap-1" aria-label="Main">' +
            NAV.map(function (item) {
                var cls = 'sidebar-link' + (item.key === active ? ' is-active' : '');
                var inner = icon(item.glyph, '', item.key === active ? 'fill' : null) + '<span>' + item.label + '</span>';
                return item.href
                    ? '<a class="' + cls + '" href="' + item.href + '">' + inner + '</a>'
                    : '<button class="' + cls + '" data-nav="' + item.action + '" data-label="' + item.label + '">' + inner + '</button>';
            }).join('') +
          '</nav>' +

          '<div class="sidebar-panel">' +
            '<h4 class="font-display text-lg mb-2 flex items-center gap-2">' + icon('stack', 'text-base') + 'My lists</h4>' +
            myLists.map(function (l) {
                return '<a class="w-full flex items-center gap-2 py-1.5 text-sm text-cream-100/85 hover:text-cream-100 transition" href="lists.html?list=' + encodeURIComponent(l.id) + '">' +
                    icon(l.glyph, 'text-base opacity-80') + '<span class="flex-1 text-left">' + esc(l.name) + '</span>' +
                    '<span class="text-[11px] px-2 py-0.5 rounded-full bg-cream-100/20">' + l.recipes.length + '</span></a>';
            }).join('') +
          '</div>' +

          (me.isGuest ? '' :
            '<div class="sidebar-panel text-sm">' +
              '<div class="flex items-center justify-between mb-2"><span class="text-cream-100/70">Status</span>' +
                '<span class="flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-emerald-300"></span>Online</span></div>' +
              '<div class="flex items-center justify-between"><span class="text-cream-100/70">Password</span>' +
                '<span class="flex items-center gap-2"><span id="pass-mask" class="tracking-[0.2em]">••••••••</span>' +
                '<button id="pass-toggle" class="opacity-80 hover:opacity-100" aria-label="Show password">' + icon('eye') + '</button></span></div>' +
            '</div>') +

          '<button class="btn ' + (me.isGuest ? 'btn-cream' : 'btn-outline !border-cream-100/50 !text-cream-100 hover:!bg-cream-100 hover:!text-sage-600') + ' btn-block mt-auto" id="session-btn">' +
            icon(me.isGuest ? 'sign-in' : 'sign-out') + (me.isGuest ? 'Sign in' : 'Log out') +
          '</button>' +
        '</aside>' +
        '<div class="app-scrim" id="app-scrim"></div>';
    }

    function cartMarkup() {
        return '' +
        '<aside class="drawer" id="cart-drawer" aria-hidden="true" aria-label="Shopping basket">' +
          '<header class="flex items-center justify-between gap-3 px-5 py-4 bg-sage-500 text-cream-100">' +
            '<h3 class="font-display text-2xl flex items-center gap-2">' + icon('basket', '', 'duotone') + 'Your basket</h3>' +
            '<button class="btn-icon !bg-transparent !border-cream-100/40 !text-cream-100 hover:!bg-cream-100 hover:!text-sage-600" data-close-cart aria-label="Close basket">' + icon('x') + '</button>' +
          '</header>' +
          '<div class="flex-1 overflow-y-auto scroll-slim p-4 flex flex-col gap-2.5" id="cart-items"></div>' +
          '<footer class="p-5 border-t border-sage-100 bg-cream-50">' +
            '<div class="flex items-center justify-between mb-3">' +
              '<span class="text-sm text-muted">Estimated total</span>' +
              '<span class="font-display text-2xl text-sage-600" id="cart-total">0 IQD</span>' +
            '</div>' +
            '<div class="flex gap-2">' +
              '<button class="btn btn-ghost btn-sm" id="cart-clear">' + icon('trash') + 'Empty</button>' +
              '<button class="btn btn-primary flex-1" id="cart-checkout">' + icon('shopping-cart-simple') + 'Checkout</button>' +
            '</div>' +
          '</footer>' +
        '</aside>';
    }

    function mountShell(options) {
        options = options || {};
        data.seed();

        var host = document.createElement('div');
        host.id = 'dished-shell';
        host.innerHTML = sidebarMarkup(options.active) + cartMarkup() + composerMarkup() +
            checkoutMarkup() + pickerMarkup() + alertsMarkup() +
            '<div class="toast-stack" id="toast-stack"></div>';
        document.body.insertBefore(host, document.body.firstChild);

        /* Sidebar behaviour ------------------------------------------------ */
        qs('#app-scrim').addEventListener('click', function () { setSidebar(false); setDrawer(false); });

        qsa('[data-nav]', host).forEach(function (btn) {
            btn.addEventListener('click', function () {
                if (btn.dataset.nav === 'compose') composer.open();
                else soon(btn.dataset.label);
                setSidebar(false);
            });
        });

        var sessionBtn = qs('#session-btn');
        sessionBtn.addEventListener('click', function () {
            if (auth.current().isGuest) window.location.href = 'sign.html';
            else auth.signOut();
        });

        /* Profile picture --------------------------------------------------- */
        var avatarInput = qs('#avatar-input');
        qs('#avatar-trigger').addEventListener('click', function () { avatarInput.click(); });
        avatarInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                store.set(K.avatar, ev.target.result);
                qsa('[data-avatar], #sidebar-avatar').forEach(function (img) { img.src = ev.target.result; });
                toast('Profile picture updated');
            };
            reader.readAsDataURL(file);
        });

        /* Password reveal ---------------------------------------------------- */
        var passToggle = qs('#pass-toggle');
        if (passToggle) {
            var shown = false;
            passToggle.addEventListener('click', function () {
                shown = !shown;
                qs('#pass-mask').textContent = shown ? (auth.current().password || 'not set') : '••••••••';
                passToggle.innerHTML = icon(shown ? 'eye-slash' : 'eye');
                passToggle.setAttribute('aria-label', shown ? 'Hide password' : 'Show password');
            });
        }

        /* Cart --------------------------------------------------------------- */
        qs('[data-close-cart]').addEventListener('click', function () { setDrawer(false); });
        qs('#cart-clear').addEventListener('click', function () { cart.clear(); });
        qs('#cart-checkout').addEventListener('click', function () {
            if (!cart.count()) return toast('Add some ingredients first', { type: 'info' });
            setDrawer(false);
            checkout.open();
        });
        cart.render();

        wireComposer();
        wireCheckout();
        wirePicker();

        qs('#alerts-read-all').addEventListener('click', function () {
            alerts.markAllRead();
            toast('All caught up');
        });
        on('alerts:change', renderAlerts);
        document.addEventListener('click', function (e) {
            var panel = qs('#alerts-panel');
            if (!panel || panel.classList.contains('hidden')) return;
            if (e.target.closest('#alerts-panel') || e.target.closest('#topbar-alerts')) return;
            panel.classList.add('hidden');
        });

        /* Global keys -------------------------------------------------------- */
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') {
                composer.close(); checkout.close(); picker.close();
                var panel = qs('#alerts-panel');
                if (panel) panel.classList.add('hidden');
                setDrawer(false); setSidebar(false);
            }
        });

        on('recipes:change', function () {
            var el = qs('#stat-recipes');
            if (el) {
                var me = auth.current();
                el.textContent = data.community().filter(function (r) { return r.creator === me.name; }).length;
            }
        });
        on('likes:change', function () {
            var el = qs('#stat-liked');
            if (el) el.textContent = likes.list().length;
        });

        return host;
    }

    /* ---------------------------------------------------------------------
       Top bar, shared by home, recipe and profile
       ------------------------------------------------------------------ */
    function mountTopbar(selector, options) {
        options = options || {};
        var host = typeof selector === 'string' ? qs(selector) : selector;
        if (!host) return;
        var me = auth.current();
        var picture = store.get(K.avatar, null) || avatar(me.name);

        host.className = 'sticky top-0 z-40 -mx-5 md:-mx-8 px-5 md:px-8 py-3 mb-6 bg-cream-100/85 backdrop-blur-md border-b border-sage-100 flex items-center gap-3';
        host.innerHTML =
            '<button class="btn-icon sidebar-toggle" id="sidebar-open" aria-label="Open menu">' + icon('list') + '</button>' +
            '<a href="home.html" class="brand lg:hidden" aria-label="dished home">' +
                '<img src="logo-sage.png" alt="dished" class="h-9"></a>' +
            (options.search === false ? '<div class="flex-1"></div>' :
                '<div class="field-wrap flex-1 max-w-xl">' + icon('magnifying-glass') +
                '<input id="topbar-search" class="input !rounded-full" type="search" placeholder="' + esc(options.placeholder || 'Search recipes, ingredients, cooks…') + '" aria-label="Search recipes">' +
                '</div>') +
            '<button class="btn-icon relative" id="topbar-alerts" aria-label="Notifications">' + icon('bell') +
                '<span class="badge-count !bg-sage-500" id="alerts-badge" style="display:none">0</span></button>' +
            '<button class="btn-icon relative" id="topbar-cart" aria-label="Open basket">' + icon('basket') +
                '<span class="badge-count" id="cart-badge" style="display:none">0</span></button>' +
            '<button class="shrink-0" id="topbar-profile" aria-label="Your profile">' +
                '<img data-avatar src="' + esc(picture) + '" alt="" class="w-10 h-10 rounded-full object-cover border-2 border-sage-200 hover:border-sage-500 transition">' +
            '</button>';

        qs('#sidebar-open', host).addEventListener('click', function () { setSidebar(true); });
        qs('#topbar-cart', host).addEventListener('click', function () { cart.toggle(); });
        qs('#topbar-alerts', host).addEventListener('click', function (e) {
            e.stopPropagation();
            toggleAlerts(qs('#topbar-alerts', host));
        });
        renderAlerts();
        qs('#topbar-profile', host).addEventListener('click', function () {
            sessionStorage.setItem('viewingProfileName', me.isGuest ? 'Guest' : me.name);
            window.location.href = 'profile.html';
        });

        var search = qs('#topbar-search', host);
        if (search) {
            if (options.onSearch) {
                var params = new URLSearchParams(window.location.search);
                if (params.get('q')) search.value = params.get('q');
                search.addEventListener('input', function () { options.onSearch(search.value.trim()); });
            } else {
                search.addEventListener('keydown', function (e) {
                    if (e.key !== 'Enter') return;
                    var q = search.value.trim();
                    window.location.href = q ? 'home.html?q=' + encodeURIComponent(q) : 'home.html';
                });
            }
        }
        cart.render();
        return host;
    }

    function goToProfile(name) {
        sessionStorage.setItem('viewingProfileName', name);
        window.location.href = 'profile.html';
    }

    /* ------------------------------------------------------------------ */
    return {
        K: K, esc: esc, qs: qs, qsa: qsa, icon: icon, store: store,
        on: on, emit: emit,
        money: money, auth: auth, data: data, likes: likes, ratings: ratings,
        lists: lists, settings: settings, orders: orders, checkoutData: checkoutData, alerts: alerts,
        cart: cart, toast: toast, soon: soon, composer: composer, checkout: checkout, picker: picker,
        avatar: avatar, deliveryFee: DELIVERY_FEE,
        recipeCard: recipeCard, emptyState: emptyState, fallbackImg: FALLBACK_IMG,
        mountShell: mountShell, mountTopbar: mountTopbar,
        openSidebar: function () { setSidebar(true); },
        closeSidebar: function () { setSidebar(false); },
        goToProfile: goToProfile
    };
})();
