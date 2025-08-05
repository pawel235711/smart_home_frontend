from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

db = SQLAlchemy()

class Device(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    device_type = db.Column(db.String(50), nullable=False)  # light, jacuzzi, powerwall, recuperation, custom
    category = db.Column(db.String(50), nullable=False)  # lighting, climate, energy, ventilation
    room = db.Column(db.String(50), nullable=False)
    icon = db.Column(db.String(50), nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    configuration = db.Column(db.Text, nullable=False)  # JSON string of device config
    current_state = db.Column(db.Text)  # JSON string of current device state
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Device {self.name} ({self.device_type})>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'device_type': self.device_type,
            'category': self.category,
            'room': self.room,
            'icon': self.icon,
            'enabled': self.enabled,
            'configuration': json.loads(self.configuration) if self.configuration else {},
            'current_state': json.loads(self.current_state) if self.current_state else {},
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

    def get_config(self):
        """Get parsed configuration as dictionary"""
        return json.loads(self.configuration) if self.configuration else {}

    def set_config(self, config_dict):
        """Set configuration from dictionary"""
        self.configuration = json.dumps(config_dict)

    def get_current_state(self):
        """Get parsed current state as dictionary"""
        return json.loads(self.current_state) if self.current_state else {}

    def set_current_state(self, state_dict):
        """Set current state from dictionary"""
        self.current_state = json.dumps(state_dict)
        self.updated_at = datetime.utcnow()

    def update_property(self, property_name, value):
        """Update a single property in current state"""
        state = self.get_current_state()
        state[property_name] = value
        self.set_current_state(state)

    @classmethod
    def get_all(cls):
        """Get all devices"""
        return cls.query.all()

    @classmethod
    def get_by_id(cls, device_id):
        """Get device by ID"""
        return cls.query.get(device_id)

    @classmethod
    def get_by_type(cls, device_type):
        """Get devices by type"""
        return cls.query.filter_by(device_type=device_type).all()

    @classmethod
    def get_by_room(cls, room):
        """Get devices by room"""
        return cls.query.filter_by(room=room).all()

    @classmethod
    def get_by_type_and_room(cls, device_type, room):
        """Get devices by type and room"""
        return cls.query.filter_by(device_type=device_type, room=room).all()

    def save(self):
        """Save device to database"""
        db.session.add(self)
        db.session.commit()

class DeviceState(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    device_id = db.Column(db.String(50), db.ForeignKey('device.id'), nullable=False)
    property_name = db.Column(db.String(50), nullable=False)  # power, brightness, temperature, etc.
    value = db.Column(db.Text, nullable=False)  # JSON string of the value
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    device = db.relationship('Device', backref=db.backref('states', lazy=True))

    def __repr__(self):
        return f'<DeviceState {self.device_id}.{self.property_name}={self.value}>'

    def to_dict(self):
        return {
            'id': self.id,
            'device_id': self.device_id,
            'property_name': self.property_name,
            'value': json.loads(self.value) if self.value else None,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }

    def get_value(self):
        """Get parsed value"""
        try:
            return json.loads(self.value)
        except (json.JSONDecodeError, TypeError):
            return self.value

    def set_value(self, value):
        """Set value (automatically converts to JSON)"""
        if isinstance(value, (dict, list)):
            self.value = json.dumps(value)
        else:
            self.value = json.dumps(value)

class Room(db.Model):
    id = db.Column(db.String(50), primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text)
    icon = db.Column(db.String(50), default='home')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Room {self.name}>'

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon': self.icon,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

