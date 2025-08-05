// Smart Home Control - Main JavaScript

// Global state
let devices = [];
let rooms = [];
let currentFilter = 'all';
let isConfigOpen = false;
let isChatOpen = true;

// API Base URL
const API_BASE = '/api';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

async function initializeApp() {
    showLoading(true);
    
    try {
        await Promise.all([
            loadDevices(),
            loadRooms(),
            updateQuickStatus()
        ]);
        
        renderDevices();
        setupEventListeners();
        
        showNotification('Smart Home System Initialized', 'success');
    } catch (error) {
        console.error('Failed to initialize app:', error);
        showNotification('Failed to initialize system', 'error');
    } finally {
        showLoading(false);
    }
}

// API Functions
async function apiCall(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const response = await fetch(url, { ...defaultOptions, ...options });
    
    if (!response.ok) {
        throw new Error(`API call failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json();
}

async function loadDevices() {
    try {
        const data = await apiCall('/devices');
        devices = data.devices || [];
        console.log('Loaded devices:', devices);
    } catch (error) {
        console.error('Failed to load devices:', error);
        devices = [];
    }
}

async function loadRooms() {
    try {
        const data = await apiCall('/rooms');
        rooms = data.rooms || [];
        updateRoomFilter();
    } catch (error) {
        console.error('Failed to load rooms:', error);
        rooms = [];
    }
}

async function updateQuickStatus() {
    try {
        // Calculate status from devices
        const activeDevices = devices.filter(d => d.current_state?.power === true).length;
        const totalDevices = devices.length;
        
        // Update energy usage (mock calculation)
        const energyUsage = devices.reduce((total, device) => {
            if (device.current_state?.power === true) {
                switch (device.device_type) {
                    case 'light': return total + 0.1;
                    case 'jacuzzi': return total + 2.5;
                    case 'thermostat': return total + 1.2;
                    case 'recuperation': return total + 0.8;
                    default: return total + 0.5;
                }
            }
            return total;
        }, 0);
        
        // Update average temperature
        const thermostats = devices.filter(d => d.device_type === 'thermostat');
        const avgTemp = thermostats.length > 0 
            ? thermostats.reduce((sum, t) => sum + (t.current_state?.current_temperature || 22), 0) / thermostats.length
            : 22;
        
        // Update DOM
        document.getElementById('total-energy').textContent = `${energyUsage.toFixed(1)} kW`;
        document.getElementById('avg-temperature').textContent = `${avgTemp.toFixed(1)}°C`;
        document.getElementById('active-devices').textContent = `${activeDevices}/${totalDevices}`;
        
    } catch (error) {
        console.error('Failed to update status:', error);
    }
}

// Device Rendering
function renderDevices() {
    const container = document.getElementById('devices-grid');
    if (!container) return;
    
    const filteredDevices = currentFilter === 'all' 
        ? devices 
        : devices.filter(device => device.room === currentFilter);
    
    if (filteredDevices.length === 0) {
        container.innerHTML = `
            <div class="no-devices">
                <p>No devices found${currentFilter !== 'all' ? ' in this room' : ''}.</p>
                <button class="action-btn primary" onclick="addDevice()">
                    <span class="material-icons">add</span>
                    Add Device
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = filteredDevices.map(device => renderDeviceCard(device)).join('');
}

function renderDeviceCard(device) {
    const isOnline = device.enabled && device.current_state;
    const isPowered = device.current_state?.power === true;
    
    switch (device.device_type) {
        case 'thermostat':
            return renderThermostatCard(device, isOnline, isPowered);
        case 'light':
            return renderLightCard(device, isOnline, isPowered);
        case 'jacuzzi':
            return renderJacuzziCard(device, isOnline, isPowered);
        case 'powerwall':
            return renderPowerwallCard(device, isOnline, isPowered);
        case 'recuperation':
            return renderRecuperationCard(device, isOnline, isPowered);
        default:
            return renderGenericCard(device, isOnline, isPowered);
    }
}

function renderThermostatCard(device, isOnline, isPowered) {
    const currentTemp = device.current_state?.current_temperature || 22;
    const targetTemp = device.current_state?.target_temperature || 22;
    const mode = device.current_state?.mode || 'auto';
    const humidity = device.current_state?.humidity || 45;
    
    return `
        <div class="device-card thermostat" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">thermostat</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isPowered ? 'Active' : 'Standby') : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
            
            <div class="thermostat-display">
                <div class="temperature-circle" onclick="adjustTemperature('${device.id}')">
                    <div class="current-temp">${currentTemp.toFixed(1)}°</div>
                    <div class="target-temp">Target: ${targetTemp.toFixed(1)}°</div>
                </div>
                
                <div class="thermostat-info">
                    <div class="thermostat-mode">
                        ${['heat', 'cool', 'auto', 'off'].map(m => 
                            `<button class="mode-btn ${mode === m ? 'active' : ''}" 
                                     onclick="setThermostatMode('${device.id}', '${m}')">${m}</button>`
                        ).join('')}
                    </div>
                    
                    <div class="thermostat-stats">
                        <div class="stat-item">
                            <div class="stat-value">${humidity}%</div>
                            <div class="stat-label">Humidity</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${mode}</div>
                            <div class="stat-label">Mode</div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="device-controls-section">
                <div class="control-group">
                    <label class="control-label">Target Temperature</label>
                    <div class="slider-control">
                        <input type="range" class="slider" min="10" max="35" step="0.5" 
                               value="${targetTemp}" 
                               onchange="setDeviceProperty('${device.id}', 'target_temperature', this.value)">
                        <span class="slider-value">${targetTemp.toFixed(1)}°C</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderLightCard(device, isOnline, isPowered) {
    const brightness = device.current_state?.brightness || 50;
    
    return `
        <div class="device-card light" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">lightbulb</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isPowered ? `${brightness}% Brightness` : 'Off') : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
            
            <div class="device-controls-section">
                <div class="control-group">
                    <label class="control-label">Brightness</label>
                    <div class="slider-control">
                        <input type="range" class="slider" min="0" max="100" 
                               value="${brightness}" 
                               onchange="setDeviceProperty('${device.id}', 'brightness', this.value)"
                               ${!isPowered ? 'disabled' : ''}>
                        <span class="slider-value">${brightness}%</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderJacuzziCard(device, isOnline, isPowered) {
    const temperature = device.current_state?.temperature || 37;
    const timer = device.current_state?.timer || 0;
    
    return `
        <div class="device-card jacuzzi" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">hot_tub</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isPowered ? `${temperature}°C` : 'Off') : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
            
            <div class="device-controls-section">
                <div class="control-group">
                    <label class="control-label">Temperature</label>
                    <div class="slider-control">
                        <input type="range" class="slider" min="20" max="40" step="0.5"
                               value="${temperature}" 
                               onchange="setDeviceProperty('${device.id}', 'temperature', this.value)"
                               ${!isPowered ? 'disabled' : ''}>
                        <span class="slider-value">${temperature}°C</span>
                    </div>
                </div>
                
                <div class="control-group">
                    <label class="control-label">Timer</label>
                    <div class="slider-control">
                        <input type="range" class="slider" min="0" max="120" step="5"
                               value="${timer}" 
                               onchange="setDeviceProperty('${device.id}', 'timer', this.value)"
                               ${!isPowered ? 'disabled' : ''}>
                        <span class="slider-value">${timer} min</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPowerwallCard(device, isOnline, isPowered) {
    const chargeLevel = device.current_state?.charge_level || 85;
    const chargingMode = device.current_state?.charging_mode || 'auto';
    
    return `
        <div class="device-card powerwall" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">battery_charging_full</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? `${chargeLevel}% - ${chargingMode}` : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
            
            <div class="device-controls-section">
                <div class="control-group">
                    <label class="control-label">Charging Mode</label>
                    <div class="dropdown-control">
                        <select onchange="setDeviceProperty('${device.id}', 'charging_mode', this.value)"
                                ${!isPowered ? 'disabled' : ''}>
                            <option value="auto" ${chargingMode === 'auto' ? 'selected' : ''}>Auto</option>
                            <option value="charge" ${chargingMode === 'charge' ? 'selected' : ''}>Charge</option>
                            <option value="discharge" ${chargingMode === 'discharge' ? 'selected' : ''}>Discharge</option>
                            <option value="standby" ${chargingMode === 'standby' ? 'selected' : ''}>Standby</option>
                        </select>
                    </div>
                </div>
                
                <div class="battery-indicator">
                    <div class="battery-level" style="width: ${chargeLevel}%"></div>
                    <span class="battery-text">${chargeLevel}%</span>
                </div>
            </div>
        </div>
    `;
}

function renderRecuperationCard(device, isOnline, isPowered) {
    const fanSpeed = device.current_state?.fan_speed || 2;
    const mode = device.current_state?.mode || 'auto';
    
    return `
        <div class="device-card recuperation" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">air</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isPowered ? `Speed ${fanSpeed} - ${mode}` : 'Off') : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
            
            <div class="device-controls-section">
                <div class="control-group">
                    <label class="control-label">Fan Speed</label>
                    <div class="slider-control">
                        <input type="range" class="slider" min="1" max="5" 
                               value="${fanSpeed}" 
                               onchange="setDeviceProperty('${device.id}', 'fan_speed', this.value)"
                               ${!isPowered ? 'disabled' : ''}>
                        <span class="slider-value">${fanSpeed}</span>
                    </div>
                </div>
                
                <div class="control-group">
                    <label class="control-label">Mode</label>
                    <div class="dropdown-control">
                        <select onchange="setDeviceProperty('${device.id}', 'mode', this.value)"
                                ${!isPowered ? 'disabled' : ''}>
                            <option value="auto" ${mode === 'auto' ? 'selected' : ''}>Auto</option>
                            <option value="manual" ${mode === 'manual' ? 'selected' : ''}>Manual</option>
                            <option value="eco" ${mode === 'eco' ? 'selected' : ''}>Eco</option>
                            <option value="boost" ${mode === 'boost' ? 'selected' : ''}>Boost</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderGenericCard(device, isOnline, isPowered) {
    return `
        <div class="device-card generic" data-device-id="${device.id}">
            <div class="device-header">
                <div class="device-info">
                    <div class="device-icon">
                        <span class="material-icons">device_unknown</span>
                    </div>
                    <div class="device-details">
                        <h3>${device.name}</h3>
                        <p class="device-status ${isOnline ? 'online' : 'offline'}">
                            ${isOnline ? (isPowered ? 'Active' : 'Standby') : 'Offline'}
                        </p>
                    </div>
                </div>
                <div class="power-toggle ${isPowered ? 'on' : ''}" onclick="toggleDevice('${device.id}', 'power')"></div>
            </div>
        </div>
    `;
}

// Device Control Functions
async function toggleDevice(deviceId, property) {
    const device = devices.find(d => d.id === deviceId);
    if (!device) return;
    
    const currentValue = device.current_state?.[property] || false;
    const newValue = !currentValue;
    
    try {
        await setDeviceProperty(deviceId, property, newValue);
    } catch (error) {
        console.error('Failed to toggle device:', error);
        showNotification('Failed to control device', 'error');
    }
}

async function setDeviceProperty(deviceId, property, value) {
    try {
        const data = await apiCall(`/devices/${deviceId}/control`, {
            method: 'POST',
            body: JSON.stringify({ [property]: value })
        });
        
        // Update local state
        const device = devices.find(d => d.id === deviceId);
        if (device) {
            if (!device.current_state) device.current_state = {};
            device.current_state[property] = value;
            
            // Update UI
            renderDevices();
            updateQuickStatus();
        }
        
        showNotification(`${property} updated successfully`, 'success');
    } catch (error) {
        console.error('Failed to set device property:', error);
        showNotification('Failed to update device', 'error');
    }
}

async function setThermostatMode(deviceId, mode) {
    await setDeviceProperty(deviceId, 'mode', mode);
}

// UI Helper Functions
function updateRoomFilter() {
    const select = document.getElementById('room-filter');
    if (!select) return;
    
    // Keep existing options and add new rooms
    const existingOptions = Array.from(select.options).map(opt => opt.value);
    
    rooms.forEach(room => {
        if (!existingOptions.includes(room.id)) {
            const option = document.createElement('option');
            option.value = room.id;
            option.textContent = room.name;
            select.appendChild(option);
        }
    });
}

function filterDevices() {
    const select = document.getElementById('room-filter');
    currentFilter = select.value;
    renderDevices();
}

function toggleConfig() {
    const panel = document.getElementById('config-panel');
    isConfigOpen = !isConfigOpen;
    
    if (isConfigOpen) {
        panel.classList.add('open');
        loadConfigurationData();
    } else {
        panel.classList.remove('open');
    }
}

function toggleChat() {
    const container = document.getElementById('chat-container');
    const toggle = document.querySelector('.chat-toggle span');
    
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) {
        container.classList.remove('collapsed');
        toggle.textContent = 'expand_less';
    } else {
        container.classList.add('collapsed');
        toggle.textContent = 'expand_more';
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <p>${message}</p>
        <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; color: inherit; cursor: pointer;">×</button>
    `;
    
    container.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Event Listeners
function setupEventListeners() {
    // Update slider values in real-time
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('slider')) {
            const valueSpan = e.target.parentElement.querySelector('.slider-value');
            if (valueSpan) {
                const unit = valueSpan.textContent.replace(/[\d.]/g, '');
                valueSpan.textContent = e.target.value + unit;
            }
        }
    });
    
    // Close config panel when clicking outside
    document.addEventListener('click', function(e) {
        const panel = document.getElementById('config-panel');
        const configBtn = document.querySelector('.config-btn');
        
        if (isConfigOpen && !panel.contains(e.target) && !configBtn.contains(e.target)) {
            toggleConfig();
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            if (isConfigOpen) toggleConfig();
        }
    });
}

// Placeholder functions for configuration
function addDevice() {
    showNotification('Device configuration will be implemented in the next phase', 'info');
}

function discoverDevices() {
    showNotification('Device discovery will be implemented in the next phase', 'info');
}

function exportConfig() {
    showNotification('Configuration export will be implemented in the next phase', 'info');
}

function importConfig() {
    showNotification('Configuration import will be implemented in the next phase', 'info');
}

function loadConfigurationData() {
    // This will be implemented in the configuration phase
    console.log('Loading configuration data...');
}

// Temperature adjustment for thermostat
function adjustTemperature(deviceId) {
    // This could open a modal or enable direct manipulation
    showNotification('Use the slider below to adjust temperature', 'info');
}

