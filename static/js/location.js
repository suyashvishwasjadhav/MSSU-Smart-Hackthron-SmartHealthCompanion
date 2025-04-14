document.addEventListener('DOMContentLoaded', function() {
    const mapContainer = document.getElementById('doctor-map');
    const userLocationBtn = document.getElementById('get-user-location');
    
    let map, userMarker, doctorMarkers = [];
    let userLocation = null;
    
    // Initialize map if container exists
    if (mapContainer) {
        // Create map centered on a default location
        map = L.map('doctor-map').setView([40.7128, -74.0060], 12);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Get user location if button exists
        if (userLocationBtn) {
            userLocationBtn.addEventListener('click', getUserLocation);
        }
        
        // Load doctors on the map
        loadDoctorsOnMap();
    }
    
    // Function to get user's location
    function getUserLocation() {
        if (navigator.geolocation) {
            userLocationBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Getting location...';
            userLocationBtn.disabled = true;
            
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    userLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Use my location';
                    userLocationBtn.disabled = false;
                    
                    // Store user location
                    userLocation = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    
                    // Update map
                    updateMapWithUserLocation(userLocation);
                    
                    // Update doctor distances
                    updateDoctorDistances(userLocation);
                },
                function(error) {
                    userLocationBtn.innerHTML = '<i class="fas fa-map-marker-alt"></i> Use my location';
                    userLocationBtn.disabled = false;
                    
                    let errorMessage = 'Unable to get your location';
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied. Please enable location services.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out.';
                            break;
                    }
                    
                    showLocationError(errorMessage);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            showLocationError('Geolocation is not supported by this browser.');
        }
    }
    
    // Function to update map with user location
    function updateMapWithUserLocation(location) {
        // Center map on user location
        map.setView([location.lat, location.lng], 12);
        
        // Add or update user marker
        if (userMarker) {
            userMarker.setLatLng([location.lat, location.lng]);
        } else {
            const userIcon = L.divIcon({
                html: '<i class="fas fa-user-circle fa-2x text-primary"></i>',
                className: 'custom-div-icon',
                iconSize: [30, 30],
                iconAnchor: [15, 15]
            });
            
            userMarker = L.marker([location.lat, location.lng], {
                icon: userIcon
            }).addTo(map);
            userMarker.bindPopup('<strong>Your Location</strong>').openPopup();
        }
    }
    
    // Function to load doctors on the map
    function loadDoctorsOnMap() {
        fetch('/api/doctors')
            .then(response => response.json())
            .then(doctors => {
                // Clear existing markers
                doctorMarkers.forEach(marker => marker.remove());
                doctorMarkers = [];
                
                doctors.forEach(doctor => {
                    // Only add doctors with valid coordinates
                    if (doctor.latitude && doctor.longitude) {
                        const doctorIcon = L.divIcon({
                            html: '<i class="fas fa-user-md fa-2x text-danger"></i>',
                            className: 'custom-div-icon',
                            iconSize: [30, 30],
                            iconAnchor: [15, 15]
                        });
                        
                        const marker = L.marker([doctor.latitude, doctor.longitude], {
                            icon: doctorIcon
                        }).addTo(map);
                        
                        marker.bindPopup(`
                            <strong>${doctor.name}</strong><br>
                            ${doctor.specialization}<br>
                            ${doctor.address || ''} ${doctor.city || ''}, ${doctor.state || ''}<br>
                            <a href="/book-appointment?doctor_id=${doctor.id}" class="btn btn-sm btn-primary mt-2">Book Appointment</a>
                        `);
                        
                        doctorMarkers.push(marker);
                    }
                });
                
                // Update doctor distances if user location is available
                if (userLocation) {
                    updateDoctorDistances(userLocation);
                }
            })
            .catch(error => {
                console.error('Error loading doctors:', error);
            });
    }
    
    // Function to update doctor distances from user location
    function updateDoctorDistances(userLocation) {
        const doctorCards = document.querySelectorAll('.doctor-card');
        
        doctorCards.forEach(card => {
            const lat = parseFloat(card.getAttribute('data-lat'));
            const lng = parseFloat(card.getAttribute('data-lng'));
            
            if (lat && lng) {
                const distance = calculateDistance(
                    userLocation.lat, userLocation.lng,
                    lat, lng
                );
                
                const distanceEl = card.querySelector('.doctor-distance');
                if (distanceEl) {
                    distanceEl.textContent = `${distance.toFixed(1)} km away`;
                    distanceEl.classList.remove('d-none');
                }
                
                // Store distance for sorting
                card.setAttribute('data-distance', distance);
            }
        });
        
        // Sort doctor cards by distance
        sortDoctorsByDistance();
    }
    
    // Function to sort doctors by distance
    function sortDoctorsByDistance() {
        const doctorContainer = document.querySelector('.doctor-cards-container');
        if (!doctorContainer) return;
        
        const doctorCards = Array.from(document.querySelectorAll('.doctor-card'));
        
        doctorCards.sort((a, b) => {
            const distA = parseFloat(a.getAttribute('data-distance')) || Infinity;
            const distB = parseFloat(b.getAttribute('data-distance')) || Infinity;
            return distA - distB;
        });
        
        // Clear and re-add sorted cards
        doctorContainer.innerHTML = '';
        doctorCards.forEach(card => doctorContainer.appendChild(card));
    }
    
    // Function to calculate distance between two coordinates
    function calculateDistance(lat1, lon1, lat2, lon2) {
        const R = 6371; // Radius of the earth in km
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        const distance = R * c; // Distance in km
        return distance;
    }
    
    function deg2rad(deg) {
        return deg * (Math.PI/180);
    }
    
    function showLocationError(message) {
        const errorAlert = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        document.getElementById('location-alerts').innerHTML = errorAlert;
    }
    
    // Profile page location picker
    const locationPickerMap = document.getElementById('location-picker-map');
    let pickerMap, pickerMarker;
    
    if (locationPickerMap) {
        // Initialize the map
        pickerMap = L.map('location-picker-map').setView([40.7128, -74.0060], 13);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(pickerMap);
        
        // Try to get initial coordinates from data attributes
        const initialLat = parseFloat(locationPickerMap.getAttribute('data-lat')) || null;
        const initialLng = parseFloat(locationPickerMap.getAttribute('data-lng')) || null;
        
        if (initialLat && initialLng) {
            pickerMap.setView([initialLat, initialLng], 15);
            
            // Add initial marker
            pickerMarker = L.marker([initialLat, initialLng], {
                draggable: true
            }).addTo(pickerMap);
            
            // Update coordinates when marker is moved
            pickerMarker.on('dragend', updateCoordinates);
        } else {
            // Use geolocation if available
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    function(position) {
                        pickerMap.setView([position.coords.latitude, position.coords.longitude], 15);
                        
                        // Add marker at user's location
                        pickerMarker = L.marker([position.coords.latitude, position.coords.longitude], {
                            draggable: true
                        }).addTo(pickerMap);
                        
                        // Update coordinates when marker is moved
                        pickerMarker.on('dragend', updateCoordinates);
                        
                        // Initial update of coordinate fields
                        updateCoordinates();
                    },
                    function(error) {
                        // Just keep the default view
                    }
                );
            }
        }
        
        // Allow clicking on map to move marker
        pickerMap.on('click', function(e) {
            if (pickerMarker) {
                pickerMarker.setLatLng(e.latlng);
            } else {
                pickerMarker = L.marker(e.latlng, {
                    draggable: true
                }).addTo(pickerMap);
                pickerMarker.on('dragend', updateCoordinates);
            }
            
            updateCoordinates();
        });
        
        function updateCoordinates() {
            const position = pickerMarker.getLatLng();
            
            // Update hidden form fields
            document.getElementById('latitude').value = position.lat;
            document.getElementById('longitude').value = position.lng;
            
            // Show coordinates in readable format
            document.getElementById('coordinates-display').textContent = 
                `Selected coordinates: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`;
        }
    }
});
