// Smart Home Control - Chat Interface with LLM Integration

// Chat state
let chatHistory = [];
let isVoiceRecording = false;
let voiceRecognition = null;
let isProcessing = false;

// Initialize chat interface
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    // Initialize speech recognition if available
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        voiceRecognition = new SpeechRecognition();
        voiceRecognition.continuous = false;
        voiceRecognition.interimResults = false;
        voiceRecognition.lang = 'en-US';
        
        voiceRecognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('chat-input').value = transcript;
            sendMessage();
        };
        
        voiceRecognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            showNotification('Voice recognition failed', 'error');
            stopVoiceInput();
        };
        
        voiceRecognition.onend = function() {
            stopVoiceInput();
        };
    }
    
    // Load chat history
    loadChatHistory();
}

// Chat functions
async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    
    if (!message || isProcessing) return;
    
    // Add user message to chat
    addMessageToChat(message, 'user');
    
    // Clear input
    input.value = '';
    
    // Process message with LLM
    await processUserMessage(message);
}

function sendQuickCommand(command) {
    if (isProcessing) return;
    
    document.getElementById('chat-input').value = command;
    sendMessage();
}

function addMessageToChat(message, sender, actions = []) {
    const messagesContainer = document.getElementById('chat-messages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${sender}-message`;
    
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let actionsHtml = '';
    if (actions && actions.length > 0) {
        actionsHtml = `
            <div class="message-actions">
                <p><strong>Actions performed:</strong></p>
                <ul>
                    ${actions.map(action => `
                        <li>${action.device_name || action.device_type}: ${action.property} → ${action.value}</li>
                    `).join('')}
                </ul>
            </div>
        `;
    }
    
    messageElement.innerHTML = `
        <div class="message-content">
            <p>${message}</p>
            ${actionsHtml}
        </div>
        <div class="message-time">${timeString}</div>
    `;
    
    messagesContainer.appendChild(messageElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    
    // Store in history
    chatHistory.push({
        message,
        sender,
        actions: actions || [],
        timestamp: now.toISOString()
    });
}

// LLM message processing
async function processUserMessage(message) {
    if (isProcessing) return;
    
    isProcessing = true;
    
    try {
        // Show typing indicator
        showTypingIndicator();
        
        // Send to backend LLM API
        const response = await apiCall('/chat', {
            method: 'POST',
            body: JSON.stringify({
                message: message,
                context: {
                    history: getRecentHistory(5) // Send last 5 messages for context
                }
            })
        });
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add AI response to chat
        addMessageToChat(response.response, 'ai', response.execution_results || []);
        
        // Update device states if actions were performed
        if (response.execution_results && response.execution_results.length > 0) {
            // Refresh device display
            await loadDevices();
            renderDevices();
            updateQuickStatus();
            
            // Show success notification for successful actions
            const successfulActions = response.execution_results.filter(r => r.success);
            if (successfulActions.length > 0) {
                showNotification(`${successfulActions.length} device(s) controlled successfully`, 'success');
            }
            
            // Show error notification for failed actions
            const failedActions = response.execution_results.filter(r => !r.success);
            if (failedActions.length > 0) {
                showNotification(`${failedActions.length} action(s) failed`, 'error');
            }
        }
        
    } catch (error) {
        console.error('Failed to process message:', error);
        
        // Hide typing indicator
        hideTypingIndicator();
        
        // Add error response
        addMessageToChat('Sorry, I encountered an error processing your request. Please try again.', 'ai');
        showNotification('Failed to process message', 'error');
        
    } finally {
        isProcessing = false;
    }
}

function getRecentHistory(count) {
    return chatHistory
        .slice(-count * 2) // Get recent user-ai pairs
        .map(item => ({
            role: item.sender === 'user' ? 'user' : 'assistant',
            content: item.message
        }));
}

function showTypingIndicator() {
    const messagesContainer = document.getElementById('chat-messages');
    const typingElement = document.createElement('div');
    typingElement.className = 'message ai-message typing-indicator';
    typingElement.id = 'typing-indicator';
    
    typingElement.innerHTML = `
        <div class="message-content">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    `;
    
    messagesContainer.appendChild(typingElement);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function hideTypingIndicator() {
    const typingElement = document.getElementById('typing-indicator');
    if (typingElement) {
        typingElement.remove();
    }
}

// Voice input functions
function toggleVoiceInput() {
    if (!voiceRecognition) {
        showNotification('Voice recognition not supported in this browser', 'error');
        return;
    }
    
    if (isVoiceRecording) {
        stopVoiceInput();
    } else {
        startVoiceInput();
    }
}

function startVoiceInput() {
    if (!voiceRecognition || isProcessing) return;
    
    try {
        voiceRecognition.start();
        isVoiceRecording = true;
        
        const voiceBtn = document.querySelector('.voice-btn');
        voiceBtn.classList.add('recording');
        voiceBtn.innerHTML = '<span class="material-icons">mic_off</span>';
        
        showNotification('Listening... Speak now', 'info');
    } catch (error) {
        console.error('Failed to start voice recognition:', error);
        showNotification('Failed to start voice input', 'error');
    }
}

function stopVoiceInput() {
    if (!voiceRecognition) return;
    
    try {
        voiceRecognition.stop();
        isVoiceRecording = false;
        
        const voiceBtn = document.querySelector('.voice-btn');
        voiceBtn.classList.remove('recording');
        voiceBtn.innerHTML = '<span class="material-icons">mic</span>';
    } catch (error) {
        console.error('Failed to stop voice recognition:', error);
    }
}

// Keyboard event handler
function handleChatKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
    }
}

// Chat management functions
async function clearChat() {
    try {
        await apiCall('/chat/clear', { method: 'POST' });
        
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = `
            <div class="message ai-message">
                <div class="message-content">
                    <p>Hello! I'm your smart home assistant. How can I help you today?</p>
                </div>
                <div class="message-time">Just now</div>
            </div>
        `;
        
        chatHistory = [];
        showNotification('Chat cleared', 'info');
        
    } catch (error) {
        console.error('Failed to clear chat:', error);
        showNotification('Failed to clear chat', 'error');
    }
}

async function loadChatHistory() {
    try {
        const data = await apiCall('/chat/history');
        
        if (data.history && data.history.length > 0) {
            chatHistory = data.history;
            
            // Render chat history
            const messagesContainer = document.getElementById('chat-messages');
            messagesContainer.innerHTML = '';
            
            chatHistory.forEach(item => {
                addMessageToChat(item.message, item.sender, item.actions);
            });
        }
        
    } catch (error) {
        console.error('Failed to load chat history:', error);
        // Don't show error notification for this, just use default welcome message
    }
}

function exportChatHistory() {
    if (chatHistory.length === 0) {
        showNotification('No chat history to export', 'info');
        return;
    }
    
    const blob = new Blob([JSON.stringify(chatHistory, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `smart-home-chat-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showNotification('Chat history exported', 'success');
}

// Enhanced quick commands with context
function updateQuickCommands() {
    const quickCommandsContainer = document.querySelector('.quick-commands');
    if (!quickCommandsContainer) return;
    
    // Get current time to suggest contextual commands
    const hour = new Date().getHours();
    let contextualCommands = [];
    
    if (hour >= 6 && hour < 12) {
        // Morning commands
        contextualCommands = [
            '☀️ Good morning routine',
            '🌡️ Set comfortable temperature',
            '💡 Turn on kitchen lights'
        ];
    } else if (hour >= 12 && hour < 18) {
        // Afternoon commands
        contextualCommands = [
            '🏠 I\'m home',
            '❄️ Cool down the house',
            '🔋 Check energy status'
        ];
    } else if (hour >= 18 && hour < 22) {
        // Evening commands
        contextualCommands = [
            '🌅 Evening mode',
            '🛁 Prepare jacuzzi',
            '💡 Dim all lights'
        ];
    } else {
        // Night commands
        contextualCommands = [
            '🌙 Good night routine',
            '🔌 Turn off all devices',
            '🛡️ Security mode'
        ];
    }
    
    // Update quick command buttons
    quickCommandsContainer.innerHTML = contextualCommands.map(cmd => 
        `<button class="quick-cmd" onclick="sendQuickCommand('${cmd.substring(2)}')">${cmd}</button>`
    ).join('');
}

// System status integration
async function getSystemStatus() {
    try {
        const status = await apiCall('/chat/status');
        return status;
    } catch (error) {
        console.error('Failed to get system status:', error);
        return null;
    }
}

// Initialize contextual commands on load
document.addEventListener('DOMContentLoaded', function() {
    updateQuickCommands();
    
    // Update quick commands every hour
    setInterval(updateQuickCommands, 60 * 60 * 1000);
});

// Add CSS for typing indicator and message actions
const chatStyles = `
<style>
.typing-dots {
    display: flex;
    gap: 4px;
    padding: 8px 0;
}

.typing-dots span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-primary);
    animation: typing 1.4s infinite ease-in-out;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes typing {
    0%, 80%, 100% { transform: scale(0.8); opacity: 0.5; }
    40% { transform: scale(1); opacity: 1; }
}

.message-actions {
    margin-top: var(--spacing-sm);
    padding-top: var(--spacing-sm);
    border-top: 1px solid var(--border-color);
    font-size: var(--font-size-sm);
}

.message-actions ul {
    margin: var(--spacing-xs) 0 0 var(--spacing-md);
    color: var(--text-secondary);
}

.message-actions li {
    margin-bottom: var(--spacing-xs);
}

.voice-btn.recording {
    background: var(--accent-error);
    animation: pulse 1s infinite;
}

.quick-cmd {
    white-space: nowrap;
}

@media (max-width: 768px) {
    .quick-commands {
        grid-template-columns: 1fr;
    }
    
    .quick-cmd {
        white-space: normal;
        text-align: center;
    }
}
</style>
`;

// Inject styles
document.head.insertAdjacentHTML('beforeend', chatStyles);

