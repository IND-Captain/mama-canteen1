document.addEventListener('DOMContentLoaded', () => {
    let menuItems = [];

    let orders = []; // This will be populated from server-provided data

    let currentFilter = 'all';
    let currentVegFilter = 'all';

    let selectedPaymentMethod = null;

    let currentOrder = null;

    function showNotification(message, type = 'success') {
        if (window.showAlert) {
            window.showAlert(message, type);
        } else {
            console.log(`Notification (${type}): ${message}`);
        }
    }

    function saveMenuToStorage() {
        localStorage.setItem('canteenMenuItems', JSON.stringify(menuItems));
    }

    function loadMenuFromStorage() {
        const savedMenu = localStorage.getItem('canteenMenuItems');
        if (savedMenu) {
            try {
                const parsedMenu = JSON.parse(savedMenu);
                menuItems.forEach(item => {
                    const savedItem = parsedMenu.find(i => i.id === item.id);
                    if (savedItem) {
                        item.quantity = savedItem.quantity || 0;
                    }
                });
            } catch (err) {
                console.error('Failed to parse saved menu', err);
            }
        }
    }

    function saveOrdersToStorage() {
        localStorage.setItem('orders', JSON.stringify(orders));
    }

    function initMenuPage() {
        const menuGrid = document.getElementById('menuGrid');
        if (!menuGrid) return;

        async function fetchAndRenderMenu() {
            try {
                const response = await fetch('/api/canteen/menu');
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                menuItems = data;
                loadMenuFromStorage();
                renderMenu();
                updateOrderSummary();
            } catch (error) {
                console.error("Could not fetch menu:", error);
                menuGrid.innerHTML = `<div class="empty-state"><h3>Could not load menu</h3><p>Please try refreshing the page.</p></div>`;
            }
        }

        const orderItems = document.getElementById('orderItems');
        const proceedToCheckout = document.getElementById('proceedToCheckout');
        const filterButtons = document.querySelectorAll('.filter-btn');
        const vegNonvegButtons = document.querySelectorAll('.veg-nonveg-btn');

        function renderMenu() {
            let filtered = menuItems;

            if (currentFilter !== 'all') {
                filtered = filtered.filter(item => item.category === currentFilter);
            }
            if (currentVegFilter !== 'all') {
                filtered = filtered.filter(item => item.type === currentVegFilter);
            }

            menuGrid.innerHTML = '';
            if (filtered.length === 0) {
                menuGrid.innerHTML = `<div class="empty-state" tabindex="0" aria-live="polite" aria-atomic="true"> ... </div>`;
                return;
            }

            filtered.forEach(item => {
                const card = document.createElement('div');
                card.className = 'menu-item';
                card.setAttribute('aria-label', `${item.name} (${item.type === 'veg' ? 'Vegetarian' : 'Non-Vegetarian'}), Price: ${item.price} INR`);

                card.innerHTML = `
                    <img src="${item.image}" alt="${item.name}" loading="lazy" class="item-image" />
                    ${item.badge ? `<div class="item-badge">${item.badge}</div>` : ''}
                    <div class="veg-indicator ${item.type === 'veg' ? 'veg' : 'nonveg'}" aria-hidden="true">${item.type === 'veg' ? 'V' : 'NV'}</div>
                    <div class="item-content">
                        <div class="item-header">
                            <h3 class="item-title">${item.name}</h3>
                            <div class="item-rating" aria-label="Rating: ${item.rating} stars from ${item.reviews} reviews">
                                <i class="fas fa-star"></i> ${item.rating} (${item.reviews})
                            </div>
                        </div>
                        <p class="item-description">${item.description}</p>
                        <div class="item-footer">
                            <div class="item-price">${item.price} INR</div>
                            <div class="quantity-controls">
                                <button class="qty-btn" aria-label="Add ${item.name} to cart" ${item.stock === 0 || item.quantity >= item.stock ? 'disabled' : ''} data-id="${item.id}"><i class="fas fa-plus"></i></button>
                            </div>
                        </div>
                    </div>
                `;
                menuGrid.appendChild(card);
            });

            menuGrid.querySelectorAll('.qty-btn').forEach(btn => {
                btn.onclick = () => {
                    const id = parseInt(btn.dataset.id);
                    addToCart(id);
                };
            });
        }

        function addToCart(itemId) {
            const item = menuItems.find(i => i.id === itemId);
            if (!item) return;

            if (item.quantity < item.stock) {
                item.quantity++;
                showNotification(`${item.name} added to cart.`);
                updateOrderSummary();
                saveMenuToStorage();
                renderMenu();
            } else {
                showNotification(`Sorry, no more stock available for ${item.name}.`, 'warning');
            }
        }

        function updateOrderSummary() {
            const selected = menuItems.filter(i => i.quantity > 0);
            if (selected.length === 0) {
                orderItems.innerHTML = `
                    <div class="empty-state" tabindex="0" aria-live="polite" aria-atomic="true">
                        <div class="empty-icon"><i class="fas fa-shopping-cart"></i></div>
                        <h3>Your Dark Selection</h3>
                        <p>Choose from our midnight menu to add items.</p>
                    </div>`;
                proceedToCheckout.disabled = true;
                proceedToCheckout.setAttribute('aria-disabled', 'true');
                return;
            }

            let html = '';
            let total = 0;
            selected.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                html += `<div class="order-item" aria-label="${item.name}, Quantity: ${item.quantity}, Total Price: ${itemTotal} INR">
                    <span>${item.name} x${item.quantity}</span>
                    <span>${itemTotal} INR</span>
                </div>`;
            });
            html += `<div class="order-item"><strong>Total Amount</strong><strong>${total} INR</strong></div>`;
            orderItems.innerHTML = html;
            proceedToCheckout.disabled = false;
            proceedToCheckout.setAttribute('aria-disabled', 'false');
        }

        filterButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                filterButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentFilter = btn.dataset.filter;
                renderMenu();
            });
        });

        vegNonvegButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                vegNonvegButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentVegFilter = btn.dataset.veg;
                renderMenu();
            });
        });

        proceedToCheckout.addEventListener('click', () => {
            window.location.href = proceedToCheckout.dataset.url;
        });

        fetchAndRenderMenu();
    }

    function initOrdersPage() {
        const ordersContainer = document.getElementById('ordersContainer');
        if (!ordersContainer) return;
        
        // Use server-provided orders if available, otherwise initialize as empty
        // The 'My Orders' page should primarily display data from the backend.
        if (window.serverOrders && Array.isArray(window.serverOrders)) {
            orders = window.serverOrders;
        }

        function renderOrders() {
            if (orders.length === 0) {
                ordersContainer.innerHTML = `
                <div class="empty-state" tabindex="0" aria-live="polite" aria-atomic="true">
                    <div class="empty-icon"><i class="fas fa-moon"></i></div>
                    <h3>No dark orders yet</h3>
                    <p>Your midnight culinary journey awaits in the shadows!</p>
                </div>`;
                return;
            }

            ordersContainer.innerHTML = '';
            orders.forEach(order => {
                const card = document.createElement('div');
                card.className = 'order-card';

                // Map backend status to client-side progress and step activation
                let progressPercent = 0;
                let statusConfirmed = '';
                let statusCrafting = '';
                let statusReady = '';

                // Assuming 'Processing' is the initial status from the backend
                if (order.status === 'Processing') {
                    progressPercent = 33;
                    statusConfirmed = 'active';
                }
                // If the backend had more statuses (e.g., 'Preparing', 'Out for Delivery', 'Delivered'),
                // you would add more conditions here to activate subsequent steps.
                // Example:
                // else if (order.status === 'Preparing') { /* ... */ }
                // else if (order.status === 'Out for Delivery' || order.status === 'Delivered') { /* ... */ }

                card.innerHTML = `
                    <div class="order-header">
                        <span>Order #${order.order_id}</span>
                        <span>${new Date(order.created_at).toLocaleString()}</span>
                    </div>
                    <div class="progress-container" aria-label="Order progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${progressPercent}%;"></div>
                        </div>
                        <div class="progress-steps">
                            <div class="progress-step ${statusConfirmed}">
                                <div class="step-icon"><i class="fas fa-check"></i></div>
                                <span>Confirmed</span>
                            </div>
                            <div class="progress-step ${statusCrafting}">
                                <div class="step-icon"><i class="fas fa-utensils"></i></div>
                                <span>Shadow Crafting</span>
                            </div>
                            <div class="progress-step ${statusReady}">
                                <div class="step-icon"><i class="fas fa-moon"></i></div>
                                <span>Ready</span>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h4 style="color: var(--text-bright); margin: 15px 0 10px;">Dark Order Details</h4>
                        <ul class="order-items-list">
                            <!-- Order items are not fetched by my_orders_page for brevity. -->
                            <!-- You can view full details including items on the order details page. -->
                            <li><a href="/order/${order.order_id}">View Order Details</a></li>
                        </ul>
                    </div>
                    <div class="order-total">Total ${order.total_amount} INR</div>
                `;
                ordersContainer.appendChild(card);
            });
        }

        renderOrders();
    }

    function initCheckoutPage() {
        const checkoutForm = document.getElementById('checkoutForm');
        if (!checkoutForm) return;

        const checkoutItems = document.getElementById('checkoutItems');
        const checkoutTotal = document.getElementById('checkoutTotal');
        const payButton = document.getElementById('payButton');
        const receiptModal = document.getElementById('receiptModal');
        const receiptItems = document.getElementById('receiptItems');
        const receiptTotal = document.getElementById('receiptTotal');

        const formSections = document.querySelectorAll('.form-section');
        const steps = document.querySelectorAll('.step');

        const paymentOptions = document.querySelectorAll('.payment-option');
        const continueToPaymentBtn = document.getElementById('continueToPaymentBtn');
        const backToStep1Btn = document.getElementById('backToStep1Btn');
        const orderAgainBtn = document.getElementById('orderAgainBtn');
        const viewReceiptBtn = document.getElementById('viewReceiptBtn');
        const closeReceiptBtn = document.getElementById('closeReceipt');

        const cardPaymentForm = document.getElementById('cardPayment');
        const upiPaymentForm = document.getElementById('upiPayment');
        const membershipPaymentForm = document.getElementById('membershipPayment');

        const cardNumberInput = document.getElementById('cardNumber');
        const cardNameInput = document.getElementById('cardName');
        const expiryDateInput = document.getElementById('expiryDate');
        const cvvInput = document.getElementById('cvv');
        const upiIdInput = document.getElementById('upiId');
        const membershipIdInput = document.getElementById('membershipId');
        const membershipPinInput = document.getElementById('membershipPin');
        
        const paymentProcessingSection = document.getElementById('paymentProcessingSection');
        const orderReviewSection = document.getElementById('orderReviewSection');
        const paymentSection = document.getElementById('paymentSection');

        const confirmedOrderIdElem = document.getElementById('confirmedOrderId');
        const confirmedOrderTotalElem = document.getElementById('confirmedOrderTotal');

        function goToStep(stepNumber) {
            formSections.forEach((section, idx) => {
                section.classList.toggle('active', idx === stepNumber - 1);
            });
            steps.forEach((step, idx) => {
                step.classList.toggle('active', idx < stepNumber);
            });
            if (stepNumber === 1) {
                resetPaymentSelection();
            }
        }

        function renderCheckout() {
            const selected = menuItems.filter(i => i.quantity > 0);
            if (selected.length === 0) {
                checkoutItems.innerHTML = '<p>No items in your cart. <a href="/">Return to menu</a>.</p>';
                checkoutTotal.textContent = '0';
                continueToPaymentBtn.disabled = true;
                return;
            }

            let html = '';
            let total = 0;
            selected.forEach(item => {
                const itemTotal = item.price * item.quantity;
                total += itemTotal;
                html += `
                    <div class="checkout-item" aria-label="${item.name}, Quantity: ${item.quantity}, Price each: ${item.price} INR">
                        <div class="item-details">
                            <img src="${item.image}" alt="${item.name}" class="item-image-small" />
                            <div class="item-name">${item.name}</div>
                        </div>
                        <div class="checkout-controls">
                            <button type="button" class="qty-btn" aria-label="Decrease quantity of ${item.name}" ${item.quantity <= 1 ? 'disabled' : ''} data-id="${item.id}" data-change="-1"><i class="fas fa-minus"></i></button>
                            <span class="quantity" aria-live="polite">${item.quantity}</span>
                            <button type="button" class="qty-btn" aria-label="Increase quantity of ${item.name}" ${item.quantity >= item.stock ? 'disabled' : ''} data-id="${item.id}" data-change="1"><i class="fas fa-plus"></i></button>
                        </div>
                        <div class="item-price-small">${itemTotal} INR</div>
                    </div>
                `;
            });

            checkoutItems.innerHTML = html;
            checkoutTotal.textContent = total;
            continueToPaymentBtn.disabled = false;

            checkoutItems.querySelectorAll('.qty-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const id = parseInt(btn.dataset.id);
                    const change = parseInt(btn.dataset.change);
                    updateCheckoutQuantity(id, change);
                });
            });
        }

        function updateCheckoutQuantity(itemId, change) {
            const item = menuItems.find(i => i.id === itemId);
            if (!item) return;

            const newQty = item.quantity + change;
            if (newQty >= 0 && newQty <= item.stock) {
                item.quantity = newQty;
                saveMenuToStorage();
                renderCheckout();
            }
        }

        function selectPayment(method) {
            selectedPaymentMethod = method;
            paymentOptions.forEach(option => {
                const isSelected = option.dataset.method === method;
                option.classList.toggle('selected', isSelected);
                option.setAttribute('aria-checked', isSelected ? 'true' : 'false');
            });
            cardPaymentForm.style.display = method === 'card' ? 'block' : 'none';
            upiPaymentForm.style.display = method === 'upi' ? 'block' : 'none';
            membershipPaymentForm.style.display = method === 'membership' ? 'block' : 'none';
            validatePaymentForm();
        }

        function resetPaymentSelection() {
            selectedPaymentMethod = null;
            paymentOptions.forEach(option => option.classList.remove('selected'));
            cardPaymentForm.style.display = 'none';
            upiPaymentForm.style.display = 'none';
            membershipPaymentForm.style.display = 'none';
            [cardNumberInput, cardNameInput, expiryDateInput, cvvInput, upiIdInput, membershipIdInput, membershipPinInput].forEach(input => input.value = '');
            payButton.disabled = true;
        }

        function validatePaymentForm() {
            let isValid = false;
            if (!selectedPaymentMethod) {
                isValid = false;
            } else if (selectedPaymentMethod === 'card') {
                const cardNumValid = /^\d{13,19}$/.test(cardNumberInput.value.replace(/\s+/g, ''));
                const nameValid = cardNameInput.value.trim().length > 0;
                const expiryValid = /^(0[1-9]|1[0-2])\/\d{2}$/.test(expiryDateInput.value);
                const cvvValid = /^\d{3,4}$/.test(cvvInput.value);
                isValid = cardNumValid && nameValid && expiryValid && cvvValid;
            } else if (selectedPaymentMethod === 'upi') {
                isValid = upiIdInput.value.trim().length > 0;
            } else if (selectedPaymentMethod === 'membership') {
                const idValid = membershipIdInput.value.trim().length > 0;
                const pinValid = membershipPinInput.value.trim().length > 0;
                isValid = idValid && pinValid;
            }
            payButton.disabled = !isValid;
        }

        function processPayment() {
            payButton.disabled = true;
            payButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing...';

            orderReviewSection.style.display = 'none';
            paymentSection.style.display = 'none';
            paymentProcessingSection.classList.add('active');

            const animStep1 = document.getElementById('anim-step-1');
            const animStep2 = document.getElementById('anim-step-2');
            const animStep3 = document.getElementById('anim-step-3');
            const processingTitle = document.getElementById('processingTitle');

            setTimeout(() => {
                animStep1.classList.add('active');
                processingTitle.textContent = 'Order Confirmed!';
            }, 1000);

            setTimeout(() => {
                animStep2.classList.add('active');
                processingTitle.textContent = 'Preparing Your Meal...';
            }, 2500);

            setTimeout(() => {
                animStep3.classList.add('active');
                processingTitle.textContent = 'Your Order is on its Way!';
            }, 4000);

            setTimeout(() => {
                const selected = menuItems.filter(i => i.quantity > 0);
                if (selected.length === 0) {
                    showNotification('No items in your cart to place order.', 'warning');
                    goToStep(1);
                    return;
                }

                const total = selected.reduce((sum, item) => sum + item.price * item.quantity, 0);
                const orderId = 'DRK' + (Math.floor(100 + Math.random() * 900));

                currentOrder = {
                    id: orderId,
                    customer: "Dark User",
                    items: selected.map(item => ({ name: item.name, quantity: item.quantity, price: item.price })),
                    total: total,
                    status: 'confirmed',
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    progress: 33
                };

                orders.push(currentOrder);

                selected.forEach(item => {
                    item.stock -= item.quantity;
                    item.quantity = 0;
                });

                saveOrdersToStorage();
                saveMenuToStorage();

                confirmedOrderIdElem.textContent = currentOrder.id;
                confirmedOrderTotalElem.textContent = currentOrder.total;

                paymentProcessingSection.classList.remove('active');
                goToStep(3);
                showNotification('Payment successful! Your order has been placed.');
            }, 5500);
        }

        function showReceipt(order) {
            receiptItems.innerHTML = '';
            order.items.forEach(item => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${item.name} x${item.quantity}</span><strong>${item.price * item.quantity} INR</strong>`;
                receiptItems.appendChild(li);
            });
            receiptTotal.textContent = `Total: ${order.total} INR`;
            receiptModal.style.display = 'flex';
            receiptModal.focus();
        }

        function closeReceipt() {
            receiptModal.style.display = 'none';
        }

        continueToPaymentBtn.addEventListener('click', () => goToStep(2));
        backToStep1Btn.addEventListener('click', () => goToStep(1));
        paymentOptions.forEach(option => {
            option.addEventListener('click', () => selectPayment(option.dataset.method));
        });
        [cardNumberInput, cardNameInput, expiryDateInput, cvvInput, upiIdInput, membershipIdInput, membershipPinInput].forEach(input => {
            input.addEventListener('input', validatePaymentForm);
        });
        payButton.addEventListener('click', processPayment);
        orderAgainBtn.addEventListener('click', () => {
            window.location.href = orderAgainBtn.dataset.url;
        });
        viewReceiptBtn.addEventListener('click', () => {
            if (currentOrder) {
                showReceipt(currentOrder);
            } else {
                showNotification('No order to show receipt for.', 'warning');
            }
        });
        closeReceiptBtn.addEventListener('click', closeReceipt);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && receiptModal.style.display === 'flex') {
                closeReceipt();
            }
        });

        renderCheckout();
        goToStep(1);
    }

    loadMenuFromStorage();

    if (document.body.classList.contains('page-canteen-menu')) {
        initMenuPage();
    } else if (document.body.classList.contains('page-canteen-orders')) {
        initOrdersPage();
    } else if (document.body.classList.contains('page-canteen-checkout')) {
        initCheckoutPage();
    }
});