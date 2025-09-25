window.addEventListener('load', () => {
    const header = document.getElementById('header');
    const menuToggle = document.getElementById('menuToggle');
    const mobileSidebar = document.getElementById('mobileSidebar');
    const mobileOverlay = document.getElementById('mobileOverlay');
    const body = document.body;
    const desktopSidebar = document.querySelector('.desktop-sidebar');
    const darkModeToggle = document.getElementById('darkModeToggle');
    const sidebarPinToggle = document.getElementById('sidebarPinToggle');
    const backToTopBtn = document.getElementById('back-to-top-btn');

    // Centralized Page Initializers
    const pageInitializers = {
        'page-home': initializeHomepageAndGrid,
        'page-get-involved': initializeAuthForms,
        'page-faqs': initializeFaqs,
        'page-contact': initializeContactForm,
        'page-reset-password': initializeResetPasswordForm,
        'page-my-profile': initializeProfilePage, 
        'page-admin-dashboard': initializeAdminDashboard,
        'page-cart': initializeCartPage,
        'page-product-detail': initializeAddToCartForms
    };

    // Run initializers for the current page
    for (const pageClass in pageInitializers) {
        if (body.classList.contains(pageClass)) {
            pageInitializers[pageClass]();
        }
    }

    // --- Global Alert System ---
    window.showAlert = (message, type = 'success') => {
        const alertContainer = document.getElementById('global-alert-container');
        if (!alertContainer) return;

        // Map flash categories to Bootstrap alert types
        const bsType = {
            'danger': 'danger',
            'success': 'success',
            'warning': 'warning',
            'info': 'info'
        }[type] || 'primary';

        const wrapper = document.createElement('div');
        wrapper.innerHTML = `
            <div class="alert alert-${bsType} alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        const alertElement = wrapper.firstChild;
        alertContainer.append(alertElement);

        // Automatically dismiss after a few seconds
        const bsAlert = new bootstrap.Alert(alertElement);
        setTimeout(() => bsAlert.close(), 5000);
    };

    // --- Form Validation Helpers ---
    function showError(inputElement, message) {
        const formGroup = inputElement.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('invalid');
            const errorElement = formGroup.querySelector('.error-message');
            if (errorElement) {
                errorElement.textContent = message;
            }
        }
    }

    function clearError(inputElement) {
        const formGroup = inputElement.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('invalid');
            const errorElement = formGroup.querySelector('.error-message');
            if (errorElement) {
                errorElement.textContent = '';
            }
        }
    }

    function isValidEmail(email) {
        // A simple regex for email validation
        const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(String(email).toLowerCase());
    }

    function initializeScrollAnimations() { 
        const animatedElements = document.querySelectorAll('.animate-on-scroll'); 
        if (animatedElements.length > 0) { 
            const observer = new IntersectionObserver((entries) => { 
                entries.forEach(entry => { 
                    if (entry.isIntersecting) { 
                        // Staggered delay for grid items
                        const delay = (entry.target.dataset.staggerIndex || 0) * 100;
                        setTimeout(() => entry.target.classList.add('in-view'), delay);
                        // Keep observing to re-animate if scrolled out and back in
                        // observer.unobserve(entry.target); // Uncomment to animate only once
                    } 
                }); 
            }, { threshold: 0.2, rootMargin: "0px 0px -50px 0px" }); // Trigger a bit earlier 
 
            animatedElements.forEach((el, index) => {
                observer.observe(el);
            }); 
        } 
    }

    function initializeHomepageAndGrid() {
        // --- Animated Counters ---
        const statsSection = document.querySelector('.stats-section');
        if (statsSection) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const counters = statsSection.querySelectorAll('.stat-number');
                        counters.forEach(counter => {
                            const target = +counter.getAttribute('data-target');
                            let current = 0;
                            const increment = target / 100; // Adjust speed of animation

                            const updateCounter = () => {
                                if (current < target) {
                                    current += increment;
                                    counter.innerText = Math.ceil(current).toLocaleString();
                                    requestAnimationFrame(updateCounter);
                                } else {
                                    counter.innerText = target.toLocaleString();
                                }
                            };
                            updateCounter();
                        });
                        observer.unobserve(statsSection); // Animate only once
                    }
                });
            }, { threshold: 0.5 });
            observer.observe(statsSection);
        }
        
        // --- Product Grid Filtering and Sorting ---
        const controls = document.querySelector('.product-controls');
        if (!controls) return;

        const filterButtons = controls.querySelectorAll('.filter-btn');
        const sortSelect = document.getElementById('sort-by');
        const productGrid = document.querySelector('.product-grid-3');
        let productItems = Array.from(productGrid.querySelectorAll('.product-item'));

        const updateGrid = () => {
            // 1. Filtering
            const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
            productItems.forEach(item => {
                const itemCategory = item.dataset.category;
                const isVisible = (activeFilter === 'all' || itemCategory === activeFilter);
                item.classList.toggle('hide', !isVisible);
            });

            // 2. Sorting
            const sortValue = sortSelect.value;
            let visibleItems = productItems.filter(item => !item.classList.contains('hide'));

            if (sortValue !== 'default') {
                visibleItems.sort((a, b) => {
                    const valA = a.dataset[sortValue.split('-')[0]];
                    const valB = b.dataset[sortValue.split('-')[0]];
                    const direction = sortValue.endsWith('asc') ? 1 : -1;

                    if (sortValue.startsWith('price')) {
                        return (parseFloat(valA) - parseFloat(valB)) * direction;
                    } else { // name
                        return valA.localeCompare(valB) * direction;
                    }
                });
            } else {
                // Revert to original DOM order if "Default" is selected
                visibleItems.sort((a, b) => {
                    return productItems.indexOf(a) - productItems.indexOf(b);
                });
            }

            // 3. Re-append to grid
            visibleItems.forEach(item => productGrid.appendChild(item));
        };

        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                updateGrid();
            });
        });

        sortSelect.addEventListener('change', updateGrid);

        // Make product cards clickable
        productGrid.addEventListener('click', (e) => {
            // Find the card that was clicked on, if any
            const card = e.target.closest('.clickable-card');
            if (!card) return;

            // Check if the click was on a button, a link, or inside a form
            const isInteractive = e.target.closest('button, a, form');

            // If not an interactive element, navigate
            if (!isInteractive) {
                const href = card.dataset.href;
                if (href) window.location.href = href;
            }
        });

        initializeAddToCartForms();
    }

    function initializeAddToCartForms() {
        document.querySelectorAll('form[action*="/add-to-cart/"]').forEach(form => {
            form.addEventListener('submit', async (e) => {
                e.preventDefault(); // Stop the default form submission
                
                const formData = new FormData(form);
                const url = form.getAttribute('action');

                try {
                    const response = await fetch(url, {
                        method: 'POST',
                        body: formData,
                        headers: {
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data.success) {
                        showAlert(data.message || 'Item added to cart!', 'success');
                        // Update cart count in header
                        const cartBadge = document.querySelector('.cta-button .badge');
                        const currentCount = parseInt(cartBadge.textContent || '0');
                        const newCount = currentCount + parseInt(formData.get('quantity'));
                        cartBadge.textContent = newCount;
                        cartBadge.style.display = newCount > 0 ? 'block' : 'none';
                    } else {
                        showAlert(data.message || 'Could not add item.', 'danger');
                    }
                } catch (error) {
                    console.error('Add to cart fetch error:', error);
                    showAlert('Could not add item to cart. Please try again.', 'danger');
                }
            });
        });

        // Add event listeners for new quantity controls
        document.querySelectorAll('.quantity-controls .btn-qty').forEach(button => {
            button.addEventListener('click', () => {
                const input = button.parentElement.querySelector('.quantity-input');
                let currentValue = parseInt(input.value, 10);
                const step = parseInt(button.dataset.step, 10);
                currentValue += step;
                if (currentValue < 1) currentValue = 1;
                input.value = currentValue;
            });
        });
    }

    function updateCartCount(count) {
        const cartBadges = document.querySelectorAll('.badge');
        cartBadges.forEach(badge => {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        });
    }
    function initializeAuthForms() {
        const authContainer = document.getElementById('auth-container');
        if (authContainer) {
            const tabs = authContainer.querySelectorAll('.auth-tab');
            const forms = authContainer.querySelectorAll('.auth-form');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    const formName = tab.dataset.form;

                    tabs.forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');

                    forms.forEach(form => {
                        form.classList.toggle('active', form.id === `${formName}-form`);
                    });
                });
            });

            // Login Form Validation
            const loginForm = document.getElementById('login-form');
            if (loginForm) {
                loginForm.addEventListener('submit', (e) => {
                    let isValid = true;
                    const identifier = loginForm.querySelector('#login-identifier');
                    const password = loginForm.querySelector('#login-password');

                    // Clear previous errors
                    clearError(identifier);
                    clearError(password);

                    if (identifier.value.trim() === '') {
                        showError(identifier, 'Email or Phone Number is required.');
                        isValid = false;
                    }

                    if (password.value.trim() === '') {
                        showError(password, 'Password is required.');
                        isValid = false;
                    }

                    if (!isValid) { e.preventDefault(); }
                });
            }

            // Signup Form Validation
            const signupForm = document.getElementById('signup-form');
            if (signupForm) {
                signupForm.addEventListener('submit', (e) => {
                    let isValid = true;
                    const name = signupForm.querySelector('#signup-name');
                    const email = signupForm.querySelector('#signup-email');
                    const contact = signupForm.querySelector('#signup-contact');
                    const dob = signupForm.querySelector('#signup-dob');
                    const password = signupForm.querySelector('#signup-password');
                    const confirmPassword = signupForm.querySelector('#signup-confirm-password');

                    clearError(name);
                    clearError(email);
                    clearError(contact);
                    clearError(dob);
                    clearError(password);
                    clearError(confirmPassword);

                    if (name.value.trim() === '') {
                        isValid = false; showError(name, 'Full Name is required.');
                    }
                    if (email.value.trim() === '') {
                        isValid = false; showError(email, 'Email is required.');
                    } else if (!isValidEmail(email.value)) {
                        isValid = false; showError(email, 'Please enter a valid email.');
                    }
                    if (contact.value.trim() === '') {
                        isValid = false; showError(contact, 'Phone Number is required.');
                    }
                    if (dob.value.trim() === '') {
                        isValid = false; showError(dob, 'Date of Birth is required.');
                    }
                    if (password.value.trim() === '') {
                        isValid = false; showError(password, 'Password is required.');
                    } else if (password.value.length < 6) {
                        isValid = false; showError(password, 'Password must be at least 6 characters.');
                    }
                    if (confirmPassword.value.trim() === '') {
                        isValid = false; showError(confirmPassword, 'Please confirm your password.');
                    } else if (password.value !== confirmPassword.value) {
                        isValid = false; showError(confirmPassword, 'Passwords do not match.');
                    }
                    if (!isValid) { e.preventDefault(); }
                });
            }
        }
    }

    function initializeFaqs() {
        const container = document.querySelector('.faq-section');
        if (!container) return;
    
        const searchInput = container.querySelector('#faq-search');
        const tabs = container.querySelectorAll('.faq-tab'); 
        const items = container.querySelectorAll('.faq-item');
    
        // Filtering logic
        const filterFaqs = () => { 
            const searchTerm = searchInput.value.toLowerCase();
            const activeCategory = container.querySelector('.faq-tab.active').dataset.category;
    
            items.forEach(item => {
                const category = item.dataset.category;
                const questionText = item.querySelector('.accordion-button').textContent.toLowerCase();
                const answerText = item.querySelector('.faq-answer').textContent.toLowerCase();
    
                const categoryMatch = activeCategory === 'all' || category === activeCategory; 
                const searchMatch = questionText.includes(searchTerm) || answerText.includes(searchTerm);
    
                item.style.display = (categoryMatch && searchMatch) ? 'block' : 'none';
            });
        };
    
        searchInput.addEventListener('input', filterFaqs);

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                filterFaqs();
            });
        });
    }

    function initializeContactForm() {
        const contactForm = document.getElementById('contact-form');
        if (contactForm) {
            contactForm.addEventListener('submit', (e) => {
                let isValid = true;
                const name = contactForm.querySelector('#name');
                const email = contactForm.querySelector('#email');
                const message = contactForm.querySelector('#message');

                // Clear previous errors
                clearError(name);
                clearError(email);
                clearError(message);

                if (name.value.trim() === '') {
                    showError(name, 'Full Name is required.');
                    isValid = false;
                }

                if (email.value.trim() === '') {
                    showError(email, 'Email Address is required.');
                    isValid = false;
                } else if (!isValidEmail(email.value.trim())) {
                    showError(email, 'Please enter a valid email address.');
                    isValid = false;
                }

                if (message.value.trim() === '') {
                    showError(message, 'Message is required.');
                    isValid = false;
                }

                if (!isValid) { e.preventDefault(); }
            });
        }

        const getDirectionsBtn = document.getElementById('get-directions-btn');
        if (getDirectionsBtn) {
            getDirectionsBtn.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    showAlert("Geolocation is not supported by your browser.", "warning");
                    return;
                }

                const destination = "123 Life-Saver St, Hope City, 12345"; // Your store's address

                const success = (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${encodeURIComponent(destination)}`;
                    window.open(googleMapsUrl, '_blank');
                };

                const error = (err) => {
                    let message = "Unable to retrieve your location.";
                    if (err.code === 1) { // PERMISSION_DENIED
                        message = "Location access was denied. Please enable it in your browser settings.";
                    }
                    showAlert(message, "danger");
                };

                getDirectionsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Detecting...';
                getDirectionsBtn.disabled = true;

                navigator.geolocation.getCurrentPosition(success, error);
            });
        }
    }

    function initializeResetPasswordForm() {
        const forgotPasswordForm = document.querySelector('.page-reset-password form');
        if (forgotPasswordForm) {
            forgotPasswordForm.addEventListener('submit', (e) => {
                let isValid = true;
                const email = forgotPasswordForm.querySelector('#email');
                
                clearError(email);

                if (email.value.trim() === '') {
                    showError(email, 'Email address is required.');
                    isValid = false;
                } else if (!isValidEmail(email.value)) {
                    showError(email, 'Please enter a valid email address.');
                    isValid = false;
                }

                if (!isValid) { e.preventDefault(); }
            });
        }
    }

    function initializeProfilePage() {
        const form = document.getElementById('profile-edit-form');
        if (!form) return;

        const editBtn = document.getElementById('edit-profile-btn');
        const buttonsContainer = document.getElementById('profile-buttons');
        const inputs = form.querySelectorAll('.form-input, #profile-picture');
        const pictureInput = document.getElementById('profile-picture');
        const picturePreview = document.getElementById('picture-preview');

        if (editBtn) {
            editBtn.addEventListener('click', () => {
                // Enable form fields (except email)
                inputs.forEach(input => {
                    if (input.id !== 'email') {
                        input.removeAttribute('disabled');
                    }
                });

                // Update buttons
                buttonsContainer.innerHTML = `
                    <button type="submit" class="btn-submit">Save Changes</button>
                    <button type="button" id="cancel-edit-btn" class="btn-secondary">Cancel</button>
                `;

                // Add event listener for the new cancel button
                document.getElementById('cancel-edit-btn').addEventListener('click', () => {
                    window.location.reload(); // Easiest way to revert changes
                });
            });
        }

        if (pictureInput && picturePreview) {
            pictureInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        picturePreview.src = event.target.result;
                    };
                    reader.readAsDataURL(file);
                }
            });
        }

        const changePasswordForm = document.getElementById('change-password-form');
        if (changePasswordForm) {
            changePasswordForm.addEventListener('submit', (e) => {
                let isValid = true;
                const currentPassword = changePasswordForm.querySelector('#current_password');
                const newPassword = changePasswordForm.querySelector('#new_password');
                const confirmNewPassword = changePasswordForm.querySelector('#confirm_new_password');

                clearError(currentPassword);
                clearError(newPassword);
                clearError(confirmNewPassword);

                if (currentPassword.value.trim() === '') {
                    isValid = false; showError(currentPassword, 'Current password is required.');
                }
                if (newPassword.value.trim() === '') {
                    isValid = false; showError(newPassword, 'New password is required.');
                } else if (newPassword.value.length < 6) {
                    isValid = false; showError(newPassword, 'Password must be at least 6 characters.');
                }
                if (confirmNewPassword.value.trim() === '') {
                    isValid = false; showError(confirmNewPassword, 'Please confirm your new password.');
                } else if (newPassword.value !== confirmNewPassword.value) {
                    isValid = false; showError(confirmNewPassword, 'Passwords do not match.');
                }

                if (!isValid) {
                    e.preventDefault();
                }
            });
        }
    }

    function initializeCartPage() {
        // This function is now a placeholder.
        // The cart page is fully rendered by the server.
    }
    function initializeAdminDashboard() {
        const tabs = document.querySelectorAll('.admin-tab');
        const tabContents = document.querySelectorAll('.admin-tab-content');
        const deleteButtons = document.querySelectorAll('.delete-btn');
        const confirmDeleteModal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        const deleteForm = document.getElementById('delete-form');
        const itemToDeleteName = document.getElementById('item-to-delete-name');

        // Tab functionality
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;

                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === `${tabId}-content`);
                });
            });
        });

        // Delete confirmation functionality
        deleteButtons.forEach(button => {
            button.addEventListener('click', () => {
                const action = button.dataset.action;
                const itemName = button.dataset.itemName;

                if (deleteForm && itemToDeleteName) {
                    deleteForm.action = action;
                    itemToDeleteName.textContent = itemName;
                    confirmDeleteModal.show();
                }
            });
        });
    }

    function initializeInteractiveEffects() {
        // --- Mouse-aware glow for feature cards ---
        const featureCards = document.querySelectorAll('.feature-card');
        featureCards.forEach(card => {
            card.addEventListener('mousemove', e => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                card.style.setProperty('--mouse-x', `${x}px`);
                card.style.setProperty('--mouse-y', `${y}px`);
            });
        });
    }

    const applyTheme = (theme) => {
        if (theme === 'dark') {
            body.classList.add('dark-mode');
            if(darkModeToggle) darkModeToggle.checked = true;
        } else {
            body.classList.remove('dark-mode');
            if(darkModeToggle) darkModeToggle.checked = false;
        }
    };

    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            applyTheme('dark');
        }
    }

    if (darkModeToggle) {
        darkModeToggle.addEventListener('change', () => {
            if (darkModeToggle.checked) {
                localStorage.setItem('theme', 'dark');
                applyTheme('dark');
            } else {
                localStorage.setItem('theme', 'light');
                applyTheme('light');
            }
        });
    }

    if (sidebarPinToggle && desktopSidebar) {
        sidebarPinToggle.addEventListener('click', () => {
            desktopSidebar.classList.toggle('force-open');
            sidebarPinToggle.classList.toggle('active');
            // Optional: Save preference to localStorage
            localStorage.setItem('sidebarPinned', desktopSidebar.classList.contains('force-open'));
        });
    }

    window.addEventListener('scroll', () => {
        // Header scroll effect
        if (header) {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        }

        // Back to Top button visibility
        if (backToTopBtn) {
            if (window.scrollY > 300) {
                backToTopBtn.classList.add('show');
            } else {
                backToTopBtn.classList.remove('show');
            }
        }

        // Hero Parallax Effect
        const heroVideo = document.getElementById('hero-video');
        if (heroVideo) {
            const scrollPosition = window.scrollY;
            // Move the video up at a fraction of the scroll speed (e.g., 0.3)
            heroVideo.style.transform = `translateX(-50%) translateY(calc(-50% + ${scrollPosition * 0.3}px)) scale(1.1)`;
        }
    });

    function toggleMobileMenu() {
        if (menuToggle && mobileSidebar && mobileOverlay) {
            menuToggle.classList.toggle('active');
            mobileSidebar.classList.toggle('active');
            mobileOverlay.classList.toggle('active');
            body.style.overflow = mobileSidebar.classList.contains('active') ? 'hidden' : 'auto';
        }
    }
    
    // Initialize global handlers
    initializeScrollAnimations();
    initializeInteractiveEffects();

    if (menuToggle) menuToggle.addEventListener('click', toggleMobileMenu);
    if (mobileOverlay) mobileOverlay.addEventListener('click', toggleMobileMenu);

    if (backToTopBtn) {
        backToTopBtn.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    function handleSidebar() {
        if (desktopSidebar && window.innerWidth > 768) {
            body.classList.add('sidebar-active');
            if (header) header.classList.add('sidebar-active');
        } else {
            body.classList.remove('sidebar-active');
            if (header) header.classList.remove('sidebar-active');
        }
    }
    handleSidebar();
    window.addEventListener('resize', handleSidebar);

    if (localStorage.getItem('sidebarPinned') === 'true') {
        desktopSidebar?.classList.add('force-open');
        sidebarPinToggle?.classList.add('active');
    }

    updateCartCountFromStorage(); // Update cart count on every page load
});
