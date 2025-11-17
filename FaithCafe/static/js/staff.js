// Staff Order Management System
class StaffOrderManager {
    constructor() {
        this.orders = [];
    // riders will be loaded from users.json (role: 'rider')
        this.riders = [];
        this.init();
    }

    async init() {
        await this.loadOrders();
        await this.loadRiders();
        this.displayOrders();
        this.setupEventListeners();
    }

    // Load riders from users.json (session cache or data file)
    async loadRiders() {
        try {
            const users = await loadUsers();
            const ridersList = (users || []).filter(u => (u.role || '').toLowerCase() === 'rider');
            // Map to internal rider objects with numeric ids
            this.riders = ridersList.map((u, idx) => ({
                id: idx + 1,
                name: u.username,
                contact: u.contactNumber || u.phone || u.email || '',
                available: true,
                username: u.username
            }));
            
        } catch (e) {
            console.error('Failed to load riders from users.json, falling back to empty list', e);
            this.riders = [];
        }
    }

    async loadOrders() {
        try {
            // Load from cache (which persists during session)
            this.orders = await getOrders();
        } catch (error) {
            console.error('Error loading orders:', error);
            this.orders = [];
        }
    }

    displayOrders() {
        const container = document.getElementById('staff-orders-container');
        if (!container) return;

        if (this.orders.length === 0) {
            container.innerHTML = '<p class="no-orders">No orders found.</p>';
            return;
        }

        // Sort orders: active orders first, then by most recent
        const sortedOrders = [...this.orders].sort((a, b) => {
            const activeA = a.status !== 'delivered' && a.status !== 'cancelled';
            const activeB = b.status !== 'delivered' && b.status !== 'cancelled';
            
            if (activeA && !activeB) return -1;
            if (!activeA && activeB) return 1;
            
            return new Date(b.orderTime) - new Date(a.orderTime);
        });

        let ordersHTML = '';
        
        sortedOrders.forEach(order => {
            ordersHTML += this.createOrderCard(order);
        });

        container.innerHTML = ordersHTML;
    }

    createOrderCard(order) {
        // Compute subtotal from items so we can include shippingFee if present.
        const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Determine shipping fee: prefer explicit stored value, otherwise infer from payment method
        let shippingFee = 0;
        if (typeof order.shippingFee === 'number') {
            shippingFee = order.shippingFee;
        } else if (order.paymentMethod) {
            const pm = (order.paymentMethod || '').toString().toLowerCase();
            if (pm === 'cash') shippingFee = 30;
            else if (pm === 'card' || pm === 'gcash') shippingFee = 15;
        }
        // Prefer an explicit stored total only if it already includes shipping (i.e., >= subtotal + shippingFee).
        // Otherwise compute subtotal + shippingFee (shippingFee may be inferred from paymentMethod).
        const expectedTotal = subtotal + shippingFee;
        let displayedTotal;
        if (typeof order.total === 'number' && order.total >= expectedTotal) {
            displayedTotal = order.total;
        } else {
            displayedTotal = expectedTotal;
        }
        const isActive = order.status !== 'delivered' && order.status !== 'cancelled';
        const statusClass = order.status === 'cancelled' ? 'cancelled' : '';
        const needsRider = (order.status === 'preparing' || order.status === 'ready') && !order.rider;
        
        return `
            <div class="order-card ${statusClass} ${isActive ? 'active' : ''} ${needsRider ? 'needs-rider' : ''}">
                <div class="order-card-header">
                    <div class="order-info">
                        <h3>Order #${order.id}</h3>
                        <span class="order-time">${new Date(order.orderTime).toLocaleString()}</span>
                        <span class="customer-name">Customer: ${order.customer || 'Unknown'}</span>
                    </div>
                    <div class="order-status-badge status-${order.status}">
                        ${this.getStatusText(order.status)}
                    </div>
                </div>
                
                <div class="order-items">
                    ${order.items.map(item => `
                        <div class="order-item">
                            <span class="item-name">${item.quantity}x ${item.name}</span>
                            <span class="item-price">₱${(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                    `).join('')}
                </div>
                
                <div class="order-total">
                    <strong>Total: ₱${displayedTotal.toFixed(2)}</strong>
                </div>
                
                <div class="customer-info">
                    <div class="info-item">
                        <span class="info-label">Address:</span>
                        <span>${order.deliveryAddress || 'Not specified'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Contact:</span>
                        <span>${order.contactNumber || 'Not specified'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Payment:</span>
                        <span>${(order.paymentMethod || order.payment || 'Not specified') === 'gcash' ? 'GCash' : ((order.paymentMethod || order.payment || 'Not specified') === 'card' ? 'Card' : ((order.paymentMethod || order.payment || 'Not specified') === 'cash' ? 'Cash' : (order.paymentMethod || order.payment || 'Not specified')))}</span>
                    </div>
                    ${order.rider ? `
                    <div class="info-item rider-info">
                        <span class="info-label">Rider:</span>
                        <span>${order.rider.name} (${order.rider.contact})</span>
                    </div>
                    ` : ''}
                </div>

                <div class="order-actions">
                    <button class="btn btn-secondary" onclick="viewOrderReceipt('${order.id}')">View Receipt</button>
                </div>
                
                ${isActive ? this.createStatusControls(order.id, order.status, order.rider) : ''}
            </div>
        `;
    }

    createStatusControls(orderId, currentStatus, currentRider) {
        const statusOptions = [
            { value: 'placed', label: 'Order Placed' },
            { value: 'preparing', label: 'Preparing' },
            { value: 'ready', label: 'Ready for Pickup' },
            { value: 'pickedup', label: 'Picked Up' },
            { value: 'delivered', label: 'Delivered' },
            { value: 'cancelled', label: 'Cancelled' }
        ];

        const needsRiderAssignment = (currentStatus === 'preparing' || currentStatus === 'ready') && !currentRider;
        const canProceedToReady = currentStatus === 'preparing' && currentRider;

        return `
            <div class="status-controls">
                ${needsRiderAssignment ? this.createRiderAssignment(orderId) : ''}
                
                <div class="status-update-section">
                    <label for="status-${orderId}">Update Status:</label>
                    <select id="status-${orderId}" class="status-select" ${needsRiderAssignment && currentStatus === 'preparing' ? 'disabled' : ''}>
                        ${statusOptions.map(option => `
                            <option value="${option.value}" ${option.value === currentStatus ? 'selected' : ''}
                                ${option.value === 'ready' && needsRiderAssignment ? 'disabled' : ''}>
                                ${option.label}
                            </option>
                        `).join('')}
                    </select>
                    <button class="btn btn-primary" onclick="staffManager.updateOrderStatus('${orderId}')"
                        ${needsRiderAssignment && currentStatus === 'preparing' ? 'disabled' : ''}>
                        Update
                    </button>
                </div>
                
                ${canProceedToReady ? `
                    <div class="rider-assigned-notice">
                        ✅ Rider assigned: ${currentRider.name}
                    </div>
                ` : ''}
            </div>
        `;
    }

    createRiderAssignment(orderId) {
        const availableRiders = this.riders.filter(rider => rider.available);
        
        return `
            <div class="rider-assignment">
                <label for="rider-${orderId}">Assign Rider (Required):</label>
                <select id="rider-${orderId}" class="rider-select">
                    <option value="">Select a rider...</option>
                    ${availableRiders.map(rider => `
                        <option value="${rider.id}">${rider.name} - ${rider.contact}</option>
                    `).join('')}
                </select>
                <button class="btn btn-secondary" onclick="staffManager.assignRider('${orderId}')">
                    Assign Rider
                </button>
                <div class="assignment-help">
                    ⚠️ Rider must be assigned before order can be marked as "Ready for Pickup"
                </div>
            </div>
        `;
    }

    assignRider(orderId) {
        const riderSelect = document.getElementById(`rider-${orderId}`);
        const riderId = riderSelect.value;
        
        if (!riderId) {
            showNotification('Please select a rider', 'error');
            return;
        }

        const orderIndex = this.orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            showNotification('Order not found', 'error');
            return;
        }

        const selectedRider = this.riders.find(rider => String(rider.id) === String(riderId));
        if (!selectedRider) {
            showNotification('Rider not found', 'error');
            return;
        }

        // Assign rider to order
        this.orders[orderIndex].rider = {
            id: selectedRider.id,
            name: selectedRider.name,
            contact: selectedRider.contact
        };

    // Mark rider as unavailable
    selectedRider.available = false;

        // Save to cache
        saveOrdersToStorage(this.orders);

        // Refresh display to show updated rider info
        this.displayOrders();

        showNotification(`Rider ${selectedRider.name} assigned to Order #${orderId}`, 'success');
    }

    async updateOrderStatus(orderId) {
        const selectElement = document.getElementById(`status-${orderId}`);
        const newStatus = selectElement.value;
        
        const orderIndex = this.orders.findIndex(order => order.id === orderId);
        if (orderIndex === -1) {
            showNotification('Order not found', 'error');
            return;
        }

        // Check if rider is required for ready status
        if (newStatus === 'ready' && !this.orders[orderIndex].rider) {
            showNotification('Please assign a rider before marking order as ready', 'error');
            return;
        }

        // Update order status and timestamp
        this.orders[orderIndex].status = newStatus;
        this.orders[orderIndex][`${newStatus}Time`] = new Date().toISOString();

        // If order is delivered or cancelled, free up the rider
        if ((newStatus === 'delivered' || newStatus === 'cancelled') && this.orders[orderIndex].rider) {
            const riderId = this.orders[orderIndex].rider && this.orders[orderIndex].rider.id;
            const rider = this.riders.find(r => String(r.id) === String(riderId));
            if (rider) {
                rider.available = true;
            }
        }

        // Save to cache
        await saveOrdersToStorage(this.orders);

        // Refresh display
        this.displayOrders();

        showNotification(`Order #${orderId} status updated to ${this.getStatusText(newStatus)}`, 'success');
    }

    getStatusText(status) {
        const statusMap = {
            'placed': 'Order Placed',
            'preparing': 'Preparing',
            'ready': 'Ready for Pickup',
            'pickedup': 'Picked Up',
            'delivered': 'Delivered',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    setupEventListeners() {
        // Refresh orders every 30 seconds to check for updates
        setInterval(() => {
            this.loadOrders().then(() => this.displayOrders());
        }, 30000);

        // Listen for cross-tab order updates (broadcast via localStorage)
        window.addEventListener('storage', (e) => {
            if (!e.key) return;
            if (e.key === 'faithcafe_orders_update') {
                console.log('Staff view received orders update via storage event, reloading');
                this.loadOrders().then(() => this.displayOrders());
            }
        });
    }
}

// Initialize staff manager when page loads
let staffManager;
document.addEventListener('DOMContentLoaded', function() {
    staffManager = new StaffOrderManager();
});

// Open a receipt for a given order id (used by staff view)
async function viewOrderReceipt(orderId) {
    try {
        const orders = await getOrders();
        const order = (orders || []).find(o => o.id === orderId);
        if (!order) return showNotification('Order not found', 'error');

        // Try to find the customer details from users.json/session
        let customer = null;
        try {
            const users = await loadUsers();
            customer = (users || []).find(u => (u.username || '').toString().toLowerCase() === (order.customer || '').toString().toLowerCase()) || null;
        } catch (e) {
            // ignore — customer may be missing
            customer = null;
        }

        // Open receipt window (function provided in script.js)
        try {
            openReceiptWindow(order, customer);
        } catch (e) {
            // fallback: alert with text version
            alert(buildOrderReceiptText(order));
        }
    } catch (error) {
        console.error('Failed to open receipt:', error);
        showNotification('Failed to open receipt', 'error');
    }

}
