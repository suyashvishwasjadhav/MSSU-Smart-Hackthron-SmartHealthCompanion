document.addEventListener('DOMContentLoaded', function() {
    // Handle date selection in appointment booking
    const dateInput = document.getElementById('date');
    const timeSelect = document.getElementById('time');
    const dateAlert = document.getElementById('date-alert');
    
    if (dateInput && timeSelect) {
        // Set minimum date to today
        const today = new Date();
        const dateString = today.toISOString().split('T')[0];
        dateInput.min = dateString;
        
        // Update available times when date changes
        dateInput.addEventListener('change', function() {
            const selectedDate = new Date(this.value);
            const dayOfWeek = selectedDate.getDay(); // 0 = Sunday, 6 = Saturday
            
            // Clear existing options except the placeholder
            while (timeSelect.options.length > 1) {
                timeSelect.remove(1);
            }
            
            // Reset selection
            timeSelect.selectedIndex = 0;
            
            // Hide any previous alerts
            if (dateAlert) {
                dateAlert.classList.add('d-none');
            }
            
            // Weekend logic
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                if (dateAlert) {
                    dateAlert.textContent = 'Note: Weekend appointments are limited to urgent cases only.';
                    dateAlert.classList.remove('d-none', 'alert-danger');
                    dateAlert.classList.add('alert-warning');
                }
                
                // Weekend hours (fewer slots)
                addTimeOptions('10:00', '14:00', 60); // 10 AM to 2 PM, hourly slots
            } else {
                // Weekday hours
                addTimeOptions('09:00', '17:00', 30); // 9 AM to 5 PM, 30-minute slots
            }
            
            // Enable the time select now that we have options
            timeSelect.disabled = false;
        });
        
        // Function to add time options between start and end times
        function addTimeOptions(startTime, endTime, intervalMinutes) {
            const start = new Date(`2000-01-01T${startTime}`);
            const end = new Date(`2000-01-01T${endTime}`);
            
            while (start < end) {
                const timeString = start.toTimeString().substring(0, 5);
                const option = document.createElement('option');
                option.value = timeString;
                option.textContent = formatTimeDisplay(timeString);
                timeSelect.appendChild(option);
                
                // Add interval minutes
                start.setMinutes(start.getMinutes() + intervalMinutes);
            }
        }
        
        // Function to format time for display (convert 24h to 12h format)
        function formatTimeDisplay(time24h) {
            const [hours, minutes] = time24h.split(':');
            let period = 'AM';
            let hours12 = parseInt(hours, 10);
            
            if (hours12 >= 12) {
                period = 'PM';
                if (hours12 > 12) {
                    hours12 -= 12;
                }
            }
            
            if (hours12 === 0) {
                hours12 = 12;
            }
            
            return `${hours12}:${minutes} ${period}`;
        }
    }
    
    // Appointment confirmation modal
    const confirmModal = document.getElementById('confirm-appointment-modal');
    const bookingForm = document.getElementById('booking-form');
    
    if (confirmModal && bookingForm) {
        const modal = new bootstrap.Modal(confirmModal);
        
        bookingForm.addEventListener('submit', function(e) {
            // Only intercept if form is valid
            if (bookingForm.checkValidity()) {
                e.preventDefault();
                
                // Get form data for confirmation
                const doctorSelect = document.getElementById('doctor_id');
                const doctorName = doctorSelect.options[doctorSelect.selectedIndex].text;
                const date = document.getElementById('date').value;
                const time = document.getElementById('time').value;
                const reason = document.getElementById('reason').value;
                
                // Update modal content
                document.getElementById('confirm-doctor').textContent = doctorName;
                document.getElementById('confirm-date').textContent = formatDate(date);
                document.getElementById('confirm-time').textContent = formatTimeDisplay(time);
                document.getElementById('confirm-reason').textContent = reason || 'Not specified';
                
                // Show the modal
                modal.show();
            }
        });
        
        // Handle confirmation button click
        document.getElementById('confirm-booking').addEventListener('click', function() {
            // Submit the form
            bookingForm.submit();
        });
        
        // Format date for display
        function formatDate(dateString) {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            return new Date(dateString).toLocaleDateString(undefined, options);
        }
    }
    
    // Appointment cancellation confirmation
    const cancelBtns = document.querySelectorAll('.cancel-appointment-btn');
    cancelBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            
            const appointmentId = this.getAttribute('data-appointment-id');
            const appointmentDate = this.getAttribute('data-appointment-date');
            
            if (confirm(`Are you sure you want to cancel your appointment on ${appointmentDate}?`)) {
                updateAppointmentStatus(appointmentId, 'cancelled');
            }
        });
    });
    
    // Update appointment status via API
    function updateAppointmentStatus(appointmentId, status) {
        fetch(`/api/appointments/${appointmentId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: status })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show toast notification
                const statusToast = document.getElementById('status-toast');
                const toastMessage = document.getElementById('toast-message');
                
                if (statusToast && toastMessage) {
                    toastMessage.textContent = data.message;
                    const toast = new bootstrap.Toast(statusToast);
                    toast.show();
                }
                
                // Reload page after a delay
                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            } else {
                alert(data.message || 'An error occurred');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('An error occurred while updating the appointment status');
        });
    }
    
    // Doctor specialization filter
    const specializationFilter = document.getElementById('specialization-filter');
    if (specializationFilter) {
        specializationFilter.addEventListener('change', function() {
            const selectedSpecialization = this.value.toLowerCase();
            const doctorCards = document.querySelectorAll('.doctor-card');
            
            doctorCards.forEach(card => {
                const cardSpecialization = card.getAttribute('data-specialization').toLowerCase();
                
                if (selectedSpecialization === '' || cardSpecialization.includes(selectedSpecialization)) {
                    card.classList.remove('d-none');
                } else {
                    card.classList.add('d-none');
                }
            });
        });
    }
});
