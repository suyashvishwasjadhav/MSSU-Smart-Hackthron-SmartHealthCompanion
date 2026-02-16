# Smart Health Companion 🩺

A professional, AI-powered healthcare ecosystem designed to bridge the gap between patients and healthcare providers. This project was developed as part of a **University Smart Hackathon**.

## 🌟 Overview

Smart Health Companion is a comprehensive health management platform that leverages late-generation AI (Google Gemini) to provide patients with instant symptom analysis and medical image insights, while streamlining the appointment process with qualified doctors.

## 🚀 Key Features

### 🏥 For Patients
- **AI Symptom Checker**: Instant analysis of symptoms using Gemini 2.0 Flash for accurate guidance.
- **AI Medical Image Analysis**: High-precision visual assessment of medical images (rashes, X-rays, etc.) via Gemini Pro Vision.
- **Doctor Finder**: Search for healthcare specialists based on location and specialization.
- **Simplified Booking**: Request and track appointments with professional doctors.
- **Health Dashboard**: Real-time tracking of recent checks and upcoming appointments.

### 👨‍⚕️ For Doctors
- **Professional Dashboard**: Manage patient requests and schedules efficiently.
- **Appointment Management**: Approve, reject, or reschedule patient consultations.
- **Patient Insights**: Access symptom history and AI analysis reports before consultations.

## 🛠️ Tech Stack

- **Backend**: Python, Flask
- **Database**: SQLAlchemy (SQLite for local development, PostgreSQL ready)
- **Artificial Intelligence**: Google Gemini AI (Text & Vision APIs)
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla), Bootstrap, Font Awesome
- **Development Environment**: Vite-ready structure for modern web standards

## 👥 Contributors

- **Suyash Vishwas Jadhav**: Lead Developer (Backend logic, AI integration, Database architecture, and UI/UX finalization)
- **Yash Vichare**: Frontend Contributor (Initial UI/UX framework and components)

---

## ⚙️ Installation & Setup

### Prerequisites
- Python 3.11+
- Google Gemini API Key

### 1. Clone the Repository
```bash
git clone https://github.com/suyashvishwasjadhav/MSSU-Smart-Hackthron-SmartHealthCompanion.git
cd MSSU-Smart-Hackthron-SmartHealthCompanion
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory (refer to `.env.example`):
```env
GOOGLE_API_KEY=your_gemini_api_key
SESSION_SECRET=your_random_secret
```

### 4. Run the Application
```bash
python main.py
```
The application will be available at `http://localhost:5001`.

## 📜 Disclaimer

*This application is a prototype for educational purposes. The AI-generated analysis is not a substitute for professional medical advice, diagnosis, or treatment.*

---
© 2026 Smart Health Companion Team
