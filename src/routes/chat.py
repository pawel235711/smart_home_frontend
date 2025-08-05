from flask import Blueprint, request, jsonify, current_app
import openai
import json
import re
from datetime import datetime
from typing import Dict, List, Any, Optional

from models.device import Device, DeviceState

chat_bp = Blueprint('chat', __name__)

# System prompt for the smart home assistant
SYSTEM_PROMPT = """You are a smart home assistant AI. You help users control their smart home devices through natural language commands.

Available device types and their controls:
- Lights: power (on/off), brightness (0-100%)
- Thermostat: power (on/off), target_temperature (10-35°C), mode (heat/cool/auto/off), current_temperature (read-only)
- Jacuzzi: power (on/off), temperature (20-40°C), timer (0-120 minutes)
- Powerwall: power (on/off), charging_mode (auto/charge/discharge/standby), charge_level (read-only)
- Recuperation: power (on/off), fan_speed (1-5), mode (auto/manual/eco/boost)

When users ask you to control devices:
1. Parse their request and identify which devices and properties to control
2. Respond with a JSON object containing "response" (your natural language response) and "actions" (array of device control actions)
3. Each action should have: device_id, device_type, property, value, and room (if specified)

Example response format:
{
  "response": "I've turned on the living room lights and set them to 75% brightness.",
  "actions": [
    {
      "device_id": "light_living_room_1",
      "device_type": "light",
      "property": "power",
      "value": true,
      "room": "living_room"
    },
    {
      "device_id": "light_living_room_1", 
      "device_type": "light",
      "property": "brightness",
      "value": 75,
      "room": "living_room"
    }
  ]
}

If you can't identify specific devices, ask for clarification. Always be helpful and conversational.
For status requests, provide current device information in a friendly way.
"""

@chat_bp.route('/chat', methods=['POST'])
def chat():
    """Process chat message and return AI response with device actions"""
    try:
        # Configure OpenAI within the request context
        openai.api_key = current_app.config.get('OPENAI_API_KEY')
        openai.api_base = current_app.config.get('OPENAI_API_BASE', 'https://api.openai.com/v1')
        
        data = request.get_json()
        if not data or 'message' not in data:
            return jsonify({'error': 'Message is required'}), 400
        
        user_message = data['message']
        context = data.get('context', {})
        
        # Get current device states for context
        devices_context = get_devices_context()
        
        # Create the conversation with context
        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "system", "content": f"Current device states: {json.dumps(devices_context, indent=2)}"},
            {"role": "user", "content": user_message}
        ]
        
        # Add conversation history if provided
        if 'history' in context:
            # Insert history before the current message
            messages = messages[:-1] + context['history'] + [messages[-1]]
        
        # Call OpenAI API
        response = openai.ChatCompletion.create(
            model="gpt-3.5-turbo",
            messages=messages,
            max_tokens=500,
            temperature=0.7,
            function_call="auto",
            functions=[
                {
                    "name": "control_devices",
                    "description": "Control smart home devices based on user commands",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "actions": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "device_id": {"type": "string"},
                                        "device_type": {"type": "string"},
                                        "property": {"type": "string"},
                                        "value": {"type": ["string", "number", "boolean"]},
                                        "room": {"type": "string"}
                                    },
                                    "required": ["device_type", "property", "value"]
                                }
                            },
                            "response": {"type": "string"}
                        },
                        "required": ["response"]
                    }
                }
            ]
        )
        
        # Process the response
        ai_response = response.choices[0].message
        
        if ai_response.get('function_call'):
            # AI wants to control devices
            function_args = json.loads(ai_response['function_call']['arguments'])
            response_text = function_args.get('response', 'I\'ll help you with that.')
            actions = function_args.get('actions', [])
            
            # Execute device actions
            execution_results = []
            for action in actions:
                try:
                    result = execute_device_action(action)
                    execution_results.append(result)
                except Exception as e:
                    execution_results.append({
                        'success': False,
                        'error': str(e),
                        'action': action
                    })
            
            return jsonify({
                'response': response_text,
                'actions': actions,
                'execution_results': execution_results,
                'timestamp': datetime.utcnow().isoformat()
            })
        else:
            # Regular conversational response
            return jsonify({
                'response': ai_response['content'],
                'actions': [],
                'timestamp': datetime.utcnow().isoformat()
            })
            
    except Exception as e:
        current_app.logger.error(f"Chat error: {str(e)}")
        return jsonify({
            'error': 'Failed to process chat message',
            'details': str(e)
        }), 500

@chat_bp.route('/chat/status', methods=['GET'])
def get_system_status():
    """Get current system status for chat context"""
    try:
        devices_context = get_devices_context()
        
        # Calculate summary statistics
        total_devices = len(devices_context)
        active_devices = sum(1 for d in devices_context if d.get('current_state', {}).get('power', False))
        
        # Calculate energy usage
        energy_usage = 0
        for device in devices_context:
            if device.get('current_state', {}).get('power', False):
                device_type = device.get('device_type', '')
                energy_map = {
                    'light': 0.1,
                    'jacuzzi': 2.5,
                    'thermostat': 1.2,
                    'recuperation': 0.8,
                    'powerwall': 0.0  # Powerwall stores energy
                }
                energy_usage += energy_map.get(device_type, 0.5)
        
        # Get average temperature
        thermostats = [d for d in devices_context if d.get('device_type') == 'thermostat']
        avg_temp = 22.0
        if thermostats:
            temps = [t.get('current_state', {}).get('current_temperature', 22) for t in thermostats]
            avg_temp = sum(temps) / len(temps)
        
        return jsonify({
            'total_devices': total_devices,
            'active_devices': active_devices,
            'energy_usage': round(energy_usage, 1),
            'average_temperature': round(avg_temp, 1),
            'devices': devices_context,
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Status error: {str(e)}")
        return jsonify({'error': 'Failed to get system status'}), 500

@chat_bp.route('/chat/voice', methods=['POST'])
def process_voice():
    """Process voice input (placeholder for future speech-to-text integration)"""
    try:
        # This would integrate with speech-to-text services
        # For now, return a placeholder response
        return jsonify({
            'message': 'Voice processing not yet implemented',
            'transcript': '',
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Voice processing error: {str(e)}")
        return jsonify({'error': 'Failed to process voice input'}), 500

def get_devices_context() -> List[Dict[str, Any]]:
    """Get current device states for AI context"""
    try:
        # Get all devices from the database/storage
        devices = Device.get_all()
        
        context = []
        for device in devices:
            device_info = {
                'id': device.id,
                'name': device.name,
                'device_type': device.device_type,
                'room': device.room,
                'enabled': device.enabled,
                'current_state': device.current_state or {}
            }
            context.append(device_info)
        
        return context
        
    except Exception as e:
        current_app.logger.error(f"Failed to get devices context: {str(e)}")
        return []

def execute_device_action(action: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a device control action"""
    try:
        device_type = action.get('device_type')
        property_name = action.get('property')
        value = action.get('value')
        device_id = action.get('device_id')
        room = action.get('room')
        
        # Find the device
        if device_id:
            device = Device.get_by_id(device_id)
        else:
            # Find device by type and room
            devices = Device.get_by_type_and_room(device_type, room)
            device = devices[0] if devices else None
        
        if not device:
            return {
                'success': False,
                'error': f'Device not found: {device_id or f"{device_type} in {room}"}',
                'action': action
            }
        
        # Validate the property and value
        validation_result = validate_device_property(device_type, property_name, value)
        if not validation_result['valid']:
            return {
                'success': False,
                'error': validation_result['error'],
                'action': action
            }
        
        # Update device state
        if not device.current_state:
            device.current_state = {}
        
        device.current_state[property_name] = value
        device.save()
        
        return {
            'success': True,
            'device_id': device.id,
            'device_name': device.name,
            'property': property_name,
            'value': value,
            'action': action
        }
        
    except Exception as e:
        current_app.logger.error(f"Failed to execute device action: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'action': action
        }

def validate_device_property(device_type: str, property_name: str, value: Any) -> Dict[str, Any]:
    """Validate device property and value"""
    
    # Define valid properties and ranges for each device type
    device_properties = {
        'light': {
            'power': {'type': bool},
            'brightness': {'type': (int, float), 'min': 0, 'max': 100}
        },
        'thermostat': {
            'power': {'type': bool},
            'target_temperature': {'type': (int, float), 'min': 10, 'max': 35},
            'mode': {'type': str, 'values': ['heat', 'cool', 'auto', 'off']}
        },
        'jacuzzi': {
            'power': {'type': bool},
            'temperature': {'type': (int, float), 'min': 20, 'max': 40},
            'timer': {'type': (int, float), 'min': 0, 'max': 120}
        },
        'powerwall': {
            'power': {'type': bool},
            'charging_mode': {'type': str, 'values': ['auto', 'charge', 'discharge', 'standby']}
        },
        'recuperation': {
            'power': {'type': bool},
            'fan_speed': {'type': int, 'min': 1, 'max': 5},
            'mode': {'type': str, 'values': ['auto', 'manual', 'eco', 'boost']}
        }
    }
    
    if device_type not in device_properties:
        return {'valid': False, 'error': f'Unknown device type: {device_type}'}
    
    if property_name not in device_properties[device_type]:
        return {'valid': False, 'error': f'Unknown property {property_name} for {device_type}'}
    
    prop_config = device_properties[device_type][property_name]
    
    # Check type
    expected_type = prop_config['type']
    if isinstance(expected_type, tuple):
        if not isinstance(value, expected_type):
            return {'valid': False, 'error': f'Invalid type for {property_name}, expected {expected_type}'}
    else:
        if not isinstance(value, expected_type):
            return {'valid': False, 'error': f'Invalid type for {property_name}, expected {expected_type}'}
    
    # Check range
    if 'min' in prop_config and value < prop_config['min']:
        return {'valid': False, 'error': f'{property_name} must be >= {prop_config["min"]}'}
    
    if 'max' in prop_config and value > prop_config['max']:
        return {'valid': False, 'error': f'{property_name} must be <= {prop_config["max"]}'}
    
    # Check allowed values
    if 'values' in prop_config and value not in prop_config['values']:
        return {'valid': False, 'error': f'{property_name} must be one of: {prop_config["values"]}'}
    
    return {'valid': True}

@chat_bp.route('/chat/history', methods=['GET'])
def get_chat_history():
    """Get chat history (placeholder - would be stored in database)"""
    try:
        # This would retrieve chat history from database
        # For now, return empty history
        return jsonify({
            'history': [],
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Failed to get chat history: {str(e)}")
        return jsonify({'error': 'Failed to get chat history'}), 500

@chat_bp.route('/chat/clear', methods=['POST'])
def clear_chat_history():
    """Clear chat history"""
    try:
        # This would clear chat history from database
        return jsonify({
            'message': 'Chat history cleared',
            'timestamp': datetime.utcnow().isoformat()
        })
        
    except Exception as e:
        current_app.logger.error(f"Failed to clear chat history: {str(e)}")
        return jsonify({'error': 'Failed to clear chat history'}), 500

