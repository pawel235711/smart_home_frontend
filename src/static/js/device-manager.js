// Smart Home Control - Device Manager

// Device management state
let deviceTemplates = {};
let configDevices = [];
let configRooms = [];
let currentConfigTab = 'devices';

// Initialize device manager
document.addEventListener('DOMContentLoaded', function() {
    loadDeviceTemplates();
});

// Load device templates from API
async function loadDeviceTemplates() {
    try {
        const data = await apiCall('/device-templates');
        deviceTemplates = data.templates || {};
        console.log('Loaded device templates:', deviceTemplates);
    } catch (error) {
        console.error('Failed to load device templates:', error);
        deviceTemplates = {};
    }
}

// Configuration panel functions
async function loadConfigurationData() {
    try {
        showLoading(true);
        
        // Load devices and rooms for configuration
        const [devicesData, roomsData] = await Promise.all([
            apiCall('/config/devices'),
            apiCall('/rooms')
        ]);
        
        configDevices = devicesData.devices || [];
        configRooms = roomsData.rooms || [];
        
        renderConfigurationTabs();
        
    } catch (error) {
        console.error('Failed to load configuration data:', error);
        showNotification('Failed to load configuration', 'error');
    } finally {
        showLoading(false);
    }
}

function renderConfigurationTabs() {
    switch (currentConfigTab) {
        case 'devices':
            renderDevicesConfig();
            break;
        case 'rooms':
            renderRoomsConfig();
            break;
        case 'settings':
            renderSettingsConfig();
            break;
    }
}

function switchConfigTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="switchConfigTab('${tabName}')"]`).classList.add('active');
    
    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.add('hidden');
    });
    document.getElementById(`${tabName}-tab`).classList.remove('hidden');
    
    currentConfigTab = tabName;
    renderConfigurationTabs();
}

function renderDevicesConfig() {
    const container = document.getElementById('config-device-list');
    if (!container) return;
    
    if (configDevices.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No devices configured</p>
                <button class="action-btn primary" onclick="addDevice()">
                    <span class="material-icons">add</span>
                    Add First Device
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = configDevices.map(device => `
        <div class="config-device-item" data-device-id="${device.id}">
            <div class="device-config-info">
                <div class="device-config-icon">
                    <span class="material-icons">${getDeviceIcon(device.device_type)}</span>
                </div>
                <div class="device-config-details">
                    <h4>${device.name}</h4>
                    <p>${device.device_type} • ${device.room}</p>
                    <span class="device-config-status ${device.enabled ? 'enabled' : 'disabled'}">
                        ${device.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                </div>
            </div>
            <div class="device-config-actions">
                <button class="action-btn" onclick="editDevice('${device.id}')" title="Edit">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn" onclick="toggleDeviceEnabled('${device.id}')" title="Toggle">
                    <span class="material-icons">${device.enabled ? 'toggle_on' : 'toggle_off'}</span>
                </button>
                <button class="action-btn" onclick="deleteDevice('${device.id}')" title="Delete">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

function renderRoomsConfig() {
    const container = document.getElementById('config-room-list');
    if (!container) return;
    
    if (configRooms.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>No rooms configured</p>
                <button class="action-btn primary" onclick="addRoom()">
                    <span class="material-icons">add</span>
                    Add First Room
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = configRooms.map(room => `
        <div class="config-room-item" data-room-id="${room.id}">
            <div class="room-config-info">
                <div class="room-config-icon">
                    <span class="material-icons">${room.icon || 'home'}</span>
                </div>
                <div class="room-config-details">
                    <h4>${room.name}</h4>
                    <p>${room.description || 'No description'}</p>
                </div>
            </div>
            <div class="room-config-actions">
                <button class="action-btn" onclick="editRoom('${room.id}')" title="Edit">
                    <span class="material-icons">edit</span>
                </button>
                <button class="action-btn" onclick="deleteRoom('${room.id}')" title="Delete">
                    <span class="material-icons">delete</span>
                </button>
            </div>
        </div>
    `).join('');
}

function renderSettingsConfig() {
    // Settings are already in HTML, just need to load current values
    loadCurrentSettings();
}

function loadCurrentSettings() {
    // Load settings from localStorage or API
    const theme = localStorage.getItem('theme') || 'dark';
    const tempUnit = localStorage.getItem('tempUnit') || 'celsius';
    const voiceEnabled = localStorage.getItem('voiceEnabled') !== 'false';
    
    document.getElementById('theme-select').value = theme;
    document.getElementById('temp-unit').value = tempUnit;
    document.getElementById('voice-enabled').checked = voiceEnabled;
}

// Device management functions
function addDevice() {
    showDeviceModal();
}

function editDevice(deviceId) {
    const device = configDevices.find(d => d.id === deviceId);
    if (device) {
        showDeviceModal(device);
    }
}

async function deleteDevice(deviceId) {
    if (!confirm('Are you sure you want to delete this device?')) return;
    
    try {
        await apiCall(`/config/devices/${deviceId}`, { method: 'DELETE' });
        
        // Remove from local state
        configDevices = configDevices.filter(d => d.id !== deviceId);
        devices = devices.filter(d => d.id !== deviceId);
        
        renderDevicesConfig();
        renderDevices();
        updateQuickStatus();
        
        showNotification('Device deleted successfully', 'success');
    } catch (error) {
        console.error('Failed to delete device:', error);
        showNotification('Failed to delete device', 'error');
    }
}

async function toggleDeviceEnabled(deviceId) {
    const device = configDevices.find(d => d.id === deviceId);
    if (!device) return;
    
    try {
        const updatedDevice = await apiCall(`/config/devices/${deviceId}`, {
            method: 'PUT',
            body: JSON.stringify({ enabled: !device.enabled })
        });
        
        // Update local state
        device.enabled = updatedDevice.enabled;
        
        renderDevicesConfig();
        await loadDevices();
        renderDevices();
        
        showNotification(`Device ${device.enabled ? 'enabled' : 'disabled'}`, 'success');
    } catch (error) {
        console.error('Failed to toggle device:', error);
        showNotification('Failed to update device', 'error');
    }
}

// Room management functions
function addRoom() {
    showRoomModal();
}

function editRoom(roomId) {
    const room = configRooms.find(r => r.id === roomId);
    if (room) {
        showRoomModal(room);
    }
}

async function deleteRoom(roomId) {
    if (!confirm('Are you sure you want to delete this room?')) return;
    
    // Check if any devices are in this room
    const devicesInRoom = configDevices.filter(d => d.room === roomId);
    if (devicesInRoom.length > 0) {
        alert(`Cannot delete room. ${devicesInRoom.length} device(s) are still in this room.`);
        return;
    }
    
    try {
        await apiCall(`/rooms/${roomId}`, { method: 'DELETE' });
        
        // Remove from local state
        configRooms = configRooms.filter(r => r.id !== roomId);
        rooms = rooms.filter(r => r.id !== roomId);
        
        renderRoomsConfig();
        updateRoomFilter();
        
        showNotification('Room deleted successfully', 'success');
    } catch (error) {
        console.error('Failed to delete room:', error);
        showNotification('Failed to delete room', 'error');
    }
}

// Modal functions
function showDeviceModal(device = null) {
    const modal = document.getElementById('device-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = device ? 'Edit Device' : 'Add Device';
    
    body.innerHTML = `
        <form id="device-form" onsubmit="saveDevice(event)">
            <div class="form-group">
                <label for="device-name">Device Name</label>
                <input type="text" id="device-name" value="${device?.name || ''}" required>
            </div>
            
            <div class="form-group">
                <label for="device-type">Device Type</label>
                <select id="device-type" onchange="updateDeviceTypeFields()" required>
                    <option value="">Select type...</option>
                    ${Object.keys(deviceTemplates).map(type => 
                        `<option value="${type}" ${device?.device_type === type ? 'selected' : ''}>${deviceTemplates[type].name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="device-room">Room</label>
                <select id="device-room" required>
                    <option value="">Select room...</option>
                    ${configRooms.map(room => 
                        `<option value="${room.id}" ${device?.room === room.id ? 'selected' : ''}>${room.name}</option>`
                    ).join('')}
                </select>
            </div>
            
            <div class="form-group">
                <label for="device-icon">Icon</label>
                <input type="text" id="device-icon" value="${device?.icon || ''}" placeholder="material-icons name">
            </div>
            
            <div class="form-group">
                <label>
                    <input type="checkbox" id="device-enabled" ${device?.enabled !== false ? 'checked' : ''}>
                    Enabled
                </label>
            </div>
            
            <div id="device-type-fields">
                <!-- Dynamic fields based on device type -->
            </div>
            
            <div class="form-actions">
                <button type="button" onclick="closeModal()">Cancel</button>
                <button type="submit" class="action-btn primary">
                    ${device ? 'Update' : 'Add'} Device
                </button>
            </div>
            
            ${device ? `<input type="hidden" id="device-id" value="${device.id}">` : ''}
        </form>
    `;
    
    modal.classList.add('open');
    
    if (device) {
        updateDeviceTypeFields();
    }
}

function showRoomModal(room = null) {
    const modal = document.getElementById('device-modal');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = room ? 'Edit Room' : 'Add Room';
    
    body.innerHTML = `
        <form id="room-form" onsubmit="saveRoom(event)">
            <div class="form-group">
                <label for="room-name">Room Name</label>
                <input type="text" id="room-name" value="${room?.name || ''}" required>
            </div>
            
            <div class="form-group">
                <label for="room-description">Description</label>
                <textarea id="room-description" rows="3">${room?.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label for="room-icon">Icon</label>
                <select id="room-icon">
                    <option value="home" ${room?.icon === 'home' ? 'selected' : ''}>Home</option>
                    <option value="living" ${room?.icon === 'living' ? 'selected' : ''}>Living Room</option>
                    <option value="bed" ${room?.icon === 'bed' ? 'selected' : ''}>Bedroom</option>
                    <option value="bathroom" ${room?.icon === 'bathroom' ? 'selected' : ''}>Bathroom</option>
                    <option value="kitchen" ${room?.icon === 'kitchen' ? 'selected' : ''}>Kitchen</option>
                    <option value="outdoor" ${room?.icon === 'outdoor' ? 'selected' : ''}>Outdoor</option>
                </select>
            </div>
            
            <div class="form-actions">
                <button type="button" onclick="closeModal()">Cancel</button>
                <button type="submit" class="action-btn primary">
                    ${room ? 'Update' : 'Add'} Room
                </button>
            </div>
            
            ${room ? `<input type="hidden" id="room-id" value="${room.id}">` : ''}
        </form>
    `;
    
    modal.classList.add('open');
}

function updateDeviceTypeFields() {
    const typeSelect = document.getElementById('device-type');
    const fieldsContainer = document.getElementById('device-type-fields');
    const selectedType = typeSelect.value;
    
    if (!selectedType || !deviceTemplates[selectedType]) {
        fieldsContainer.innerHTML = '';
        return;
    }
    
    const template = deviceTemplates[selectedType];
    
    // Update icon field with template default
    const iconField = document.getElementById('device-icon');
    if (iconField && !iconField.value) {
        iconField.value = template.icon;
    }
    
    // Add template-specific configuration fields
    fieldsContainer.innerHTML = `
        <h4>Device Configuration</h4>
        <div class="config-preview">
            <p><strong>Category:</strong> ${template.category}</p>
            <p><strong>Capabilities:</strong> ${Object.keys(template.capabilities).join(', ')}</p>
        </div>
    `;
}

async function saveDevice(event) {
    event.preventDefault();
    
    const form = document.getElementById('device-form');
    const formData = new FormData(form);
    const deviceId = document.getElementById('device-id')?.value;
    
    const deviceData = {
        name: document.getElementById('device-name').value,
        device_type: document.getElementById('device-type').value,
        room: document.getElementById('device-room').value,
        icon: document.getElementById('device-icon').value,
        enabled: document.getElementById('device-enabled').checked
    };
    
    // Add template configuration
    if (deviceTemplates[deviceData.device_type]) {
        deviceData.configuration = deviceTemplates[deviceData.device_type];
    }
    
    try {
        let result;
        if (deviceId) {
            // Update existing device
            result = await apiCall(`/config/devices/${deviceId}`, {
                method: 'PUT',
                body: JSON.stringify(deviceData)
            });
        } else {
            // Create new device
            result = await apiCall('/config/devices', {
                method: 'POST',
                body: JSON.stringify(deviceData)
            });
        }
        
        // Update local state
        if (deviceId) {
            const index = configDevices.findIndex(d => d.id === deviceId);
            if (index !== -1) {
                configDevices[index] = result;
            }
        } else {
            configDevices.push(result);
        }
        
        // Refresh UI
        renderDevicesConfig();
        await loadDevices();
        renderDevices();
        updateQuickStatus();
        
        closeModal();
        showNotification(`Device ${deviceId ? 'updated' : 'added'} successfully`, 'success');
        
    } catch (error) {
        console.error('Failed to save device:', error);
        showNotification('Failed to save device', 'error');
    }
}

async function saveRoom(event) {
    event.preventDefault();
    
    const roomId = document.getElementById('room-id')?.value;
    
    const roomData = {
        name: document.getElementById('room-name').value,
        description: document.getElementById('room-description').value,
        icon: document.getElementById('room-icon').value
    };
    
    try {
        let result;
        if (roomId) {
            // Update existing room
            result = await apiCall(`/rooms/${roomId}`, {
                method: 'PUT',
                body: JSON.stringify(roomData)
            });
        } else {
            // Create new room
            result = await apiCall('/rooms', {
                method: 'POST',
                body: JSON.stringify(roomData)
            });
        }
        
        // Update local state
        if (roomId) {
            const index = configRooms.findIndex(r => r.id === roomId);
            if (index !== -1) {
                configRooms[index] = result;
            }
        } else {
            configRooms.push(result);
        }
        
        // Refresh UI
        renderRoomsConfig();
        await loadRooms();
        
        closeModal();
        showNotification(`Room ${roomId ? 'updated' : 'added'} successfully`, 'success');
        
    } catch (error) {
        console.error('Failed to save room:', error);
        showNotification('Failed to save room', 'error');
    }
}

function closeModal() {
    const modal = document.getElementById('device-modal');
    modal.classList.remove('open');
}

// Device discovery
async function discoverDevices() {
    try {
        showLoading(true);
        
        const data = await apiCall('/config/discover', { method: 'POST' });
        
        if (data.discovered_devices && data.discovered_devices.length > 0) {
            showNotification(`Found ${data.discovered_devices.length} device(s)`, 'success');
            // Here you could show a modal to add discovered devices
        } else {
            showNotification('No new devices found', 'info');
        }
        
    } catch (error) {
        console.error('Failed to discover devices:', error);
        showNotification('Device discovery failed', 'error');
    } finally {
        showLoading(false);
    }
}

// Configuration import/export
async function exportConfig() {
    try {
        const data = await apiCall('/config/export');
        
        // Create and download file
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smart-home-config-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showNotification('Configuration exported successfully', 'success');
        
    } catch (error) {
        console.error('Failed to export configuration:', error);
        showNotification('Failed to export configuration', 'error');
    }
}

function importConfig() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = handleConfigImport;
    input.click();
}

async function handleConfigImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const config = JSON.parse(text);
        
        const result = await apiCall('/config/import', {
            method: 'POST',
            body: JSON.stringify(config)
        });
        
        // Reload all data
        await loadConfigurationData();
        await loadDevices();
        await loadRooms();
        
        renderDevicesConfig();
        renderDevices();
        updateQuickStatus();
        
        showNotification(`Imported ${result.imported_devices} devices and ${result.imported_rooms} rooms`, 'success');
        
        if (result.errors && result.errors.length > 0) {
            console.warn('Import errors:', result.errors);
            showNotification(`${result.errors.length} errors occurred during import`, 'warning');
        }
        
    } catch (error) {
        console.error('Failed to import configuration:', error);
        showNotification('Failed to import configuration', 'error');
    }
}

// Settings functions
function changeTheme() {
    const theme = document.getElementById('theme-select').value;
    localStorage.setItem('theme', theme);
    
    // Apply theme (this would be expanded for full theme switching)
    document.body.className = theme;
    
    showNotification(`Theme changed to ${theme}`, 'success');
}

function changeTempUnit() {
    const unit = document.getElementById('temp-unit').value;
    localStorage.setItem('tempUnit', unit);
    
    // Refresh device displays with new unit
    renderDevices();
    
    showNotification(`Temperature unit changed to ${unit}`, 'success');
}

function toggleVoiceAssistant() {
    const enabled = document.getElementById('voice-enabled').checked;
    localStorage.setItem('voiceEnabled', enabled);
    
    showNotification(`Voice assistant ${enabled ? 'enabled' : 'disabled'}`, 'success');
}

// Utility functions
function getDeviceIcon(deviceType) {
    const iconMap = {
        'light': 'lightbulb',
        'thermostat': 'thermostat',
        'jacuzzi': 'hot_tub',
        'powerwall': 'battery_charging_full',
        'recuperation': 'air',
        'custom': 'device_unknown'
    };
    
    return iconMap[deviceType] || 'device_unknown';
}

