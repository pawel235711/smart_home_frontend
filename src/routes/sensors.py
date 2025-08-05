from flask import Blueprint, request, jsonify, current_app, send_file
from datetime import datetime, timedelta
import json
import requests
import os
import hashlib
from typing import Dict, List, Any, Optional

from src.models.sensor import (
    db, SensorDevice, SensorReading, OTAUpdate, SensorAlert,
    get_sensor_summary, check_sensor_thresholds
)

sensors_bp = Blueprint('sensors', __name__)

# Device Registration and Management
@sensors_bp.route('/sensors/register', methods=['POST'])
def register_sensor():
    """Register a new ESP32 sensor device"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['device_id', 'name', 'location']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        device_id = data['device_id']
        name = data['name']
        location = data['location']
        device_type = data.get('device_type', 'esp32_dht22')
        mac_address = data.get('mac_address')
        firmware_version = data.get('firmware_version')
        configuration = data.get('configuration', {})
        
        # Get client IP address
        ip_address = request.headers.get('X-Forwarded-For', request.remote_addr)
        if ',' in ip_address:
            ip_address = ip_address.split(',')[0].strip()
        
        # Register or update device
        device = SensorDevice.get_by_device_id(device_id)
        if device:
            # Update existing device
            device.name = name
            device.location = location
            device.device_type = device_type
            device.ip_address = ip_address
            device.mac_address = mac_address or device.mac_address
            device.firmware_version = firmware_version or device.firmware_version
            device.last_seen = datetime.utcnow()
            device.status = 'online'
            device.updated_at = datetime.utcnow()
            if configuration:
                device.configuration = json.dumps(configuration)
            
            current_app.logger.info(f"Updated sensor device: {device_id}")
        else:
            # Create new device
            device = SensorDevice(
                device_id=device_id,
                name=name,
                location=location,
                device_type=device_type,
                ip_address=ip_address,
                mac_address=mac_address,
                firmware_version=firmware_version,
                status='online',
                last_seen=datetime.utcnow(),
                configuration=json.dumps(configuration) if configuration else None
            )
            db.session.add(device)
            current_app.logger.info(f"Registered new sensor device: {device_id}")
        
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'device_id': device_id,
            'message': 'Device registered successfully',
            'registered_at': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error registering sensor: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/data', methods=['POST'])
def receive_sensor_data():
    """Receive sensor readings from ESP32 devices"""
    try:
        data = request.get_json()
        
        device_id = data.get('device_id')
        readings = data.get('readings', [])
        
        if not device_id:
            return jsonify({'error': 'Missing device_id'}), 400
        
        if not readings:
            return jsonify({'error': 'No readings provided'}), 400
        
        # Update device last seen and status
        device = SensorDevice.get_by_device_id(device_id)
        if device:
            device.last_seen = datetime.utcnow()
            device.status = 'online'
            device.updated_at = datetime.utcnow()
        else:
            current_app.logger.warning(f"Received data from unregistered device: {device_id}")
            return jsonify({'error': 'Device not registered'}), 404
        
        # Store sensor readings
        stored_readings = 0
        for reading_data in readings:
            try:
                # Validate reading data
                required_fields = ['type', 'value', 'unit']
                if not all(field in reading_data for field in required_fields):
                    current_app.logger.warning(f"Invalid reading data: {reading_data}")
                    continue
                
                # Parse timestamp
                timestamp_str = reading_data.get('timestamp')
                if timestamp_str:
                    try:
                        timestamp = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
                    except ValueError:
                        timestamp = datetime.utcnow()
                else:
                    timestamp = datetime.utcnow()
                
                # Create sensor reading
                sensor_reading = SensorReading(
                    device_id=device_id,
                    sensor_type=reading_data['type'],
                    value=float(reading_data['value']),
                    unit=reading_data['unit'],
                    quality=reading_data.get('quality', 'good'),
                    timestamp=timestamp
                )
                db.session.add(sensor_reading)
                stored_readings += 1
                
            except (ValueError, TypeError) as e:
                current_app.logger.warning(f"Error processing reading: {reading_data}, error: {str(e)}")
                continue
        
        db.session.commit()
        
        # Check thresholds for alerts
        try:
            check_sensor_thresholds()
        except Exception as e:
            current_app.logger.error(f"Error checking thresholds: {str(e)}")
        
        current_app.logger.info(f"Stored {stored_readings} readings from device {device_id}")
        
        return jsonify({
            'status': 'success',
            'readings_stored': stored_readings,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error receiving sensor data: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Device Information and Status
@sensors_bp.route('/sensors', methods=['GET'])
def list_sensors():
    """Get list of all sensor devices"""
    try:
        devices = SensorDevice.query.all()
        
        # Update device statuses
        for device in devices:
            device.update_status()
        db.session.commit()
        
        return jsonify({
            'status': 'success',
            'devices': [device.to_dict() for device in devices],
            'count': len(devices)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error listing sensors: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/<device_id>', methods=['GET'])
def get_sensor_details(device_id):
    """Get detailed information about a specific sensor"""
    try:
        device = SensorDevice.get_by_device_id(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        device.update_status()
        db.session.commit()
        
        # Get latest readings
        latest_readings = device.get_latest_readings(limit=20)
        
        # Get recent alerts
        recent_alerts = SensorAlert.query.filter_by(device_id=device_id).order_by(
            SensorAlert.created_at.desc()
        ).limit(10).all()
        
        return jsonify({
            'status': 'success',
            'device': device.to_dict(),
            'latest_readings': latest_readings,
            'recent_alerts': [alert.to_dict() for alert in recent_alerts]
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting sensor details: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/<device_id>/readings', methods=['GET'])
def get_sensor_readings(device_id):
    """Get historical sensor readings"""
    try:
        device = SensorDevice.get_by_device_id(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        # Parse query parameters
        sensor_type = request.args.get('type', 'temperature')
        hours = int(request.args.get('hours', 24))
        limit = int(request.args.get('limit', 100))
        
        # Get historical data
        readings = SensorReading.get_historical_data(device_id, sensor_type, hours)
        
        # Limit results if needed
        if len(readings) > limit:
            # Sample readings to fit within limit
            step = len(readings) // limit
            readings = readings[::step][:limit]
        
        return jsonify({
            'status': 'success',
            'device_id': device_id,
            'sensor_type': sensor_type,
            'readings': [reading.to_dict() for reading in readings],
            'count': len(readings)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting sensor readings: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Device Configuration
@sensors_bp.route('/sensors/<device_id>/config', methods=['GET', 'PUT'])
def sensor_configuration(device_id):
    """Get or update sensor configuration"""
    try:
        device = SensorDevice.get_by_device_id(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        if request.method == 'GET':
            # Get current configuration
            config = json.loads(device.configuration) if device.configuration else {}
            return jsonify({
                'status': 'success',
                'device_id': device_id,
                'configuration': config
            })
        
        elif request.method == 'PUT':
            # Update configuration
            data = request.get_json()
            new_config = data.get('configuration', {})
            
            # Validate configuration
            if not isinstance(new_config, dict):
                return jsonify({'error': 'Configuration must be a JSON object'}), 400
            
            # Update device configuration
            device.configuration = json.dumps(new_config)
            device.updated_at = datetime.utcnow()
            db.session.commit()
            
            current_app.logger.info(f"Updated configuration for device {device_id}")
            
            return jsonify({
                'status': 'success',
                'device_id': device_id,
                'message': 'Configuration updated successfully'
            })
            
    except Exception as e:
        current_app.logger.error(f"Error handling sensor configuration: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# OTA Update Management
@sensors_bp.route('/sensors/<device_id>/ota', methods=['POST'])
def trigger_ota_update(device_id):
    """Trigger OTA update for specific device"""
    try:
        device = SensorDevice.get_by_device_id(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        if not device.is_online():
            return jsonify({'error': 'Device is offline'}), 400
        
        data = request.get_json()
        firmware_version = data.get('firmware_version')
        firmware_url = data.get('firmware_url')
        
        if not firmware_version:
            return jsonify({'error': 'Missing firmware_version'}), 400
        
        # Check for existing active update
        existing_update = OTAUpdate.query.filter_by(
            device_id=device_id,
            update_status='in_progress'
        ).first()
        
        if existing_update:
            return jsonify({'error': 'Update already in progress'}), 409
        
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
            update_payload = {
                'firmware_version': firmware_version,
                'update_id': ota_update.id
            }
            
            if firmware_url:
                update_payload['firmware_url'] = firmware_url
            
            response = requests.post(
                f"http://{device.ip_address}/update",
                json=update_payload,
                timeout=30,
                headers={'Content-Type': 'application/json'}
            )
            
            if response.status_code == 200:
                ota_update.update_status = 'in_progress'
                current_app.logger.info(f"OTA update initiated for device {device_id}")
            else:
                ota_update.update_status = 'failed'
                ota_update.error_message = f"HTTP {response.status_code}: {response.text}"
                current_app.logger.error(f"OTA update failed for device {device_id}: {response.status_code}")
            
        except requests.exceptions.RequestException as e:
            ota_update.update_status = 'failed'
            ota_update.error_message = f"Connection error: {str(e)}"
            current_app.logger.error(f"OTA update connection error for device {device_id}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'status': ota_update.update_status,
            'update_id': ota_update.id,
            'message': 'OTA update initiated' if ota_update.update_status == 'in_progress' else 'OTA update failed'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error triggering OTA update: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/<device_id>/ota/status', methods=['GET'])
def get_ota_status(device_id):
    """Get OTA update status for device"""
    try:
        device = SensorDevice.get_by_device_id(device_id)
        if not device:
            return jsonify({'error': 'Device not found'}), 404
        
        # Get latest OTA update
        latest_update = OTAUpdate.get_latest_for_device(device_id)
        
        if not latest_update:
            return jsonify({
                'status': 'success',
                'device_id': device_id,
                'ota_status': 'none',
                'message': 'No OTA updates found'
            })
        
        return jsonify({
            'status': 'success',
            'device_id': device_id,
            'ota_update': latest_update.to_dict()
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting OTA status: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/ota/updates/<int:update_id>/progress', methods=['POST'])
def update_ota_progress(update_id):
    """Update OTA progress (called by ESP32 during update)"""
    try:
        ota_update = OTAUpdate.query.get(update_id)
        if not ota_update:
            return jsonify({'error': 'Update not found'}), 404
        
        data = request.get_json()
        progress = data.get('progress', 0)
        status = data.get('status', 'in_progress')
        error_message = data.get('error_message')
        
        # Update progress
        ota_update.update_progress(progress)
        if status in ['completed', 'failed']:
            ota_update.mark_completed(success=(status == 'completed'), error_message=error_message)
        
        db.session.commit()
        
        current_app.logger.info(f"OTA update {update_id} progress: {progress}% - {status}")
        
        return jsonify({
            'status': 'success',
            'update_id': update_id,
            'progress': ota_update.progress_percentage
        })
        
    except Exception as e:
        current_app.logger.error(f"Error updating OTA progress: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Alerts and Notifications
@sensors_bp.route('/sensors/alerts', methods=['GET'])
def get_sensor_alerts():
    """Get all sensor alerts"""
    try:
        # Parse query parameters
        active_only = request.args.get('active_only', 'true').lower() == 'true'
        limit = int(request.args.get('limit', 50))
        
        query = SensorAlert.query
        if active_only:
            query = query.filter_by(is_active=True, acknowledged=False)
        
        alerts = query.order_by(SensorAlert.created_at.desc()).limit(limit).all()
        
        return jsonify({
            'status': 'success',
            'alerts': [alert.to_dict() for alert in alerts],
            'count': len(alerts)
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting sensor alerts: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/alerts/<int:alert_id>/acknowledge', methods=['POST'])
def acknowledge_alert(alert_id):
    """Acknowledge a sensor alert"""
    try:
        alert = SensorAlert.query.get(alert_id)
        if not alert:
            return jsonify({'error': 'Alert not found'}), 404
        
        alert.acknowledge()
        db.session.commit()
        
        current_app.logger.info(f"Alert {alert_id} acknowledged")
        
        return jsonify({
            'status': 'success',
            'alert_id': alert_id,
            'message': 'Alert acknowledged'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error acknowledging alert: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Dashboard and Summary
@sensors_bp.route('/sensors/summary', methods=['GET'])
def get_sensors_summary():
    """Get summary of all sensors and their status"""
    try:
        summary = get_sensor_summary()
        return jsonify({
            'status': 'success',
            'summary': summary
        })
        
    except Exception as e:
        current_app.logger.error(f"Error getting sensors summary: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# Utility endpoints
@sensors_bp.route('/sensors/cleanup', methods=['POST'])
def cleanup_old_data():
    """Clean up old sensor data"""
    try:
        data = request.get_json()
        days = data.get('days', 30)
        
        # Clean up old readings
        SensorReading.cleanup_old_data(days)
        
        current_app.logger.info(f"Cleaned up sensor data older than {days} days")
        
        return jsonify({
            'status': 'success',
            'message': f'Cleaned up data older than {days} days'
        })
        
    except Exception as e:
        current_app.logger.error(f"Error cleaning up sensor data: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@sensors_bp.route('/sensors/health', methods=['GET'])
def sensor_health_check():
    """Health check endpoint for sensor system"""
    try:
        # Check database connectivity
        device_count = SensorDevice.query.count()
        
        # Check for recent readings
        recent_cutoff = datetime.utcnow() - timedelta(minutes=10)
        recent_readings = SensorReading.query.filter(
            SensorReading.timestamp >= recent_cutoff
        ).count()
        
        # Check for active alerts
        active_alerts = SensorAlert.query.filter_by(
            is_active=True,
            acknowledged=False
        ).count()
        
        return jsonify({
            'status': 'healthy',
            'timestamp': datetime.utcnow().isoformat(),
            'metrics': {
                'total_devices': device_count,
                'recent_readings': recent_readings,
                'active_alerts': active_alerts
            }
        })
        
    except Exception as e:
        current_app.logger.error(f"Sensor health check failed: {str(e)}")
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500

