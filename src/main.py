import os
import sys
# DON'T CHANGE THIS !!!
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from flask import Flask, send_from_directory
from flask_cors import CORS
from src.models.device import db as device_db, Device, DeviceState, Room
from src.models.sensor import SensorDevice, SensorReading, OTAUpdate, SensorAlert
from src.routes.user import user_bp
from src.routes.devices import devices_bp
from src.routes.config import config_bp
from src.routes.chat import chat_bp
from src.routes.sensors import sensors_bp

app = Flask(__name__, static_folder=os.path.join(os.path.dirname(__file__), 'static'))
app.config['SECRET_KEY'] = 'asdf#FGSgvasgf$5$WGT'

# OpenAI configuration
app.config['OPENAI_API_KEY'] = os.environ.get('OPENAI_API_KEY')
app.config['OPENAI_API_BASE'] = os.environ.get('OPENAI_API_BASE', 'https://api.openai.com/v1')

# Database configuration
app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(os.path.dirname(__file__), 'database', 'app.db')}"
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Enable CORS for all routes
CORS(app)

# Initialize database (use single db instance)
device_db.init_app(app)

# Register blueprints
app.register_blueprint(user_bp, url_prefix='/api')
app.register_blueprint(devices_bp, url_prefix='/api')
app.register_blueprint(config_bp, url_prefix='/api')
app.register_blueprint(chat_bp, url_prefix='/api')
app.register_blueprint(sensors_bp, url_prefix='/api')

# Create tables and initialize data
with app.app_context():
    device_db.create_all()
    
    # Initialize with default configuration if no devices exist
    if Device.query.count() == 0:
        from src.routes.config import reset_configuration
        reset_configuration()

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    static_folder_path = app.static_folder
    if static_folder_path is None:
            return "Static folder not configured", 404

    if path != "" and os.path.exists(os.path.join(static_folder_path, path)):
        return send_from_directory(static_folder_path, path)
    else:
        index_path = os.path.join(static_folder_path, 'index.html')
        if os.path.exists(index_path):
            return send_from_directory(static_folder_path, 'index.html')
        else:
            return "index.html not found", 404


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
