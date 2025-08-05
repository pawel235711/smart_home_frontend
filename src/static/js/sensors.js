/**
 * ESP32 Sensor Monitoring Module
 * Handles real-time sensor data display, alerts, and OTA updates
 */

class SensorManager {
    constructor() {
        this.sensors = new Map();
        this.alerts = [];
        this.updateInterval = null;
        this.chartInstances = new Map();
        this.init();
    }

    async init() {
        console.log('Initializing Sensor Manager...');
        await this.loadSensors();
        this.setupEventListeners();
        this.startPeriodicUpdates();
        this.renderSensorDashboard();
    }

    async loadSensors() {
        try {
            const response = await apiCall('/sensors');
            if (response.status === 'success') {
                this.sensors.clear();
                response.devices.forEach(device => {
                    this.sensors.set(device.device_id, device);
                });
                console.log(`Loaded ${this.sensors.size} sensors`);
            }
        } catch (error) {
            console.error('Error loading sensors:', error);
            showNotification('Failed to load sensors', 'error');
        }
    }

    async loadSensorAlerts() {
        try {
            const response = await apiCall('/sensors/alerts?active_only=true');
            if (response.status === 'success') {
                this.alerts = response.alerts;
                this.updateAlertsDisplay();
            }
        } catch (error) {
            console.error('Error loading alerts:', error);
        }
    }

    setupEventListeners() {
        // Sensor configuration modal events
        document.addEventListener('click', (e) => {
            if (e.target.matches('.sensor-config-btn')) {
                const deviceId = e.target.dataset.deviceId;
                this.openSensorConfig(deviceId);
            }
            
            if (e.target.matches('.ota-update-btn')) {
                const deviceId = e.target.dataset.deviceId;
                this.openOTAUpdateModal(deviceId);
            }
            
            if (e.target.matches('.acknowledge-alert-btn')) {
                const alertId = e.target.dataset.alertId;
                this.acknowledgeAlert(alertId);
            }
        });

        // Real-time chart toggle
        document.addEventListener('change', (e) => {
            if (e.target.matches('.chart-toggle')) {
                const deviceId = e.target.dataset.deviceId;
                const sensorType = e.target.dataset.sensorType;
                this.toggleChart(deviceId, sensorType, e.target.checked);
            }
        });
    }

    startPeriodicUpdates() {
        // Update sensor data every 30 seconds
        this.updateInterval = setInterval(() => {
            this.updateSensorData();
            this.loadSensorAlerts();
        }, 30000);
    }

    async updateSensorData() {
        try {
            const response = await apiCall('/sensors/summary');
            if (response.status === 'success') {
                this.updateDashboardSummary(response.summary);
            }

            // Update individual sensor readings
            for (const [deviceId, sensor] of this.sensors) {
                await this.updateSensorReadings(deviceId);
            }
        } catch (error) {
            console.error('Error updating sensor data:', error);
        }
    }

    async updateSensorReadings(deviceId) {
        try {
            const response = await apiCall(`/sensors/${deviceId}`);
            if (response.status === 'success') {
                const updatedDevice = response.device;
                this.sensors.set(deviceId, updatedDevice);
                this.updateSensorCard(deviceId, updatedDevice);
                
                // Update charts if visible
                this.updateSensorCharts(deviceId, response.latest_readings);
            }
        } catch (error) {
            console.error(`Error updating sensor ${deviceId}:`, error);
        }
    }

    renderSensorDashboard() {
        const container = document.getElementById('sensor-dashboard');
        if (!container) return;

        container.innerHTML = `
            <div class="sensor-dashboard">
                <div class="dashboard-header">
                    <h2>Environmental Sensors</h2>
                    <div class="dashboard-summary" id="sensor-summary">
                        <div class="summary-card">
                            <span class="summary-icon">📡</span>
                            <div class="summary-info">
                                <span class="summary-value" id="total-sensors">0</span>
                                <span class="summary-label">Total Sensors</span>
                            </div>
                        </div>
                        <div class="summary-card">
                            <span class="summary-icon">🟢</span>
                            <div class="summary-info">
                                <span class="summary-value" id="online-sensors">0</span>
                                <span class="summary-label">Online</span>
                            </div>
                        </div>
                        <div class="summary-card">
                            <span class="summary-icon">⚠️</span>
                            <div class="summary-info">
                                <span class="summary-value" id="sensor-alerts">0</span>
                                <span class="summary-label">Alerts</span>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="sensor-grid" id="sensor-grid">
                    ${this.renderSensorCards()}
                </div>
                
                <div class="alerts-section" id="alerts-section">
                    <h3>Active Alerts</h3>
                    <div class="alerts-container" id="alerts-container">
                        <!-- Alerts will be populated here -->
                    </div>
                </div>
            </div>
        `;

        this.loadSensorAlerts();
    }

    renderSensorCards() {
        if (this.sensors.size === 0) {
            return `
                <div class="no-sensors">
                    <div class="no-sensors-icon">📡</div>
                    <h3>No Sensors Found</h3>
                    <p>Connect your ESP32 sensors to start monitoring environmental data.</p>
                    <button class="btn btn-primary" onclick="sensorManager.showAddSensorGuide()">
                        Setup Guide
                    </button>
                </div>
            `;
        }

        return Array.from(this.sensors.values()).map(sensor => this.renderSensorCard(sensor)).join('');
    }

    renderSensorCard(sensor) {
        const isOnline = sensor.status === 'online';
        const statusClass = isOnline ? 'online' : 'offline';
        const statusIcon = isOnline ? '🟢' : '🔴';
        
        // Get latest readings
        const tempReading = this.getLatestReading(sensor, 'temperature');
        const humidityReading = this.getLatestReading(sensor, 'humidity');
        
        return `
            <div class="sensor-card ${statusClass}" data-device-id="${sensor.device_id}">
                <div class="sensor-header">
                    <div class="sensor-info">
                        <h3>${sensor.name}</h3>
                        <span class="sensor-location">${sensor.location}</span>
                    </div>
                    <div class="sensor-status">
                        <span class="status-indicator">${statusIcon}</span>
                        <span class="status-text">${sensor.status}</span>
                    </div>
                </div>
                
                <div class="sensor-readings">
                    <div class="reading-item">
                        <div class="reading-icon">🌡️</div>
                        <div class="reading-info">
                            <span class="reading-value">${tempReading ? tempReading.value.toFixed(1) : '--'}°C</span>
                            <span class="reading-label">Temperature</span>
                        </div>
                    </div>
                    
                    <div class="reading-item">
                        <div class="reading-icon">💧</div>
                        <div class="reading-info">
                            <span class="reading-value">${humidityReading ? humidityReading.value.toFixed(1) : '--'}%</span>
                            <span class="reading-label">Humidity</span>
                        </div>
                    </div>
                </div>
                
                <div class="sensor-charts">
                    <div class="chart-controls">
                        <label class="chart-toggle-label">
                            <input type="checkbox" class="chart-toggle" 
                                   data-device-id="${sensor.device_id}" 
                                   data-sensor-type="temperature">
                            <span>Temperature Chart</span>
                        </label>
                        <label class="chart-toggle-label">
                            <input type="checkbox" class="chart-toggle" 
                                   data-device-id="${sensor.device_id}" 
                                   data-sensor-type="humidity">
                            <span>Humidity Chart</span>
                        </label>
                    </div>
                    <div class="chart-container" id="chart-${sensor.device_id}"></div>
                </div>
                
                <div class="sensor-actions">
                    <button class="btn btn-sm sensor-config-btn" data-device-id="${sensor.device_id}">
                        ⚙️ Configure
                    </button>
                    <button class="btn btn-sm ota-update-btn" data-device-id="${sensor.device_id}" 
                            ${!isOnline ? 'disabled' : ''}>
                        🔄 Update
                    </button>
                    <span class="sensor-version">v${sensor.firmware_version || 'Unknown'}</span>
                </div>
                
                <div class="sensor-details">
                    <div class="detail-item">
                        <span class="detail-label">IP Address:</span>
                        <span class="detail-value">${sensor.ip_address || 'Unknown'}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Last Seen:</span>
                        <span class="detail-value">${this.formatTimestamp(sensor.last_seen)}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getLatestReading(sensor, type) {
        // This would be populated from the latest_readings in the API response
        // For now, return mock data
        if (type === 'temperature') {
            return { value: 22.5, unit: '°C', timestamp: new Date().toISOString() };
        } else if (type === 'humidity') {
            return { value: 45.2, unit: '%', timestamp: new Date().toISOString() };
        }
        return null;
    }

    updateSensorCard(deviceId, sensor) {
        const card = document.querySelector(`[data-device-id="${deviceId}"]`);
        if (!card) return;

        // Update status
        const statusIndicator = card.querySelector('.status-indicator');
        const statusText = card.querySelector('.status-text');
        const isOnline = sensor.status === 'online';
        
        statusIndicator.textContent = isOnline ? '🟢' : '🔴';
        statusText.textContent = sensor.status;
        card.className = `sensor-card ${sensor.status}`;

        // Update readings (would use real data from API)
        const tempValue = card.querySelector('.reading-value');
        const humidityValue = card.querySelectorAll('.reading-value')[1];
        
        // Update last seen
        const lastSeenValue = card.querySelector('.detail-value:last-child');
        lastSeenValue.textContent = this.formatTimestamp(sensor.last_seen);
    }

    updateDashboardSummary(summary) {
        document.getElementById('total-sensors').textContent = summary.total_devices || 0;
        document.getElementById('online-sensors').textContent = summary.online_devices || 0;
        document.getElementById('sensor-alerts').textContent = summary.active_alerts || 0;
    }

    updateAlertsDisplay() {
        const container = document.getElementById('alerts-container');
        if (!container) return;

        if (this.alerts.length === 0) {
            container.innerHTML = `
                <div class="no-alerts">
                    <span class="no-alerts-icon">✅</span>
                    <span>No active alerts</span>
                </div>
            `;
            return;
        }

        container.innerHTML = this.alerts.map(alert => `
            <div class="alert-item ${alert.severity}" data-alert-id="${alert.id}">
                <div class="alert-icon">
                    ${this.getAlertIcon(alert.alert_type, alert.severity)}
                </div>
                <div class="alert-content">
                    <div class="alert-message">${alert.message}</div>
                    <div class="alert-meta">
                        <span class="alert-device">${alert.device_id}</span>
                        <span class="alert-time">${this.formatTimestamp(alert.created_at)}</span>
                    </div>
                </div>
                <button class="alert-action acknowledge-alert-btn" data-alert-id="${alert.id}">
                    ✓ Acknowledge
                </button>
            </div>
        `).join('');
    }

    getAlertIcon(alertType, severity) {
        const icons = {
            'temperature_high': '🌡️🔥',
            'temperature_low': '🌡️❄️',
            'humidity_high': '💧⬆️',
            'humidity_low': '💧⬇️',
            'device_offline': '📡❌'
        };
        
        return icons[alertType] || (severity === 'critical' ? '🚨' : '⚠️');
    }

    async acknowledgeAlert(alertId) {
        try {
            const response = await apiCall(`/sensors/alerts/${alertId}/acknowledge`, {
                method: 'POST'
            });
            
            if (response.status === 'success') {
                // Remove alert from display
                const alertElement = document.querySelector(`[data-alert-id="${alertId}"]`);
                if (alertElement) {
                    alertElement.style.opacity = '0.5';
                    alertElement.style.pointerEvents = 'none';
                    setTimeout(() => alertElement.remove(), 300);
                }
                
                // Update alerts count
                this.alerts = this.alerts.filter(alert => alert.id !== parseInt(alertId));
                this.updateDashboardSummary({ active_alerts: this.alerts.length });
                
                showNotification('Alert acknowledged', 'success');
            }
        } catch (error) {
            console.error('Error acknowledging alert:', error);
            showNotification('Failed to acknowledge alert', 'error');
        }
    }

    async toggleChart(deviceId, sensorType, show) {
        const chartContainer = document.getElementById(`chart-${deviceId}`);
        if (!chartContainer) return;

        if (show) {
            await this.renderSensorChart(deviceId, sensorType, chartContainer);
        } else {
            this.destroyChart(deviceId, sensorType);
        }
    }

    async renderSensorChart(deviceId, sensorType, container) {
        try {
            // Get historical data
            const response = await apiCall(`/sensors/${deviceId}/readings?type=${sensorType}&hours=24`);
            if (response.status !== 'success') return;

            const readings = response.readings;
            if (readings.length === 0) {
                container.innerHTML = '<div class="no-chart-data">No data available</div>';
                return;
            }

            // Prepare chart data
            const chartData = readings.map(reading => ({
                time: new Date(reading.timestamp).getTime(),
                value: reading.value
            }));

            // Create chart using Chart.js (if available) or simple SVG
            this.createSimpleChart(container, chartData, sensorType);
            
        } catch (error) {
            console.error('Error rendering chart:', error);
            container.innerHTML = '<div class="chart-error">Failed to load chart</div>';
        }
    }

    createSimpleChart(container, data, sensorType) {
        if (data.length === 0) return;

        const width = 300;
        const height = 150;
        const padding = 20;

        const minValue = Math.min(...data.map(d => d.value));
        const maxValue = Math.max(...data.map(d => d.value));
        const minTime = Math.min(...data.map(d => d.time));
        const maxTime = Math.max(...data.map(d => d.time));

        const xScale = (time) => padding + ((time - minTime) / (maxTime - minTime)) * (width - 2 * padding);
        const yScale = (value) => height - padding - ((value - minValue) / (maxValue - minValue)) * (height - 2 * padding);

        const pathData = data.map((d, i) => 
            `${i === 0 ? 'M' : 'L'} ${xScale(d.time)} ${yScale(d.value)}`
        ).join(' ');

        const unit = sensorType === 'temperature' ? '°C' : '%';
        const color = sensorType === 'temperature' ? '#ff6b6b' : '#4ecdc4';

        container.innerHTML = `
            <div class="chart-header">
                <span class="chart-title">${sensorType.charAt(0).toUpperCase() + sensorType.slice(1)} (24h)</span>
                <span class="chart-range">${minValue.toFixed(1)} - ${maxValue.toFixed(1)} ${unit}</span>
            </div>
            <svg width="${width}" height="${height}" class="sensor-chart">
                <defs>
                    <linearGradient id="gradient-${sensorType}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:${color};stop-opacity:0.3" />
                        <stop offset="100%" style="stop-color:${color};stop-opacity:0.1" />
                    </linearGradient>
                </defs>
                <path d="${pathData} L ${xScale(data[data.length - 1].time)} ${height - padding} L ${xScale(data[0].time)} ${height - padding} Z" 
                      fill="url(#gradient-${sensorType})" />
                <path d="${pathData}" stroke="${color}" stroke-width="2" fill="none" />
                ${data.map(d => 
                    `<circle cx="${xScale(d.time)}" cy="${yScale(d.value)}" r="3" fill="${color}" />`
                ).join('')}
            </svg>
        `;
    }

    destroyChart(deviceId, sensorType) {
        const chartKey = `${deviceId}-${sensorType}`;
        if (this.chartInstances.has(chartKey)) {
            this.chartInstances.get(chartKey).destroy();
            this.chartInstances.delete(chartKey);
        }
    }

    async openSensorConfig(deviceId) {
        const sensor = this.sensors.get(deviceId);
        if (!sensor) return;

        try {
            const response = await apiCall(`/sensors/${deviceId}/config`);
            const config = response.status === 'success' ? response.configuration : {};

            this.showConfigModal(sensor, config);
        } catch (error) {
            console.error('Error loading sensor config:', error);
            showNotification('Failed to load sensor configuration', 'error');
        }
    }

    showConfigModal(sensor, config) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal sensor-config-modal">
                <div class="modal-header">
                    <h3>Configure ${sensor.name}</h3>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <form id="sensor-config-form">
                        <div class="form-group">
                            <label>Device Name</label>
                            <input type="text" name="name" value="${sensor.name}" required>
                        </div>
                        
                        <div class="form-group">
                            <label>Location</label>
                            <input type="text" name="location" value="${sensor.location}" required>
                        </div>
                        
                        <div class="form-section">
                            <h4>Temperature Thresholds</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>High Alert (°C)</label>
                                    <input type="number" name="temp_high" value="${config.thresholds?.temperature_high || ''}" 
                                           step="0.1" placeholder="e.g., 30">
                                </div>
                                <div class="form-group">
                                    <label>Low Alert (°C)</label>
                                    <input type="number" name="temp_low" value="${config.thresholds?.temperature_low || ''}" 
                                           step="0.1" placeholder="e.g., 15">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4>Humidity Thresholds</h4>
                            <div class="form-row">
                                <div class="form-group">
                                    <label>High Alert (%)</label>
                                    <input type="number" name="humidity_high" value="${config.thresholds?.humidity_high || ''}" 
                                           step="0.1" placeholder="e.g., 80">
                                </div>
                                <div class="form-group">
                                    <label>Low Alert (%)</label>
                                    <input type="number" name="humidity_low" value="${config.thresholds?.humidity_low || ''}" 
                                           step="0.1" placeholder="e.g., 30">
                                </div>
                            </div>
                        </div>
                        
                        <div class="form-section">
                            <h4>Update Interval</h4>
                            <div class="form-group">
                                <label>Reading Interval (seconds)</label>
                                <select name="update_interval">
                                    <option value="30" ${config.update_interval === 30 ? 'selected' : ''}>30 seconds</option>
                                    <option value="60" ${config.update_interval === 60 ? 'selected' : ''}>1 minute</option>
                                    <option value="300" ${config.update_interval === 300 ? 'selected' : ''}>5 minutes</option>
                                    <option value="600" ${config.update_interval === 600 ? 'selected' : ''}>10 minutes</option>
                                </select>
                            </div>
                        </div>
                    </form>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary modal-close">Cancel</button>
                    <button type="button" class="btn btn-primary" onclick="sensorManager.saveSensorConfig('${sensor.device_id}')">
                        Save Configuration
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
    }

    async saveSensorConfig(deviceId) {
        const form = document.getElementById('sensor-config-form');
        const formData = new FormData(form);
        
        const configuration = {
            thresholds: {
                temperature_high: formData.get('temp_high') ? parseFloat(formData.get('temp_high')) : null,
                temperature_low: formData.get('temp_low') ? parseFloat(formData.get('temp_low')) : null,
                humidity_high: formData.get('humidity_high') ? parseFloat(formData.get('humidity_high')) : null,
                humidity_low: formData.get('humidity_low') ? parseFloat(formData.get('humidity_low')) : null
            },
            update_interval: parseInt(formData.get('update_interval'))
        };

        try {
            const response = await apiCall(`/sensors/${deviceId}/config`, {
                method: 'PUT',
                body: JSON.stringify({ configuration })
            });

            if (response.status === 'success') {
                showNotification('Configuration saved successfully', 'success');
                document.querySelector('.modal-overlay').remove();
                await this.loadSensors();
                this.renderSensorDashboard();
            }
        } catch (error) {
            console.error('Error saving configuration:', error);
            showNotification('Failed to save configuration', 'error');
        }
    }

    formatTimestamp(timestamp) {
        if (!timestamp) return 'Never';
        
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
        return date.toLocaleDateString();
    }

    showAddSensorGuide() {
        // Open ESP32 setup guide
        window.open('/ESP32_SETUP.md', '_blank');
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        // Destroy all chart instances
        this.chartInstances.forEach(chart => chart.destroy());
        this.chartInstances.clear();
    }
}

// Initialize sensor manager when DOM is loaded
let sensorManager;
document.addEventListener('DOMContentLoaded', () => {
    sensorManager = new SensorManager();
});

// Export for global access
window.sensorManager = sensorManager;

