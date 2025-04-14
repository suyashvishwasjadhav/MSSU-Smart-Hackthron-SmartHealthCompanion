document.addEventListener('DOMContentLoaded', function() {
    // Enable Bootstrap tooltips
    const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    const tooltipList = [...tooltipTriggerList].map(tooltipTriggerEl => new bootstrap.Tooltip(tooltipTriggerEl));
    
    // Enable Bootstrap popovers
    const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
    const popoverList = [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    
    // Fade in elements with the .fade-in class
    document.querySelectorAll('.fade-in').forEach(element => {
        element.style.opacity = '1';
    });
    
    // Add active class to current nav item
    const currentLocation = window.location.pathname;
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('href') === currentLocation) {
            link.classList.add('active');
        }
    });
    
    // Form validation
    const forms = document.querySelectorAll('.needs-validation');
    Array.from(forms).forEach(form => {
        form.addEventListener('submit', event => {
            if (!form.checkValidity()) {
                event.preventDefault();
                event.stopPropagation();
            }
            form.classList.add('was-validated');
        }, false);
    });
    
    // Password strength meter
    const passwordInput = document.getElementById('password');
    const passwordStrength = document.getElementById('password-strength');
    
    if (passwordInput && passwordStrength) {
        passwordInput.addEventListener('input', function() {
            const password = passwordInput.value;
            const strength = calculatePasswordStrength(password);
            
            // Update the strength meter
            passwordStrength.style.width = `${strength}%`;
            
            // Update the color based on strength
            if (strength < 30) {
                passwordStrength.className = 'progress-bar bg-danger';
            } else if (strength < 70) {
                passwordStrength.className = 'progress-bar bg-warning';
            } else {
                passwordStrength.className = 'progress-bar bg-success';
            }
        });
    }
    
    // Helper function to calculate password strength
    function calculatePasswordStrength(password) {
        if (!password) return 0;
        
        let strength = 0;
        
        // Length
        if (password.length > 6) strength += 20;
        if (password.length > 10) strength += 10;
        
        // Contains lowercase
        if (/[a-z]/.test(password)) strength += 20;
        
        // Contains uppercase
        if (/[A-Z]/.test(password)) strength += 20;
        
        // Contains number
        if (/[0-9]/.test(password)) strength += 20;
        
        // Contains special character
        if (/[^A-Za-z0-9]/.test(password)) strength += 20;
        
        return Math.min(strength, 100);
    }
    
    // Show/hide password toggle
    const togglePasswordButtons = document.querySelectorAll('.toggle-password');
    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', function() {
            const targetId = this.getAttribute('data-target');
            const passwordField = document.getElementById(targetId);
            
            if (passwordField.type === 'password') {
                passwordField.type = 'text';
                this.innerHTML = '<i class="fas fa-eye-slash"></i>';
            } else {
                passwordField.type = 'password';
                this.innerHTML = '<i class="fas fa-eye"></i>';
            }
        });
    });
    
    // Auto-close alerts after 5 seconds
    setTimeout(function() {
        document.querySelectorAll('.alert-dismissible').forEach(alert => {
            // Create and trigger a bootstrap alert close event
            const closeEvent = new bootstrap.Alert(alert);
            closeEvent.close();
        });
    }, 5000);
    
    // Handle appointment status changes
    const appointmentStatusBtns = document.querySelectorAll('.appointment-status-btn');
    appointmentStatusBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const appointmentId = this.getAttribute('data-appointment-id');
            const newStatus = this.getAttribute('data-status');
            
            updateAppointmentStatus(appointmentId, newStatus);
        });
    });
    
    function updateAppointmentStatus(appointmentId, newStatus) {
        fetch(`/api/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show success message
                const toast = new bootstrap.Toast(document.getElementById('status-toast'));
                document.getElementById('toast-message').textContent = data.message;
                toast.show();
                
                // Reload page after a short delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                alert(data.message || 'An error occurred');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while updating the appointment');
        });
    }
});
