/**
 * NeuroRoute API Client-side JavaScript
 * Handles form submission, API interaction, and response display
 */

document.addEventListener('DOMContentLoaded', function() {
    // Elements
    const promptForm = document.getElementById('prompt-form');
    const promptInput = document.getElementById('prompt-input');
    const modelSelect = document.getElementById('model-select');
    const prioritySelect = document.getElementById('priority-select');
    const responseContainer = document.getElementById('response-container');
    const responseText = document.getElementById('response-text');
    const modelUsed = document.getElementById('model-used');
    const latency = document.getElementById('latency');
    const tokenUsage = document.getElementById('token-usage');
    const errorMessage = document.getElementById('error-message');
    
    // Initialize health check
    checkApiHealth();
    
    // Form submission
    if (promptForm) {
        promptForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Clear previous responses and errors
            responseText.textContent = '';
            modelUsed.textContent = '';
            latency.textContent = '';
            tokenUsage.textContent = '';
            errorMessage.textContent = '';
            
            // Show loading state
            responseContainer.classList.add('loading');
            responseContainer.style.display = 'block';
            
            // Get form values
            const prompt = promptInput.value.trim();
            const model = modelSelect.value;
            const priority = prioritySelect.value;
            
            if (!prompt) {
                errorMessage.textContent = 'Please enter a prompt';
                responseContainer.classList.remove('loading');
                return;
            }
            
            try {
                // Prepare request data
                const requestData = {
                    prompt: prompt,
                    metadata: {
                        request_id: generateRequestId(),
                        use_cache: true
                    }
                };
                
                // Add model selection if specified
                if (model && model !== 'auto') {
                    requestData.metadata.model = model;
                }
                
                // Add priority if specified
                if (priority) {
                    requestData.metadata.priority = priority;
                }
                
                // Send request to API
                const response = await fetch('/prompt', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(requestData)
                });
                
                // Parse response
                const data = await response.json();
                
                if (!response.ok) {
                    throw new Error(data.detail || 'Failed to process prompt');
                }
                
                // Display response
                responseText.textContent = data.response;
                modelUsed.textContent = data.model_used;
                latency.textContent = `${data.latency_ms}ms`;
                
                // Display token usage if available
                if (data.token_usage) {
                    const total = data.token_usage.total_tokens || 0;
                    tokenUsage.textContent = `${total} tokens`;
                }
                
                // Add model badge class
                modelUsed.className = 'model-badge';
                modelUsed.classList.add(`model-${data.model_used}`);
                
            } catch (error) {
                console.error('Error:', error);
                errorMessage.textContent = error.message;
            } finally {
                responseContainer.classList.remove('loading');
            }
        });
    }
    
    // Health check function
    async function checkApiHealth() {
        const healthStatus = document.getElementById('health-status');
        if (!healthStatus) return;
        
        try {
            const response = await fetch('/health');
            const data = await response.json();
            
            healthStatus.textContent = data.status;
            healthStatus.className = 'status';
            healthStatus.classList.add(`status-${data.status}`);
            
            // Update model status indicators
            if (data.models) {
                Object.entries(data.models).forEach(([model, info]) => {
                    const modelStatus = document.getElementById(`${model}-status`);
                    if (modelStatus) {
                        modelStatus.textContent = info.status;
                        modelStatus.className = 'status';
                        modelStatus.classList.add(`status-${info.status}`);
                    }
                });
            }
        } catch (error) {
            console.error('Health check error:', error);
            if (healthStatus) {
                healthStatus.textContent = 'Error';
                healthStatus.className = 'status status-unhealthy';
            }
        }
    }
    
    // Generate a simple request ID
    function generateRequestId() {
        return 'req_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
    }
});