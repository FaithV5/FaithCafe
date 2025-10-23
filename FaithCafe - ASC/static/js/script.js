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

// Helper to return the site's root login page path
function loginHref() {
    return '/index.html';
}

// Cart management
function initializeCart() {
    if (!localStorage.getItem('cart')) {
        localStorage.setItem('cart', JSON.stringify([]));
    }
    
    // Update cart count in navigation
    updateCartCount();
    
    // If on cart page, display cart items
    if (window.location.pathname.includes('cart.html')) {
        displayCartItems();
    }
    
    // If on checkout page, display order summary
    if (window.location.pathname.includes('checkout.html')) {
        displayOrderSummary();
    }
}

// Update the addToCart function to handle quantities
function addToCart(itemName, itemPrice, quantity = 1) {
    const cart = JSON.parse(localStorage.getItem('cart'));
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
    
    localStorage.setItem('cart', JSON.stringify(cart));
    updateCartCount();
    
    // Show confirmation
    showNotification(`${quantity} ${itemName} added to cart!`);
}

function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        const cart = JSON.parse(localStorage.getItem('cart'));
        const totalItems = cart.reduce((total, item) => total + item.quantity, 0);
        cartCount.textContent = totalItems;
    }
}

function displayCartItems() {
    const cartItemsContainer = document.getElementById('cart-items');
    const cartTotalElement = document.getElementById('cart-total');
    
    if (!cartItemsContainer) return;
    
    const cart = JSON.parse(localStorage.getItem('cart'));
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

// In your checkout process, after successful payment:
function completeOrder() {
    const cart = JSON.parse(localStorage.getItem('cart'));
    const total = calculateTotal(cart);
    const deliveryInfo = {
        address: document.getElementById('address').value,
        phone: document.getElementById('phone').value
    };
    
    // Create new order
    const newOrder = createNewOrder(cart, total, deliveryInfo);
    
    // Clear cart
    localStorage.setItem('cart', JSON.stringify([]));
    updateCartCount();
    
    // Redirect to delivery status (templates folder)
    window.location.href = '/templates/status.html';
}

function updateQuantity(itemName, change) {
    const cart = JSON.parse(localStorage.getItem('cart'));
    const item = cart.find(item => item.name === itemName);
    
    if (item) {
        item.quantity += change;
        
        if (item.quantity <= 0) {
            // Remove item if quantity is 0 or less
            const itemIndex = cart.findIndex(item => item.name === itemName);
            cart.splice(itemIndex, 1);
        }
        
        localStorage.setItem('cart', JSON.stringify(cart));
        updateCartCount();
        displayCartItems();
        
        // Update totals if on cart page
        if (window.location.pathname.includes('cart.html')) {
            updateCartTotals();
        }
    }
}

// NEW FUNCTION: Remove item completely from cart
function removeFromCart(itemName) {
    if (confirm(`Are you sure you want to remove ${itemName} from your cart?`)) {
        const cart = JSON.parse(localStorage.getItem('cart'));
        const itemIndex = cart.findIndex(item => item.name === itemName);
        
        if (itemIndex !== -1) {
            cart.splice(itemIndex, 1);
            localStorage.setItem('cart', JSON.stringify(cart));
            updateCartCount();
            displayCartItems();
            
            // Update totals if on cart page
            if (window.location.pathname.includes('cart.html')) {
                updateCartTotals();
            }
            
            // Show confirmation message
            showNotification(`${itemName} removed from cart`);
        }
    }
}

function displayOrderSummary() {
    const orderSummaryElement = document.getElementById('order-summary');
    const totalAmountElement = document.getElementById('total-amount');
    
    if (!orderSummaryElement) return;
    
    const cart = JSON.parse(localStorage.getItem('cart'));
    let total = 0;
    
    orderSummaryElement.innerHTML = '';
    
    if (cart.length === 0) {
        orderSummaryElement.innerHTML = '<p>No items in cart</p>';
        if (totalAmountElement) {
            totalAmountElement.textContent = '₱0.00';
        }
        return;
    }
    
    cart.forEach(item => {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;
        
        const orderItemElement = document.createElement('div');
        orderItemElement.className = 'summary-row';
        orderItemElement.innerHTML = `
            <span>${item.name} x${item.quantity}</span>
            <span>₱${itemTotal.toFixed(2)}</span>
        `;
        
        orderSummaryElement.appendChild(orderItemElement);
    });
    
    if (totalAmountElement) {
        totalAmountElement.textContent = `₱${total.toFixed(2)}`;
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

function placeOrder() {
    const cart = JSON.parse(localStorage.getItem('cart'));
    
    if (cart.length === 0) {
        alert('Your cart is empty!');
        return;
    }
    
    // Get selected payment method
    const paymentMethod = document.querySelector('input[name="payment"]:checked');
    if (!paymentMethod) {
        alert('Please select a payment method');
        return;
    }
    
    // In a real application, you would send this data to a server
    alert('Order placed successfully! Thank you for your purchase.');
    
    // Clear cart
    localStorage.setItem('cart', JSON.stringify([]));
    updateCartCount();
    
    // Redirect to home page (templates folder)
    window.location.href = '/templates/home.html';
}

// Authentication functions
function updateAuthLinks() {
    const authLinks = document.getElementById('auth-links');
    if (!authLinks) return;

    const currentUser = getCurrentUser();
    const headerLogoutBtn = document.getElementById('header-logout');

    if (currentUser) {
        // Show username only in the auth area (role-specific links are in the main nav)
        authLinks.innerHTML = `
            <div class="user-menu">
                <span class="username">Hello, ${currentUser.username}</span>
            </div>
        `;
        // Show header logout button if present and wire it
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'inline-block';
            headerLogoutBtn.onclick = logout;
        }
    } else {
        authLinks.innerHTML = `
            <a href="${loginHref()}" class="login-link">Login</a>
        `;
        // Hide header logout button when not logged in
        if (headerLogoutBtn) {
            headerLogoutBtn.style.display = 'none';
            headerLogoutBtn.onclick = null;
        }
    }
    // Also update main navigation to show role-specific links
    try { ensureRoleNavLinks(currentUser ? currentUser.role : null); } catch (e) {}
}

// Inject/remove role links in the main <nav> so Admin/Staff get visible nav entries
function ensureRoleNavLinks(role) {
    const nav = document.querySelector('header nav ul');
    if (!nav) return;

    // If admin, replace nav with exactly: Home, Menu, Manage Users
    if (role === 'admin') {
        nav.innerHTML = '';
        const add = (href, text, id) => {
            const li = document.createElement('li');
            if (id) li.id = id;
            li.innerHTML = `<a href="${href}">${text}</a>`;
            nav.appendChild(li);
        };
    add('/templates/home.html', 'Home');
    add('/templates/adminmenu.html', 'Menu');
    add('/templates/manage_users.html', 'Manage Users');
        return;
    }

    // Otherwise restore the default public nav and append staff link when applicable
    nav.innerHTML = '';
    // Build Menu href dynamically so admin users get adminmenu.html while customers get menu.html
    const menuHref = (role === 'admin') ? 'adminmenu.html' : 'menu.html';
    const defaultItems = [
        { href: '/templates/home.html', label: 'Home' },
        { href: menuHref.startsWith('/') ? menuHref : '/templates/' + menuHref, label: 'Menu' },
        { href: '/templates/cart.html', label: 'Cart (<span id="cart-count">0</span>)', raw: true },
        { href: '/templates/status.html', label: 'Delivery Status' }
    ];
    defaultItems.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<a href="${item.href}">${item.label}</a>`;
        nav.appendChild(li);
    });

    if (role === 'staff') {
        // Clear existing navigation
        nav.innerHTML = '';
        // Add only Home and Orders
        const homeLink = document.createElement('li');
    homeLink.innerHTML = `<a href="/templates/home.html">Home</a>`;
        nav.appendChild(homeLink);
        
        const ordersLink = document.createElement('li');
        ordersLink.id = 'nav-staff';
    ordersLink.innerHTML = `<a href="/templates/staff.html">Orders</a>`;
        nav.appendChild(ordersLink);
    }
}

function logout() {
    if (confirm('Are you sure you want to logout?')) {
        logoutUser();
        showNotification('You have been logged out successfully!');
        
        // Redirect to home page after a short delay
        setTimeout(() => {
            window.location.href = loginHref();
        }, 500);
    }
}

function checkAuthentication() {
    const currentUser = getCurrentUser();
    const protectedPages = ['cart.html', 'checkout.html', 'delivery_status.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    // If user is not logged in and trying to access protected pages
    if (!currentUser && protectedPages.includes(currentPage)) {
        showNotification('Please login to access this page');
        setTimeout(() => {
            window.location.href = loginHref();
        }, 1500);
        return false;
    }

    // Additional role-based page protection
    if (currentPage === 'admin.html' || currentPage === 'adminmenu.html') {
        if (!currentUser || (currentUser.role !== 'admin')) {
            showNotification('Admin access required');
            setTimeout(() => { window.location.href = loginHref(); }, 1500);
            return false;
        }
    }

    if (currentPage === 'staff.html') {
        if (!currentUser || (currentUser.role !== 'staff' && currentUser.role !== 'admin')) {
            showNotification('Staff access required');
            setTimeout(() => { window.location.href = loginHref(); }, 1500);
            return false;
        }
    }
    
    return true;
}

// Update the DOMContentLoaded event listener
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
    
    // Mobile menu: inject hamburger button and wire toggle
    (function setupMobileMenu(){
        const headerContainer = document.querySelector('.header-container');
        if (!headerContainer) return;
        // avoid duplicating
        if (document.getElementById('mobile-menu-btn')) return;
        const btn = document.createElement('button');
        btn.id = 'mobile-menu-btn';
        btn.className = 'mobile-menu-btn';
        btn.innerHTML = '☰';
        // place before theme toggle
        const themeToggle = document.getElementById('theme-toggle');
        headerContainer.insertBefore(btn, themeToggle);

        btn.addEventListener('click', function(e){
            document.body.classList.toggle('nav-open');
        });

        // close nav when clicking a link
        document.addEventListener('click', function(e){
            if (!document.body.classList.contains('nav-open')) return;
            const target = e.target;
            if (target.tagName === 'A' && target.closest('nav')) {
                document.body.classList.remove('nav-open');
            }
        });
    })();
});

// --- Test data seeder (for local testing only) ---
function seedTestAccounts() {
    try {
        const existing = JSON.parse(localStorage.getItem('users') || '[]');
        if (!existing || existing.length === 0) {
            const users = [
                { username: 'admin', email: 'admin@local', password: 'admin', role: 'admin' },
                { username: 'staff', email: 'staff@local', password: 'staff', role: 'staff' },
                { username: 'customer', email: 'customer@local', password: 'cust', role: 'customer' }
            ];
            localStorage.setItem('users', JSON.stringify(users));
            console.info('Test accounts seeded: admin/admin, staff/staff, customer/cust');
        }
    } catch (e) {
        console.error('Failed to seed test accounts', e);
    }
}

// Seed test accounts if needed (safe no-op if users already present)
seedTestAccounts();



// NEW FUNCTION: Update cart totals (for cart page)
function updateCartTotals() {
    const cart = JSON.parse(localStorage.getItem('cart'));
    let subtotal = 0;
    
    cart.forEach(item => {
        subtotal += item.price * item.quantity;
    });
    
    const tax = subtotal * 0.12;
    const total = subtotal + tax;
    
    const cartTotalElement = document.getElementById('cart-total');
    const taxAmountElement = document.getElementById('tax-amount');
    const totalAmountElement = document.getElementById('total-amount');
    
    if (cartTotalElement) cartTotalElement.textContent = `₱${subtotal.toFixed(2)}`;
    if (taxAmountElement) taxAmountElement.textContent = `₱${tax.toFixed(2)}`;
    if (totalAmountElement) totalAmountElement.textContent = `₱${total.toFixed(2)}`;
}

// User authentication functions
function registerUser(userData) {
    // In a real application, this would be an API call to your backend
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Check if username already exists
    if (users.find(user => user.username === userData.username)) {
        throw new Error('Username already exists');
    }
    
    // Check if email already exists
    if (users.find(user => user.email === userData.email)) {
        throw new Error('Email already registered');
    }
    
    users.push(userData);
    localStorage.setItem('users', JSON.stringify(users));
    return true;
}

function loginUser(username, password) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        // Store current user session (without password)
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

// Add these functions to the existing script.js

// Password Reset Functions
function initiatePasswordReset(email) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.email === email);
    
    if (!user) {
        return { success: false, message: 'No account found with this email address.' };
    }
    
    // In a real application, you would:
    // 1. Generate a unique reset token
    // 2. Store the token with expiration time
    // 3. Send an email with the reset link
    
    // For demo purposes, we'll simulate this process
    const resetToken = generateResetToken();
    const resetData = {
        email: email,
        token: resetToken,
        expires: Date.now() + (60 * 60 * 1000) // 1 hour expiration
    };
    
    localStorage.setItem('resetToken', JSON.stringify(resetData));
    return { success: true, message: 'Password reset link sent to your email!' };
}

function generateResetToken() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
}

function validateResetToken(token) {
    const resetData = JSON.parse(localStorage.getItem('resetToken'));
    
    if (!resetData) {
        return { valid: false, message: 'Invalid or expired reset token.' };
    }
    
    if (resetData.token !== token || Date.now() > resetData.expires) {
        localStorage.removeItem('resetToken');
        return { valid: false, message: 'Invalid or expired reset token.' };
    }
    
    return { valid: true, email: resetData.email };
}

function resetPassword(email, newPassword) {
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const userIndex = users.findIndex(u => u.email === email);
    
    if (userIndex === -1) {
        return { success: false, message: 'User not found.' };
    }
    
    // Update password
    users[userIndex].password = newPassword;
    localStorage.setItem('users', JSON.stringify(users));
    
    // Clear reset token
    localStorage.removeItem('resetToken');
    
    return { success: true, message: 'Password reset successfully!' };
}

// Password validation utility function
function validatePasswordStrength(password) {
    const requirements = {
        length: password.length >= 8,
        uppercase: /[A-Z]/.test(password),
        lowercase: /[a-z]/.test(password),
        number: /[0-9]/.test(password),
        special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
    };
    
    const strength = Object.values(requirements).filter(Boolean).length;
    const maxStrength = Object.keys(requirements).length;
    
    return {
        requirements,
        strength,
        maxStrength,
        isValid: Object.values(requirements).every(Boolean)
    };
}

// Enhanced notification system
function showNotification(message, type = 'success') {
    // Create notification element
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
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (document.body.contains(notification)) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// -------------------- Admin / Staff helpers --------------------

// Role helpers: isRole('admin'|'staff'|'customer')
function isRole(role) {
    const user = getCurrentUser();
    if (!user) return false;
    return (user.role || 'customer') === role;
}

// Orders storage helpers
function getOrders() {
    return JSON.parse(localStorage.getItem('faithcafe_orders') || '[]');
}

function saveOrders(orders) {
    localStorage.setItem('faithcafe_orders', JSON.stringify(orders));
}

// Menu storage helpers
function getMenuItems() {
    return JSON.parse(localStorage.getItem('faithcafe_menu') || '[]');
}

function saveMenuItems(menu) {
    localStorage.setItem('faithcafe_menu', JSON.stringify(menu));
}

// Expose helper for staff/admin pages to update order status by id


// Provide a public function used by templates (staff/admin) to update status
function updateOrderStatus(orderId, newStatus) {
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return showNotification('Order not found', 'error');
    orders[idx].status = newStatus;
    orders[idx][`${newStatus}Time`] = new Date().toISOString();
    saveOrders(orders);
    showNotification('Order updated', 'success');
    // If on status page or staff page, try to refresh
    if (typeof statusController !== 'undefined' && statusController) {
        try { statusController.loadCurrentOrder(); } catch(e){}
    }
    return true;
}

// When checkout creates an order, the existing createNewOrder in status.js already stores orders under 'faithcafe_orders'.

// (Defaults/seeding removed to keep script minimal)
