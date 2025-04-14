document.addEventListener('DOMContentLoaded', function() {
    const mapContainer = document.getElementById('hospital-map');
    const userLocationBtn = document.getElementById('get-user-location');
    const facilityTypeSelect = document.getElementById('facility-type');
    const searchInput = document.getElementById('location-search');
    const searchBtn = document.getElementById('search-btn');
    const resultsCount = document.getElementById('results-count');
    const hospitalCardsContainer = document.getElementById('hospital-cards-container');
    const loadingMessage = document.getElementById('loading-message');
    const cardTemplate = document.getElementById('hospital-card-template');
    
    let map, userMarker, facilityMarkers = [];
    let userLocation = null;
    let facilities = [];
    
    // Initialize map if container exists
    if (mapContainer) {
        // Create map centered on a default location
        map = L.map('hospital-map').setView([40.7128, -74.0060], 12);
        
        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Get user location if button exists
        if (userLocationBtn) {
            userLocationBtn.addEventListener('click', getUserLocation);
        }
        
        // Add event listener for search button
        if (searchBtn) {
            searchBtn.addEventListener('click', searchLocation);
        }
        
        // Add event listener for search input Enter key
        if (searchInput) {
            searchInput.addEventListener('keyup', function(event) {
                if (event.key === "Enter") {
                    searchLocation();
                }
            });
        }
        
        // Add event listener for facility type filter
        if (facilityTypeSelect) {
            facilityTypeSelect.addEventListener('change', filterFacilities);
        }
        
        // Try to get user's location automatically
        getUserLocation();
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
                    
                    // Search for healthcare facilities
                    searchHealthcareFacilities(userLocation);
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
                    
                    showError(errorMessage);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            showError('Geolocation is not supported by this browser.');
        }
    }
    
    // Function to update map with user location
    function updateMapWithUserLocation(location) {
        // Center map on user location
        map.setView([location.lat, location.lng], 13);
        
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
    
    // Function to search for healthcare facilities near a location using Overpass API
    function searchHealthcareFacilities(location) {
        // Show loading state
        showLoading(true);
        
        // Clear current facilities
        clearFacilities();
        
        // Build Overpass API query
        const radius = 5000; // 5km radius
        const overpassQuery = `
            [out:json][timeout:25];
            (
              node["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
              way["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
              relation["amenity"="hospital"](around:${radius},${location.lat},${location.lng});
              node["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
              way["amenity"="clinic"](around:${radius},${location.lat},${location.lng});
              node["amenity"="doctors"](around:${radius},${location.lat},${location.lng});
              way["amenity"="doctors"](around:${radius},${location.lat},${location.lng});
              node["amenity"="pharmacy"](around:${radius},${location.lat},${location.lng});
              way["amenity"="pharmacy"](around:${radius},${location.lat},${location.lng});
              node["healthcare"](around:${radius},${location.lat},${location.lng});
              way["healthcare"](around:${radius},${location.lat},${location.lng});
            );
            out center;
        `;
        
        // Make request to Overpass API
        fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: overpassQuery
        })
        .then(response => response.json())
        .then(data => {
            // Process results
            processOverpassResults(data, location);
        })
        .catch(error => {
            console.error('Error fetching healthcare facilities:', error);
            showError('Unable to fetch healthcare facilities. Please try again later.');
            showLoading(false);
        });
    }
    
    // Process the Overpass API results
    function processOverpassResults(data, userLocation) {
        facilities = [];
        
        data.elements.forEach(element => {
            // Get location coordinates
            let lat, lng;
            
            if (element.type === 'node') {
                lat = element.lat;
                lng = element.lon;
            } else if (element.center) {
                // For ways and relations, use the center point
                lat = element.center.lat;
                lng = element.center.lon;
            } else {
                return; // Skip if no coordinates
            }
            
            // Extract facility properties
            const tags = element.tags || {};
            const name = tags.name || getFacilityTypeName(tags);
            const type = getFacilityType(tags);
            const address = formatAddress(tags);
            
            // Calculate distance from user
            const distance = calculateDistance(
                userLocation.lat, userLocation.lng,
                lat, lng
            );
            
            // Create facility object
            const facility = {
                id: element.id,
                name: name,
                type: type,
                lat: lat,
                lng: lng,
                address: address,
                distance: distance,
                tags: tags
            };
            
            facilities.push(facility);
        });
        
        // Sort facilities by distance
        facilities.sort((a, b) => a.distance - b.distance);
        
        // Update map and display results
        displayFacilities();
        showLoading(false);
    }
    
    // Clear all facilities from the map and list
    function clearFacilities() {
        // Clear markers
        facilityMarkers.forEach(marker => marker.remove());
        facilityMarkers = [];
        
        // Clear facility cards
        if (hospitalCardsContainer) {
            // Keep only the loading message
            while (hospitalCardsContainer.firstChild) {
                if (hospitalCardsContainer.firstChild === loadingMessage) {
                    break;
                }
                hospitalCardsContainer.removeChild(hospitalCardsContainer.firstChild);
            }
        }
    }
    
    // Display facilities on the map and in the list
    function displayFacilities() {
        // Clear existing markers
        facilityMarkers.forEach(marker => marker.remove());
        facilityMarkers = [];
        
        // Get the selected facility type
        const selectedType = facilityTypeSelect ? facilityTypeSelect.value : 'all';
        
        // Filter facilities if a type is selected
        const filteredFacilities = selectedType === 'all' 
            ? facilities 
            : facilities.filter(f => f.type === selectedType);
        
        // Update results count
        if (resultsCount) {
            resultsCount.textContent = `${filteredFacilities.length} Found`;
        }
        
        // Clear facility cards
        if (hospitalCardsContainer) {
            while (hospitalCardsContainer.firstChild) {
                hospitalCardsContainer.removeChild(hospitalCardsContainer.firstChild);
            }
        }
        
        // If no facilities found
        if (filteredFacilities.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'col-12 text-center py-5';
            noResults.innerHTML = `
                <i class="fas fa-hospital-alt fa-3x text-muted mb-3"></i>
                <h5>No healthcare facilities found</h5>
                <p>Try adjusting your search criteria or increasing the search radius</p>
            `;
            hospitalCardsContainer.appendChild(noResults);
            return;
        }
        
        // Add facilities to map and create cards
        filteredFacilities.forEach(facility => {
            // Create marker for the map
            addFacilityMarker(facility);
            
            // Create facility card
            createFacilityCard(facility);
        });
    }
    
    // Add a facility marker to the map
    function addFacilityMarker(facility) {
        // Choose icon based on facility type
        let iconHtml = '<i class="fas fa-hospital fa-2x text-danger"></i>';
        
        if (facility.type === 'clinic') {
            iconHtml = '<i class="fas fa-clinic-medical fa-2x text-info"></i>';
        } else if (facility.type === 'pharmacy') {
            iconHtml = '<i class="fas fa-prescription-bottle-alt fa-2x text-success"></i>';
        } else if (facility.type === 'dentist') {
            iconHtml = '<i class="fas fa-tooth fa-2x text-warning"></i>';
        } else if (facility.type === 'optician') {
            iconHtml = '<i class="fas fa-glasses fa-2x text-primary"></i>';
        }
        
        const facilityIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-div-icon',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });
        
        // Create and add the marker
        const marker = L.marker([facility.lat, facility.lng], {
            icon: facilityIcon
        }).addTo(map);
        
        // Create popup content
        const popupContent = `
            <strong>${facility.name}</strong><br>
            <em>${getFacilityTypeDisplay(facility.type)}</em><br>
            ${facility.address ? facility.address + '<br>' : ''}
            <strong>${facility.distance.toFixed(1)} km</strong> from your location<br>
            <div class="mt-2">
                <a href="https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${facility.lat},${facility.lng}" 
                   class="btn btn-sm btn-primary" target="_blank">
                    <i class="fas fa-directions"></i> Get Directions
                </a>
            </div>
        `;
        
        marker.bindPopup(popupContent);
        facilityMarkers.push(marker);
    }
    
    // Create a facility card in the list
    function createFacilityCard(facility) {
        if (!cardTemplate || !hospitalCardsContainer) return;
        
        // Clone the template
        const cardNode = cardTemplate.content.cloneNode(true);
        const card = cardNode.querySelector('.hospital-card');
        
        // Set facility icon based on type
        const facilityIcon = cardNode.querySelector('.facility-icon');
        if (facilityIcon) {
            facilityIcon.className = 'fas fa-2x text-primary';
            
            if (facility.type === 'hospital') {
                facilityIcon.classList.add('fa-hospital');
            } else if (facility.type === 'clinic') {
                facilityIcon.classList.add('fa-clinic-medical');
            } else if (facility.type === 'pharmacy') {
                facilityIcon.classList.add('fa-prescription-bottle-alt');
                facilityIcon.classList.replace('text-primary', 'text-success');
            } else if (facility.type === 'dentist') {
                facilityIcon.classList.add('fa-tooth');
                facilityIcon.classList.replace('text-primary', 'text-warning');
            } else if (facility.type === 'optician') {
                facilityIcon.classList.add('fa-glasses');
            } else {
                facilityIcon.classList.add('fa-stethoscope');
            }
        }
        
        // Set facility details
        cardNode.querySelector('.facility-name').textContent = facility.name;
        cardNode.querySelector('.facility-type').textContent = getFacilityTypeDisplay(facility.type);
        
        // Set address if available
        const addressElement = cardNode.querySelector('.facility-address');
        if (facility.address) {
            addressElement.textContent = facility.address;
        } else {
            addressElement.innerHTML = '<em>Address not available</em>';
        }
        
        // Set distance
        cardNode.querySelector('.facility-distance span').textContent = `${facility.distance.toFixed(1)} km away`;
        
        // Set links
        const directionsLink = cardNode.querySelector('.directions-link');
        directionsLink.href = `https://www.openstreetmap.org/directions?from=${userLocation.lat},${userLocation.lng}&to=${facility.lat},${facility.lng}`;
        
        const findDoctorsLink = cardNode.querySelector('.find-doctors-link');
        findDoctorsLink.href = `/doctor-finder?lat=${facility.lat}&lng=${facility.lng}`;
        
        // Add the card to the container
        hospitalCardsContainer.appendChild(cardNode);
    }
    
    // Function to search for a location by name
    function searchLocation() {
        if (!searchInput || !searchInput.value.trim()) return;
        
        const query = searchInput.value.trim();
        
        // Show loading state
        showLoading(true);
        
        // Use Nominatim API to geocode the address
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.length > 0) {
                    const result = data[0];
                    
                    // Update user location
                    userLocation = {
                        lat: parseFloat(result.lat),
                        lng: parseFloat(result.lon)
                    };
                    
                    // Update map
                    updateMapWithUserLocation(userLocation);
                    
                    // Search for healthcare facilities
                    searchHealthcareFacilities(userLocation);
                } else {
                    showError('Location not found. Please try a different search term.');
                    showLoading(false);
                }
            })
            .catch(error => {
                console.error('Error searching location:', error);
                showError('Unable to search location. Please try again later.');
                showLoading(false);
            });
    }
    
    // Filter facilities by type
    function filterFacilities() {
        if (!facilityTypeSelect) return;
        
        // Update the display
        displayFacilities();
    }
    
    // Show/hide loading state
    function showLoading(isLoading) {
        if (loadingMessage) {
            loadingMessage.style.display = isLoading ? 'block' : 'none';
        }
    }
    
    // Show error message
    function showError(message) {
        const errorAlert = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        if (hospitalCardsContainer) {
            const errorDiv = document.createElement('div');
            errorDiv.className = 'col-12 mb-3';
            errorDiv.innerHTML = errorAlert;
            hospitalCardsContainer.prepend(errorDiv);
        }
    }
    
    // Helper function to get a display name for facility type
    function getFacilityTypeDisplay(type) {
        switch (type) {
            case 'hospital': return 'Hospital';
            case 'clinic': return 'Medical Clinic';
            case 'pharmacy': return 'Pharmacy';
            case 'dentist': return 'Dental Clinic';
            case 'optician': return 'Optical Center';
            default: return 'Healthcare Facility';
        }
    }
    
    // Helper function to determine facility type from tags
    function getFacilityType(tags) {
        if (tags.amenity === 'hospital') return 'hospital';
        if (tags.amenity === 'clinic' || tags.amenity === 'doctors' || tags.healthcare === 'doctor') return 'clinic';
        if (tags.amenity === 'pharmacy' || tags.healthcare === 'pharmacy') return 'pharmacy';
        if (tags.amenity === 'dentist' || tags.healthcare === 'dentist') return 'dentist';
        if (tags.shop === 'optician' || tags.healthcare === 'optician') return 'optician';
        
        // Check for other healthcare tags
        if (tags.healthcare) return 'clinic';
        
        return 'hospital'; // Default
    }
    
    // Helper function to get a name if the official name is not available
    function getFacilityTypeName(tags) {
        if (tags.amenity === 'hospital') return 'Hospital';
        if (tags.amenity === 'clinic') return 'Medical Clinic';
        if (tags.amenity === 'doctors') return 'Doctor\'s Office';
        if (tags.amenity === 'pharmacy') return 'Pharmacy';
        if (tags.amenity === 'dentist') return 'Dental Clinic';
        if (tags.shop === 'optician') return 'Optical Center';
        
        return 'Healthcare Facility';
    }
    
    // Helper function to format address from tags
    function formatAddress(tags) {
        let address = '';
        
        // Try to use the address tags if available
        if (tags['addr:street']) {
            address += tags['addr:housenumber'] ? `${tags['addr:housenumber']} ` : '';
            address += tags['addr:street'];
            
            if (tags['addr:city'] || tags['addr:postcode']) {
                address += ', ';
                address += tags['addr:city'] || '';
                address += tags['addr:postcode'] ? ` ${tags['addr:postcode']}` : '';
            }
            
            return address;
        }
        
        // If no address fields, try to use other location fields
        if (tags.street) {
            address += tags.housenumber ? `${tags.housenumber} ` : '';
            address += tags.street;
        }
        
        if (tags.city || tags.postcode) {
            address += address ? ', ' : '';
            address += tags.city || '';
            address += tags.postcode ? ` ${tags.postcode}` : '';
        }
        
        return address;
    }
    
    // Function to calculate distance between two coordinates in kilometers
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
});