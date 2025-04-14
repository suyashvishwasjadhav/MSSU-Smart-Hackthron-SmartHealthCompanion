document.addEventListener('DOMContentLoaded', function() {
    const symptomForm = document.getElementById('symptom-form');
    const analysisResults = document.getElementById('analysis-results');
    const imageAnalysisResults = document.getElementById('image-analysis-results');
    const loadingSpinner = document.getElementById('loading-spinner');
    const submitButton = document.getElementById('submit-symptoms');
    const imageUploadInput = document.getElementById('medical-image');
    const imagePreviewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('image-preview');
    const removeImageBtn = document.getElementById('remove-image-btn');
    const imageAnalysisTab = document.getElementById('image-analysis-tab');
    const textAnalysisTab = document.getElementById('text-analysis-tab');
    
    // Initialize tabs if they exist
    const resultsTabs = document.getElementById('results-tabs');
    if (resultsTabs) {
        const tabElements = resultsTabs.querySelectorAll('button[data-bs-toggle="tab"]');
        if (tabElements.length) {
            tabElements.forEach(tab => {
                tab.addEventListener('click', function(e) {
                    e.preventDefault();
                    tabElements.forEach(t => t.classList.remove('active'));
                    this.classList.add('active');
                    
                    const target = document.querySelector(this.getAttribute('data-bs-target'));
                    const tabContents = document.querySelectorAll('.tab-pane');
                    tabContents.forEach(tc => tc.classList.remove('show', 'active'));
                    if (target) {
                        target.classList.add('show', 'active');
                    }
                });
            });
        }
    }
    
    if (!symptomForm) return;
    
    // Initialize image upload functionality
    if (imageUploadInput) {
        imageUploadInput.addEventListener('change', function(e) {
            const file = this.files[0];
            if (file) {
                // Check file type
                if (!file.type.match('image.*')) {
                    showError('Please upload an image file');
                    this.value = '';
                    return;
                }
                
                // Check file size (limit to 5MB)
                if (file.size > 5 * 1024 * 1024) {
                    showError('Image file size must be less than 5MB');
                    this.value = '';
                    return;
                }
                
                // Show preview
                const reader = new FileReader();
                reader.onload = function(e) {
                    imagePreview.src = e.target.result;
                    imagePreviewContainer.classList.remove('d-none');
                    removeImageBtn.classList.remove('d-none');
                };
                reader.readAsDataURL(file);
            }
        });
        
        // Remove image button
        if (removeImageBtn) {
            removeImageBtn.addEventListener('click', function() {
                imageUploadInput.value = '';
                imagePreview.src = '';
                imagePreviewContainer.classList.add('d-none');
                this.classList.add('d-none');
            });
        }
    }
    
    symptomForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Get form data
        const symptomsInput = document.getElementById('symptoms').value;
        const ageInput = document.getElementById('age').value;
        const genderInput = document.getElementById('gender').value;
        const durationInput = document.getElementById('duration').value;
        const severityInput = document.getElementById('severity').value;
        const medicalHistoryInput = document.getElementById('medical_history').value;
        
        // Validate required fields
        if (!symptomsInput) {
            showError('Please enter your symptoms');
            return;
        }
        
        // Show loading state
        loadingSpinner.classList.remove('d-none');
        submitButton.disabled = true;
        analysisResults.innerHTML = '';
        if (imageAnalysisResults) {
            imageAnalysisResults.innerHTML = '';
        }
        
        // Get image data if uploaded
        let imageData = '';
        if (imageUploadInput && imageUploadInput.files.length > 0) {
            imageData = imagePreview.src;
        }
        
        // Prepare data for API call
        const data = {
            symptoms: symptomsInput,
            age: ageInput,
            gender: genderInput,
            duration: durationInput,
            severity: severityInput,
            medical_history: medicalHistoryInput,
            image_data: imageData
        };
        
        // Send API request
        fetch('/symptom-checker', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            // Hide loading state
            loadingSpinner.classList.add('d-none');
            submitButton.disabled = false;
            
            if (data.success) {
                // Show tabs container
                const resultsTabs = document.getElementById('results-tabs');
                if (resultsTabs) {
                    resultsTabs.classList.remove('d-none');
                }
                
                // Display text analysis
                displayAnalysisResults(data.analysis);
                
                // Handle image analysis if present
                if (data.has_image && data.image_analysis) {
                    displayImageAnalysisResults(data.image_analysis);
                    
                    // Show image analysis tab
                    if (imageAnalysisTab) {
                        imageAnalysisTab.classList.remove('d-none');
                        imageAnalysisTab.click(); // Auto-select the image tab
                    }
                } else {
                    // Hide image analysis tab
                    if (imageAnalysisTab) {
                        imageAnalysisTab.classList.add('d-none');
                    }
                    
                    // Make sure text tab is active
                    if (textAnalysisTab) {
                        textAnalysisTab.click();
                    }
                }
                
                // Show the doctor finder suggestion
                document.getElementById('doctor-finder-suggestion').classList.remove('d-none');
            } else {
                showError(data.message || 'An error occurred during analysis');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            loadingSpinner.classList.add('d-none');
            submitButton.disabled = false;
            showError('An error occurred while processing your request');
        });
    });
    
    function displayAnalysisResults(analysis) {
        // Clear previous results
        analysisResults.innerHTML = '';
        
        // Process the analysis text
        const sections = [
            "Possible Conditions:",
            "Key Symptoms Analysis:",
            "Risk Factors:",
            "Recommended Next Steps:",
            "Warning Signs:",
            "Preventive Measures:"
        ];
        
        // Split analysis by sections and create formatted HTML
        let currentSectionContent = '';
        let currentSectionTitle = '';
        let htmlContent = '';
        
        const lines = analysis.split('\n');
        
        lines.forEach(line => {
            // Check if line is a section title
            const isSectionTitle = sections.some(section => line.trim().startsWith(section));
            
            if (isSectionTitle) {
                // Add previous section content if exists
                if (currentSectionTitle && currentSectionContent) {
                    htmlContent += createSectionHtml(currentSectionTitle, currentSectionContent);
                    currentSectionContent = '';
                }
                currentSectionTitle = line.trim();
            } else if (currentSectionTitle) {
                // Add content to current section
                currentSectionContent += line + '\n';
            }
        });
        
        // Add the last section
        if (currentSectionTitle && currentSectionContent) {
            htmlContent += createSectionHtml(currentSectionTitle, currentSectionContent);
        }
        
        // Add the disclaimer
        htmlContent += `
            <div class="alert alert-warning mt-4">
                <strong>Disclaimer:</strong> This is an AI-generated analysis for informational purposes only. 
                Please consult with a healthcare provider for proper medical diagnosis and treatment.
            </div>
        `;
        
        // Display the formatted results
        analysisResults.innerHTML = htmlContent;
        
        // Scroll to results tabs if available, otherwise scroll to results directly
        const resultsElement = document.getElementById('results-tabs') || analysisResults;
        resultsElement.scrollIntoView({ behavior: 'smooth' });
    }
    
    function displayImageAnalysisResults(analysis) {
        if (!imageAnalysisResults) return;
        
        // Clear previous results
        imageAnalysisResults.innerHTML = '';
        
        // Process the image analysis text
        const sections = [
            "Visual Findings:",
            "Potential Diagnoses:",
            "Recommended Medical Specialties:",
            "Important Notes:"
        ];
        
        // Define icons and colors for each section
        const sectionStyles = {
            "Visual Findings:": {
                icon: 'fas fa-eye',
                colorClass: 'border-info'
            },
            "Potential Diagnoses:": {
                icon: 'fas fa-stethoscope',
                colorClass: 'border-primary'
            },
            "Recommended Medical Specialties:": {
                icon: 'fas fa-user-md',
                colorClass: 'border-success'
            },
            "Important Notes:": {
                icon: 'fas fa-exclamation-circle',
                colorClass: 'border-danger'
            }
        };
        
        // Split analysis by sections
        let currentSectionContent = '';
        let currentSectionTitle = '';
        let htmlContent = '';
        
        const lines = analysis.split('\n');
        
        lines.forEach(line => {
            // Check if line is a section title
            const isSectionTitle = sections.some(section => line.trim().startsWith(section));
            
            if (isSectionTitle) {
                // Add previous section content if exists
                if (currentSectionTitle && currentSectionContent) {
                    const style = sectionStyles[currentSectionTitle] || { icon: 'fas fa-info-circle', colorClass: 'border-secondary' };
                    htmlContent += createSectionHtml(currentSectionTitle, currentSectionContent, style.icon, style.colorClass);
                    currentSectionContent = '';
                }
                currentSectionTitle = line.trim();
            } else if (currentSectionTitle) {
                // Add content to current section
                currentSectionContent += line + '\n';
            }
        });
        
        // Add the last section
        if (currentSectionTitle && currentSectionContent) {
            const style = sectionStyles[currentSectionTitle] || { icon: 'fas fa-info-circle', colorClass: 'border-secondary' };
            htmlContent += createSectionHtml(currentSectionTitle, currentSectionContent, style.icon, style.colorClass);
        }
        
        // Add the image display at the top
        if (imagePreview && imagePreview.src) {
            const imageDisplayHtml = `
                <div class="card border-dark mb-4 analysis-section fade-in">
                    <div class="card-header d-flex align-items-center">
                        <i class="fas fa-image me-2"></i>
                        <h5 class="mb-0">Uploaded Medical Image</h5>
                    </div>
                    <div class="card-body text-center">
                        <img src="${imagePreview.src}" class="img-fluid rounded" style="max-height: 300px;" alt="Medical image for analysis">
                    </div>
                </div>
            `;
            htmlContent = imageDisplayHtml + htmlContent;
        }
        
        // Add the disclaimer
        htmlContent += `
            <div class="alert alert-warning mt-4">
                <strong>Important:</strong> This image analysis is provided for informational purposes only and is not a substitute for professional medical diagnosis.
                Please consult with a healthcare provider for proper medical evaluation.
            </div>
        `;
        
        // Display the formatted results
        imageAnalysisResults.innerHTML = htmlContent;
    }
    
    function createSectionHtml(title, content, iconClass = 'fas fa-info-circle', cardClass = 'border-primary') {
        // Set default icon and class based on title if not provided
        if (iconClass === 'fas fa-info-circle') {
            if (title.includes('Possible Conditions')) {
                iconClass = 'fas fa-stethoscope';
                cardClass = 'border-primary';
            } else if (title.includes('Key Symptoms')) {
                iconClass = 'fas fa-list-ul';
                cardClass = 'border-info';
            } else if (title.includes('Risk Factors')) {
                iconClass = 'fas fa-exclamation-triangle';
                cardClass = 'border-warning';
            } else if (title.includes('Next Steps')) {
                iconClass = 'fas fa-clipboard-check';
                cardClass = 'border-success';
            } else if (title.includes('Warning Signs')) {
                iconClass = 'fas fa-exclamation-circle';
                cardClass = 'border-danger';
            } else if (title.includes('Preventive')) {
                iconClass = 'fas fa-shield-alt';
                cardClass = 'border-secondary';
            }
        }
        
        // Format the content
        let formattedContent = content.trim();
        formattedContent = formattedContent.replace(/\n/g, '<br>');
        
        // Format list items with bullet points
        formattedContent = formattedContent.replace(/- (.*?)(?=<br>|$)/g, '<li>$1</li>');
        formattedContent = formattedContent.replace(/\d+\. (.*?)(?=<br>|$)/g, '<li>$1</li>');
        
        if (formattedContent.includes('<li>')) {
            formattedContent = '<ul class="mb-0">' + formattedContent + '</ul>';
        }
        
        // Create HTML for the section
        return `
            <div class="card ${cardClass} my-3 analysis-section fade-in">
                <div class="card-header d-flex align-items-center">
                    <i class="${iconClass} me-2"></i>
                    <h5 class="mb-0">${title}</h5>
                </div>
                <div class="card-body">
                    ${formattedContent}
                </div>
            </div>
        `;
    }
    
    function showError(message) {
        const errorAlert = `
            <div class="alert alert-danger alert-dismissible fade show" role="alert">
                ${message}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            </div>
        `;
        
        document.getElementById('symptom-form-alerts').innerHTML = errorAlert;
    }
});
