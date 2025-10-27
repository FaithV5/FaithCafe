// Staff Order Management System
class StaffOrderManager {
    constructor() {
        this.orders = [];
        this.riders = [
            { id: 1, name: "Juan Dela Cruz", contact: "+63 912 345 6789", available: true },
            { id: 2, name: "Maria Santos", contact: "+63 923 456 7890", available: true },
            { id: 3, name: "Pedro Reyes", contact: "+63 934 567 8901", available: true }
        ];
        this.init();
    }

    async init() {
        await this.loadOrders();
        this.displayOrders();
        this.setupEventListeners();
    }

    async loadOrders() {
        try {
            // Load from cache (which persists during session)
            this.orders = await getOrders();
            console.log('Loaded orders from cache for staff:', this.orders);
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
        const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
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
                    <strong>Total: ₱${total.toFixed(2)}</strong>
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
                    ${order.rider ? `
                    <div class="info-item rider-info">
                        <span class="info-label">Rider:</span>
                        <span>${order.rider.name} (${order.rider.contact})</span>
                    </div>
                    ` : ''}
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

        const selectedRider = this.riders.find(rider => rider.id == riderId);
        if (!selectedRider) {
            showNotification('Rider not found', 'error');
            return;
        }

        // Assign rider to order
        this.orders[orderIndex].rider = {
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
            const riderName = this.orders[orderIndex].rider.name;
            const rider = this.riders.find(r => r.name === riderName);
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
    }
}

// Initialize staff manager when page loads
let staffManager;
document.addEventListener('DOMContentLoaded', function() {
    staffManager = new StaffOrderManager();
});