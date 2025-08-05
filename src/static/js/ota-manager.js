/**
 * OTA Update Management Module
 * Handles Over-The-Air firmware updates for ESP32 devices
 */

class OTAManager {
    constructor() {
        this.activeUpdates = new Map();
        this.updateHistory = [];
        this.firmwareVersions = new Map();
        this.init();
    }

    async init() {
        console.log('Initializing OTA Manager...');
        await this.loadFirmwareVersions();
        await this.loadActiveUpdates();
        this.setupEventListeners();
        this.startUpdateMonitoring();
    }

    async loadFirmwareVersions() {
        // Load available firmware versions (this would typically come from a firmware repository)
        this.firmwareVersions.set('esp32_dht22', [
            { version: '1.0.0', description: 'Initial release', stable: true },
            { version: '1.1.0', description: 'Improved sensor accuracy', stable: true },
            { version: '1.2.0', description: 'Added WiFi reconnection', stable: true },
            { version: '1.3.0', description: 'Enhanced OTA support', stable: false },
            { version: '2.0.0-beta', description: 'Major update with new features', stable: false }
        ]);
    }

    async loadActiveUpdates() {
        try {
            // Load active updates for all devices
            const sensors = await apiCall('/sensors');
            if (sensors.status === 'success') {
                for (const device of sensors.devices) {
                    const statusResponse = await apiCall(`/sensors/${device.device_id}/ota/status`);
                    if (statusResponse.status === 'success' && statusResponse.ota_update) {
                        const update = statusResponse.ota_update;
                        if (['initiated', 'in_progress'].includes(update.update_status)) {
                            this.activeUpdates.set(device.device_id, update);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error loading active updates:', error);
        }
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.matches('.ota-update-btn')) {
                const deviceId = e.target.dataset.deviceId;
                this.openOTAUpdateModal(deviceId);
            }
            
            if (e.target.matches('.cancel-update-btn')) {
                const deviceId = e.target.dataset.deviceId;
                this.cancelUpdate(deviceId);
            }
            
            if (e.target.matches('.retry-update-btn')) {
                const deviceId = e.target.dataset.deviceId;
                this.retryUpdate(deviceId);
            }
        });
    }

    startUpdateMonitoring() {
        // Monitor active updates every 10 seconds
        setInterval(() => {
            this.monitorActiveUpdates();
        }, 10000);
    }

    async monitorActiveUpdates() {
        for (const [deviceId, update] of this.activeUpdates) {
            try {
                const response = await apiCall(`/sensors/${deviceId}/ota/status`);
                if (response.status === 'success' && response.ota_update) {
                    const latestUpdate = response.ota_update;
                    
                    // Update local state
                    this.activeUpdates.set(deviceId, latestUpdate);
                    
                    // Update UI
                    this.updateProgressDisplay(deviceId, latestUpdate);
                    
                    // Check if update completed
                    if (['completed', 'failed'].includes(latestUpdate.update_status)) {
                        this.handleUpdateCompletion(deviceId, latestUpdate);
                    }
                }
            } catch (error) {
                console.error(`Error monitoring update for ${deviceId}:`, error);
            }
        }
    }

    async openOTAUpdateModal(deviceId) {
        const sensor = window.sensorManager?.sensors.get(deviceId);
        if (!sensor) {
            showNotification('Sensor not found', 'error');
            return;
        }

        if (!sensor.status === 'online') {
            showNotification('Device must be online for OTA updates', 'warning');
            return;
        }

        // Check for active update
        if (this.activeUpdates.has(deviceId)) {
            this.showUpdateProgressModal(deviceId);
            return;
        }

        const availableVersions = this.firmwareVersions.get(sensor.device_type) || [];
        const currentVersion = sensor.firmware_version || 'Unknown';

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal ota-update-modal">
                <div class="modal-header">
                    <h3>OTA Firmware Update</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="device-info">
                        <h4>${sensor.name}</h4>
                        <p class="device-location">${sensor.location}</p>
                        <div class="current-version">
                            <span class="label">Current Version:</span>
                            <span class="version">${currentVersion}</span>
                        </div>
                    </div>
                    
                    <div class="firmware-selection">
                        <h4>Select Firmware Version</h4>
                        <div class="version-list">
                            ${availableVersions.map(version => `
                                <div class="version-item ${version.stable ? 'stable' : 'beta'}" 
                                     data-version="${version.version}">
                                    <div class="version-header">
                                        <span class="version-number">${version.version}</span>
                                        <span class="version-badge ${version.stable ? 'stable' : 'beta'}">
                                            ${version.stable ? 'Stable' : 'Beta'}
                                        </span>
                                    </div>
                                    <p class="version-description">${version.description}</p>
                                    <div class="version-actions">
                                        <input type="radio" name="firmware-version" value="${version.version}" 
                                               id="version-${version.version}" 
                                               ${version.version === currentVersion ? 'disabled' : ''}>
                                        <label for="version-${version.version}">
                                            ${version.version === currentVersion ? 'Current' : 'Select'}
                                        </label>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    
                    <div class="update-options">
                        <h4>Update Options</h4>
                        <div class="option-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="backup-config" checked>
                                <span>Backup current configuration</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="auto-restart" checked>
                                <span>Automatically restart after update</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" id="safe-mode">
                                <span>Enable safe mode (recovery fallback)</span>
                            </label>
                        </div>
                    </div>
                    
                    <div class="update-warnings">
                        <div class="warning-box">
                            <span class="warning-icon">⚠️</span>
                            <div class="warning-content">
                                <strong>Important:</strong>
                                <ul>
                                    <li>Do not power off the device during update</li>
                                    <li>Ensure stable WiFi connection</li>
                                    <li>Update may take 5-10 minutes</li>
                                    <li>Device will restart automatically</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="otaManager.startUpdate('${deviceId}')">
                        Start Update
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Close modal events
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close') || e.target === modal) {
                modal.remove();
            }
        });

        // Version selection events
        modal.addEventListener('change', (e) => {
            if (e.target.name === 'firmware-version') {
                const selectedVersion = e.target.value;
                const versionItems = modal.querySelectorAll('.version-item');
                versionItems.forEach(item => {
                    item.classList.remove('selected');
                    if (item.dataset.version === selectedVersion) {
                        item.classList.add('selected');
                    }
                });
            }
        });
    }

    async startUpdate(deviceId) {
        const modal = document.querySelector('.ota-update-modal');
        const selectedVersion = modal.querySelector('input[name="firmware-version"]:checked');
        
        if (!selectedVersion) {
            showNotification('Please select a firmware version', 'warning');
            return;
        }

        const firmwareVersion = selectedVersion.value;
        const backupConfig = modal.querySelector('#backup-config').checked;
        const autoRestart = modal.querySelector('#auto-restart').checked;
        const safeMode = modal.querySelector('#safe-mode').checked;

        try {
            showLoading(true, 'Initiating firmware update...');
            
            const response = await apiCall(`/sensors/${deviceId}/ota`, {
                method: 'POST',
                body: JSON.stringify({
                    firmware_version: firmwareVersion,
                    options: {
                        backup_config: backupConfig,
                        auto_restart: autoRestart,
                        safe_mode: safeMode
                    }
                })
            });

            if (response.status === 'success' || response.status === 'in_progress') {
                modal.remove();
                showNotification('Firmware update initiated', 'success');
                
                // Add to active updates
                this.activeUpdates.set(deviceId, {
                    id: response.update_id,
                    device_id: deviceId,
                    firmware_version: firmwareVersion,
                    update_status: 'initiated',
                    progress_percentage: 0,
                    started_at: new Date().toISOString()
                });
                
                // Show progress modal
                setTimeout(() => {
                    this.showUpdateProgressModal(deviceId);
                }, 1000);
                
            } else {
                showNotification('Failed to start firmware update', 'error');
            }
        } catch (error) {
            console.error('Error starting update:', error);
            showNotification('Error starting firmware update', 'error');
        } finally {
            showLoading(false);
        }
    }

    showUpdateProgressModal(deviceId) {
        const update = this.activeUpdates.get(deviceId);
        if (!update) return;

        const sensor = window.sensorManager?.sensors.get(deviceId);
        const sensorName = sensor ? sensor.name : deviceId;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = `progress-modal-${deviceId}`;
        modal.innerHTML = `
            <div class="modal ota-progress-modal">
                <div class="modal-header">
                    <h3>Firmware Update Progress</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="update-device-info">
                        <h4>${sensorName}</h4>
                        <p>Updating to version ${update.firmware_version}</p>
                    </div>
                    
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progress-fill-${deviceId}" 
                                 style="width: ${update.progress_percentage}%"></div>
                        </div>
                        <div class="progress-text">
                            <span id="progress-percentage-${deviceId}">${update.progress_percentage}%</span>
                            <span id="progress-status-${deviceId}">${this.getStatusText(update.update_status)}</span>
                        </div>
                    </div>
                    
                    <div class="update-steps">
                        <div class="step ${this.getStepStatus(update, 'initiated')}">
                            <span class="step-icon">📡</span>
                            <span class="step-text">Initiating update</span>
                        </div>
                        <div class="step ${this.getStepStatus(update, 'downloading')}">
                            <span class="step-icon">⬇️</span>
                            <span class="step-text">Downloading firmware</span>
                        </div>
                        <div class="step ${this.getStepStatus(update, 'installing')}">
                            <span class="step-icon">🔧</span>
                            <span class="step-text">Installing firmware</span>
                        </div>
                        <div class="step ${this.getStepStatus(update, 'restarting')}">
                            <span class="step-icon">🔄</span>
                            <span class="step-text">Restarting device</span>
                        </div>
                        <div class="step ${this.getStepStatus(update, 'completed')}">
                            <span class="step-icon">✅</span>
                            <span class="step-text">Update completed</span>
                        </div>
                    </div>
                    
                    <div class="update-log" id="update-log-${deviceId}">
                        <h5>Update Log</h5>
                        <div class="log-content">
                            <div class="log-entry">
                                <span class="log-time">${new Date().toLocaleTimeString()}</span>
                                <span class="log-message">Update initiated</span>
                            </div>
                        </div>
                    </div>
                    
                    ${update.error_message ? `
                        <div class="error-message">
                            <span class="error-icon">❌</span>
                            <span class="error-text">${update.error_message}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="modal-footer">
                    ${update.update_status === 'in_progress' ? `
                        <button type="button" class="btn btn-warning cancel-update-btn" 
                                data-device-id="${deviceId}">Cancel Update</button>
                    ` : ''}
                    ${update.update_status === 'failed' ? `
                        <button type="button" class="btn btn-primary retry-update-btn" 
                                data-device-id="${deviceId}">Retry Update</button>
                    ` : ''}
                    <button type="button" class="btn btn-secondary modal-close">Close</button>
                </div>
            </div>
        `;

        // Remove existing progress modal for this device
        const existingModal = document.getElementById(`progress-modal-${deviceId}`);
        if (existingModal) {
            existingModal.remove();
        }

        document.body.appendChild(modal);

        // Close modal events
        modal.addEventListener('click', (e) => {
            if (e.target.matches('.modal-close') || e.target === modal) {
                modal.remove();
            }
        });
    }

    updateProgressDisplay(deviceId, update) {
        const progressFill = document.getElementById(`progress-fill-${deviceId}`);
        const progressPercentage = document.getElementById(`progress-percentage-${deviceId}`);
        const progressStatus = document.getElementById(`progress-status-${deviceId}`);

        if (progressFill) {
            progressFill.style.width = `${update.progress_percentage}%`;
        }
        
        if (progressPercentage) {
            progressPercentage.textContent = `${update.progress_percentage}%`;
        }
        
        if (progressStatus) {
            progressStatus.textContent = this.getStatusText(update.update_status);
        }

        // Update steps
        const modal = document.getElementById(`progress-modal-${deviceId}`);
        if (modal) {
            const steps = modal.querySelectorAll('.step');
            steps.forEach((step, index) => {
                const stepNames = ['initiated', 'downloading', 'installing', 'restarting', 'completed'];
                step.className = `step ${this.getStepStatus(update, stepNames[index])}`;
            });
        }

        // Add log entry
        this.addLogEntry(deviceId, update.update_status);
    }

    getStatusText(status) {
        const statusTexts = {
            'initiated': 'Starting update...',
            'in_progress': 'Update in progress...',
            'completed': 'Update completed successfully',
            'failed': 'Update failed',
            'cancelled': 'Update cancelled'
        };
        return statusTexts[status] || status;
    }

    getStepStatus(update, stepName) {
        const stepOrder = ['initiated', 'downloading', 'installing', 'restarting', 'completed'];
        const currentIndex = stepOrder.indexOf(update.update_status);
        const stepIndex = stepOrder.indexOf(stepName);
        
        if (update.update_status === 'failed') {
            return stepIndex <= currentIndex ? 'error' : 'pending';
        }
        
        if (stepIndex < currentIndex) return 'completed';
        if (stepIndex === currentIndex) return 'active';
        return 'pending';
    }

    addLogEntry(deviceId, status) {
        const logContent = document.querySelector(`#update-log-${deviceId} .log-content`);
        if (!logContent) return;

        const logEntry = document.createElement('div');
        logEntry.className = 'log-entry';
        logEntry.innerHTML = `
            <span class="log-time">${new Date().toLocaleTimeString()}</span>
            <span class="log-message">${this.getStatusText(status)}</span>
        `;
        
        logContent.appendChild(logEntry);
        logContent.scrollTop = logContent.scrollHeight;
    }

    handleUpdateCompletion(deviceId, update) {
        this.activeUpdates.delete(deviceId);
        
        if (update.update_status === 'completed') {
            showNotification(`Firmware update completed for ${deviceId}`, 'success');
            
            // Refresh sensor data
            if (window.sensorManager) {
                window.sensorManager.loadSensors();
            }
        } else if (update.update_status === 'failed') {
            showNotification(`Firmware update failed for ${deviceId}`, 'error');
        }
        
        // Update progress modal if open
        const modal = document.getElementById(`progress-modal-${deviceId}`);
        if (modal) {
            this.updateProgressDisplay(deviceId, update);
        }
    }

    async cancelUpdate(deviceId) {
        try {
            const response = await apiCall(`/sensors/${deviceId}/ota/cancel`, {
                method: 'POST'
            });
            
            if (response.status === 'success') {
                this.activeUpdates.delete(deviceId);
                showNotification('Update cancelled', 'info');
                
                const modal = document.getElementById(`progress-modal-${deviceId}`);
                if (modal) {
                    modal.remove();
                }
            }
        } catch (error) {
            console.error('Error cancelling update:', error);
            showNotification('Failed to cancel update', 'error');
        }
    }

    async retryUpdate(deviceId) {
        const modal = document.getElementById(`progress-modal-${deviceId}`);
        if (modal) {
            modal.remove();
        }
        
        // Remove from active updates and restart
        this.activeUpdates.delete(deviceId);
        this.openOTAUpdateModal(deviceId);
    }

    // Utility method to check if device has pending updates
    hasPendingUpdate(deviceId) {
        return this.activeUpdates.has(deviceId);
    }

    // Get update status for device
    getUpdateStatus(deviceId) {
        return this.activeUpdates.get(deviceId);
    }

    destroy() {
        // Clean up any intervals or event listeners
        this.activeUpdates.clear();
    }
}

// Initialize OTA manager when DOM is loaded
let otaManager;
document.addEventListener('DOMContentLoaded', () => {
    otaManager = new OTAManager();
});

// Export for global access
window.otaManager = otaManager;

