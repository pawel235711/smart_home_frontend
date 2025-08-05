from src.models.device import db
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json

class SensorDevice(db.Model):
    """Model for ESP32 sensor devices"""
    __tablename__ = 'sensor_devices'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), unique=True, nullable=False)
    name = db.Column(db.String(100), nullable=False)
    location = db.Column(db.String(100), nullable=False)
    device_type = db.Column(db.String(50), nullable=False, default='esp32_dht22')
    ip_address = db.Column(db.String(15))
    mac_address = db.Column(db.String(17))
    firmware_version = db.Column(db.String(20))
    last_seen = db.Column(db.DateTime, default=datetime.utcnow)
    status = db.Column(db.String(20), default='offline')
    configuration = db.Column(db.Text)  # JSON configuration
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    readings = db.relationship('SensorReading', backref='device', lazy='dynamic', cascade='all, delete-orphan')
    ota_updates = db.relationship('OTAUpdate', backref='device', lazy='dynamic', cascade='all, delete-orphan')
    
    def __repr__(self):
        return f'<SensorDevice {self.device_id}: {self.name}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert sensor device to dictionary"""
        return {
            'id': self.id,
            'device_id': self.device_id,
            'name': self.name,
            'location': self.location,
            'device_type': self.device_type,
            'ip_address': self.ip_address,
            'mac_address': self.mac_address,
            'firmware_version': self.firmware_version,
            'last_seen': self.last_seen.isoformat() if self.last_seen else None,
            'status': self.status,
            'configuration': json.loads(self.configuration) if self.configuration else {},
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
    
    def get_latest_readings(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Get latest sensor readings"""
        readings = self.readings.order_by(SensorReading.timestamp.desc()).limit(limit).all()
        return [reading.to_dict() for reading in readings]
    
    def get_current_temperature(self) -> Optional[float]:
        """Get current temperature reading"""
        reading = self.readings.filter_by(sensor_type='temperature').order_by(SensorReading.timestamp.desc()).first()
        return reading.value if reading else None
    
    def get_current_humidity(self) -> Optional[float]:
        """Get current humidity reading"""
        reading = self.readings.filter_by(sensor_type='humidity').order_by(SensorReading.timestamp.desc()).first()
        return reading.value if reading else None
    
    def is_online(self) -> bool:
        """Check if device is considered online"""
        if not self.last_seen:
            return False
        
        # Consider device offline if not seen for more than 5 minutes
        time_diff = datetime.utcnow() - self.last_seen
        return time_diff.total_seconds() < 300  # 5 minutes
    
    def update_status(self):
        """Update device status based on last seen time"""
        self.status = 'online' if self.is_online() else 'offline'
    
    @classmethod
    def get_by_device_id(cls, device_id: str) -> Optional['SensorDevice']:
        """Get device by device ID"""
        return cls.query.filter_by(device_id=device_id).first()
    
    @classmethod
    def get_all_active(cls) -> List['SensorDevice']:
        """Get all active sensor devices"""
        return cls.query.filter_by(status='online').all()


class SensorReading(db.Model):
    """Model for sensor readings from ESP32 devices"""
    __tablename__ = 'sensor_readings'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('sensor_devices.device_id'), nullable=False)
    sensor_type = db.Column(db.String(50), nullable=False)  # temperature, humidity, etc.
    value = db.Column(db.Float, nullable=False)
    unit = db.Column(db.String(10), nullable=False)
    quality = db.Column(db.String(20), default='good')  # good, poor, error
    timestamp = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    
    # Indexes for performance
    __table_args__ = (
        db.Index('idx_device_sensor_time', 'device_id', 'sensor_type', 'timestamp'),
        db.Index('idx_timestamp', 'timestamp'),
    )
    
    def __repr__(self):
        return f'<SensorReading {self.device_id}: {self.sensor_type}={self.value}{self.unit}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert sensor reading to dictionary"""
        return {
            'id': self.id,
            'device_id': self.device_id,
            'sensor_type': self.sensor_type,
            'value': self.value,
            'unit': self.unit,
            'quality': self.quality,
            'timestamp': self.timestamp.isoformat()
        }
    
    @classmethod
    def get_latest_by_type(cls, device_id: str, sensor_type: str) -> Optional['SensorReading']:
        """Get latest reading for specific sensor type"""
        return cls.query.filter_by(
            device_id=device_id,
            sensor_type=sensor_type
        ).order_by(cls.timestamp.desc()).first()
    
    @classmethod
    def get_historical_data(cls, device_id: str, sensor_type: str, hours: int = 24) -> List['SensorReading']:
        """Get historical data for specific time period"""
        cutoff_time = datetime.utcnow() - timedelta(hours=hours)
        return cls.query.filter(
            cls.device_id == device_id,
            cls.sensor_type == sensor_type,
            cls.timestamp >= cutoff_time
        ).order_by(cls.timestamp.asc()).all()
    
    @classmethod
    def cleanup_old_data(cls, days: int = 30):
        """Clean up old sensor readings"""
        cutoff_time = datetime.utcnow() - timedelta(days=days)
        cls.query.filter(cls.timestamp < cutoff_time).delete()
        db.session.commit()


class OTAUpdate(db.Model):
    """Model for OTA update tracking"""
    __tablename__ = 'ota_updates'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('sensor_devices.device_id'), nullable=False)
    firmware_version = db.Column(db.String(20), nullable=False)
    update_status = db.Column(db.String(20), nullable=False)  # initiated, in_progress, completed, failed
    progress_percentage = db.Column(db.Integer, default=0)
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime)
    error_message = db.Column(db.Text)
    file_size = db.Column(db.Integer)
    checksum = db.Column(db.String(64))
    
    def __repr__(self):
        return f'<OTAUpdate {self.device_id}: {self.firmware_version} - {self.update_status}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert OTA update to dictionary"""
        return {
            'id': self.id,
            'device_id': self.device_id,
            'firmware_version': self.firmware_version,
            'update_status': self.update_status,
            'progress_percentage': self.progress_percentage,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'error_message': self.error_message,
            'file_size': self.file_size,
            'checksum': self.checksum
        }
    
    def mark_completed(self, success: bool = True, error_message: str = None):
        """Mark update as completed"""
        self.completed_at = datetime.utcnow()
        self.progress_percentage = 100 if success else self.progress_percentage
        self.update_status = 'completed' if success else 'failed'
        if error_message:
            self.error_message = error_message
    
    def update_progress(self, percentage: int):
        """Update progress percentage"""
        self.progress_percentage = max(0, min(100, percentage))
        if percentage >= 100:
            self.update_status = 'completed'
            self.completed_at = datetime.utcnow()
    
    @classmethod
    def get_latest_for_device(cls, device_id: str) -> Optional['OTAUpdate']:
        """Get latest OTA update for device"""
        return cls.query.filter_by(device_id=device_id).order_by(cls.started_at.desc()).first()
    
    @classmethod
    def get_active_updates(cls) -> List['OTAUpdate']:
        """Get all active OTA updates"""
        return cls.query.filter(cls.update_status.in_(['initiated', 'in_progress'])).all()


class SensorAlert(db.Model):
    """Model for sensor-based alerts and notifications"""
    __tablename__ = 'sensor_alerts'
    
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('sensor_devices.device_id'), nullable=False)
    alert_type = db.Column(db.String(50), nullable=False)  # temperature_high, humidity_low, device_offline
    threshold_value = db.Column(db.Float)
    current_value = db.Column(db.Float)
    severity = db.Column(db.String(20), default='warning')  # info, warning, critical
    message = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    acknowledged = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    acknowledged_at = db.Column(db.DateTime)
    
    def __repr__(self):
        return f'<SensorAlert {self.device_id}: {self.alert_type} - {self.severity}>'
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert sensor alert to dictionary"""
        return {
            'id': self.id,
            'device_id': self.device_id,
            'alert_type': self.alert_type,
            'threshold_value': self.threshold_value,
            'current_value': self.current_value,
            'severity': self.severity,
            'message': self.message,
            'is_active': self.is_active,
            'acknowledged': self.acknowledged,
            'created_at': self.created_at.isoformat(),
            'acknowledged_at': self.acknowledged_at.isoformat() if self.acknowledged_at else None
        }
    
    def acknowledge(self):
        """Acknowledge the alert"""
        self.acknowledged = True
        self.acknowledged_at = datetime.utcnow()
    
    def deactivate(self):
        """Deactivate the alert"""
        self.is_active = False
    
    @classmethod
    def create_temperature_alert(cls, device_id: str, current_temp: float, threshold: float, is_high: bool):
        """Create temperature-based alert"""
        alert_type = 'temperature_high' if is_high else 'temperature_low'
        comparison = 'above' if is_high else 'below'
        severity = 'critical' if abs(current_temp - threshold) > 5 else 'warning'
        
        message = f"Temperature {comparison} threshold: {current_temp}°C (threshold: {threshold}°C)"
        
        alert = cls(
            device_id=device_id,
            alert_type=alert_type,
            threshold_value=threshold,
            current_value=current_temp,
            severity=severity,
            message=message
        )
        return alert
    
    @classmethod
    def create_humidity_alert(cls, device_id: str, current_humidity: float, threshold: float, is_high: bool):
        """Create humidity-based alert"""
        alert_type = 'humidity_high' if is_high else 'humidity_low'
        comparison = 'above' if is_high else 'below'
        severity = 'warning'
        
        message = f"Humidity {comparison} threshold: {current_humidity}% (threshold: {threshold}%)"
        
        alert = cls(
            device_id=device_id,
            alert_type=alert_type,
            threshold_value=threshold,
            current_value=current_humidity,
            severity=severity,
            message=message
        )
        return alert
    
    @classmethod
    def create_device_offline_alert(cls, device_id: str):
        """Create device offline alert"""
        alert = cls(
            device_id=device_id,
            alert_type='device_offline',
            severity='critical',
            message=f"Device {device_id} is offline and not responding"
        )
        return alert
    
    @classmethod
    def get_active_alerts(cls) -> List['SensorAlert']:
        """Get all active, unacknowledged alerts"""
        return cls.query.filter_by(is_active=True, acknowledged=False).order_by(cls.created_at.desc()).all()


# Utility functions for sensor data management
from datetime import timedelta

def get_sensor_summary() -> Dict[str, Any]:
    """Get summary of all sensor devices and their status"""
    devices = SensorDevice.query.all()
    total_devices = len(devices)
    online_devices = len([d for d in devices if d.is_online()])
    
    # Get latest readings
    latest_readings = {}
    for device in devices:
        temp = device.get_current_temperature()
        humidity = device.get_current_humidity()
        if temp is not None or humidity is not None:
            latest_readings[device.device_id] = {
                'temperature': temp,
                'humidity': humidity,
                'location': device.location
            }
    
    # Get active alerts
    active_alerts = SensorAlert.get_active_alerts()
    
    return {
        'total_devices': total_devices,
        'online_devices': online_devices,
        'offline_devices': total_devices - online_devices,
        'latest_readings': latest_readings,
        'active_alerts': len(active_alerts),
        'critical_alerts': len([a for a in active_alerts if a.severity == 'critical'])
    }

def check_sensor_thresholds():
    """Check all sensors against configured thresholds and create alerts"""
    devices = SensorDevice.get_all_active()
    
    for device in devices:
        # Get device configuration
        config = json.loads(device.configuration) if device.configuration else {}
        thresholds = config.get('thresholds', {})
        
        # Check temperature thresholds
        temp_high = thresholds.get('temperature_high')
        temp_low = thresholds.get('temperature_low')
        current_temp = device.get_current_temperature()
        
        if current_temp is not None:
            if temp_high and current_temp > temp_high:
                alert = SensorAlert.create_temperature_alert(device.device_id, current_temp, temp_high, True)
                db.session.add(alert)
            elif temp_low and current_temp < temp_low:
                alert = SensorAlert.create_temperature_alert(device.device_id, current_temp, temp_low, False)
                db.session.add(alert)
        
        # Check humidity thresholds
        humidity_high = thresholds.get('humidity_high')
        humidity_low = thresholds.get('humidity_low')
        current_humidity = device.get_current_humidity()
        
        if current_humidity is not None:
            if humidity_high and current_humidity > humidity_high:
                alert = SensorAlert.create_humidity_alert(device.device_id, current_humidity, humidity_high, True)
                db.session.add(alert)
            elif humidity_low and current_humidity < humidity_low:
                alert = SensorAlert.create_humidity_alert(device.device_id, current_humidity, humidity_low, False)
                db.session.add(alert)
    
    # Check for offline devices
    all_devices = SensorDevice.query.all()
    for device in all_devices:
        if not device.is_online() and device.status != 'offline':
            device.status = 'offline'
            alert = SensorAlert.create_device_offline_alert(device.device_id)
            db.session.add(alert)
    
    db.session.commit()

