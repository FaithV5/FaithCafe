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

// Database management functions with caching
async function loadUsers() {
    try {
        // Check cache first
        const cachedUsers = localStorage.getItem('faithcafe_users_cache');
        if (cachedUsers) {
            return JSON.parse(cachedUsers);
        }
        
        // Otherwise load from JSON
        const response = await fetch('../data/users.json');
        const data = await response.json();
        const users = data.users;
        
        // Cache the users
        localStorage.setItem('faithcafe_users_cache', JSON.stringify(users));
        
        return users;
    } catch (error) {
        console.error('Error loading users:', error);
        return [];
    }
}

async function loadMenu() {
    try {
        // Check cache first
        const cachedMenu = localStorage.getItem('faithcafe_menu_cache');
        if (cachedMenu) {
            return JSON.parse(cachedMenu);
        }
        
        // Otherwise load from JSON
        const response = await fetch('../data/menu.json');
        const data = await response.json();
        const menu = data.menu;
        
        // Cache the menu
        localStorage.setItem('faithcafe_menu_cache', JSON.stringify(menu));
        
        return menu;
    } catch (error) {
        console.error('Error loading menu:', error);
        return [];
    }
}

async function loadCart() {
    try {
        // Cart is always managed in localStorage during session
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        console.log('Cart loaded from localStorage:', cart);
        return cart;
    } catch (error) {
        console.error('Error loading cart:', error);
        return [];
    }
}

async function loadOrders() {
    try {
        // Check cache first
        const cachedOrders = localStorage.getItem('faithcafe_orders_cache');
        if (cachedOrders) {
            return JSON.parse(cachedOrders);
        }
        
        // Otherwise load from JSON
        const response = await fetch('../data/orders.json');
        const data = await response.json();
        const orders = data.orders;
        
        // Cache the orders
        localStorage.setItem('faithcafe_orders_cache', JSON.stringify(orders));
        
        return orders;
    } catch (error) {
        console.error('Error loading orders:', error);
        return [];
    }
}

async function saveUsers(users) {
    localStorage.setItem('faithcafe_users_cache', JSON.stringify(users));
}

async function saveMenu(menu) {
    localStorage.setItem('faithcafe_menu_cache', JSON.stringify(menu));
}

async function saveOrders(orders) {
    localStorage.setItem('faithcafe_orders_cache', JSON.stringify(orders));
}

// Cart management - UPDATED TO USE LOCALSTORAGE DURING SESSION
async function initializeCart() {
    try {
        // Always load cart from localStorage (session storage)
        const cart = JSON.parse(localStorage.getItem('cart') || '[]');
        console.log('Cart initialized from localStorage:', cart);
        
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
    
    // Save to localStorage (session storage)
    localStorage.setItem('cart', JSON.stringify(cart));
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
        console.log('Cart count updated:', totalItems, 'items in cart');
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
        authLinks.innerHTML = `
            <div class="user-menu">
                <span class="username">Hello, ${currentUser.username}</span>
            </div>
        `;
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
        return;
    }

    nav.innerHTML = '';
    const menuHref = (role === 'admin') ? 'adminmenu.html' : 'menu.html';
    const defaultItems = [
        { href: 'home.html', label: 'Home' },
        { href: menuHref, label: 'Menu' },
        { href: 'cart.html', label: 'Cart (<span id="cart-count">0</span>)', raw: true },
        { href: 'status.html', label: 'Delivery Status' }
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
    
    users.push(userData);
    await saveUsers(users);
    return true;
}

async function loginUser(username, password) {
    const users = await loadUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        const { password, ...userSession } = user;
        localStorage.setItem('currentUser', JSON.stringify(userSession));
        return true;
    }
    return false;
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

// Enhanced notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--primary-color)' : '#dc3545'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 1000;
        animation: slideIn 0.3s ease;
        max-width: 300px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
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
    console.log('Cart reset - should now show only items from cart.json');
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
    
    // Calculate shipping fee (₱30 for Cash on Delivery)
    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    const shippingFee = paymentMethod && paymentMethod.value === 'cash' ? 30 : 0;
    const total = subtotal + shippingFee;
    
    if (subtotalElement) subtotalElement.textContent = `₱${subtotal.toFixed(2)}`;
    if (shippingFeeElement) shippingFeeElement.textContent = `₱${shippingFee.toFixed(2)}`;
    if (totalAmountElement) totalAmountElement.textContent = `₱${total.toFixed(2)}`;
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
    const shippingFee = paymentMethod.value === 'cash' ? 30 : 0;
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
    
    console.log('Placing new order:', newOrder);
    
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
    
    localStorage.setItem('cart', JSON.stringify(cart));
    
    // Clear checkout items
    localStorage.removeItem('checkoutItems');
    
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
});