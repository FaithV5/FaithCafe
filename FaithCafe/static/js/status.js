// Delivery Status Tracking System
class DeliveryTracker {
    constructor() {
        this.currentOrder = null;
        this.orders = [];
        this.init();
    }

    async init() {
        await this.loadOrders();
        this.loadCurrentOrder();
        this.displayOrderHistory();
        this.startAutoRefresh();
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

    loadCurrentOrder() {
        const currentUser = getCurrentUser();
        if (!currentUser) {
            this.showNoOrdersMessage();
            return;
        }

        

        // Get orders for current user
            const uname = (currentUser.username || '').toString().toLowerCase();
            const userOrders = this.orders.filter(order => ((order.customer || '').toString().toLowerCase() === uname));
        
        
        if (userOrders.length === 0) {
            this.showNoOrdersMessage();
            return;
        }

            // Get the most recent order that's not delivered, completed, or cancelled
            const activeOrders = userOrders.filter(order => 
                order.status !== 'delivered' && order.status !== 'completed' && order.status !== 'cancelled'
            );
        
        

        // Only show most recent ACTIVE order; if none, show no active orders
        if (activeOrders.length > 0) {
            this.currentOrder = activeOrders.reduce((latest, order) =>
                new Date(order.orderTime) > new Date(latest.orderTime) ? order : latest
            );
            
            this.displayCurrentOrder();
        } else {
            this.currentOrder = null;
            
            this.showNoOrdersMessage();
        }
    }

    displayCurrentOrder() {
        if (!this.currentOrder) {
            this.showNoOrdersMessage();
            return;
        }

        

        // Update order number
        const orderNumberElement = document.getElementById('current-order-number');
        if (orderNumberElement) {
            orderNumberElement.textContent = this.currentOrder.id;
        }
        
        // Update order items
        this.displayOrderItems();

        // Add View Receipt button in actions area
        const actionsEl = document.getElementById('order-actions');
        if (actionsEl) {
            actionsEl.innerHTML = '';
            const btn = document.createElement('button');
            btn.className = 'btn btn-secondary';
            btn.id = 'view-receipt-btn';
            btn.textContent = 'View Receipt';
            btn.addEventListener('click', () => {
                try {
                    openReceiptWindow(this.currentOrder, getCurrentUser());
                } catch (e) {
                    alert(buildOrderReceiptText(this.currentOrder));
                }
            });
            actionsEl.appendChild(btn);
        }
        
        // Update delivery information
        this.updateDeliveryInfo();
        
        // Update progress steps
        this.updateProgressSteps();
        
        // Update ETA
        this.updateETA();
        
        // Add completed button if delivered
        this.addCompletedButton();
    }

    displayOrderItems() {
        const itemsList = document.getElementById('order-items-list');
        const totalAmount = document.getElementById('order-total-amount');
        
        if (!itemsList || !this.currentOrder) return;

        let itemsHTML = '';
        let subtotal = 0;

        this.currentOrder.items.forEach(item => {
            const itemTotal = item.price * item.quantity;
            subtotal += itemTotal;
            itemsHTML += `
                <div class="order-item">
                    <span class="item-name">${item.quantity}x ${item.name}</span>
                    <span class="item-price">₱${itemTotal.toFixed(2)}</span>
                </div>
            `;
        });

        // Determine shipping fee: prefer explicit value, otherwise infer from payment method
        let shippingFee = 0;
        if (typeof this.currentOrder.shippingFee === 'number') {
            shippingFee = this.currentOrder.shippingFee;
        } else if (this.currentOrder.paymentMethod) {
            const pm = (this.currentOrder.paymentMethod || '').toString().toLowerCase();
            if (pm === 'cash') shippingFee = 30;
            else if (pm === 'card' || pm === 'gcash') shippingFee = 15;
        }

        const expectedTotal = subtotal + shippingFee;
        let displayedTotal;
        if (typeof this.currentOrder.total === 'number' && this.currentOrder.total >= expectedTotal) {
            displayedTotal = this.currentOrder.total;
        } else {
            displayedTotal = expectedTotal;
        }

        itemsList.innerHTML = itemsHTML;
        if (totalAmount) {
            totalAmount.textContent = displayedTotal.toFixed(2);
        }
    }

    updateDeliveryInfo() {
        const user = getCurrentUser();
        
        if (user) {
            const deliveryAddress = document.getElementById('delivery-address');
            const contactNumber = document.getElementById('contact-number');
            
            if (deliveryAddress) {
                deliveryAddress.textContent = this.currentOrder.deliveryAddress || user.address || 'Not specified';
            }
            if (contactNumber) {
                contactNumber.textContent = this.currentOrder.contactNumber || user.contactNumber || 'Not specified';
            }
        }

        // Show rider info if assigned
        const riderName = document.getElementById('rider-name');
        const riderContact = document.getElementById('rider-contact');
    const paymentMethodEl = document.getElementById('payment-method');
        
        if (riderName && riderContact) {
            if (this.currentOrder.rider) {
                riderName.textContent = this.currentOrder.rider.name;
                riderContact.textContent = this.currentOrder.rider.contact;
            } else if (this.currentOrder.status === 'ready' || this.currentOrder.status === 'pickedup' || this.currentOrder.status === 'delivered') {
                riderName.textContent = 'Assigning rider...';
                riderContact.textContent = '-';
            } else {
                riderName.textContent = 'Rider will be assigned when order is ready';
                riderContact.textContent = '-';
            }
        }
        // Show payment method if available
        if (paymentMethodEl) {
            const pm = this.currentOrder.paymentMethod || this.currentOrder.payment || 'Not specified';
            // normalize display value
            const display = (pm === 'gcash') ? 'GCash' : (pm === 'card') ? 'Card' : (pm === 'cash') ? 'Cash' : pm;
            paymentMethodEl.textContent = display;
        }
    }

    updateProgressSteps() {
        if (!this.currentOrder) return;

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
                    } else {
                        timeElement.textContent = '-';
                    }
                } else {
                    stepElement.classList.remove('active');
                    timeElement.textContent = '-';
                }
            }
        });
    }

    updateETA() {
        if (!this.currentOrder) return;

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
        
        const etaElement = document.getElementById('eta-time');
        if (etaElement) {
            etaElement.textContent = eta;
        }
    }

    addCompletedButton() {
        if (!this.currentOrder) return;

        // If order is picked up, allow customer to confirm delivery
        if (this.currentOrder.status === 'pickedup') {
            if (document.getElementById('confirm-delivered-btn')) return;

            const deliveryInfo = document.querySelector('.delivery-info');
            if (!deliveryInfo) return;

            const buttonContainer = document.createElement('div');
            buttonContainer.className = 'completed-button-container';

            const confirmBtn = document.createElement('button');
            confirmBtn.id = 'confirm-delivered-btn';
            confirmBtn.className = 'btn btn-primary complete-order-btn';
            confirmBtn.textContent = 'Confirm Delivery';
            confirmBtn.addEventListener('click', async () => {
                if (confirm('Confirm that you have received this order?')) {
                    await this.confirmDelivered();
                }
            });

            buttonContainer.appendChild(confirmBtn);
            deliveryInfo.parentNode.insertBefore(buttonContainer, deliveryInfo.nextSibling);
            return;
        }

        // If order is delivered, allow customer to mark as completed (move to history)
        if (this.currentOrder.status !== 'delivered') return;

        // Check if delivered-complete button already exists
        if (document.getElementById('complete-order-btn')) return;
        
        // Find the delivery info section to add button after it
        const deliveryInfo = document.querySelector('.delivery-info');
        if (!deliveryInfo) return;
        
    // Create completed button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'completed-button-container';
        
    const completeBtn = document.createElement('button');
    completeBtn.id = 'complete-order-btn';
    completeBtn.className = 'btn btn-primary complete-order-btn';
    completeBtn.textContent = 'Mark as Completed';
        
        completeBtn.addEventListener('click', async () => {
            if (confirm('Mark this order as completed? This will move it to your order history.')) {
                await this.completeOrder();
            }
        });
        
        buttonContainer.appendChild(completeBtn);
        deliveryInfo.parentNode.insertBefore(buttonContainer, deliveryInfo.nextSibling);
    }

    async confirmDelivered() {
        if (!this.currentOrder) return;
        try {
            // Update order status to delivered via the shared update function
            await updateOrderStatus(this.currentOrder.id, 'delivered');

            // Update local currentOrder and timestamps
            this.currentOrder.status = 'delivered';
            this.currentOrder.deliveredTime = new Date().toISOString();

            // Save to session cache (updateOrders will handle persistence)
            const orders = await getOrders();
            const idx = orders.findIndex(o => o.id === this.currentOrder.id);
            if (idx !== -1) {
                orders[idx] = this.currentOrder;
                await saveOrdersToStorage(orders);
            }

            showNotification('Order status updated to Delivered', 'success');

            // Refresh UI
            await this.loadOrders();
            this.loadCurrentOrder();
            this.displayOrderHistory();
            this.displayCurrentOrder();
        } catch (error) {
            console.error('Error confirming delivery:', error);
            alert('Failed to confirm delivery. Please try again.');
        }
    }

    async completeOrder() {
        if (!this.currentOrder) return;
        
        try {
            // Update order status to completed
            await updateOrderStatus(this.currentOrder.id, 'completed');
            
            // Mark completed time
            this.currentOrder.status = 'completed';
            this.currentOrder.completedTime = new Date().toISOString();
            
            // Save updated orders
            const orders = await getOrders();
            const orderIndex = orders.findIndex(o => o.id === this.currentOrder.id);
            if (orderIndex !== -1) {
                orders[orderIndex] = this.currentOrder;
                await saveOrdersToStorage(orders);
            }
            
            alert('Order marked as completed! Thank you for your order.');
            
            // Refresh UI without full reload: clear current order and show no active orders
            this.currentOrder = null;
            await this.loadOrders();
            this.showNoOrdersMessage();
            this.displayOrderHistory();
        } catch (error) {
            console.error('Error completing order:', error);
            alert('Failed to complete order. Please try again.');
        }
    }

    displayOrderHistory() {
        const historyList = document.getElementById('order-history-list');
        if (!historyList) return;

        const currentUser = getCurrentUser();
        if (!currentUser) {
            historyList.innerHTML = '<p class="no-orders">Please login to view order history.</p>';
            return;
        }

    // Filter orders for current user (case-insensitive)
    const uname = (currentUser.username || '').toString().toLowerCase();
    const userOrders = this.orders.filter(order => ((order.customer || '').toString().toLowerCase() === uname));

        if (userOrders.length === 0) {
            historyList.innerHTML = '<p class="no-orders">No previous orders found.</p>';
            return;
        }

        let historyHTML = '';
        
        // Sort orders by most recent first
        const sortedOrders = userOrders.sort((a, b) => new Date(b.orderTime) - new Date(a.orderTime));
        
        sortedOrders.forEach(order => {
            // Only show delivered, completed, or cancelled orders in history
            if (order.status === 'delivered' || order.status === 'completed' || order.status === 'cancelled') {
                historyHTML += this.createOrderHistoryCard(order);
            }
        });

        historyList.innerHTML = historyHTML || '<p class="no-orders">No completed orders yet.</p>';
    }

    createOrderHistoryCard(order) {
        const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        // Determine shipping fee (explicit or inferred)
        let shippingFee = 0;
        if (typeof order.shippingFee === 'number') {
            shippingFee = order.shippingFee;
        } else if (order.paymentMethod) {
            const pm = (order.paymentMethod || '').toString().toLowerCase();
            if (pm === 'cash') shippingFee = 30;
            else if (pm === 'card' || pm === 'gcash') shippingFee = 15;
        }
        const expectedTotal = subtotal + shippingFee;
        const displayedTotal = (typeof order.total === 'number' && order.total >= expectedTotal) ? order.total : expectedTotal;
        const statusClass = order.status === 'cancelled' ? 'cancelled' : order.status === 'completed' ? 'completed' : 'delivered';
        const statusText = order.status === 'cancelled' ? 'Cancelled' : order.status === 'completed' ? 'Completed' : 'Delivered';
        
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
                    <span class="order-total">₱${displayedTotal.toFixed(2)}</span>
                    <span class="order-status ${statusClass}">${statusText}</span>
                    <button class="btn btn-secondary view-history-receipt" onclick="viewOrderReceipt('${order.id}')">View Receipt</button>
                </div>
            </div>
        `;
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

    // Add auto-refresh to check for status updates from staff
    startAutoRefresh() {
        // Refresh orders every 10 seconds to check for updates from staff
        setInterval(async () => {
            console.log('Auto-refreshing orders...');
            await this.loadOrders();
            this.loadCurrentOrder();
            this.displayOrderHistory();
        }, 10000);
    }
}

// Initialize delivery tracker when page loads
document.addEventListener('DOMContentLoaded', function() {
    new DeliveryTracker();
});