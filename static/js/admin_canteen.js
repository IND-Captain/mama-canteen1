document.addEventListener('DOMContentLoaded', () => {
    const menuItemsList = document.getElementById('menuItemsList');
    const menuItemForm = document.getElementById('menuItemForm');
    const formTitle = document.getElementById('formTitle');
    const cancelBtn = document.getElementById('cancelBtn');
    let editingItemId = null;

    // --- UTILITY FUNCTIONS ---
    const showAlert = window.showAlert || ((msg, type) => console.log(`${type}: ${msg}`));

    // --- API FUNCTIONS ---
    async function fetchMenuItems() {
        try {
            const response = await fetch('/api/canteen/menu');
            if (!response.ok) throw new Error('Failed to fetch menu items');
            const items = await response.json();
            renderMenuItems(items);
        } catch (error) {
            showAlert(error.message, 'danger');
            menuItemsList.innerHTML = `<div class="empty-state"><h3>Could not load menu</h3><p>Please try refreshing the page.</p></div>`;
        }
    }

    async function saveMenuItem(itemData) {
        const isEditing = editingItemId !== null;
        const url = isEditing ? `/api/admin/canteen/menu/${editingItemId}` : '/api/admin/canteen/menu';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(itemData),
            });

            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showAlert(`Item ${isEditing ? 'updated' : 'added'} successfully!`, 'success');
            resetForm();
            fetchMenuItems(); // Refresh the list
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    }

    async function deleteMenuItem(itemId) {
        if (!confirm('Are you sure you want to delete this item? This action cannot be undone.')) return;

        try {
            const response = await fetch(`/api/admin/canteen/menu/${itemId}`, { method: 'DELETE' });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showAlert('Item deleted successfully!', 'success');
            fetchMenuItems(); // Refresh the list
        } catch (error) {
            showAlert(error.message, 'danger');
        }
    }

    // --- RENDER FUNCTIONS ---
    function renderMenuItems(items) {
        if (items.length === 0) {
            menuItemsList.innerHTML = `<div class="empty-state"><div class="empty-icon"><i class="fas fa-utensils"></i></div><h3>No Menu Items</h3><p>Add your first item using the form.</p></div>`;
            return;
        }

        menuItemsList.innerHTML = items.map(item => `
            <div class="menu-item-admin">
                <div class="item-info">
                    <img src="${item.image}" alt="${item.name}" class="item-image-admin">
                    <div class="item-details">
                        <h4>${item.name}</h4>
                        <p>₹${item.price} • Stock: ${item.stock}</p>
                    </div>
                </div>
                <div class="item-actions">
                    <button class="btn btn-sm btn-secondary" data-item-id="${item.id}" data-action="edit">Edit</button>
                    <button class="btn btn-sm btn-danger" data-item-id="${item.id}" data-action="delete">Delete</button>
                </div>
            </div>
        `).join('');
    }

    // --- FORM HANDLING ---
    function populateForm(item) {
        editingItemId = item.id;
        document.getElementById('itemId').value = item.id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemCategory').value = item.category;
        document.getElementById('itemType').value = item.type;
        document.getElementById('itemPrice').value = item.price;
        document.getElementById('itemStock').value = item.stock; document.getElementById('itemDescription').value = item.description;
        document.getElementById('itemImage').value = item.image;
        document.getElementById('itemBadge').value = item.badge || '';
        formTitle.textContent = 'Edit Item';
        menuItemForm.querySelector('button[type="submit"]').textContent = 'Update Item';
    }

    function resetForm() {
        editingItemId = null;
        menuItemForm.reset();
        formTitle.textContent = 'Add New Item';
        menuItemForm.querySelector('button[type="submit"]').textContent = 'Save Item';
    }

    // --- EVENT LISTENERS ---
    menuItemForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const itemData = {
            name: document.getElementById('itemName').value,
            category: document.getElementById('itemCategory').value,
            price: parseFloat(document.getElementById('itemPrice').value), 
            stock: parseInt(document.getElementById('itemStock').value),
            description: document.getElementById('itemDescription').value,
            image: document.getElementById('itemImage').value,
            badge: document.getElementById('itemBadge').value,
        };
        saveMenuItem(itemData);
    });

    cancelBtn.addEventListener('click', resetForm);

    menuItemsList.addEventListener('click', async (e) => {
        const target = e.target;
        const action = target.dataset.action;
        const itemId = target.dataset.itemId;

        if (!action || !itemId) return;

        if (action === 'edit') {
            // Fetch the single item's full data to populate the form accurately
            try {
                const response = await fetch('/api/canteen/menu');
                if (!response.ok) throw new Error('Failed to fetch item details');
                const items = await response.json();
                const itemToEdit = items.find(item => item.id == itemId);
                if (itemToEdit) {
                    populateForm(itemToEdit);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    showAlert('Could not find item to edit.', 'danger');
                }
            } catch (error) {
                showAlert(error.message, 'danger');
            }
        } else if (action === 'delete') {
            deleteMenuItem(itemId);
        }
    });

    // --- INITIALIZATION ---
    fetchMenuItems();
});