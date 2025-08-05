# 🏠 Smart Home Control System

A modern, responsive smart home control interface with Flask backend that manages lights, jacuzzi, powerwall battery, LLM chat control, recuperation systems, and a beautiful thermostat with dynamic device configuration management.

![Smart Home Control](https://img.shields.io/badge/Smart%20Home-Control%20System-blue)
![Flask](https://img.shields.io/badge/Flask-2.3.0-green)
![OpenAI](https://img.shields.io/badge/OpenAI-GPT--3.5--turbo-orange)
![Responsive](https://img.shields.io/badge/Responsive-Mobile%20%7C%20Tablet%20%7C%20Desktop-purple)

## ✨ Features

### 🎛️ Device Control
- **Smart Lights** - Power control with brightness adjustment (0-100%)
- **Modern Thermostat** - Circular temperature control with heating/cooling modes
- **Jacuzzi Control** - Temperature and timer management (20-40°C, 0-120 min)
- **Powerwall Battery** - Charging modes (auto/charge/discharge/standby) with level monitoring
- **Recuperation System** - Fan speed control (1-5) with multiple modes (auto/manual/eco/boost)

### 🤖 AI Assistant
- **Natural Language Control** - "Turn on living room lights" or "Set temperature to 23 degrees"
- **OpenAI GPT-3.5 Integration** - Intelligent command processing
- **Voice Input Support** - Speech-to-text for hands-free control
- **Contextual Commands** - Time-based quick suggestions (morning/evening routines)
- **Real-time Feedback** - See exactly which devices were controlled

### 📱 Modern Interface
- **Responsive Design** - Optimized for mobile, tablet, and desktop
- **Dark Theme** - Professional dark interface with cyan accents
- **Real-time Updates** - Live device status and energy monitoring
- **Touch-friendly Controls** - Intuitive sliders, buttons, and circular controls
- **Beautiful Thermostat** - Circular temperature display with gradient backgrounds

### ⚙️ Configuration Management
- **Dynamic Device Management** - Add, remove, and configure devices
- **Room Organization** - Organize devices by rooms (Living Room, Bedroom, Kitchen, etc.)
- **Import/Export** - Backup and restore configurations
- **Device Discovery** - Automatic device detection capabilities
- **Template System** - Pre-configured device templates

### 📊 Dashboard & Monitoring
- **Energy Usage Tracking** - Real-time power consumption monitoring
- **Climate Monitoring** - Average temperature across all thermostats
- **Device Status** - Active device count and system health
- **Visual Indicators** - Color-coded status and progress indicators

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 20+ (for development)
- OpenAI API Key (for AI chat functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-home-control.git
   cd smart-home-control
   ```

2. **Set up Python environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

4. **Initialize the database**
   ```bash
   cd src
   python main.py
   ```

5. **Access the application**
   - Open your browser to `http://localhost:5000`
   - The system will initialize with default devices

## 🔧 Configuration

### Environment Variables
Create a `.env` file in the root directory:

```env
# OpenAI Configuration (required for AI chat)
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_API_BASE=https://api.openai.com/v1

# Flask Configuration
SECRET_KEY=your-secret-key-here
FLASK_ENV=development
```

### Device Configuration
The system supports dynamic device configuration through the web interface:

1. Click the **Settings** button in the top navigation
2. Use the **Device Configuration** panel to:
   - Add new devices with custom properties
   - Modify existing device settings
   - Enable/disable devices
   - Organize devices by rooms
   - Import/export configurations

## 📱 Usage

### Device Control
- **Manual Control**: Use the device cards to control individual devices
- **Room Filtering**: Select specific rooms from the dropdown
- **Real-time Updates**: Changes reflect immediately across the interface

### AI Assistant
- **Text Commands**: Type natural language commands like "Turn on all lights"
- **Voice Commands**: Click the microphone button and speak your command
- **Quick Commands**: Use contextual quick command buttons
- **Status Queries**: Ask "What's the current temperature?" or "Show energy usage"

### Example Commands
```
"Turn on the living room lights"
"Set thermostat to 23 degrees"
"Turn off all devices"
"Set jacuzzi temperature to 38 degrees for 30 minutes"
"Good morning routine"
"What's the current energy usage?"
```

## 🏗️ Architecture

### Backend (Flask)
- **RESTful API** - Clean API endpoints for device control
- **SQLite Database** - Persistent device states and configurations
- **OpenAI Integration** - Natural language processing for commands
- **CORS Enabled** - Cross-origin requests for frontend-backend communication

### Frontend (Vanilla JS + CSS)
- **Responsive Design** - Mobile-first approach with CSS Grid and Flexbox
- **Real-time Updates** - WebSocket-like polling for live data
- **Modern UI Components** - Custom-built controls and animations
- **Progressive Enhancement** - Works without JavaScript for basic functionality

### File Structure
```
smart-home-control/
├── src/
│   ├── main.py                 # Flask application entry point
│   ├── models/                 # Database models
│   │   ├── device.py          # Device and room models
│   │   └── user.py            # User management
│   ├── routes/                 # API endpoints
│   │   ├── devices.py         # Device control APIs
│   │   ├── config.py          # Configuration management
│   │   ├── chat.py            # AI chat integration
│   │   └── user.py            # User management
│   ├── static/                 # Frontend assets
│   │   ├── index.html         # Main application
│   │   ├── css/               # Stylesheets
│   │   └── js/                # JavaScript modules
│   └── database/              # SQLite database files
├── requirements.txt           # Python dependencies
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## 🔌 API Endpoints

### Device Control
- `GET /api/devices` - List all devices
- `POST /api/devices/{id}/control` - Control device property
- `GET /api/devices/{id}/status` - Get device status

### Configuration
- `GET /api/config` - Get system configuration
- `POST /api/config/reset` - Reset to default configuration
- `POST /api/config/import` - Import configuration
- `GET /api/config/export` - Export configuration

### AI Chat
- `POST /api/chat` - Send message to AI assistant
- `GET /api/chat/status` - Get system status for AI context
- `GET /api/chat/history` - Get chat history

## 🎨 Customization

### Adding New Device Types
1. **Update Device Templates** in `src/routes/devices.py`
2. **Add Frontend Controls** in `src/static/js/main.js`
3. **Update CSS Styles** in `src/static/css/main.css`

### Theming
The interface uses CSS custom properties for easy theming:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a1a;
  --accent-primary: #00d4ff;
  --text-primary: #ffffff;
  --text-secondary: #b0b0b0;
}
```

## 🚀 Deployment

### Local Development
```bash
python src/main.py
```

### Production Deployment
1. **Set environment variables** for production
2. **Use a production WSGI server** like Gunicorn:
   ```bash
   pip install gunicorn
   gunicorn -w 4 -b 0.0.0.0:5000 src.main:app
   ```

### Docker Deployment
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "src.main:app"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for GPT-3.5-turbo API
- **Flask** for the excellent web framework
- **Material Design Icons** for the beautiful iconography
- **CSS Grid and Flexbox** for responsive layout capabilities

## 📞 Support

If you encounter any issues or have questions:

1. Check the [Issues](https://github.com/yourusername/smart-home-control/issues) page
2. Create a new issue with detailed information
3. Join our [Discussions](https://github.com/yourusername/smart-home-control/discussions) for community support

---

**Made with ❤️ for smart home enthusiasts**

