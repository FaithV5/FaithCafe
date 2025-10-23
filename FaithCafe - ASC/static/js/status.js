// Delivery Status Tracking System
class DeliveryTracker {
    constructor() {
        this.currentOrder = null;
        this.orders = JSON.parse(localStorage.getItem('faithcafe_orders') || '[]');
        this.init();
    }

    init() {
        this.loadCurrentOrder();
        this.displayOrderHistory();
        this.startTracking();
    }

    loadCurrentOrder() {
        // Get the most recent order that's not delivered
        this.currentOrder = this.orders.find(order => 
            order.status !== 'delivered' && order.status !== 'cancelled'
        ) || this.orders[this.orders.length - 1];

        if (this.currentOrder) {
            this.displayCurrentOrder();
        } else {
            this.showNoOrdersMessage();
        }
    }

    displayCurrentOrder() {
        // Update order number
        document.getElementById('current-order-number').textContent = this.currentOrder.id;
        
        // Update order items
        this.displayOrderItems();
        
        // Update delivery information
        this.updateDeliveryInfo();
        
        // Update progress steps
        this.updateProgressSteps();
        
        // Update ETA
        this.updateETA();
    }

    displayOrderItems() {
        const itemsList = document.getElementById('order-items-list');
        const totalAmount = document.getElementById('order-total-amount');
        
        if (!itemsList) return;

        let itemsHTML = '';
        let total = 0;

        this.currentOrder.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            total += itemTotal;
            itemsHTML += `
                <div class="order-item">
                    <span class="item-name">${item.quantity}x ${item.name}</span>
                    <span class="item-price">₱${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });

        itemsList.innerHTML = itemsHTML;
        totalAmount.textContent = total.toFixed(2);
    }

    updateDeliveryInfo() {
        const user = JSON.parse(localStorage.getItem('currentUser'));
        
        if (user) {
            document.getElementById('delivery-address').textContent = user.address || 'Not specified';
            document.getElementById('contact-number').textContent = user.contactNumber || 'Not specified';
        }

        // Simulate rider assignment
        if (this.currentOrder.status === 'preparing' || this.currentOrder.status === 'ready') {
            document.getElementById('rider-name').textContent = 'Juan Dela Cruz';
            document.getElementById('rider-contact').textContent = '+63 912 345 6789';
        }
    }

    updateProgressSteps() {
        const status = this.currentOrder.status;
        const steps = ['placed', 'preparing', 'ready', 'pickedup', 'delivered'];
        
        steps.forEach((step, index) => {
            const stepElement = document.getElementById(`step-${step}`);
            const timeElement = document.getElementById(`step${index + 1}-time`);
            
            if (stepElement) {
                if (steps.indexOf(status) >= index) {
                    stepElement.classList.add('active');
                    if (this.currentOrder[`${step}Time`]) {
                        timeElement.textContent = this.formatTime(this.currentOrder[`${step}Time`]);
                    }
                } else {
                    stepElement.classList.remove('active');
                }
            }
        });
    }

    updateETA() {
        const status = this.currentOrder.status;
        let eta = '15-20 minutes';
        
        switch(status) {
            case 'placed':
                eta = '15-20 minutes';
                break;
            case 'preparing':
                eta = '10-15 minutes';
                break;
            case 'ready':
                eta = '5-10 minutes';
                break;
            case 'pickedup':
                eta = 'Arriving soon';
                break;
            case 'delivered':
                eta = 'Delivered';
                break;
        }
        
        document.getElementById('eta-time').textContent = eta;
    }

    displayOrderHistory() {
        const historyList = document.getElementById('order-history-list');
        if (!historyList) return;

        if (this.orders.length === 0) {
            historyList.innerHTML = '<p class="no-orders">No previous orders found.</p>';
            return;
        }

        let historyHTML = '';
        this.orders.slice().reverse().forEach(order => {
            if (order.status === 'delivered' || order.status === 'cancelled') {
                historyHTML += this.createOrderHistoryCard(order);
            }
        });

        historyList.innerHTML = historyHTML || '<p class="no-orders">No completed orders yet.</p>';
    }

    createOrderHistoryCard(order) {
        const total = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const statusClass = order.status === 'cancelled' ? 'cancelled' : 'delivered';
        const statusText = order.status === 'cancelled' ? 'Cancelled' : 'Delivered';
        
        return `
            <div class="order-history-card ${statusClass}">
                <div class="history-card-header">
                    <span class="order-id">Order #${order.id}</span>
                    <span class="order-date">${new Date(order.orderTime).toLocaleDateString()}</span>
                </div>
                <div class="history-items">
                    ${order.items.slice(0, 2).map(item => 
                        `<span class="history-item">${item.quantity}x ${item.name}</span>`
                    ).join('')}
                    ${order.items.length > 2 ? `<span class="more-items">+${order.items.length - 2} more</span>` : ''}
                </div>
                <div class="history-footer">
                    <span class="order-total">₱${total.toFixed(2)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                </div>
            </div>
        `;
    }

    startTracking() {
        // Simulate real-time updates
        if (this.currentOrder && this.currentOrder.status !== 'delivered') {
            setInterval(() => {
                this.simulateProgress();
            }, 30000); // Update every 30 seconds
        }
    }

    simulateProgress() {
        if (!this.currentOrder || this.currentOrder.status === 'delivered') return;

        const statuses = ['placed', 'preparing', 'ready', 'pickedup', 'delivered'];
        const currentIndex = statuses.indexOf(this.currentOrder.status);
        
        if (currentIndex < statuses.length - 1) {
            // 80% chance to progress to next stage
            if (Math.random() < 0.8) {
                const nextStatus = statuses[currentIndex + 1];
                this.updateOrderStatus(nextStatus);
            }
        }
    }

    updateOrderStatus(newStatus) {
        this.currentOrder.status = newStatus;
        this.currentOrder[`${newStatus}Time`] = new Date().toISOString();
        
        // Save to localStorage
        const orderIndex = this.orders.findIndex(order => order.id === this.currentOrder.id);
        if (orderIndex !== -1) {
            this.orders[orderIndex] = this.currentOrder;
            localStorage.setItem('faithcafe_orders', JSON.stringify(this.orders));
        }
        
        this.displayCurrentOrder();
        
        // Show notification for status change
        this.showStatusNotification(newStatus);
    }

    showStatusNotification(status) {
        const messages = {
            'preparing': 'Your order is now being prepared! 👨‍🍳',
            'ready': 'Your order is ready for pickup! ✅',
            'pickedup': 'Your order has been picked up and is on the way! 🚗',
            'delivered': 'Your order has been delivered! Enjoy! 🎉'
        };

        if (messages[status]) {
            showNotification(messages[status]);
        }
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} min ago`;
        
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    showNoOrdersMessage() {
        const trackingSection = document.querySelector('.tracking-section');
        if (trackingSection) {
            trackingSection.innerHTML = `
                <div class="no-orders-message">
                    <div class="no-orders-icon">📦</div>
                    <h3>No Active Orders</h3>
                    <p>You don't have any active orders at the moment.</p>
                    <a href="menu.html" class="btn">Order Now</a>
                </div>
            `;
        }
    }
}

// Initialize delivery tracker when page loads
document.addEventListener('DOMContentLoaded', function() {
    new DeliveryTracker();
});

// Function to create a new order (to be called from checkout)
function createNewOrder(cartItems, totalAmount, deliveryInfo) {
    const orders = JSON.parse(localStorage.getItem('faithcafe_orders') || '[]');
    
    const newOrder = {
        id: 'FC' + Date.now().toString().slice(-6),
        items: cartItems,
        total: totalAmount,
        status: 'placed',
        orderTime: new Date().toISOString(),
        placedTime: new Date().toISOString(),
        deliveryAddress: deliveryInfo.address,
        contactNumber: deliveryInfo.phone
    };

    orders.push(newOrder);
    localStorage.setItem('faithcafe_orders', JSON.stringify(orders));
    
    return newOrder;
}