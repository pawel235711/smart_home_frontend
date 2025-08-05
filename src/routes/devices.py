from flask import Blueprint, request, jsonify
from src.models.device import db, Device, DeviceState, Room
from datetime import datetime
import json
import uuid

devices_bp = Blueprint('devices', __name__)

# Device CRUD operations
@devices_bp.route('/devices', methods=['GET'])
def get_devices():
    """Get all devices with their current states"""
    try:
        devices = Device.query.filter_by(enabled=True).all()
        result = []
        
        for device in devices:
            device_data = device.to_dict()
            
            # Get latest states for this device
            latest_states = {}
            for state in DeviceState.query.filter_by(device_id=device.id).order_by(DeviceState.timestamp.desc()).all():
                if state.property_name not in latest_states:
                    latest_states[state.property_name] = state.get_value()
            
            device_data['current_state'] = latest_states
            result.append(device_data)
        
        return jsonify({'devices': result}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices/<device_id>', methods=['GET'])
def get_device(device_id):
    """Get specific device with current state"""
    try:
        device = Device.query.get_or_404(device_id)
        device_data = device.to_dict()
        
        # Get latest states
        latest_states = {}
        for state in DeviceState.query.filter_by(device_id=device_id).order_by(DeviceState.timestamp.desc()).all():
            if state.property_name not in latest_states:
                latest_states[state.property_name] = state.get_value()
        
        device_data['current_state'] = latest_states
        return jsonify(device_data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices', methods=['POST'])
def create_device():
    """Create a new device"""
    try:
        data = request.get_json()
        
        # Generate ID if not provided
        device_id = data.get('id', str(uuid.uuid4()))
        
        # Validate required fields
        required_fields = ['name', 'device_type', 'category', 'room', 'icon']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Create device
        device = Device(
            id=device_id,
            name=data['name'],
            device_type=data['device_type'],
            category=data['category'],
            room=data['room'],
            icon=data['icon'],
            enabled=data.get('enabled', True)
        )
        
        # Set configuration
        if 'configuration' in data:
            device.set_config(data['configuration'])
        
        db.session.add(device)
        db.session.commit()
        
        return jsonify(device.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices/<device_id>', methods=['PUT'])
def update_device(device_id):
    """Update device configuration"""
    try:
        device = Device.query.get_or_404(device_id)
        data = request.get_json()
        
        # Update fields
        if 'name' in data:
            device.name = data['name']
        if 'device_type' in data:
            device.device_type = data['device_type']
        if 'category' in data:
            device.category = data['category']
        if 'room' in data:
            device.room = data['room']
        if 'icon' in data:
            device.icon = data['icon']
        if 'enabled' in data:
            device.enabled = data['enabled']
        if 'configuration' in data:
            device.set_config(data['configuration'])
        
        device.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(device.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices/<device_id>', methods=['DELETE'])
def delete_device(device_id):
    """Delete a device"""
    try:
        device = Device.query.get_or_404(device_id)
        
        # Delete associated states
        DeviceState.query.filter_by(device_id=device_id).delete()
        
        # Delete device
        db.session.delete(device)
        db.session.commit()
        
        return jsonify({'message': 'Device deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Device control operations
@devices_bp.route('/devices/<device_id>/control', methods=['POST'])
def control_device(device_id):
    """Control a device (set property values)"""
    try:
        device = Device.query.get_or_404(device_id)
        if not device.enabled:
            return jsonify({'error': 'Device is disabled'}), 400
        
        data = request.get_json()
        
        # Update device states
        for property_name, value in data.items():
            # Find existing state or create new one
            state = DeviceState.query.filter_by(
                device_id=device_id, 
                property_name=property_name
            ).order_by(DeviceState.timestamp.desc()).first()
            
            # Create new state record
            new_state = DeviceState(
                device_id=device_id,
                property_name=property_name
            )
            new_state.set_value(value)
            
            db.session.add(new_state)
        
        db.session.commit()
        
        # Return updated device state
        return get_device(device_id)
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices/<device_id>/status', methods=['GET'])
def get_device_status(device_id):
    """Get current status of a device"""
    try:
        device = Device.query.get_or_404(device_id)
        
        # Get latest state for each property
        latest_states = {}
        states = DeviceState.query.filter_by(device_id=device_id).order_by(DeviceState.timestamp.desc()).all()
        
        for state in states:
            if state.property_name not in latest_states:
                latest_states[state.property_name] = {
                    'value': state.get_value(),
                    'timestamp': state.timestamp.isoformat()
                }
        
        return jsonify({
            'device_id': device_id,
            'name': device.name,
            'enabled': device.enabled,
            'status': latest_states
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/devices/<device_id>/history', methods=['GET'])
def get_device_history(device_id):
    """Get historical data for a device"""
    try:
        device = Device.query.get_or_404(device_id)
        
        # Get query parameters
        property_name = request.args.get('property')
        limit = int(request.args.get('limit', 100))
        
        query = DeviceState.query.filter_by(device_id=device_id)
        
        if property_name:
            query = query.filter_by(property_name=property_name)
        
        states = query.order_by(DeviceState.timestamp.desc()).limit(limit).all()
        
        return jsonify({
            'device_id': device_id,
            'history': [state.to_dict() for state in states]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Room management
@devices_bp.route('/rooms', methods=['GET'])
def get_rooms():
    """Get all rooms"""
    try:
        rooms = Room.query.all()
        return jsonify({'rooms': [room.to_dict() for room in rooms]}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@devices_bp.route('/rooms', methods=['POST'])
def create_room():
    """Create a new room"""
    try:
        data = request.get_json()
        
        room_id = data.get('id', str(uuid.uuid4()))
        
        room = Room(
            id=room_id,
            name=data['name'],
            description=data.get('description', ''),
            icon=data.get('icon', 'home')
        )
        
        db.session.add(room)
        db.session.commit()
        
        return jsonify(room.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

# Device templates and discovery
@devices_bp.route('/device-templates', methods=['GET'])
def get_device_templates():
    """Get available device templates"""
    templates = {
        'light': {
            'name': 'Smart Light',
            'icon': 'lightbulb',
            'category': 'lighting',
            'capabilities': {
                'power': True,
                'brightness': True,
                'color': False,
                'temperature': False
            },
            'controls': [
                {
                    'type': 'toggle',
                    'property': 'power',
                    'label': 'Power'
                },
                {
                    'type': 'slider',
                    'property': 'brightness',
                    'label': 'Brightness',
                    'min': 0,
                    'max': 100,
                    'step': 1,
                    'unit': '%'
                }
            ]
        },
        'jacuzzi': {
            'name': 'Jacuzzi/Spa',
            'icon': 'hot_tub',
            'category': 'climate',
            'capabilities': {
                'power': True,
                'temperature': True,
                'timer': True,
                'jets': True
            },
            'controls': [
                {
                    'type': 'toggle',
                    'property': 'power',
                    'label': 'Power'
                },
                {
                    'type': 'slider',
                    'property': 'temperature',
                    'label': 'Temperature',
                    'min': 20,
                    'max': 40,
                    'step': 0.5,
                    'unit': '°C'
                },
                {
                    'type': 'slider',
                    'property': 'timer',
                    'label': 'Timer',
                    'min': 0,
                    'max': 120,
                    'step': 5,
                    'unit': 'min'
                }
            ]
        },
        'powerwall': {
            'name': 'Powerwall Battery',
            'icon': 'battery_charging_full',
            'category': 'energy',
            'capabilities': {
                'power': True,
                'charge_level': True,
                'charging_mode': True
            },
            'controls': [
                {
                    'type': 'toggle',
                    'property': 'power',
                    'label': 'Power'
                },
                {
                    'type': 'dropdown',
                    'property': 'charging_mode',
                    'label': 'Charging Mode',
                    'options': ['auto', 'charge', 'discharge', 'standby']
                }
            ]
        },
        'recuperation': {
            'name': 'Recuperation System',
            'icon': 'air',
            'category': 'ventilation',
            'capabilities': {
                'power': True,
                'fan_speed': True,
                'mode': True,
                'air_quality': True
            },
            'controls': [
                {
                    'type': 'toggle',
                    'property': 'power',
                    'label': 'Power'
                },
                {
                    'type': 'slider',
                    'property': 'fan_speed',
                    'label': 'Fan Speed',
                    'min': 1,
                    'max': 5,
                    'step': 1
                },
                {
                    'type': 'dropdown',
                    'property': 'mode',
                    'label': 'Mode',
                    'options': ['auto', 'manual', 'eco', 'boost']
                }
            ]
        },
        'thermostat': {
            'name': 'Smart Thermostat',
            'icon': 'thermostat',
            'category': 'climate',
            'capabilities': {
                'power': True,
                'target_temperature': True,
                'current_temperature': True,
                'mode': True,
                'fan_mode': True,
                'schedule': True,
                'humidity': True,
                'eco_mode': True
            },
            'controls': [
                {
                    'type': 'toggle',
                    'property': 'power',
                    'label': 'Power'
                },
                {
                    'type': 'temperature',
                    'property': 'target_temperature',
                    'label': 'Target Temperature',
                    'min': 10,
                    'max': 35,
                    'step': 0.5,
                    'unit': '°C'
                },
                {
                    'type': 'dropdown',
                    'property': 'mode',
                    'label': 'Mode',
                    'options': ['heat', 'cool', 'auto', 'off', 'fan_only']
                },
                {
                    'type': 'dropdown',
                    'property': 'fan_mode',
                    'label': 'Fan Mode',
                    'options': ['auto', 'on', 'circulate', 'eco']
                },
                {
                    'type': 'toggle',
                    'property': 'eco_mode',
                    'label': 'Eco Mode'
                },
                {
                    'type': 'schedule',
                    'property': 'schedule',
                    'label': 'Schedule',
                    'presets': ['home', 'away', 'sleep', 'custom']
                }
            ],
            'advanced_features': {
                'learning': True,
                'geofencing': True,
                'weather_integration': True,
                'energy_reports': True,
                'multi_zone': True,
                'voice_control': True
            }
        }
    }
    
    return jsonify({'templates': templates}), 200

# Bulk operations
@devices_bp.route('/devices/bulk-control', methods=['POST'])
def bulk_control_devices():
    """Control multiple devices at once"""
    try:
        data = request.get_json()
        device_ids = data.get('device_ids', [])
        commands = data.get('commands', {})
        
        results = []
        
        for device_id in device_ids:
            try:
                device = Device.query.get(device_id)
                if not device or not device.enabled:
                    results.append({
                        'device_id': device_id,
                        'success': False,
                        'error': 'Device not found or disabled'
                    })
                    continue
                
                # Apply commands to this device
                for property_name, value in commands.items():
                    new_state = DeviceState(
                        device_id=device_id,
                        property_name=property_name
                    )
                    new_state.set_value(value)
                    db.session.add(new_state)
                
                results.append({
                    'device_id': device_id,
                    'success': True
                })
                
            except Exception as e:
                results.append({
                    'device_id': device_id,
                    'success': False,
                    'error': str(e)
                })
        
        db.session.commit()
        
        return jsonify({'results': results}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

