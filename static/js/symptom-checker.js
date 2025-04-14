document.addEventListener('DOMContentLoaded', function() {
    const symptomForm = document.getElementById('symptom-form');
    const analysisResults = document.getElementById('analysis-results');
    const loadingSpinner = document.getElementById('loading-spinner');
    const submitButton = document.getElementById('submit-symptoms');
    
    if (!symptomForm) return;
    
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
        
        // Prepare data for API call
        const data = {
            symptoms: symptomsInput,
            age: ageInput,
            gender: genderInput,
            duration: durationInput,
            severity: severityInput,
            medical_history: medicalHistoryInput
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
                displayAnalysisResults(data.analysis);
                
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
        
        // Scroll to results
        analysisResults.scrollIntoView({ behavior: 'smooth' });
    }
    
    function createSectionHtml(title, content) {
        // Format section title
        let iconClass = 'fas fa-info-circle';
        let cardClass = 'card-primary';
        
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
