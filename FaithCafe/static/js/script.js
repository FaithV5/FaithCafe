// Theme toggle functionality
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// Database management functions - Prefer session data, fallback to JSON
async function loadUsers(forceReload = false) {
    try {
        // Prefer session-stored users (e.g., roles updated during this session)
        const sessionUsers = sessionStorage.getItem('faithcafe_users');
        if (sessionUsers && !forceReload) {
            // If session cache exists, ensure any plaintext passwords are hashed
            const users = JSON.parse(sessionUsers);
            let updated = false;
            for (let i = 0; i < users.length; i++) {
                const pwd = users[i].password || '';
                if (pwd && !/^[a-f0-9]{64}$/i.test(pwd)) {
                    // Hash plaintext password and mark updated
                    users[i].password = await hashPassword(pwd);
                    updated = true;
                }
            }
            if (updated) {
                sessionStorage.setItem('faithcafe_users', JSON.stringify(users));
            }
            return users;
        }
    // Otherwise, load fresh from JSON and cache to session
    // Resolve path depending on where the current page is (root or templates folder)
    const usersPath = window.location.pathname.includes('/templates/') ? '../data/users.json' : 'data/users.json';
    const response = await fetch(usersPath);
        const data = await response.json();
        const users = data.users;
        // Ensure passwords are stored hashed during runtime. If the seed JSON contains plain passwords,
        // replace them with their SHA-256 hex hash before caching to sessionStorage.
        for (let i = 0; i < users.length; i++) {
            const pwd = users[i].password || '';
            if (pwd && !/^[a-f0-9]{64}$/i.test(pwd)) {
                users[i].password = await hashPassword(pwd);
            }
        }
        sessionStorage.setItem('faithcafe_users', JSON.stringify(users));
        return users;
    } catch (error) {
    console.error('Error loading users:', error);
        const sessionUsersFallback = sessionStorage.getItem('faithcafe_users');
        if (sessionUsersFallback) {
            return JSON.parse(sessionUsersFallback);
        }
        return [];
    }
}

// Hash a password using SHA-256 and return hex string
async function hashPassword(password) {
    if (!password) return '';
    const enc = new TextEncoder();
    const data = enc.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

async function loadMenu() {
    try {
        // Prefer session-stored menu so runtime edits by admin are visible to customers
        const sessionMenuRaw = sessionStorage.getItem('faithcafe_menu');
        if (sessionMenuRaw) {
            try {
                return JSON.parse(sessionMenuRaw);
            } catch (e) {
                // fall through to fetch if session data malformed
                console.warn('Malformed session menu, reloading from JSON', e);
            }
        }

        // Resolve path depending on where the current page is (root or templates folder)
        const menuPath = window.location.pathname.includes('/templates/') ? '../data/menu.json' : 'data/menu.json';
        const response = await fetch(menuPath);
        const data = await response.json();
        const menu = data.menu || [];

        // Cache the menu in sessionStorage for the session
        sessionStorage.setItem('faithcafe_menu', JSON.stringify(menu));
        return menu;
    } catch (error) {
        console.error('Error loading menu from JSON:', error);
        // Fallback to session if JSON fails
        const sessionMenu = sessionStorage.getItem('faithcafe_menu');
        if (sessionMenu) {
            return JSON.parse(sessionMenu);
        }
        return [];
    }
}

async function loadCart() {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            
            return [];
        }
        
        // Check if cart was already loaded in this session
        // Use a normalized (lowercase) username for the session cart key to avoid casing mismatches
        const sessionCartKey = `cart_${(currentUser.username || '').toString().toLowerCase()}`;
        const sessionCart = sessionStorage.getItem(sessionCartKey);
        if (sessionCart) {
            
            const items = JSON.parse(sessionCart);
            // Ensure both session and local storage hold the same canonical cart state
            localStorage.setItem('cart', JSON.stringify(items));
            return items;
        }
        
        // If session cache is missing, prefer a saved localStorage cart (last known state).
        // However, if localStorage cart is empty, prefer the seeded `data/cart.json` for default carts.
        const localCartRaw = localStorage.getItem('cart');
        if (localCartRaw) {
            try {
                const parsedLocal = JSON.parse(localCartRaw) || [];
                // If the local cart is empty, check seed JSON for a default cart for this user.
                if (!parsedLocal.length) {
                    try {
                        const resp = await fetch('../data/cart.json');
                        const data = await resp.json();
                        const allCarts = data.carts || [];
                        const userCart = allCarts.find(cart => (cart.customer || '').toString().toLowerCase() === (currentUser.username || '').toString().toLowerCase());
                        const seedItems = userCart ? userCart.items : [];
                        if (seedItems && seedItems.length) {
                            // Use seeded cart when local cart is empty
                            sessionStorage.setItem(sessionCartKey, JSON.stringify(seedItems));
                            localStorage.setItem('cart', JSON.stringify(seedItems));
                            return seedItems;
                        }
                    } catch (e) {
                        // fall back to returning the empty local cart
                        console.warn('Failed to load seed cart, returning local cart', e);
                    }
                }

                // Cache into session for this tab and return whatever local cart contains
                sessionStorage.setItem(sessionCartKey, JSON.stringify(parsedLocal));
                return parsedLocal;
            } catch (e) {
                // malformed local cart — fall through to loading JSON
                console.warn('Malformed local cart, falling back to JSON', e);
            }
        }

        // Load all carts from JSON (first time)
        const response = await fetch('../data/cart.json');
        const data = await response.json();
        const allCarts = data.carts || [];

        // Find cart for current user
        const userCart = allCarts.find(cart => (cart.customer || '').toString().toLowerCase() === (currentUser.username || '').toString().toLowerCase());
        const items = userCart ? userCart.items : [];

        // Store in sessionStorage. Only overwrite localStorage with seed JSON
        // if localStorage cart is empty (to avoid clobbering a user's recent changes).
        sessionStorage.setItem(sessionCartKey, JSON.stringify(items));
        try {
            const existingLocal = JSON.parse(localStorage.getItem('cart') || '[]');
            if (!existingLocal || existingLocal.length === 0) {
                localStorage.setItem('cart', JSON.stringify(items));
            } else {
                // keep the user's local cart intact and prefer it on subsequent loads
                console.log('Keeping existing localStorage cart (not overwriting with seed JSON)');
            }
        } catch (e) {
            // If parsing fails, overwrite with seed
            localStorage.setItem('cart', JSON.stringify(items));
        }

        return items;
    } catch (error) {
        console.error('Error loading cart:', error);
        // Fallback to localStorage
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        return cart;
    }
}

async function loadOrders() {
    try {
        // Load JSON orders first
        const ordersPath = window.location.pathname.includes('/templates/') ? '../data/orders.json' : 'data/orders.json';
        const response = await fetch(ordersPath);
        const data = await response.json();
        const jsonOrders = data.orders || [];

        // If there are orders in sessionStorage, merge them (session overrides JSON by id)
        const sessionOrdersRaw = sessionStorage.getItem('faithcafe_orders');
        if (sessionOrdersRaw) {
            try {
                const sessionOrders = JSON.parse(sessionOrdersRaw) || [];
                const map = {};
                // Start with JSON orders as the base so seeded fields (e.g., paymentMethod)
                // are preserved even if session orders are missing them.
                jsonOrders.forEach(o => { if (o && o.id) map[o.id] = Object.assign({}, o); });
                // Merge session orders on top of JSON orders, but only override fields provided
                // in the session objects. This prevents losing seeded fields like paymentMethod.
                sessionOrders.forEach(o => {
                    if (o && o.id) {
                        const existing = map[o.id] || {};
                        map[o.id] = Object.assign({}, existing, o);
                    }
                });
                const merged = Object.values(map);
                sessionStorage.setItem('faithcafe_orders', JSON.stringify(merged));

                return merged;
            } catch (e) {
                console.warn('Failed to parse session orders, using JSON orders', e);
                sessionStorage.setItem('faithcafe_orders', JSON.stringify(jsonOrders));
                return jsonOrders;
            }
        }

        // No session cache — cache JSON orders and return
        sessionStorage.setItem('faithcafe_orders', JSON.stringify(jsonOrders));
        
        return jsonOrders;
    } catch (error) {
        console.error('Error loading orders from JSON:', error);
        // Fallback to session if JSON fails
        const sessionOrders = sessionStorage.getItem('faithcafe_orders');
        if (sessionOrders) {
            
            return JSON.parse(sessionOrders);
        }
        return [];
    }
}

async function saveUsers(users) {
    // Save to sessionStorage (persists during session, resets on close)
    sessionStorage.setItem('faithcafe_users', JSON.stringify(users));
    
}

async function saveMenu(menu) {
    // Save to sessionStorage (persists during session, resets on close)
    sessionStorage.setItem('faithcafe_menu', JSON.stringify(menu));
    
}

async function saveOrders(orders) {
    // Save to sessionStorage (persists during session, resets on close)
    sessionStorage.setItem('faithcafe_orders', JSON.stringify(orders));
    
}

async function saveCart() {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            
            return;
        }
        
        const currentCart = JSON.parse(localStorage.getItem('cart') || '[]');

        // Save to sessionStorage (resets when browser closes) using lowercase username key
        const cartKey = `cart_${(currentUser.username || '').toString().toLowerCase()}`;
        sessionStorage.setItem(cartKey, JSON.stringify(currentCart));
        // Also ensure localStorage stays in sync
        localStorage.setItem('cart', JSON.stringify(currentCart));
        
    } catch (error) {
        console.error('Error saving cart:', error);
    }
}

// Cart management - Customer-specific carts
async function initializeCart() {
    try {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            
            localStorage.setItem('cart', JSON.stringify([]));
            updateCartCount();
            return;
        }
        
        // Load customer-specific cart from JSON
        await loadCart();
        
        updateCartCount();
        
        if (window.location.pathname.includes('cart.html')) {
            displayCartItems();
        }
        
        if (window.location.pathname.includes('checkout.html')) {
            displayOrderSummary();
        }
    } catch (error) {
        console.error('Error initializing cart:', error);
        localStorage.setItem('cart', JSON.stringify([]));
    }
}

async function addToCart(itemName, itemPrice, quantity = 1) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showNotification('Please login to add items to cart', 'error');
        return;
    }
    
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const existingItem = cart.find(item => item.name === itemName);
    
    if (existingItem) {
        existingItem.quantity += quantity;
    } else {
        cart.push({
            name: itemName,
            price: itemPrice,
            quantity: quantity
        });
    }
    
    // Save to localStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    await saveCart();
    updateCartCount();
    showNotification(`${quantity} ${itemName} added to cart!`);
    
    // Update cart display if we're on cart page
    if (window.location.pathname.includes('cart.html')) {
        displayCartItems();
    }
}

async function updateQuantity(itemName, change) {
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    const item = cart.find(item => item.name === itemName);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            const itemIndex = cart.findIndex(item => item.name === itemName);
            cart.splice(itemIndex, 1);
        }
        
        // Save to localStorage
        localStorage.setItem('cart', JSON.stringify(cart));
        await saveCart();
        updateCartCount();
        
        if (window.location.pathname.includes('cart.html')) {
            displayCartItems();
            updateCartTotals();
        }
    }
}

async function removeFromCart(itemName) {
    if (confirm(`Are you sure you want to remove ${itemName} from your cart?`)) {
        let cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const itemIndex = cart.findIndex(item => item.name === itemName);
        
        if (itemIndex !== -1) {
            cart.splice(itemIndex, 1);
            
            // Save to localStorage
            localStorage.setItem('cart', JSON.stringify(cart));
            await saveCart();
            updateCartCount();
            
            if (window.location.pathname.includes('cart.html')) {
                displayCartItems();
                updateCartTotals();
            }
            
            showNotification(`${itemName} removed from cart`);
        }
    }
}

function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;
        
    }
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartItemsContainer) return;
    
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    cartItemsContainer.innerHTML = '';
    
    let total = 0;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="empty-cart">Your cart is empty</p>';
        if (cartTotalElement) {
            cartTotalElement.textContent = '₱0.00';
        }
        return;
    }
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const cartItemElement = document.createElement('div');
        cartItemElement.className = 'cart-item';
        cartItemElement.innerHTML = `
            <div class="item-info">
                <h3>${item.name}</h3>
                <p class="item-price">₱${item.price.toFixed(2)}</p>
            </div>
            <div class="quantity-controls">
                <button class="quantity-btn" onclick="updateQuantity('${item.name}', -1)">-</button>
                <span class="quantity">${item.quantity}</span>
                <button class="quantity-btn" onclick="updateQuantity('${item.name}', 1)">+</button>
            </div>
            <div class="item-total">
                <p>₱${itemTotal.toFixed(2)}</p>
            </div>
            <div class="item-actions">
                <button class="delete-btn" onclick="removeFromCart('${item.name}')" title="Remove item">
                    🗑️
                </button>
            </div>
        `;
        
        cartItemsContainer.appendChild(cartItemElement);
    });
    
    if (cartTotalElement) {
        cartTotalElement.textContent = `₱${total.toFixed(2)}`;
    }
}

function setActiveNav() {
    const currentPage = window.location.pathname.split('/').pop();
    const navLinks = document.querySelectorAll('nav a');
    
    navLinks.forEach(link => {
        const linkHref = link.getAttribute('href');
        if (linkHref === currentPage) {
            link.classList.add('active');
        }
    });
}

// Authentication functions
function updateAuthLinks() {
    const authLinks = document.getElementById('auth-links');
    if (!authLinks) return;

    const currentUser = getCurrentUser();
    const headerLogoutBtn = document.getElementById('header-logout');

    if (currentUser) {
        // Remove the greeting text but keep existing logout button behavior
        authLinks.innerHTML = '';
        // Ensure header logout button remains available if present
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'inline-block';
            headerLogoutBtn.onclick = logout;
        }
    } else {
        authLinks.innerHTML = `
            <a href="../index.html" class="login-link">Login</a>
        `;
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'none';
            headerLogoutBtn.onclick = null;
        }
    }
    try { ensureRoleNavLinks(currentUser ? currentUser.role : null); } catch (e) {}
}

function ensureRoleNavLinks(role) {
    const nav = document.querySelector('header nav ul');
    if (!nav) return;

    if (role === 'admin') {
        nav.innerHTML = '';
        const add = (href, text, id) => {
            const li = document.createElement('li');
            if (id) li.id = id;
            li.innerHTML = `<a href="${href}">${text}</a>`;
            nav.appendChild(li);
        };
        add('home.html', 'Home');
        add('adminmenu.html', 'Manage Menu');
        add('manage_users.html', 'Manage Users');
            // Admins do not see the public Contact page in the admin nav
            // (Contact remains available for other roles/pages)
        return;
    }

    nav.innerHTML = '';
    const menuHref = (role === 'admin') ? 'adminmenu.html' : 'menu.html';
    const defaultItems = [
        { href: 'home.html', label: 'Home' },
        { href: menuHref, label: 'Menu' },
        { href: 'cart.html', label: 'Cart (<span id="cart-count">0</span>)', raw: true },
        { href: 'status.html', label: 'Delivery Status' },
        { href: 'contact.html', label: 'Contact' }
    ];
    defaultItems.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${item.href}">${item.label}</a>`;
        nav.appendChild(li);
    });

    if (role === 'staff') {
        nav.innerHTML = '';
        const homeLink = document.createElement('li');
        homeLink.innerHTML = `<a href="home.html">Home</a>`;
        nav.appendChild(homeLink);
        
        const ordersLink = document.createElement('li');
        ordersLink.id = 'nav-staff';
        ordersLink.innerHTML = `<a href="staff.html">Manage Orders</a>`;
        nav.appendChild(ordersLink);

        const contactLink = document.createElement('li');
        contactLink.innerHTML = `<a href="contact.html">Contact</a>`;
        nav.appendChild(contactLink);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser();
        showNotification('You have been logged out successfully!');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 500);
    }
}

function checkAuthentication() {
    const currentUser = getCurrentUser();
    const protectedPages = ['cart.html', 'checkout.html', 'delivery_status.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (!currentUser && protectedPages.includes(currentPage)) {
        showNotification('Please login to access this page');
        setTimeout(() => {
            window.location.href = '../index.html';
        }, 1500);
        return false;
    }

    if (currentPage === 'admin.html' || currentPage === 'adminmenu.html') {
        if (!currentUser || (currentUser.role !== 'admin')) {
            showNotification('Admin access required');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            return false;
        }
    }

    if (currentPage === 'staff.html') {
        if (!currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
            showNotification('Staff access required');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
            return false;
        }
    }
    
    return true;
}

// User authentication functions
async function registerUser(userData) {
    const users = await loadUsers();
    
    if (users.find(user => user.username === userData.username)) {
        throw new Error('Username already exists');
    }
    
    if (users.find(user => user.email === userData.email)) {
        throw new Error('Email already registered');
    }
    // Enforce minimum password length before storing (defensive/programmatic check)
    if (userData.password && userData.password.length < 8) {
        throw new Error('Password must be at least 8 characters long');
    }
    // Hash the password before storing
    if (userData.password) {
        userData.password = await hashPassword(userData.password);
    }

    users.push(userData);
    await saveUsers(users);
    return true;
}

async function loginUser(username, password) {
    // Try using current session cache first (or fresh JSON if session missing)
    let users = await loadUsers();

    // Normalize username for case-insensitive lookup
    const uname = (username || '').toString().trim().toLowerCase();

    // Find user case-insensitively
    let user = users.find(u => ((u.username || '').toString().trim().toLowerCase() === uname));
    if (!user) {
        return { success: false, reason: 'no-account' };
    }

    // If user exists but has no password field (e.g., rider), disallow login
    if (!user.password) {
        return { success: false, reason: 'no-password' };
    }

    const hashed = await hashPassword(password || '');

    // Accept either hashed match or legacy plaintext match while transitioning
    let passwordMatches = (user.password === hashed) || (user.password === password);

    // If password didn't match, try forcing a reload from JSON (handles edited data/users.json)
    if (!passwordMatches) {
        try {
            users = await loadUsers(true); // force reload from JSON and re-hash
            user = users.find(u => ((u.username || '').toString().trim().toLowerCase() === uname));
            if (!user) return { success: false, reason: 'no-account' };
            if (!user.password) return { success: false, reason: 'no-password' };
            const hashed2 = await hashPassword(password || '');
            passwordMatches = (user.password === hashed2) || (user.password === password);
        } catch (e) {
            // ignore reload errors, fall through to invalid-password
        }
    }

    if (!passwordMatches) {
        return { success: false, reason: 'invalid-password' };
    }

    // Successful login: save session (omit password)
    const { password: _pwd, ...userSession } = user;
    localStorage.setItem('currentUser', JSON.stringify(userSession));
    return { success: true };
}

function getCurrentUser() {
    return JSON.parse(localStorage.getItem('currentUser'));
}

function logoutUser() {
    localStorage.removeItem('currentUser');
}

function updateWelcomeMessage() {
    const welcomeElement = document.querySelector('.welcome-section h2');
    if (welcomeElement) {
        const currentUser = getCurrentUser();
        if (currentUser && currentUser.username) {
            welcomeElement.textContent = `Welcome ${currentUser.username}!`;
        }
    }
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after timeout with fade-out
    setTimeout(() => {
        notification.style.animation = 'notifOut 0.25s ease forwards';
        setTimeout(() => {
            if (document.body.contains(notification)) document.body.removeChild(notification);
        }, 250);
    }, 3000);
}

// Role helpers
function isRole(role) {
    const user = getCurrentUser();
    if (!user) return false;
    return (user.role || 'customer') === role;
}

// Orders storage helpers
async function getOrders() {
    try {
        return await loadOrders();
    } catch (error) {
        console.error('Error loading orders:', error);
        return [];
    }
}

async function saveOrdersToStorage(orders) {
    await saveOrders(orders);
}

function resetCartToJSON() {
    // Clear current cart from localStorage
    localStorage.removeItem('cart');
    
    // Reload from cart.json
    initializeCart();
    
    showNotification('Cart reset to JSON data');
    
}

// Menu storage helpers
async function getMenuItems() {
    try {
        return await loadMenu();
    } catch (error) {
        console.error('Error loading menu:', error);
        return [];
    }
}

async function saveMenuItems(menu) {
    await saveMenu(menu);
}

async function updateOrderStatus(orderId, newStatus) {
    const orders = await getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return showNotification('Order not found', 'error');
    orders[idx].status = newStatus;
    orders[idx][`${newStatus}Time`] = new Date().toISOString();
    await saveOrdersToStorage(orders);
    showNotification('Order updated', 'success');
    return true;
}

function updateCartTotals() {
    const cart = JSON.parse(localStorage.getItem('cart') || '[]');
    let subtotal = 0;
    
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    
    const total = subtotal;
    
    const cartTotalElement = document.getElementById('cart-total');
    const totalAmountElement = document.getElementById('total-amount');
    
    if (cartTotalElement) cartTotalElement.textContent = `₱${subtotal.toFixed(2)}`;
    if (totalAmountElement) totalAmountElement.textContent = `₱${total.toFixed(2)}`;
}

// Auto-fill user details on checkout
function autoFillUserDetails() {
    const currentUser = getCurrentUser();
    if (currentUser && window.location.pathname.includes('checkout.html')) {
        document.getElementById('full-name').value = currentUser.username || '';
        document.getElementById('address').value = currentUser.address || '';
        document.getElementById('phone').value = currentUser.contactNumber || '';
    }
}

// Setup payment method toggle to show/hide payment fields
function setupPaymentMethodToggle() {
    const paymentRadios = document.querySelectorAll('input[name="payment"]');
    const cardFields = document.getElementById('card-fields');
    const gcashFields = document.getElementById('gcash-fields');
    
    if (!paymentRadios.length || !cardFields || !gcashFields) return;
    
    function togglePaymentFields() {
        const selectedPayment = document.querySelector('input[name="payment"]:checked');
        if (!selectedPayment) return;
        
        // Hide all payment fields first
        cardFields.style.display = 'none';
        gcashFields.style.display = 'none';
        
        // Reset required attributes
        const cardInputs = cardFields.querySelectorAll('input');
        const gcashInputs = gcashFields.querySelectorAll('input');
        
        cardInputs.forEach(input => input.removeAttribute('required'));
        gcashInputs.forEach(input => input.removeAttribute('required'));
        
        // Show relevant fields based on selection
        if (selectedPayment.value === 'card') {
            cardFields.style.display = 'block';
            cardInputs.forEach(input => input.setAttribute('required', 'required'));
        } else if (selectedPayment.value === 'gcash') {
            gcashFields.style.display = 'block';
            gcashInputs.forEach(input => input.setAttribute('required', 'required'));
        }
    }
    
    // Add change event listeners to all payment radio buttons
    paymentRadios.forEach(radio => {
        radio.addEventListener('change', togglePaymentFields);
    });
    
    // Initialize on page load
    togglePaymentFields();
}

// Format card number input (adds spaces every 4 digits)
function formatCardNumber(input) {
    let value = input.value.replace(/\s/g, '');
    let formattedValue = value.match(/.{1,4}/g)?.join(' ') || value;
    input.value = formattedValue;
}

// Setup card input formatting
function setupCardFormatting() {
    const cardNumberInput = document.getElementById('card-number');
    
    if (cardNumberInput) {
        cardNumberInput.addEventListener('input', function() {
            // Remove non-digits
            this.value = this.value.replace(/\D/g, '');
            // Format with spaces
            formatCardNumber(this);
        });
    }
}

// Update displayOrderSummary to handle selected items and shipping fee
function displayOrderSummary() {
    const orderSummaryElement = document.getElementById('order-summary');
    const subtotalElement = document.getElementById('order-subtotal');
    const shippingFeeElement = document.getElementById('shipping-fee');
    const totalAmountElement = document.getElementById('total-amount');
    
    if (!orderSummaryElement) return;
    
    // Get selected items from localStorage (set in cart.html)
    const selectedItems = JSON.parse(localStorage.getItem('checkoutItems') || '[]');
    let subtotal = 0;
    
    orderSummaryElement.innerHTML = '';
    
    if (selectedItems.length === 0) {
        orderSummaryElement.innerHTML = '<p>No items selected for checkout</p>';
        if (subtotalElement) subtotalElement.textContent = '₱0.00';
        if (shippingFeeElement) shippingFeeElement.textContent = '₱0.00';
        if (totalAmountElement) totalAmountElement.textContent = '₱0.00';
        return;
    }
    
    selectedItems.forEach(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        
        const orderItemElement = document.createElement('div');
        orderItemElement.className = 'summary-row';
        orderItemElement.innerHTML = `
            <span>${item.name} x${item.quantity}</span>
            <span>₱${itemTotal.toFixed(2)}</span>
        `;
        
        orderSummaryElement.appendChild(orderItemElement);
    });
    
    // Calculate shipping fee: Cash = ₱30, Card/GCash = ₱15
    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    let shippingFee = 0;
    if (paymentMethod) {
        if (paymentMethod.value === 'cash') shippingFee = 30;
        else if (paymentMethod.value === 'card' || paymentMethod.value === 'gcash') shippingFee = 15;
    }
    const total = subtotal + shippingFee;
    
    if (subtotalElement) subtotalElement.textContent = `₱${subtotal.toFixed(2)}`;
    if (shippingFeeElement) shippingFeeElement.textContent = `₱${shippingFee.toFixed(2)}`;
    if (totalAmountElement) totalAmountElement.textContent = `₱${total.toFixed(2)}`;
}

// Build a plain-text receipt for email
function buildOrderReceiptText(order) {
    const lines = [];
    lines.push('FaithCafe Receipt');
    lines.push('');
    lines.push(`Order ID: ${order.id}`);
    lines.push(`Date: ${new Date(order.orderTime).toLocaleString()}`);
    lines.push(`Payment Method: ${order.paymentMethod}`);
    if (order.deliveryAddress) lines.push(`Delivery Address: ${order.deliveryAddress}`);
    if (order.contactNumber) lines.push(`Contact Number: ${order.contactNumber}`);
    lines.push('');
    lines.push('Items:');
    order.items.forEach(item => {
        const lineTotal = (item.price * item.quantity).toFixed(2);
        lines.push(` - ${item.name} x${item.quantity}  ₱${lineTotal}`);
    });
    lines.push('');
    // Compute totals defensively in case session data is stale
    const subtotal = (order.items || []).reduce((s, it) => s + (it.price * it.quantity), 0);
    let shippingFee = 0;
    if (typeof order.shippingFee === 'number') {
        shippingFee = order.shippingFee;
    } else if (order.paymentMethod) {
        const pm = (order.paymentMethod || '').toString().toLowerCase();
        if (pm === 'cash') shippingFee = 30;
        else if (pm === 'card' || pm === 'gcash') shippingFee = 15;
    }
    const expectedTotal = subtotal + shippingFee;
    const total = (typeof order.total === 'number' && order.total >= expectedTotal) ? order.total : expectedTotal;

    lines.push(`Subtotal: ₱${subtotal.toFixed(2)}`);
    lines.push(`Shipping: ₱${shippingFee.toFixed(2)}`);
    lines.push(`Total: ₱${total.toFixed(2)}`);
    lines.push('');
    lines.push('Thank you for ordering from FaithCafe!');
    return lines.join('\n');
}

// Open Gmail compose with prefilled receipt; falls back to mailto if blocked
function sendReceiptEmail(toEmail, order) {
    if (!toEmail) return;
    const subject = `Your FaithCafe Receipt - ${order.id}`;
    const body = buildOrderReceiptText(order);
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(toEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    const win = window.open(gmailUrl, '_blank');
    // If popup blocked, fallback to mailto
    if (!win) {
        const mailto = `mailto:${encodeURIComponent(toEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        window.location.href = mailto;
    }
}

// Build printable HTML for receipt popup
function buildReceiptHTML(order, customer) {
        const itemsRows = order.items.map(item => {
                const lineTotal = (item.price * item.quantity).toFixed(2);
                return `<tr>
                        <td>${item.name}</td>
                        <td class="right">${item.quantity}</td>
                        <td class="right">₱${item.price.toFixed(2)}</td>
                        <td class="right">₱${lineTotal}</td>
                </tr>`;
        }).join('');

        const escapeHtml = (str) => (str || '').toString()
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');

        // Compute totals defensively to avoid showing stale values
        const subtotal = (order.items || []).reduce((s, it) => s + (it.price * it.quantity), 0);
        let shippingFee = 0;
        if (typeof order.shippingFee === 'number') {
            shippingFee = order.shippingFee;
        } else if (order.paymentMethod) {
            const pm = (order.paymentMethod || '').toString().toLowerCase();
            if (pm === 'cash') shippingFee = 30;
            else if (pm === 'card' || pm === 'gcash') shippingFee = 15;
        }
        const expectedTotal = subtotal + shippingFee;
        const total = (typeof order.total === 'number' && order.total >= expectedTotal) ? order.total : expectedTotal;

        return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FaithCafe Receipt ${escapeHtml(order.id)}</title>
    <style>
        :root { --fg:#222; --muted:#666; --brand:#7b4c2b; --line:#eee; }
        body { font-family: Arial, sans-serif; color:var(--fg); margin:0; padding:24px; background:#fff; }
        .header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
        .brand { font-size:20px; font-weight:700; color:var(--brand); }
        .meta { color:var(--muted); font-size:12px; }
        .section { border:1px solid var(--line); border-radius:8px; padding:16px; margin-bottom:16px; }
        h2 { margin:0 0 8px; font-size:16px; }
        table { width:100%; border-collapse:collapse; }
        th, td { padding:8px; border-bottom:1px solid var(--line); font-size:14px; }
        th { text-align:left; background:#fafafa; }
        .right { text-align:right; }
        .totals { margin-top:8px; }
        .totals .row { display:flex; justify-content:space-between; padding:6px 0; }
        .totals .grand { font-weight:700; border-top:1px solid var(--line); margin-top:6px; padding-top:8px; }
        .actions { position:sticky; bottom:0; background:#fff; padding-top:12px; margin-top:16px; display:flex; gap:8px; }
        .btn { padding:10px 14px; border-radius:6px; border:1px solid var(--line); background:#f6f6f6; cursor:pointer; }
        .btn.primary { background:var(--brand); color:#fff; border-color:var(--brand); }
        @media print { .actions { display:none; } body { padding:0; } .section { border:none; } th, td { border-bottom:1px solid #ddd; } }
    </style>
    <script>
        function printReceipt(){ window.print(); }
        function closeWindow(){ window.close(); }
    </script>
    </head>
<body>
    <div class="header">
        <div class="brand">FaithCafe</div>
        <div class="meta">Receipt • ${escapeHtml(order.id)}</div>
    </div>

    <div class="section">
        <h2>Order details</h2>
        <div class="meta">Date: ${new Date(order.orderTime).toLocaleString()}</div>
        <div class="meta">Payment: ${escapeHtml(order.paymentMethod)}</div>
    </div>

    <div class="section">
        <h2>Customer</h2>
        <div>${escapeHtml(customer?.username || '')}${customer?.email ? ` • ${escapeHtml(customer.email)}` : ''}</div>
        ${order.deliveryAddress ? `<div class="meta">Address: ${escapeHtml(order.deliveryAddress)}</div>` : ''}
        ${order.contactNumber ? `<div class="meta">Contact: ${escapeHtml(order.contactNumber)}</div>` : ''}
    </div>

    <div class="section">
        <h2>Items</h2>
        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th class="right">Qty</th>
                    <th class="right">Price</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                ${itemsRows}
            </tbody>
        </table>
        <div class="totals">
            <div class="row"><span>Subtotal</span><span>₱${subtotal.toFixed(2)}</span></div>
            <div class="row"><span>Shipping</span><span>₱${shippingFee.toFixed(2)}</span></div>
            <div class="row grand"><span>Total</span><span>₱${total.toFixed(2)}</span></div>
        </div>
    </div>

    <div class="actions">
        <button class="btn" onclick="closeWindow()">Close</button>
        <button class="btn primary" onclick="printReceipt()">Print receipt</button>
    </div>
</body>
</html>`;
}

function openReceiptWindow(order, customer, preOpenedWin) {
    let win = preOpenedWin;
    try {
        if (!win) win = window.open('', 'fc_receipt', 'width=520,height=700,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes');
    } catch (e) {
                console.warn('Popup blocked: ', e);
                win = null;
        }
        const html = buildReceiptHTML(order, customer);
        if (win) {
                win.document.open();
                win.document.write(html);
                win.document.close();
                try { win.focus(); } catch (_) {}
        } else {
                // Last resort: show a compact text receipt in an alert
                alert(buildOrderReceiptText(order));
        }
}

// Global helper to open a receipt by order ID (used by history cards)
async function viewOrderReceipt(orderId) {
    try {
        const orders = await getOrders();
        const order = (orders || []).find(o => o.id === orderId);
        if (!order) return showNotification('Order not found', 'error');

        // For customer pages, current user is the customer; for staff pages, try to find user
        let customer = getCurrentUser();
        if (!customer) {
            try {
                const users = await loadUsers();
                customer = (users || []).find(u => (u.username || '').toString().toLowerCase() === (order.customer || '').toString().toLowerCase()) || null;
            } catch (e) {
                customer = null;
            }
        }

        try {
            openReceiptWindow(order, customer);
        } catch (e) {
            alert(buildOrderReceiptText(order));
        }
    } catch (error) {
        console.error('Failed to open receipt by id:', error);
        showNotification('Failed to open receipt', 'error');
    }
}

// Update placeOrder function to use caching
async function placeOrder() {
    const selectedItems = JSON.parse(localStorage.getItem('checkoutItems') || '[]');
    
    if (selectedItems.length === 0) {
        alert('No items selected for checkout!');
        return;
    }
    
    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    if (!paymentMethod) {
        alert('Please select a payment method');
        return;
    }
    
    // Calculate totals
    const subtotal = selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    let shippingFee = 0;
    if (paymentMethod.value === 'cash') {
        shippingFee = 30;
    } else if (paymentMethod.value === 'card' || paymentMethod.value === 'gcash') {
        shippingFee = 15;
    }
    const total = subtotal + shippingFee;
    
    // Get current user
    const currentUser = getCurrentUser();
    if (!currentUser) {
        alert('Please login to place an order');
        return;
    }
    
    // Get current orders from cache
    const orders = await getOrders();
    const newOrder = {
        id: 'FC' + Date.now().toString().slice(-6),
        customer: currentUser.username,
        items: selectedItems,
        subtotal: subtotal,
        shippingFee: shippingFee,
        total: total,
        status: 'placed',
        orderTime: new Date().toISOString(),
        placedTime: new Date().toISOString(),
        deliveryAddress: document.getElementById('address').value,
        contactNumber: document.getElementById('phone').value,
        paymentMethod: paymentMethod.value
    };
    
    

    // Pre-open a small receipt window to avoid popup blockers (will fill after saves)
    let receiptWin = null;
    try { receiptWin = window.open('', 'fc_receipt', 'width=520,height=700,menubar=no,toolbar=no,location=no,status=no,scrollbars=yes'); } catch (_) { receiptWin = null; }
    
    orders.push(newOrder);
    await saveOrdersToStorage(orders);
    
    // Remove selected items from cart
    let cart = JSON.parse(localStorage.getItem('cart') || '[]');
    selectedItems.forEach(selectedItem => {
        const index = cart.findIndex(item => 
            item.name === selectedItem.name && 
            item.price === selectedItem.price
        );
        if (index !== -1) {
            cart.splice(index, 1);
        }
    });
    
    // Update cart in both localStorage and sessionStorage
    localStorage.setItem('cart', JSON.stringify(cart));
    await saveCart(); // Save to sessionStorage for persistence during session
    
    // Clear checkout items
    localStorage.removeItem('checkoutItems');
    
    // Open in-app receipt window
    openReceiptWindow(newOrder, currentUser, receiptWin);
    
    // Note: per request, no automatic email draft for receipts. Email features remain for Contact page.
    
    alert('Order placed successfully! Thank you for your purchase.');
    updateCartCount();
    
    // Redirect to status page to see the new order
    window.location.href = 'status.html';
}

// Admin functions for user management
async function deleteUser(username) {
    if (confirm(`Are you sure you want to delete user ${username}?`)) {
        const users = await loadUsers();
        const updatedUsers = users.filter(user => user.username !== username);
        await saveUsers(updatedUsers);
        showNotification(`User ${username} deleted successfully`);
        return true;
    }
    return false;
}

// Admin functions for menu management
async function addMenuItem(menuItem) {
    const menu = await loadMenu();
    menu.push(menuItem);
    await saveMenuItems(menu);
    showNotification('Menu item added successfully');
}

async function updateMenuItem(itemName, updatedItem) {
    const menu = await loadMenu();
    const index = menu.findIndex(item => item.name === itemName);
    if (index !== -1) {
        menu[index] = updatedItem;
        await saveMenuItems(menu);
        showNotification('Menu item updated successfully');
        return true;
    }
    return false;
}

async function deleteMenuItem(itemName) {
    if (confirm(`Are you sure you want to delete ${itemName} from the menu?`)) {
        const menu = await loadMenu();
        const updatedMenu = menu.filter(item => item.name !== itemName);
        await saveMenuItems(updatedMenu);
        showNotification('Menu item deleted successfully');
        return true;
    }
    return false;
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
        
        const currentTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', currentTheme);
        updateThemeIcon(currentTheme);
    }
    
    // Cart functionality
    initializeCart();
    
    // Navigation active state
    setActiveNav();
    
    // Update welcome message if on home page
    updateWelcomeMessage();
    
    // Update authentication links
    updateAuthLinks();
    
    // Check authentication for protected pages
    checkAuthentication();
    
    // Auto-fill user details on checkout page
    if (window.location.pathname.includes('checkout.html')) {
        autoFillUserDetails();
        displayOrderSummary();
        
        // Update order summary when payment method changes
        document.querySelectorAll('input[name="payment"]').forEach(radio => {
            radio.addEventListener('change', displayOrderSummary);
        });
        
        // Toggle payment fields based on selected payment method
        setupPaymentMethodToggle();
        
        // Setup card input formatting
        setupCardFormatting();
    }
    
    // Mobile menu
    (function setupMobileMenu(){
        const headerContainer = document.querySelector('.header-container');
        if (!headerContainer) return;
        if (document.getElementById('mobile-menu-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.className = 'mobile-menu-btn';
        btn.innerHTML = '☰';
        const themeToggle = document.getElementById('theme-toggle');
        headerContainer.insertBefore(btn, themeToggle);

        btn.addEventListener('click', function(e){
            document.body.classList.toggle('nav-open');
        });

        document.addEventListener('click', function(e){
            if (!document.body.classList.contains('nav-open')) return;
            const target = e.target;
            if (target.tagName === 'A' && target.closest('nav')) {
                document.body.classList.remove('nav-open');
            }
        });
    })();

    // Password show/hide toggles with eye icon inside input
    (function setupPasswordToggles(){
        const passwordInputs = Array.from(document.querySelectorAll('input[type="password"]'));
        if (!passwordInputs.length) return;

        const eyeIcon = (visible) => {
            // visible=false => eye; visible=true => eye with slash
            return visible
                ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M2.1 3.51 3.51 2.1l18.39 18.39-1.41 1.41-3.21-3.21A11.1 11.1 0 0 1 12 20.5C6 20.5 1.73 16.36.46 12.7a1.94 1.94 0 0 1 0-1.4c.56-1.63 1.7-3.45 3.34-5.02L2.1 3.51ZM12 5.5c6 0 10.27 4.14 11.54 7.8.23.66.23 1.36 0 2.02-.4 1.16-1.12 2.45-2.12 3.65l-1.43-1.43c.74-.88 1.3-1.84 1.6-2.73.08-.22.08-.46 0-.68C19.88 10.5 16.34 7.5 12 7.5c-.6 0-1.18.05-1.75.16L8.76 6.17C9.77 5.75 10.87 5.5 12 5.5Zm0 4a3 3 0 0 1 3 3c0 .35-.06.68-.17 1l-3.83-3.83c.32-.11.65-.17 1-.17Zm-5 3a5 5 0 0 0 6.83 4.65l-1.58-1.58a3 3 0 0 1-3.67-3.67L6.35 10.7c-.22.57-.35 1.2-.35 1.8Z" fill="currentColor"/></svg>'
                : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 5.5c6 0 10.27 4.14 11.54 7.8.23.66.23 1.36 0 2.02C22.27 19.86 18 24 12 24S1.73 19.86.46 15.32a2.13 2.13 0 0 1 0-1.64C1.73 9.14 6 5 12 5Zm0 2C7.66 7.5 4.12 10.5 2.82 13.76a.52.52 0 0 0 0 .4C4.12 17.42 7.66 20.5 12 20.5s7.88-3.08 9.18-6.34a.52.52 0 0 0 0-.4C19.88 10.5 16.34 7.5 12 7.5Zm0 2.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 12 12Z" fill="currentColor"/></svg>';
        };

        passwordInputs.forEach((input) => {
            if (input.dataset.toggleAttached === 'true') return;

            let fieldWrapper = input.closest('.password-field');

            if (!fieldWrapper) {
                // Create an inline wrapper and move the input inside it
                const parent = input.parentElement;
                const wrapper = document.createElement('div');
                wrapper.className = 'password-field';
                // Insert wrapper just before the input, then move the input into it
                parent.insertBefore(wrapper, input);
                wrapper.appendChild(input);
                fieldWrapper = wrapper;
            }

            input.classList.add('password-input');

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'toggle-password-btn';
            btn.setAttribute('aria-label', 'Show password');
            btn.setAttribute('title', 'Show password');
            btn.innerHTML = eyeIcon(false);

            btn.addEventListener('click', () => {
                const isPassword = input.type === 'password';
                input.type = isPassword ? 'text' : 'password';
                btn.innerHTML = eyeIcon(isPassword);
                const label = isPassword ? 'Hide password' : 'Show password';
                btn.setAttribute('aria-label', label);
                btn.setAttribute('title', label);
            });

            // Insert button after input so it sits inside the same wrapper
            input.insertAdjacentElement('afterend', btn);
            input.dataset.toggleAttached = 'true';
        });
    })();

});
