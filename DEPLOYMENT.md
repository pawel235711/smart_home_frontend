# 🚀 Deployment Guide

This guide covers various deployment options for the Smart Home Control System.

## 📋 Prerequisites

- Python 3.11+
- OpenAI API Key (for AI chat functionality)
- Domain name (for production deployment)

## 🏠 Local Development

### Quick Start
```bash
# Clone and setup
git clone https://github.com/yourusername/smart-home-control.git
cd smart-home-control
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your OpenAI API key

# Run application
python src/main.py
```

Access at: `http://localhost:5000`

## 🐳 Docker Deployment

### Using Docker Compose (Recommended)

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-home-control.git
   cd smart-home-control
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Deploy with Docker Compose**
   ```bash
   docker-compose up -d
   ```

4. **Access the application**
   - URL: `http://localhost:5000`
   - Logs: `docker-compose logs -f`

### Using Docker Only

```bash
# Build image
docker build -t smart-home-control .

# Run container
docker run -d \
  --name smart-home-control \
  -p 5000:5000 \
  -e OPENAI_API_KEY=your-api-key \
  -v $(pwd)/src/database:/app/src/database \
  smart-home-control
```

## ☁️ Cloud Deployment

### Heroku

1. **Install Heroku CLI**
   ```bash
   # macOS
   brew tap heroku/brew && brew install heroku
   
   # Ubuntu
   curl https://cli-assets.heroku.com/install.sh | sh
   ```

2. **Create Heroku app**
   ```bash
   heroku create your-smart-home-app
   ```

3. **Set environment variables**
   ```bash
   heroku config:set OPENAI_API_KEY=your-api-key
   heroku config:set SECRET_KEY=your-secret-key
   ```

4. **Deploy**
   ```bash
   git push heroku main
   ```

5. **Access your app**
   ```bash
   heroku open
   ```

### DigitalOcean App Platform

1. **Create `app.yaml`**
   ```yaml
   name: smart-home-control
   services:
   - name: web
     source_dir: /
     github:
       repo: yourusername/smart-home-control
       branch: main
     run_command: python src/main.py
     environment_slug: python
     instance_count: 1
     instance_size_slug: basic-xxs
     envs:
     - key: OPENAI_API_KEY
       value: your-api-key
       type: SECRET
     - key: SECRET_KEY
       value: your-secret-key
       type: SECRET
     http_port: 5000
   ```

2. **Deploy via CLI**
   ```bash
   doctl apps create --spec app.yaml
   ```

### AWS EC2

1. **Launch EC2 instance** (Ubuntu 22.04 LTS)

2. **Connect and setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Python and Git
   sudo apt install python3.11 python3.11-venv git nginx -y
   
   # Clone repository
   git clone https://github.com/yourusername/smart-home-control.git
   cd smart-home-control
   
   # Setup Python environment
   python3.11 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   pip install gunicorn
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Create systemd service**
   ```bash
   sudo nano /etc/systemd/system/smart-home-control.service
   ```
   
   ```ini
   [Unit]
   Description=Smart Home Control System
   After=network.target
   
   [Service]
   User=ubuntu
   Group=ubuntu
   WorkingDirectory=/home/ubuntu/smart-home-control
   Environment=PATH=/home/ubuntu/smart-home-control/venv/bin
   EnvironmentFile=/home/ubuntu/smart-home-control/.env
   ExecStart=/home/ubuntu/smart-home-control/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 src.main:app
   Restart=always
   
   [Install]
   WantedBy=multi-user.target
   ```

5. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/smart-home-control
   ```
   
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
   
       location / {
           proxy_pass http://127.0.0.1:5000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

6. **Enable and start services**
   ```bash
   sudo ln -s /etc/nginx/sites-available/smart-home-control /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   sudo systemctl enable smart-home-control
   sudo systemctl start smart-home-control
   ```

### Google Cloud Platform

1. **Create `app.yaml`**
   ```yaml
   runtime: python311
   
   env_variables:
     OPENAI_API_KEY: "your-api-key"
     SECRET_KEY: "your-secret-key"
   
   handlers:
   - url: /static
     static_dir: src/static
   
   - url: /.*
     script: auto
   ```

2. **Deploy**
   ```bash
   gcloud app deploy
   ```

## 🔒 SSL/HTTPS Setup

### Using Certbot (Let's Encrypt)

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

### Using Cloudflare

1. Add your domain to Cloudflare
2. Set DNS records to point to your server
3. Enable "Always Use HTTPS" in SSL/TLS settings
4. Set SSL mode to "Full" or "Full (strict)"

## 📊 Monitoring & Logging

### Application Logs

```bash
# View logs (systemd)
sudo journalctl -u smart-home-control -f

# View logs (Docker)
docker-compose logs -f

# View logs (Heroku)
heroku logs --tail
```

### Health Checks

The application includes a health check endpoint:
- URL: `http://your-domain.com/api/health`
- Response: `{"status": "healthy", "timestamp": "..."}`

### Monitoring Setup

1. **Uptime monitoring** - Use services like UptimeRobot or Pingdom
2. **Error tracking** - Integrate with Sentry or similar
3. **Performance monitoring** - Use New Relic or DataDog

## 🔧 Environment Variables

### Required Variables
```env
OPENAI_API_KEY=your-openai-api-key-here
SECRET_KEY=your-secret-key-change-in-production
```

### Optional Variables
```env
FLASK_ENV=production
DATABASE_URL=sqlite:///database/app.db
HOST=0.0.0.0
PORT=5000
OPENAI_API_BASE=https://api.openai.com/v1
```

## 🔄 Updates & Maintenance

### Updating the Application

```bash
# Pull latest changes
git pull origin main

# Update dependencies
pip install -r requirements.txt

# Restart service
sudo systemctl restart smart-home-control

# Or with Docker
docker-compose down && docker-compose up -d --build
```

### Database Backups

```bash
# Backup SQLite database
cp src/database/app.db src/database/app.db.backup.$(date +%Y%m%d_%H%M%S)

# Automated backup script
#!/bin/bash
BACKUP_DIR="/home/ubuntu/backups"
mkdir -p $BACKUP_DIR
cp /home/ubuntu/smart-home-control/src/database/app.db $BACKUP_DIR/app.db.$(date +%Y%m%d_%H%M%S)
# Keep only last 30 days
find $BACKUP_DIR -name "app.db.*" -mtime +30 -delete
```

## 🚨 Troubleshooting

### Common Issues

1. **Port 5000 already in use**
   ```bash
   # Find process using port
   sudo lsof -i :5000
   # Kill process or change port in configuration
   ```

2. **Permission denied errors**
   ```bash
   # Fix file permissions
   sudo chown -R ubuntu:ubuntu /home/ubuntu/smart-home-control
   chmod +x src/main.py
   ```

3. **Database connection errors**
   ```bash
   # Check database directory exists
   mkdir -p src/database
   # Check file permissions
   ls -la src/database/
   ```

4. **OpenAI API errors**
   - Verify API key is correct
   - Check API quota and billing
   - Ensure OPENAI_API_KEY environment variable is set

### Performance Optimization

1. **Use a production WSGI server** (Gunicorn, uWSGI)
2. **Enable gzip compression** in Nginx
3. **Use a reverse proxy** (Nginx, Apache)
4. **Implement caching** for static assets
5. **Monitor resource usage** and scale as needed

## 📞 Support

For deployment issues:
1. Check the [troubleshooting section](#-troubleshooting)
2. Review application logs
3. Create an issue on GitHub with:
   - Deployment method used
   - Error messages
   - System information
   - Steps to reproduce

---

**Happy deploying! 🚀**

