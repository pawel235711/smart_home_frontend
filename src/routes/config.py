from flask import Blueprint, request, jsonify, current_app
from src.models.device import db, Device, DeviceState, Room
import json
import uuid
from datetime import datetime

config_bp = Blueprint('config', __name__)

@config_bp.route('/config/devices', methods=['GET'])
def get_device_configurations():
    """Get all device configurations"""
    try:
        devices = Device.query.all()
        return jsonify({
            'devices': [device.to_dict() for device in devices]
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/devices', methods=['POST'])
def add_device_configuration():
    """Add a new device configuration"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['name', 'device_type', 'category', 'room']
        for field in required_fields:
            if field not in data:
                return jsonify({'error': f'Missing required field: {field}'}), 400
        
        # Generate unique ID if not provided
        device_id = data.get('id', f"{data['device_type']}_{str(uuid.uuid4())[:8]}")
        
        # Check if device ID already exists
        if Device.query.get(device_id):
            return jsonify({'error': 'Device ID already exists'}), 400
        
        # Create device
        device = Device(
            id=device_id,
            name=data['name'],
            device_type=data['device_type'],
            category=data['category'],
            room=data['room'],
            icon=data.get('icon', 'device_unknown'),
            enabled=data.get('enabled', True)
        )
        
        # Set configuration
        config = data.get('configuration', {})
        device.set_config(config)
        
        db.session.add(device)
        db.session.commit()
        
        # Initialize default states if provided
        if 'initial_state' in data:
            for property_name, value in data['initial_state'].items():
                state = DeviceState(
                    device_id=device_id,
                    property_name=property_name
                )
                state.set_value(value)
                db.session.add(state)
            
            db.session.commit()
        
        return jsonify(device.to_dict()), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/devices/<device_id>', methods=['PUT'])
def update_device_configuration(device_id):
    """Update device configuration"""
    try:
        device = Device.query.get_or_404(device_id)
        data = request.get_json()
        
        # Update basic fields
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
        
        # Update configuration
        if 'configuration' in data:
            device.set_config(data['configuration'])
        
        device.updated_at = datetime.utcnow()
        db.session.commit()
        
        return jsonify(device.to_dict()), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/devices/<device_id>', methods=['DELETE'])
def remove_device_configuration(device_id):
    """Remove device configuration"""
    try:
        device = Device.query.get_or_404(device_id)
        
        # Delete all associated states
        DeviceState.query.filter_by(device_id=device_id).delete()
        
        # Delete device
        db.session.delete(device)
        db.session.commit()
        
        return jsonify({'message': f'Device {device_id} removed successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/export', methods=['GET'])
def export_configuration():
    """Export complete system configuration"""
    try:
        # Get all devices
        devices = Device.query.all()
        
        # Get all rooms
        rooms = Room.query.all()
        
        # Get latest states for all devices
        device_states = {}
        for device in devices:
            states = {}
            for state in DeviceState.query.filter_by(device_id=device.id).order_by(DeviceState.timestamp.desc()).all():
                if state.property_name not in states:
                    states[state.property_name] = state.get_value()
            device_states[device.id] = states
        
        config = {
            'version': '1.0',
            'exported_at': datetime.utcnow().isoformat(),
            'devices': [device.to_dict() for device in devices],
            'rooms': [room.to_dict() for room in rooms],
            'device_states': device_states
        }
        
        return jsonify(config), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/import', methods=['POST'])
def import_configuration():
    """Import system configuration"""
    try:
        data = request.get_json()
        
        if 'devices' not in data:
            return jsonify({'error': 'Invalid configuration format'}), 400
        
        imported_devices = 0
        imported_rooms = 0
        errors = []
        
        # Import rooms first
        if 'rooms' in data:
            for room_data in data['rooms']:
                try:
                    # Check if room already exists
                    existing_room = Room.query.get(room_data['id'])
                    if existing_room:
                        continue
                    
                    room = Room(
                        id=room_data['id'],
                        name=room_data['name'],
                        description=room_data.get('description', ''),
                        icon=room_data.get('icon', 'home')
                    )
                    db.session.add(room)
                    imported_rooms += 1
                except Exception as e:
                    errors.append(f"Room {room_data.get('id', 'unknown')}: {str(e)}")
        
        # Import devices
        for device_data in data['devices']:
            try:
                # Check if device already exists
                existing_device = Device.query.get(device_data['id'])
                if existing_device:
                    continue
                
                device = Device(
                    id=device_data['id'],
                    name=device_data['name'],
                    device_type=device_data['device_type'],
                    category=device_data['category'],
                    room=device_data['room'],
                    icon=device_data['icon'],
                    enabled=device_data.get('enabled', True)
                )
                
                if 'configuration' in device_data:
                    device.set_config(device_data['configuration'])
                
                db.session.add(device)
                imported_devices += 1
                
                # Import device states if available
                if 'device_states' in data and device_data['id'] in data['device_states']:
                    states = data['device_states'][device_data['id']]
                    for property_name, value in states.items():
                        state = DeviceState(
                            device_id=device_data['id'],
                            property_name=property_name
                        )
                        state.set_value(value)
                        db.session.add(state)
                
            except Exception as e:
                errors.append(f"Device {device_data.get('id', 'unknown')}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            'message': 'Configuration imported successfully',
            'imported_devices': imported_devices,
            'imported_rooms': imported_rooms,
            'errors': errors
        }), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/reset', methods=['POST'])
def reset_configuration():
    """Reset to default configuration"""
    try:
        # Clear all existing data
        DeviceState.query.delete()
        Device.query.delete()
        Room.query.delete()
        
        # Create default rooms
        default_rooms = [
            {'id': 'living_room', 'name': 'Living Room', 'icon': 'living'},
            {'id': 'bedroom', 'name': 'Bedroom', 'icon': 'bed'},
            {'id': 'bathroom', 'name': 'Bathroom', 'icon': 'bathroom'},
            {'id': 'kitchen', 'name': 'Kitchen', 'icon': 'kitchen'},
            {'id': 'outdoor', 'name': 'Outdoor', 'icon': 'outdoor'}
        ]
        
        for room_data in default_rooms:
            room = Room(**room_data)
            db.session.add(room)
        
        # Create default devices
        default_devices = [
            {
                'id': 'living_room_light',
                'name': 'Living Room Light',
                'device_type': 'light',
                'category': 'lighting',
                'room': 'living_room',
                'icon': 'lightbulb',
                'configuration': {
                    'capabilities': {'power': True, 'brightness': True},
                    'controls': [
                        {'type': 'toggle', 'property': 'power', 'label': 'Power'},
                        {'type': 'slider', 'property': 'brightness', 'label': 'Brightness', 'min': 0, 'max': 100, 'unit': '%'}
                    ]
                },
                'initial_state': {'power': False, 'brightness': 50}
            },
            {
                'id': 'outdoor_jacuzzi',
                'name': 'Outdoor Jacuzzi',
                'device_type': 'jacuzzi',
                'category': 'climate',
                'room': 'outdoor',
                'icon': 'hot_tub',
                'configuration': {
                    'capabilities': {'power': True, 'temperature': True, 'timer': True},
                    'controls': [
                        {'type': 'toggle', 'property': 'power', 'label': 'Power'},
                        {'type': 'slider', 'property': 'temperature', 'label': 'Temperature', 'min': 20, 'max': 40, 'unit': '°C'},
                        {'type': 'slider', 'property': 'timer', 'label': 'Timer', 'min': 0, 'max': 120, 'unit': 'min'}
                    ]
                },
                'initial_state': {'power': False, 'temperature': 37, 'timer': 0}
            },
            {
                'id': 'house_powerwall',
                'name': 'House Powerwall',
                'device_type': 'powerwall',
                'category': 'energy',
                'room': 'outdoor',
                'icon': 'battery_charging_full',
                'configuration': {
                    'capabilities': {'power': True, 'charge_level': True, 'charging_mode': True},
                    'controls': [
                        {'type': 'toggle', 'property': 'power', 'label': 'Power'},
                        {'type': 'dropdown', 'property': 'charging_mode', 'label': 'Mode', 'options': ['auto', 'charge', 'discharge', 'standby']}
                    ]
                },
                'initial_state': {'power': True, 'charge_level': 85, 'charging_mode': 'auto'}
            },
            {
                'id': 'house_recuperation',
                'name': 'House Recuperation',
                'device_type': 'recuperation',
                'category': 'ventilation',
                'room': 'living_room',
                'icon': 'air',
                'configuration': {
                    'capabilities': {'power': True, 'fan_speed': True, 'mode': True},
                    'controls': [
                        {'type': 'toggle', 'property': 'power', 'label': 'Power'},
                        {'type': 'slider', 'property': 'fan_speed', 'label': 'Fan Speed', 'min': 1, 'max': 5},
                        {'type': 'dropdown', 'property': 'mode', 'label': 'Mode', 'options': ['auto', 'manual', 'eco', 'boost']}
                    ]
                },
                'initial_state': {'power': True, 'fan_speed': 2, 'mode': 'auto'}
            },
            {
                'id': 'living_room_thermostat',
                'name': 'Living Room Thermostat',
                'device_type': 'thermostat',
                'category': 'climate',
                'room': 'living_room',
                'icon': 'thermostat',
                'configuration': {
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
                        {'type': 'toggle', 'property': 'power', 'label': 'Power'},
                        {'type': 'temperature', 'property': 'target_temperature', 'label': 'Target Temperature', 'min': 10, 'max': 35, 'step': 0.5, 'unit': '°C'},
                        {'type': 'dropdown', 'property': 'mode', 'label': 'Mode', 'options': ['heat', 'cool', 'auto', 'off', 'fan_only']},
                        {'type': 'dropdown', 'property': 'fan_mode', 'label': 'Fan Mode', 'options': ['auto', 'on', 'circulate', 'eco']},
                        {'type': 'toggle', 'property': 'eco_mode', 'label': 'Eco Mode'},
                        {'type': 'schedule', 'property': 'schedule', 'label': 'Schedule', 'presets': ['home', 'away', 'sleep', 'custom']}
                    ],
                    'advanced_features': {
                        'learning': True,
                        'geofencing': True,
                        'weather_integration': True,
                        'energy_reports': True,
                        'multi_zone': False,
                        'voice_control': True
                    }
                },
                'initial_state': {
                    'power': True, 
                    'target_temperature': 22.0, 
                    'current_temperature': 21.5, 
                    'mode': 'auto', 
                    'fan_mode': 'auto', 
                    'eco_mode': False,
                    'humidity': 45,
                    'schedule': 'home'
                }
            }
        ]
        
        for device_data in default_devices:
            device = Device(
                id=device_data['id'],
                name=device_data['name'],
                device_type=device_data['device_type'],
                category=device_data['category'],
                room=device_data['room'],
                icon=device_data['icon']
            )
            device.set_config(device_data['configuration'])
            db.session.add(device)
            
            # Add initial states
            for property_name, value in device_data['initial_state'].items():
                state = DeviceState(
                    device_id=device_data['id'],
                    property_name=property_name
                )
                state.set_value(value)
                db.session.add(state)
        
        db.session.commit()
        
        return jsonify({'message': 'Configuration reset to defaults successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/discover', methods=['POST'])
def discover_devices():
    """Simulate device discovery (placeholder for real implementation)"""
    try:
        # This is a placeholder for actual device discovery
        # In a real implementation, this would scan the network for compatible devices
        
        discovered_devices = [
            {
                'id': f'discovered_{uuid.uuid4().hex[:8]}',
                'name': 'Discovered Smart Light',
                'device_type': 'light',
                'category': 'lighting',
                'room': 'living_room',
                'icon': 'lightbulb',
                'ip_address': '192.168.1.100',
                'mac_address': '00:11:22:33:44:55',
                'manufacturer': 'Generic Smart Home',
                'model': 'SL-001'
            }
        ]
        
        return jsonify({
            'discovered_devices': discovered_devices,
            'message': f'Found {len(discovered_devices)} devices'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@config_bp.route('/config/validate', methods=['POST'])
def validate_configuration():
    """Validate device configuration"""
    try:
        data = request.get_json()
        
        errors = []
        warnings = []
        
        # Validate required fields
        required_fields = ['name', 'device_type', 'category', 'room']
        for field in required_fields:
            if field not in data:
                errors.append(f'Missing required field: {field}')
        
        # Validate device type
        valid_types = ['light', 'jacuzzi', 'powerwall', 'recuperation', 'custom']
        if data.get('device_type') not in valid_types:
            errors.append(f'Invalid device type. Must be one of: {", ".join(valid_types)}')
        
        # Validate category
        valid_categories = ['lighting', 'climate', 'energy', 'ventilation']
        if data.get('category') not in valid_categories:
            errors.append(f'Invalid category. Must be one of: {", ".join(valid_categories)}')
        
        # Check if room exists
        if 'room' in data:
            room = Room.query.get(data['room'])
            if not room:
                warnings.append(f'Room "{data["room"]}" does not exist. It will be created automatically.')
        
        # Validate configuration structure
        if 'configuration' in data:
            config = data['configuration']
            if not isinstance(config, dict):
                errors.append('Configuration must be a JSON object')
            else:
                # Validate controls
                if 'controls' in config:
                    if not isinstance(config['controls'], list):
                        errors.append('Controls must be an array')
                    else:
                        for i, control in enumerate(config['controls']):
                            if 'type' not in control:
                                errors.append(f'Control {i}: Missing type field')
                            if 'property' not in control:
                                errors.append(f'Control {i}: Missing property field')
        
        return jsonify({
            'valid': len(errors) == 0,
            'errors': errors,
            'warnings': warnings
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

