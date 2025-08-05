# ESP32 + DHT22 Sensor Integration with ESPHome

## Overview

This guide provides comprehensive instructions for integrating ESP32 microcontrollers with DHT22 temperature and humidity sensors into your Smart Home Control System using ESPHome. The integration includes real-time sensor monitoring, Over-The-Air (OTA) updates, and seamless web interface control.

## Table of Contents

1. [Hardware Requirements](#hardware-requirements)
2. [Hardware Assembly](#hardware-assembly)
3. [ESPHome Installation](#esphome-installation)
4. [ESP32 Configuration](#esp32-configuration)
5. [Firmware Compilation and Upload](#firmware-compilation-and-upload)
6. [OTA Update Setup](#ota-update-setup)
7. [Integration with Smart Home System](#integration-with-smart-home-system)
8. [Troubleshooting](#troubleshooting)

## Hardware Requirements

### Essential Components

| Component | Specification | Quantity | Purpose |
|-----------|--------------|----------|---------|
| ESP32 Development Board | ESP32-WROOM-32 or ESP32-DevKitC | 1 | Main microcontroller |
| DHT22 Sensor | AM2302 Temperature & Humidity | 1 | Environmental monitoring |
| Resistor | 10kΩ pull-up resistor | 1 | Signal stabilization |
| Breadboard | Half-size or full-size | 1 | Prototyping connections |
| Jumper Wires | Male-to-male, various colors | 10+ | Connections |
| USB Cable | Micro-USB or USB-C (ESP32 dependent) | 1 | Programming and power |
| Power Supply | 5V/3.3V adapter (optional) | 1 | Standalone operation |

### Optional Components

- **Enclosure**: Weatherproof case for outdoor installation
- **PCB**: Custom printed circuit board for permanent installation
- **Additional Sensors**: DS18B20 for precise temperature, BMP280 for pressure
- **Display**: OLED screen for local sensor readings

## Hardware Assembly

### Wiring Diagram

The DHT22 sensor connects to the ESP32 using a simple three-wire configuration plus a pull-up resistor for signal integrity.

```
DHT22 Pin 1 (VCC) ──────────── ESP32 3.3V
DHT22 Pin 2 (DATA) ─────┬───── ESP32 GPIO4
                        │
                   10kΩ Resistor
                        │
DHT22 Pin 1 (VCC) ──────┘
DHT22 Pin 4 (GND) ──────────── ESP32 GND
```

### Step-by-Step Assembly

1. **Power Connections**
   - Connect DHT22 VCC (Pin 1) to ESP32 3.3V pin
   - Connect DHT22 GND (Pin 4) to ESP32 GND pin

2. **Data Connection**
   - Connect DHT22 DATA (Pin 2) to ESP32 GPIO4
   - Install 10kΩ pull-up resistor between DATA pin and VCC

3. **Verification**
   - Double-check all connections using a multimeter
   - Ensure no short circuits between power rails
   - Verify GPIO4 is not used by other components

### Pin Configuration Options

While GPIO4 is recommended, alternative pins can be used:

| GPIO Pin | Suitability | Notes |
|----------|-------------|-------|
| GPIO4 | Excellent | Default recommendation |
| GPIO5 | Good | Alternative option |
| GPIO18 | Good | SPI SCLK, avoid if using SPI |
| GPIO19 | Good | SPI MISO, avoid if using SPI |
| GPIO21 | Good | I2C SDA, avoid if using I2C |
| GPIO22 | Good | I2C SCL, avoid if using I2C |

## ESPHome Installation

### Prerequisites

Ensure your development environment meets these requirements:

- **Python 3.8+**: ESPHome requires modern Python
- **pip**: Python package manager
- **Git**: Version control system
- **USB Drivers**: ESP32 serial communication drivers

### Installation Methods

#### Method 1: pip Installation (Recommended)

```bash
# Create virtual environment
python3 -m venv esphome-env
source esphome-env/bin/activate  # Linux/Mac
# esphome-env\Scripts\activate  # Windows

# Install ESPHome
pip install esphome

# Verify installation
esphome version
```

#### Method 2: Docker Installation

```bash
# Pull ESPHome Docker image
docker pull esphome/esphome

# Create alias for convenience
alias esphome='docker run --rm -v "${PWD}":/config -it esphome/esphome'
```

#### Method 3: Home Assistant Add-on

If using Home Assistant OS:

1. Navigate to **Supervisor** → **Add-on Store**
2. Search for **ESPHome**
3. Click **Install**
4. Start the add-on and access via web interface

### Development Environment Setup

Create a dedicated workspace for ESP32 projects:

```bash
mkdir ~/esp32-projects
cd ~/esp32-projects
mkdir living-room-sensor
cd living-room-sensor
```

## ESP32 Configuration


### ESPHome Configuration File

Create a comprehensive configuration file that defines the ESP32 behavior, sensor setup, and OTA capabilities. The configuration uses YAML format and includes all necessary components for seamless integration.

#### Basic Configuration Structure

Create `living-room-sensor.yaml` with the following comprehensive configuration:

```yaml
# ESPHome Configuration for Living Room Temperature/Humidity Sensor
# Device: ESP32 + DHT22
# Purpose: Environmental monitoring with OTA updates

esphome:
  name: living-room-sensor
  friendly_name: "Living Room Environmental Sensor"
  comment: "DHT22 temperature and humidity monitoring"
  project:
    name: "smarthome.environmental-sensor"
    version: "1.0.0"

# ESP32 Platform Configuration
esp32:
  board: esp32dev
  framework:
    type: arduino
    version: recommended

# Enable logging for debugging
logger:
  level: INFO
  baud_rate: 115200

# API for Home Assistant integration
api:
  encryption:
    key: "your-32-character-encryption-key-here"
  services:
    # Custom service for manual sensor reading
    - service: read_sensors
      then:
        - component.update: dht22_sensor
    
    # Custom service for system restart
    - service: restart_device
      then:
        - restart:

# Over-The-Air updates
ota:
  password: "your-ota-password-here"
  safe_mode: true
  reboot_timeout: 10min
  num_attempts: 5

# WiFi Configuration
wifi:
  ssid: "Your-WiFi-SSID"
  password: "Your-WiFi-Password"
  
  # Enable WiFi Access Point fallback
  ap:
    ssid: "Living-Room-Sensor-Fallback"
    password: "fallback-password"

# Web server for local access
web_server:
  port: 80
  version: 2
  include_internal: true
  ota: true

# Captive portal for WiFi setup
captive_portal:

# Status LED (built-in ESP32 LED)
status_led:
  pin:
    number: GPIO2
    inverted: true

# DHT22 Sensor Configuration
sensor:
  # DHT22 Temperature and Humidity
  - platform: dht
    pin: GPIO4
    model: DHT22
    id: dht22_sensor
    update_interval: 30s
    
    temperature:
      name: "Living Room Temperature"
      id: living_room_temperature
      unit_of_measurement: "°C"
      accuracy_decimals: 1
      device_class: temperature
      state_class: measurement
      filters:
        # Remove outlier readings
        - filter_out: nan
        - sliding_window_moving_average:
            window_size: 3
            send_every: 1
        # Calibration offset (adjust based on sensor accuracy)
        - offset: 0.0
      on_value:
        then:
          - lambda: |-
              ESP_LOGI("sensor", "Temperature: %.1f°C", x);
    
    humidity:
      name: "Living Room Humidity"
      id: living_room_humidity
      unit_of_measurement: "%"
      accuracy_decimals: 1
      device_class: humidity
      state_class: measurement
      filters:
        - filter_out: nan
        - sliding_window_moving_average:
            window_size: 3
            send_every: 1
        - offset: 0.0
      on_value:
        then:
          - lambda: |-
              ESP_LOGI("sensor", "Humidity: %.1f%%", x);

  # WiFi Signal Strength
  - platform: wifi_signal
    name: "Living Room Sensor WiFi Signal"
    id: wifi_signal_strength
    update_interval: 60s
    unit_of_measurement: "dBm"
    accuracy_decimals: 0
    device_class: signal_strength
    state_class: measurement

  # Uptime Sensor
  - platform: uptime
    name: "Living Room Sensor Uptime"
    id: uptime_sensor
    update_interval: 60s
    unit_of_measurement: "s"
    accuracy_decimals: 0
    state_class: total_increasing

# Binary Sensors
binary_sensor:
  # Device Status
  - platform: status
    name: "Living Room Sensor Status"
    id: device_status

# Text Sensors
text_sensor:
  # WiFi Information
  - platform: wifi_info
    ip_address:
      name: "Living Room Sensor IP Address"
      id: ip_address
    ssid:
      name: "Living Room Sensor Connected SSID"
      id: connected_ssid
    mac_address:
      name: "Living Room Sensor MAC Address"
      id: mac_address

  # ESPHome Version
  - platform: version
    name: "Living Room Sensor ESPHome Version"
    id: esphome_version

# Switches for remote control
switch:
  # Restart switch
  - platform: restart
    name: "Living Room Sensor Restart"
    id: restart_switch

  # Safe mode switch for OTA recovery
  - platform: safe_mode
    name: "Living Room Sensor Safe Mode"
    id: safe_mode_switch

# Buttons for manual actions
button:
  # Manual sensor update
  - platform: template
    name: "Update Living Room Sensors"
    id: update_sensors_button
    on_press:
      - component.update: dht22_sensor

  # Factory reset button
  - platform: factory_reset
    name: "Living Room Sensor Factory Reset"
    id: factory_reset_button

# Intervals for periodic tasks
interval:
  # Periodic sensor health check
  - interval: 5min
    then:
      - lambda: |-
          if (isnan(id(living_room_temperature).state) || 
              isnan(id(living_room_humidity).state)) {
            ESP_LOGW("sensor", "DHT22 sensor readings are invalid, attempting restart");
            id(restart_switch).turn_on();
          }

# Time synchronization
time:
  - platform: sntp
    id: sntp_time
    timezone: "Europe/Warsaw"  # Adjust to your timezone
    servers:
      - 0.pool.ntp.org
      - 1.pool.ntp.org
      - 2.pool.ntp.org
```

### Configuration Customization

#### Network Settings

Modify the WiFi configuration section to match your network:

```yaml
wifi:
  ssid: "YourNetworkName"
  password: "YourNetworkPassword"
  
  # Optional: Static IP configuration
  manual_ip:
    static_ip: 192.168.1.100
    gateway: 192.168.1.1
    subnet: 255.255.255.0
    dns1: 8.8.8.8
    dns2: 8.8.4.4
```

#### Security Configuration

Generate secure passwords and encryption keys:

```bash
# Generate OTA password
openssl rand -base64 32

# Generate API encryption key
esphome wizard living-room-sensor.yaml
```

#### Sensor Calibration

Fine-tune sensor readings based on your specific DHT22 characteristics:

```yaml
temperature:
  filters:
    - offset: -0.5  # Subtract 0.5°C if sensor reads high
    - multiply: 1.0  # Scaling factor if needed

humidity:
  filters:
    - offset: 2.0   # Add 2% if sensor reads low
    - multiply: 1.0  # Scaling factor if needed
```

### Advanced Configuration Options

#### Multiple Sensor Support

For installations with multiple sensors, extend the configuration:

```yaml
sensor:
  # Primary DHT22 (Living Room)
  - platform: dht
    pin: GPIO4
    model: DHT22
    temperature:
      name: "Living Room Temperature"
    humidity:
      name: "Living Room Humidity"
  
  # Secondary DHT22 (Kitchen)
  - platform: dht
    pin: GPIO5
    model: DHT22
    temperature:
      name: "Kitchen Temperature"
    humidity:
      name: "Kitchen Humidity"
```

#### Environmental Monitoring Enhancements

Add additional sensors for comprehensive monitoring:

```yaml
sensor:
  # Air Quality (if using MQ-135)
  - platform: adc
    pin: A0
    name: "Air Quality"
    update_interval: 60s
    filters:
      - multiply: 3.3
      - sliding_window_moving_average:
          window_size: 10
  
  # Light Level (if using photoresistor)
  - platform: adc
    pin: A1
    name: "Light Level"
    update_interval: 30s
    unit_of_measurement: "lx"
```

## Firmware Compilation and Upload

### Initial Firmware Upload

The first firmware upload requires a physical USB connection to the ESP32. Subsequent updates can be performed wirelessly via OTA.

#### Compilation Process

```bash
# Navigate to project directory
cd ~/esp32-projects/living-room-sensor

# Validate configuration
esphome config living-room-sensor.yaml

# Compile firmware
esphome compile living-room-sensor.yaml

# Upload via USB (first time only)
esphome upload living-room-sensor.yaml
```

#### Upload Process Details

During the initial upload, ESPHome performs several critical steps:

1. **Configuration Validation**: Checks YAML syntax and component compatibility
2. **Code Generation**: Converts YAML configuration to C++ Arduino code
3. **Compilation**: Builds firmware binary using ESP-IDF or Arduino framework
4. **Upload**: Transfers firmware to ESP32 via serial connection
5. **Verification**: Confirms successful upload and initial boot

#### Troubleshooting Upload Issues

Common upload problems and solutions:

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Port Access | "Permission denied" errors | `sudo usermod -a -G dialout $USER` |
| Driver Missing | Device not recognized | Install CP2102 or CH340 drivers |
| Boot Mode | Upload fails consistently | Hold BOOT button during upload |
| Power Issues | Brownout detector triggered | Use powered USB hub |
| Baud Rate | Slow or failed uploads | Try different baud rates (115200, 460800) |

### Monitoring Initial Boot

After successful upload, monitor the device boot process:

```bash
# Monitor serial output
esphome logs living-room-sensor.yaml

# Alternative: Direct serial monitoring
screen /dev/ttyUSB0 115200
```

Expected boot sequence:

1. **ESP32 Boot**: Hardware initialization and bootloader execution
2. **WiFi Connection**: Network association and IP address assignment
3. **Sensor Initialization**: DHT22 sensor detection and calibration
4. **API Startup**: Home Assistant API and web server activation
5. **First Readings**: Initial temperature and humidity measurements

## OTA Update Setup

Over-The-Air updates enable remote firmware updates without physical access to the ESP32. This capability is essential for deployed sensors in hard-to-reach locations.

### OTA Configuration Components

The OTA system consists of several interconnected components:

#### Security Framework

OTA updates use password-based authentication and optional encryption:

```yaml
ota:
  password: "secure-ota-password-2024"
  safe_mode: true
  reboot_timeout: 10min
  num_attempts: 5
  
  # Optional: Port configuration
  port: 3232
  
  # Optional: Encryption (requires ESPHome 2023.5+)
  encryption:
    key: "32-character-encryption-key-here"
```

#### Safe Mode Protection

Safe mode provides recovery capabilities if OTA updates fail:

- **Automatic Activation**: Triggers after failed boot attempts
- **Fallback Network**: Creates temporary WiFi access point
- **Recovery Interface**: Allows emergency firmware upload
- **Timeout Protection**: Automatically exits safe mode after specified duration

#### Update Process Workflow

The OTA update process follows a secure, multi-step workflow:

1. **Authentication**: Verify OTA password and encryption keys
2. **Preparation**: Stop non-essential services and prepare flash memory
3. **Transfer**: Download new firmware binary over WiFi
4. **Verification**: Validate firmware integrity using checksums
5. **Installation**: Write new firmware to flash memory
6. **Reboot**: Restart ESP32 with new firmware
7. **Validation**: Confirm successful boot and functionality

### Performing OTA Updates

#### Command-Line OTA Updates

```bash
# Update via OTA (after initial USB upload)
esphome upload living-room-sensor.yaml --device 192.168.1.100

# Alternative: Auto-discovery
esphome upload living-room-sensor.yaml
```

#### Web Interface OTA Updates

ESPHome provides a web interface for convenient updates:

1. **Access Web Interface**: Navigate to `http://[ESP32-IP-ADDRESS]`
2. **Authentication**: Enter OTA password if configured
3. **Upload Firmware**: Select compiled `.bin` file
4. **Monitor Progress**: Watch upload progress and reboot sequence
5. **Verification**: Confirm device functionality post-update

#### Automated OTA Updates

For production deployments, implement automated update systems:

```bash
#!/bin/bash
# Automated OTA update script

DEVICE_IP="192.168.1.100"
CONFIG_FILE="living-room-sensor.yaml"
LOG_FILE="/var/log/esp32-updates.log"

echo "$(date): Starting OTA update for $DEVICE_IP" >> $LOG_FILE

# Compile latest firmware
if esphome compile $CONFIG_FILE; then
    echo "$(date): Compilation successful" >> $LOG_FILE
    
    # Perform OTA update
    if esphome upload $CONFIG_FILE --device $DEVICE_IP; then
        echo "$(date): OTA update successful" >> $LOG_FILE
    else
        echo "$(date): OTA update failed" >> $LOG_FILE
        exit 1
    fi
else
    echo "$(date): Compilation failed" >> $LOG_FILE
    exit 1
fi
```

### OTA Update Best Practices

#### Version Management

Implement systematic version control for firmware updates:

```yaml
esphome:
  name: living-room-sensor
  project:
    name: "smarthome.environmental-sensor"
    version: "1.2.3"  # Semantic versioning
  
  # Build flags for version tracking
  build_flags:
    - -DVERSION_STRING='"1.2.3"'
    - -DBUILD_DATE='"$(date +%Y%m%d)"'
```

#### Rollback Capabilities

Configure automatic rollback for failed updates:

```yaml
ota:
  safe_mode: true
  reboot_timeout: 5min  # Shorter timeout for faster rollback
  num_attempts: 3       # Fewer attempts before safe mode
  
  # Custom rollback logic
  on_error:
    then:
      - logger.log: "OTA update failed, entering safe mode"
      - switch.turn_on: safe_mode_switch
```

#### Update Scheduling

Implement intelligent update scheduling to minimize disruption:

```yaml
# Update window configuration
time:
  - platform: sntp
    id: sntp_time
    on_time:
      # Check for updates daily at 3 AM
      - seconds: 0
        minutes: 0
        hours: 3
        then:
          - lambda: |-
              // Custom update check logic
              ESP_LOGI("ota", "Checking for firmware updates");
```

## Integration with Smart Home System

The ESP32 sensor integrates with the Smart Home Control System through multiple communication protocols and data exchange mechanisms. This integration enables real-time monitoring, historical data analysis, and automated control based on environmental conditions.

### Communication Architecture

#### API Integration Points

The integration utilizes several API endpoints for seamless data exchange:

1. **Sensor Data Ingestion**: Real-time temperature and humidity readings
2. **Device Status Monitoring**: Connection status, battery levels, and error states
3. **OTA Update Management**: Remote firmware update capabilities
4. **Configuration Synchronization**: Settings and calibration parameters

#### Data Flow Architecture

```
ESP32 Sensor → WiFi Network → Smart Home Backend → Web Interface
     ↓              ↓                ↓                ↓
  DHT22 Data    HTTP/MQTT API    Database Storage   Real-time Display
```

### Backend API Extensions

The Smart Home Control System requires several backend modifications to support ESP32 sensor integration. These extensions handle sensor data ingestion, device management, and OTA update coordination.

#### Database Schema Extensions

New database tables support sensor data storage and device management:

```sql
-- Sensor devices table
CREATE TABLE sensor_devices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    device_type VARCHAR(50) NOT NULL,
    ip_address VARCHAR(15),
    mac_address VARCHAR(17),
    firmware_version VARCHAR(20),
    last_seen TIMESTAMP,
    status VARCHAR(20) DEFAULT 'offline',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Sensor readings table
CREATE TABLE sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id VARCHAR(50) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    value REAL NOT NULL,
    unit VARCHAR(10) NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id)
);

-- OTA update history
CREATE TABLE ota_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id VARCHAR(50) NOT NULL,
    firmware_version VARCHAR(20) NOT NULL,
    update_status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    FOREIGN KEY (device_id) REFERENCES sensor_devices(device_id)
);
```

#### API Endpoint Implementation

New Flask routes handle sensor communication and management:

```python
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
import json

sensors_bp = Blueprint('sensors', __name__)

@sensors_bp.route('/sensors/register', methods=['POST'])
def register_sensor():
    """Register a new ESP32 sensor device"""
    data = request.get_json()
    
    device_id = data.get('device_id')
    name = data.get('name')
    location = data.get('location')
    ip_address = request.remote_addr
    
    # Validate required fields
    if not all([device_id, name, location]):
        return jsonify({'error': 'Missing required fields'}), 400
    
    # Register or update device
    device = SensorDevice.query.filter_by(device_id=device_id).first()
    if device:
        device.ip_address = ip_address
        device.last_seen = datetime.utcnow()
        device.status = 'online'
    else:
        device = SensorDevice(
            device_id=device_id,
            name=name,
            location=location,
            ip_address=ip_address,
            status='online',
            last_seen=datetime.utcnow()
        )
        db.session.add(device)
    
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'device_id': device_id,
        'registered_at': datetime.utcnow().isoformat()
    })

@sensors_bp.route('/sensors/data', methods=['POST'])
def receive_sensor_data():
    """Receive sensor readings from ESP32 devices"""
    data = request.get_json()
    
    device_id = data.get('device_id')
    readings = data.get('readings', [])
    
    if not device_id or not readings:
        return jsonify({'error': 'Invalid data format'}), 400
    
    # Update device last seen
    device = SensorDevice.query.filter_by(device_id=device_id).first()
    if device:
        device.last_seen = datetime.utcnow()
        device.status = 'online'
    
    # Store sensor readings
    for reading in readings:
        sensor_reading = SensorReading(
            device_id=device_id,
            sensor_type=reading.get('type'),
            value=reading.get('value'),
            unit=reading.get('unit'),
            timestamp=datetime.fromisoformat(reading.get('timestamp'))
        )
        db.session.add(sensor_reading)
    
    db.session.commit()
    
    return jsonify({
        'status': 'success',
        'readings_stored': len(readings)
    })

@sensors_bp.route('/sensors/<device_id>/ota', methods=['POST'])
def trigger_ota_update(device_id):
    """Trigger OTA update for specific device"""
    data = request.get_json()
    firmware_version = data.get('firmware_version')
    
    device = SensorDevice.query.filter_by(device_id=device_id).first()
    if not device:
        return jsonify({'error': 'Device not found'}), 404
    
    # Create OTA update record
    ota_update = OTAUpdate(
        device_id=device_id,
        firmware_version=firmware_version,
        update_status='initiated',
        started_at=datetime.utcnow()
    )
    db.session.add(ota_update)
    db.session.commit()
    
    # Trigger OTA update via HTTP request to device
    try:
        import requests
        response = requests.post(
            f"http://{device.ip_address}/update",
            json={'firmware_version': firmware_version},
            timeout=30
        )
        
        if response.status_code == 200:
            ota_update.update_status = 'in_progress'
        else:
            ota_update.update_status = 'failed'
            ota_update.error_message = f"HTTP {response.status_code}"
        
    except Exception as e:
        ota_update.update_status = 'failed'
        ota_update.error_message = str(e)
    
    db.session.commit()
    
    return jsonify({
        'status': ota_update.update_status,
        'update_id': ota_update.id
    })
```

This comprehensive setup provides the foundation for ESP32 + DHT22 sensor integration with your Smart Home Control System. The next sections will cover frontend interface development and OTA update management through the web interface.


### ESP32 Integration with Smart Home System

Once your ESP32 is configured and running with the provided ESPHome configuration, it will automatically integrate with your Smart Home Control System. The integration process involves device registration, data transmission, and web interface management.

#### Automatic Device Registration

When your ESP32 boots up with the ESPHome firmware, it will automatically register itself with the Smart Home Control System through the following process:

1. **Network Connection**: The ESP32 connects to your WiFi network using the configured credentials
2. **Service Discovery**: The device discovers the Smart Home Control System API endpoint
3. **Registration Request**: Sends a registration request with device information
4. **Database Entry**: The system creates a new sensor device entry in the database
5. **Confirmation**: Registration confirmation is sent back to the ESP32

The registration payload includes essential device information:

```json
{
  "device_id": "living-room-sensor",
  "name": "Living Room Environmental Sensor",
  "location": "Living Room",
  "device_type": "esp32_dht22",
  "mac_address": "AA:BB:CC:DD:EE:FF",
  "firmware_version": "1.0.0",
  "configuration": {
    "update_interval": 30,
    "thresholds": {
      "temperature_high": 30.0,
      "temperature_low": 15.0,
      "humidity_high": 80.0,
      "humidity_low": 30.0
    }
  }
}
```

#### Real-time Data Transmission

After successful registration, the ESP32 begins transmitting sensor readings to the Smart Home Control System at the configured interval (default: 30 seconds). The data transmission follows this structure:

```json
{
  "device_id": "living-room-sensor",
  "readings": [
    {
      "type": "temperature",
      "value": 22.5,
      "unit": "°C",
      "quality": "good",
      "timestamp": "2025-08-05T19:30:00Z"
    },
    {
      "type": "humidity",
      "value": 45.2,
      "unit": "%",
      "quality": "good",
      "timestamp": "2025-08-05T19:30:00Z"
    }
  ]
}
```

#### Web Interface Integration

Once your ESP32 sensor is registered and transmitting data, it will appear in the Smart Home Control System web interface:

1. **Navigate to Sensors**: Click the "Sensors" tab in the navigation menu
2. **View Dashboard**: Your sensor will appear in the sensor grid with real-time readings
3. **Monitor Status**: Online/offline status is automatically updated
4. **Configure Settings**: Click the "Configure" button to adjust thresholds and settings
5. **Manage Updates**: Use the "Update" button to perform OTA firmware updates

#### Advanced Configuration

##### Custom API Endpoint

If your Smart Home Control System is running on a different server or port, update the ESP32 configuration:

```yaml
# Custom API endpoint configuration
http_request:
  - url: "http://your-server-ip:5000/api/sensors/register"
    method: POST
    headers:
      Content-Type: "application/json"
    json:
      device_id: !lambda 'return App.get_name();'
      name: "${friendly_name}"
      location: "${location}"
```

##### Multiple Sensor Support

For installations with multiple ESP32 sensors, ensure each device has a unique identifier:

```yaml
esphome:
  name: living-room-sensor-01  # Unique name for each device
  friendly_name: "Living Room Sensor #1"
```

##### Network Security

For enhanced security in production environments, consider implementing:

1. **API Authentication**: Add API keys or tokens to sensor requests
2. **HTTPS Communication**: Use SSL/TLS for encrypted data transmission
3. **Network Segmentation**: Place sensors on a dedicated IoT VLAN
4. **Firewall Rules**: Restrict sensor communication to necessary endpoints

#### Troubleshooting Integration Issues

##### Device Not Appearing in Web Interface

1. **Check Network Connectivity**: Verify ESP32 can reach the Smart Home Control System
2. **Verify API Endpoint**: Ensure the registration URL is correct
3. **Check Logs**: Monitor ESP32 serial output for error messages
4. **Database Verification**: Check if device entry exists in sensor_devices table

```bash
# Check ESP32 logs
esphome logs living-room-sensor.yaml

# Verify database entry
sqlite3 src/database/app.db "SELECT * FROM sensor_devices;"
```

##### Data Not Updating

1. **Transmission Interval**: Verify update_interval setting in ESP32 configuration
2. **API Connectivity**: Test data endpoint manually
3. **Database Permissions**: Ensure write permissions to database
4. **Error Logs**: Check Flask application logs for API errors

##### OTA Updates Failing

1. **Network Stability**: Ensure stable WiFi connection during updates
2. **Power Supply**: Verify adequate power supply for ESP32
3. **Firmware Compatibility**: Check firmware version compatibility
4. **Safe Mode**: Use safe mode for recovery if update fails

#### Performance Optimization

##### Battery-Powered Sensors

For battery-powered ESP32 installations, optimize power consumption:

```yaml
# Deep sleep configuration for battery operation
deep_sleep:
  run_duration: 30s
  sleep_duration: 10min
  id: deep_sleep_1

# Wake up on sensor reading
sensor:
  - platform: dht
    # ... sensor configuration
    on_value:
      then:
        - deep_sleep.enter: deep_sleep_1
```

##### High-Frequency Monitoring

For applications requiring frequent sensor readings:

```yaml
# High-frequency sensor configuration
sensor:
  - platform: dht
    pin: GPIO4
    model: DHT22
    update_interval: 10s  # More frequent readings
    
    temperature:
      filters:
        # Reduce noise with moving average
        - sliding_window_moving_average:
            window_size: 5
            send_every: 1
```

#### Integration with Home Automation Platforms

##### Home Assistant Integration

The Smart Home Control System can be integrated with Home Assistant through MQTT or REST API:

```yaml
# Home Assistant sensor configuration
sensor:
  - platform: rest
    resource: "http://your-smart-home-system:5000/api/sensors/living-room-sensor"
    name: "Living Room Temperature"
    value_template: "{{ value_json.temperature }}"
    unit_of_measurement: "°C"
```

##### Node-RED Integration

Create Node-RED flows to process sensor data:

```javascript
// Node-RED function node for sensor data processing
const sensorData = msg.payload;
const temperature = sensorData.readings.find(r => r.type === 'temperature');
const humidity = sensorData.readings.find(r => r.type === 'humidity');

// Process and forward data
msg.payload = {
    temperature: temperature.value,
    humidity: humidity.value,
    timestamp: new Date().toISOString()
};

return msg;
```

#### Maintenance and Monitoring

##### Regular Maintenance Tasks

1. **Firmware Updates**: Keep ESP32 firmware updated for security and features
2. **Calibration Checks**: Verify sensor accuracy periodically
3. **Network Monitoring**: Monitor WiFi signal strength and connectivity
4. **Database Cleanup**: Remove old sensor readings to manage storage

##### Monitoring Dashboard

The Smart Home Control System provides comprehensive monitoring:

- **Device Status**: Real-time online/offline status
- **Data Quality**: Sensor reading quality indicators
- **Alert Management**: Threshold-based alert system
- **Historical Trends**: Long-term data analysis and visualization

##### Automated Alerts

Configure automated alerts for various conditions:

```json
{
  "thresholds": {
    "temperature_high": 30.0,
    "temperature_low": 15.0,
    "humidity_high": 80.0,
    "humidity_low": 30.0
  },
  "alert_settings": {
    "email_notifications": true,
    "push_notifications": true,
    "alert_cooldown": 300
  }
}
```

## Conclusion

The ESP32 + DHT22 sensor integration with ESPHome provides a robust, scalable solution for environmental monitoring in smart home systems. The combination of reliable hardware, comprehensive software configuration, and seamless web interface integration creates a professional-grade monitoring solution.

Key benefits of this integration include:

- **Ease of Setup**: Comprehensive configuration templates and documentation
- **Reliability**: Robust error handling and recovery mechanisms
- **Scalability**: Support for multiple sensors and room assignments
- **Maintainability**: OTA updates and remote configuration management
- **Integration**: Seamless integration with existing smart home infrastructure

The system is designed to grow with your needs, supporting additional sensor types, advanced analytics, and integration with other home automation platforms. Whether you're monitoring a single room or an entire building, this ESP32 integration provides the foundation for comprehensive environmental monitoring and control.

For additional support and advanced configuration options, refer to the comprehensive API documentation and community resources available in the project repository.

---

**Author**: Manus AI  
**Version**: 1.0.0  
**Last Updated**: August 5, 2025  
**License**: MIT License

## References

[1] ESPHome Official Documentation: https://esphome.io/  
[2] ESP32 Technical Reference: https://www.espressif.com/sites/default/files/documentation/esp32_technical_reference_manual_en.pdf  
[3] DHT22 Sensor Datasheet: https://www.sparkfun.com/datasheets/Sensors/Temperature/DHT22.pdf  
[4] Flask-SQLAlchemy Documentation: https://flask-sqlalchemy.palletsprojects.com/  
[5] Home Assistant ESPHome Integration: https://www.home-assistant.io/integrations/esphome/

