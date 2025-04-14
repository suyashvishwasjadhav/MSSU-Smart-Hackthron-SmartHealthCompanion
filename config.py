import os

# Google Gemini API
GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY', "AIzaSyDydt1V58LLoRrrM98A1YeoGo6GnhJgNfk")

# Database configuration
DATABASE_URL = os.environ.get('DATABASE_URL', 'sqlite:///healthcare.db')
PGPORT = os.environ.get('PGPORT')
PGDATABASE = os.environ.get('PGDATABASE')
PGPASSWORD = os.environ.get('PGPASSWORD')
PGHOST = os.environ.get('PGHOST')
PGUSER = os.environ.get('PGUSER')

# Application configuration
DEBUG = True
SECRET_KEY = os.environ.get('SESSION_SECRET', os.urandom(24))

# Google Maps API
MAPS_API_KEY = os.environ.get('MAPS_API_KEY', '')
