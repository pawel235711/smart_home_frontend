// Smart Home Interface JavaScript

class SmartHomeInterface {
    constructor() {
        this.devices = {
            lights: {
                livingRoom: { name: 'Living room light', brightness: 75, isOn: true }
            },
            climate: {
                livingRoom: { temperature: 22, mode: 'A2M3', room: 'Living Room' }
            },
            energy: {
                current: '1.ail',
                history: []
            },
            security: {
                cameras: ['Camera', 'Backyard'],
                activeCamera: 'Camera'
            }
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateInterface();
        this.startPeriodicUpdates();
    }

    setupEventListeners() {
        // Navigation icons
        document.querySelectorAll('.nav-icon').forEach(icon => {
            icon.addEventListener('click', (e) => this.handleNavigation(e));
        });

        // Light slider interaction
        const lightSlider = document.querySelector('.light-slider');
        if (lightSlider) {
            lightSlider.addEventListener('click', (e) => this.handleLightSlider(e));
        }

        // Security tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.addEventListener('click', (e) => this.handleSecurityTab(e));
        });

        // Suggestion buttons
        document.querySelectorAll('.suggestion-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.handleSuggestion(e));
        });

        // Voice assistant
        const voiceAssistant = document.querySelector('.voice-assistant');
        if (voiceAssistant) {
            voiceAssistant.addEventListener('click', () => this.handleVoiceAssistant());
        }

        // View schedule button
        const scheduleBtn = document.querySelector('.view-schedule-btn');
        if (scheduleBtn) {
            scheduleBtn.addEventListener('click', () => this.handleViewSchedule());
        }
    }

    handleNavigation(e) {
        // Remove active class from all nav icons
        document.querySelectorAll('.nav-icon').forEach(icon => {
            icon.classList.remove('active');
        });
        
        // Add active class to clicked icon
        e.currentTarget.classList.add('active');
        
        // Handle navigation logic based on icon
        const icon = e.currentTarget.querySelector('.material-icons').textContent;
        console.log(`Navigation: ${icon}`);
    }

    handleLightSlider(e) {
        const slider = e.currentTarget;
        const rect = slider.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
        
        this.devices.lights.livingRoom.brightness = Math.round(percentage);
        this.updateLightControl();
        
        console.log(`Light brightness set to: ${this.devices.lights.livingRoom.brightness}%`);
    }

    handleSecurityTab(e) {
        // Remove active class from all tabs
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        
        // Add active class to clicked tab
        e.currentTarget.classList.add('active');
        
        const tabName = e.currentTarget.textContent;
        this.devices.security.activeCamera = tabName;
        
        console.log(`Security camera switched to: ${tabName}`);
    }

    handleSuggestion(e) {
        const suggestion = e.currentTarget.querySelector('span:nth-child(2)').textContent;
        console.log(`Suggestion clicked: ${suggestion}`);
        
        // Simulate executing the suggestion
        this.executeSuggestion(suggestion);
    }

    executeSuggestion(suggestion) {
        if (suggestion.includes('coffee maker')) {
            this.showNotification('Coffee maker turned on');
        } else if (suggestion.includes('24°C')) {
            this.devices.climate.livingRoom.temperature = 24;
            this.updateClimateControl();
            this.showNotification('Temperature set to 24°C');
        } else if (suggestion.includes('security system')) {
            this.showNotification('Security system armed');
        }
    }

    handleVoiceAssistant() {
        console.log('Voice assistant activated');
        this.showNotification('Voice assistant listening...');
        
        // Simulate voice recognition
        setTimeout(() => {
            this.showNotification('Voice command processed');
        }, 2000);
    }

    handleViewSchedule() {
        console.log('View schedule clicked');
        this.showNotification('Schedule view opened');
    }

    updateInterface() {
        this.updateLightControl();
        this.updateClimateControl();
        this.updateEnergyInfo();
        this.updateGreeting();
    }

    updateLightControl() {
        const light = this.devices.lights.livingRoom;
        const percentageElement = document.querySelector('.light-percentage');
        const sliderFill = document.querySelector('.slider-fill');
        const sliderThumb = document.querySelector('.slider-thumb');
        
        if (percentageElement) {
            percentageElement.textContent = `${light.brightness}%`;
        }
        
        if (sliderFill) {
            sliderFill.style.width = `${light.brightness}%`;
        }
        
        if (sliderThumb) {
            sliderThumb.style.left = `${light.brightness}%`;
        }
    }

    updateClimateControl() {
        const climate = this.devices.climate.livingRoom;
        const tempDisplay = document.querySelector('.temperature-display');
        const roomName = document.querySelector('.room-name');
        
        if (tempDisplay) {
            tempDisplay.textContent = `${climate.temperature}°`;
        }
        
        if (roomName) {
            roomName.textContent = climate.room;
        }
    }

    updateEnergyInfo() {
        const energyUsage = document.querySelector('.energy-usage');
        if (energyUsage) {
            energyUsage.textContent = this.devices.energy.current;
        }
    }

    updateGreeting() {
        const now = new Date();
        const hour = now.getHours();
        let greeting = 'Good evening!';
        
        if (hour < 12) {
            greeting = 'Good morning!';
        } else if (hour < 18) {
            greeting = 'Good afternoon!';
        }
        
        const greetingElement = document.querySelector('.greeting');
        if (greetingElement) {
            greetingElement.textContent = greeting;
        }
        
        // Update time
        const timeElement = document.querySelector('.time');
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('en-US', { 
                hour: 'numeric', 
                minute: '2-digit',
                hour12: false 
            });
        }
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #00d4ff;
            color: #000;
            padding: 12px 20px;
            border-radius: 8px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(notification);
        
        // Remove notification after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    startPeriodicUpdates() {
        // Update time every minute
        setInterval(() => {
            this.updateGreeting();
        }, 60000);
        
        // Simulate energy usage updates
        setInterval(() => {
            const usage = (Math.random() * 2 + 1).toFixed(1);
            this.devices.energy.current = `${usage}ail`;
            this.updateEnergyInfo();
        }, 30000);
    }

    // API integration methods (for future use)
    async fetchDeviceStatus() {
        try {
            const response = await fetch('/api/devices');
            const devices = await response.json();
            return devices;
        } catch (error) {
            console.error('Failed to fetch device status:', error);
            return null;
        }
    }

    async controlDevice(deviceId, action, value) {
        try {
            const response = await fetch(`/api/devices/${deviceId}/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action, value })
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to control device:', error);
            return null;
        }
    }

    async sendChatMessage(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ message })
            });
            
            const result = await response.json();
            return result;
        } catch (error) {
            console.error('Failed to send chat message:', error);
            return null;
        }
    }
}

// Initialize the interface when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.smartHome = new SmartHomeInterface();
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SmartHomeInterface;
}

