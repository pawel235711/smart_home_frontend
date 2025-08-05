# Contributing to Smart Home Control System

Thank you for your interest in contributing to the Smart Home Control System! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Python 3.11+
- Git
- Basic knowledge of Flask and JavaScript
- OpenAI API key (for testing AI features)

### Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/yourusername/smart-home-control.git
   cd smart-home-control
   ```

2. **Set up development environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Run the development server**
   ```bash
   python src/main.py
   ```

## 📋 How to Contribute

### Reporting Bugs
1. Check if the bug has already been reported in [Issues](https://github.com/yourusername/smart-home-control/issues)
2. Create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots if applicable
   - Environment details (OS, Python version, browser)

### Suggesting Features
1. Check [Issues](https://github.com/yourusername/smart-home-control/issues) for existing feature requests
2. Create a new issue with:
   - Clear description of the feature
   - Use case and benefits
   - Possible implementation approach
   - Mockups or examples if applicable

### Code Contributions

#### Pull Request Process
1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the coding standards below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run the application
   python src/main.py
   
   # Test in browser
   # Verify all device controls work
   # Test responsive design
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "Add: description of your changes"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature-name
   ```
   Then create a Pull Request on GitHub.

## 📝 Coding Standards

### Python (Backend)
- Follow PEP 8 style guide
- Use type hints where appropriate
- Add docstrings for functions and classes
- Keep functions focused and small
- Use meaningful variable names

```python
def get_device_status(device_id: str) -> Dict[str, Any]:
    """
    Get current status of a device.
    
    Args:
        device_id: Unique identifier for the device
        
    Returns:
        Dictionary containing device status information
    """
    device = Device.get_by_id(device_id)
    return device.to_dict() if device else {}
```

### JavaScript (Frontend)
- Use modern ES6+ features
- Follow consistent naming conventions
- Add comments for complex logic
- Keep functions pure when possible
- Use async/await for asynchronous operations

```javascript
/**
 * Update device property and refresh UI
 * @param {string} deviceId - Device identifier
 * @param {string} property - Property name
 * @param {any} value - New property value
 */
async function updateDeviceProperty(deviceId, property, value) {
    try {
        const response = await apiCall(`/devices/${deviceId}/control`, {
            method: 'POST',
            body: JSON.stringify({ property, value })
        });
        
        if (response.success) {
            refreshDeviceDisplay(deviceId);
        }
    } catch (error) {
        showNotification('Failed to update device', 'error');
    }
}
```

### CSS
- Use CSS custom properties for theming
- Follow mobile-first responsive design
- Use meaningful class names
- Group related styles together
- Add comments for complex layouts

```css
/* Device control card styles */
.device-card {
    background: var(--bg-secondary);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    transition: transform 0.2s ease;
}

.device-card:hover {
    transform: translateY(-2px);
}
```

## 🏗️ Project Structure

### Adding New Device Types
1. **Backend**: Update `src/routes/devices.py` with device template
2. **Frontend**: Add device controls in `src/static/js/main.js`
3. **Styling**: Add CSS for new device in `src/static/css/main.css`
4. **Documentation**: Update README with device information

### Adding New API Endpoints
1. Create route in appropriate file under `src/routes/`
2. Add proper error handling and validation
3. Update API documentation in README
4. Add frontend integration if needed

### Frontend Components
- Keep components modular and reusable
- Use consistent naming conventions
- Add proper error handling
- Ensure responsive design

## 🧪 Testing Guidelines

### Manual Testing Checklist
- [ ] All device controls work correctly
- [ ] Responsive design on mobile/tablet/desktop
- [ ] Configuration panel functions properly
- [ ] AI chat responds appropriately (with API key)
- [ ] Real-time updates work
- [ ] Error handling displays proper messages

### Browser Testing
Test on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Android Chrome)

## 📚 Documentation

### Code Documentation
- Add docstrings to all Python functions
- Comment complex JavaScript logic
- Update README for new features
- Add inline comments for non-obvious code

### API Documentation
When adding new endpoints, update the API section in README with:
- Endpoint URL and method
- Request/response format
- Example usage
- Error responses

## 🎨 Design Guidelines

### UI/UX Principles
- **Consistency**: Use established patterns and components
- **Accessibility**: Ensure keyboard navigation and screen reader support
- **Performance**: Optimize for fast loading and smooth interactions
- **Mobile-first**: Design for mobile, enhance for desktop

### Visual Design
- Follow the dark theme with cyan accents
- Use consistent spacing and typography
- Ensure sufficient color contrast
- Add smooth transitions and animations

## 🔍 Code Review Process

### For Reviewers
- Check code quality and standards
- Verify functionality works as expected
- Test responsive design
- Ensure documentation is updated
- Look for potential security issues

### For Contributors
- Respond to feedback promptly
- Make requested changes
- Test thoroughly before requesting re-review
- Keep PR scope focused and manageable

## 📞 Getting Help

- **Questions**: Use [GitHub Discussions](https://github.com/yourusername/smart-home-control/discussions)
- **Issues**: Report bugs in [GitHub Issues](https://github.com/yourusername/smart-home-control/issues)
- **Real-time help**: Join our community chat (link to be added)

## 🏆 Recognition

Contributors will be recognized in:
- README acknowledgments
- Release notes
- Contributors page (coming soon)

Thank you for helping make the Smart Home Control System better! 🏠✨

