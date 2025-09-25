document.addEventListener('DOMContentLoaded', () => {
    const checkoutForm = document.getElementById('checkout-form');
    if (!checkoutForm) return;

    checkoutForm.addEventListener('submit', function(e) {
        e.preventDefault(); // Prevent the default form submission

        // Hide the form and show the animation container
        document.getElementById('checkout-form-container').style.display = 'none';
        const postCheckoutContainer = document.getElementById('post-checkout-container');
        postCheckoutContainer.style.display = 'block';

        // Start the animation sequence
        runAnimationsAndSubmit();
    });

    function runAnimationsAndSubmit() {
        const processingSection = document.getElementById('paymentProcessingSection');
        const confirmationSection = document.getElementById('confirmationSection');
        const animStep1 = document.getElementById('anim-step-1');
        const animStep2 = document.getElementById('anim-step-2');
        const animStep3 = document.getElementById('anim-step-3');
        const processingTitle = document.getElementById('processingTitle');

        processingSection.style.display = 'block';
        confirmationSection.style.display = 'none';

        // 1. Order Confirmed
        setTimeout(() => {
            animStep1.classList.add('active');
            processingTitle.textContent = 'Order Confirmed!';
        }, 500);

        // 2. Preparing Your Meal
        setTimeout(() => {
            animStep2.classList.add('active');
            processingTitle.textContent = 'Preparing Your Meal...';
        }, 2000);

        // 3. Out for Delivery
        setTimeout(() => {
            animStep3.classList.add('active');
            processingTitle.textContent = 'Your Order is on its Way!';
        }, 3500);

        // 4. Submit the form data in the background and show final confirmation
        setTimeout(() => {
            // Create a FormData object from the form
            const formData = new FormData(checkoutForm);
            
            // Use fetch to submit the form data to the server
            fetch(checkoutForm.action, {
                method: 'POST',
                body: formData,
            }).then(response => {
                // When the server responds, hide the animation and show the final confirmation
                processingSection.style.display = 'none';
                confirmationSection.style.display = 'block';
            }).catch(error => console.error('Error:', error));

        }, 5000); // Wait for animations to finish
    }
});