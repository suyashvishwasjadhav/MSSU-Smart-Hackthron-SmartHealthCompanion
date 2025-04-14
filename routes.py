from flask import render_template, request, jsonify, redirect, url_for, session, flash
from functools import wraps
import google.generativeai as genai
import os
import json
import base64
import re
from datetime import datetime, timedelta
from app import app, db
from models import User, Doctor, Patient, Appointment, SymptomCheck, ImageAnalysisSection, Notification
from config import GOOGLE_API_KEY
import logging
from sqlalchemy.exc import SQLAlchemyError
from werkzeug.security import generate_password_hash, check_password_hash

# Configure Gemini API
genai.configure(api_key=GOOGLE_API_KEY)

# Text model (optimized for faster responses)
text_model = genai.GenerativeModel('gemini-2.0-flash')

# Vision model (supporting multimodal inputs like images)
vision_model = genai.GenerativeModel('gemini-pro-vision')

# Login required decorator
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            flash('Please log in to access this page', 'warning')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

# Doctor required decorator
def doctor_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'doctor':
            flash('Access denied. Doctor privileges required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# Patient required decorator
def patient_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_type' not in session or session['user_type'] != 'patient':
            flash('Access denied. Patient privileges required.', 'danger')
            return redirect(url_for('dashboard'))
        return f(*args, **kwargs)
    return decorated_function

# Home route
@app.route('/')
def home():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

# Login route
@app.route('/login', methods=['GET', 'POST'])
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        
        user = User.query.filter_by(email=email).first()
        
        if user and user.check_password(password):
            session['user_id'] = user.id
            session['user_email'] = user.email
            session['user_type'] = user.user_type
            
            flash(f'Welcome back!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid email or password', 'danger')
    
    return render_template('login.html')

# Registration route
@app.route('/register', methods=['GET', 'POST'])
def register():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')
        user_type = request.form.get('user_type')
        name = request.form.get('name')
        
        # Basic validation
        if not all([email, password, confirm_password, user_type, name]):
            flash('All fields are required', 'danger')
            return render_template('register.html')
        
        if password != confirm_password:
            flash('Passwords do not match', 'danger')
            return render_template('register.html')
        
        # Check if user already exists
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            flash('Email already registered', 'danger')
            return render_template('register.html')
        
        try:
            # Create new user
            new_user = User(
                email=email,
                user_type=user_type
            )
            new_user.set_password(password)
            db.session.add(new_user)
            db.session.flush()  # Get the user ID without committing
            
            # Create doctor or patient profile
            if user_type == 'doctor':
                specialization = request.form.get('specialization')
                if not specialization:
                    flash('Specialization is required for doctors', 'danger')
                    return render_template('register.html')
                
                new_doctor = Doctor(
                    user_id=new_user.id,
                    name=name,
                    specialization=specialization
                )
                db.session.add(new_doctor)
            else:
                new_patient = Patient(
                    user_id=new_user.id,
                    name=name
                )
                db.session.add(new_patient)
            
            db.session.commit()
            
            # Log in the user
            session['user_id'] = new_user.id
            session['user_email'] = new_user.email
            session['user_type'] = new_user.user_type
            
            flash('Registration successful!', 'success')
            return redirect(url_for('dashboard'))
            
        except SQLAlchemyError as e:
            db.session.rollback()
            app.logger.error(f"Registration error: {str(e)}")
            flash('An error occurred during registration. Please try again.', 'danger')
    
    return render_template('register.html')

# Logout route
@app.route('/logout')
def logout():
    session.clear()
    flash('You have been logged out', 'info')
    return redirect(url_for('home'))

# Dashboard route
@app.route('/dashboard')
@login_required
def dashboard():
    user_id = session.get('user_id')
    user_type = session.get('user_type')
    
    # Get unread notification count
    notification_count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    # Get recent notifications
    recent_notifications = Notification.query.filter_by(
        user_id=user_id
    ).order_by(
        Notification.created_at.desc()
    ).limit(5).all()
    
    if user_type == 'doctor':
        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            session.clear()
            flash('Doctor profile not found', 'danger')
            return redirect(url_for('login'))
        
        # Get all appointments for doctors, including pending requests
        upcoming_appointments = Appointment.query.filter_by(
            doctor_id=doctor.id
        ).filter(
            Appointment.status.in_(['pending', 'approved', 'scheduled'])
        ).filter(
            Appointment.date >= datetime.now().date()
        ).order_by(
            Appointment.date,
            Appointment.time
        ).limit(5).all()
        
        # Get pending appointment requests for doctors
        pending_requests = Appointment.query.filter_by(
            doctor_id=doctor.id,
            status='pending'
        ).count()
        
        return render_template(
            'dashboard.html',
            user_data=doctor,
            user_type=user_type,
            appointments=upcoming_appointments,
            notification_count=notification_count,
            recent_notifications=recent_notifications,
            pending_requests=pending_requests
        )
    else:
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            session.clear()
            flash('Patient profile not found', 'danger')
            return redirect(url_for('login'))
        
        # Get upcoming appointments for patients, including pending and approved
        upcoming_appointments = Appointment.query.filter_by(
            patient_id=patient.id
        ).filter(
            Appointment.status.in_(['pending', 'approved', 'scheduled'])
        ).filter(
            Appointment.date >= datetime.now().date()
        ).order_by(
            Appointment.date,
            Appointment.time
        ).limit(5).all()
        
        # Get recent symptom checks
        recent_checks = SymptomCheck.query.filter_by(
            patient_id=patient.id
        ).order_by(
            SymptomCheck.created_at.desc()
        ).limit(3).all()
        
        return render_template(
            'dashboard.html',
            user_data=patient,
            user_type=user_type,
            appointments=upcoming_appointments,
            symptom_checks=recent_checks,
            notification_count=notification_count,
            recent_notifications=recent_notifications
        )

# Symptom checker route
@app.route('/symptom-checker', methods=['GET', 'POST'])
@login_required
@patient_required
def symptom_checker():
    if request.method == 'POST':
        try:
            user_id = session.get('user_id')
            patient = Patient.query.filter_by(user_id=user_id).first()
            
            if not patient:
                return jsonify({
                    'success': False,
                    'message': 'Patient profile not found'
                }), 404
            
            data = request.json
            symptoms = data.get('symptoms', '')
            age = data.get('age', '')
            gender = data.get('gender', '')
            duration = data.get('duration', '')
            severity = data.get('severity', '')
            medical_history = data.get('medical_history', '')
            image_data = data.get('image_data', '')  # Base64 encoded image
            
            # Check if an image was uploaded
            has_image = bool(image_data and image_data.startswith('data:image'))
            
            # Prepare the symptom check object first (we'll analyze later)
            new_check = SymptomCheck(
                patient_id=patient.id,
                symptoms=symptoms,
                age=int(age) if age.isdigit() else None,
                gender=gender,
                duration=duration,
                severity=severity,
                medical_history=medical_history
            )
            
            # Store the image data if provided
            if has_image:
                # Extract the base64 part
                base64_data = re.sub('^data:image/.+;base64,', '', image_data)
                new_check.image_data = base64_data
            
            # Add to session to get ID but don't commit yet
            db.session.add(new_check)
            db.session.flush()
                
            # Text analysis prompt
            prompt = f"""As a medical AI assistant, analyze the following patient information:

Patient Information:
- Age: {age}
- Gender: {gender}
- Symptoms: {symptoms}
- Duration: {duration}
- Severity: {severity}
- Medical History: {medical_history}

Please provide a comprehensive analysis with the following structure:

Possible Conditions:
[List each condition with confidence level and brief description]
- Condition (High/Medium/Low confidence): Description and typical presentation

Key Symptoms Analysis:
- [Analyze each reported symptom and its significance]

Risk Factors:
- [List relevant risk factors based on patient's profile]

Recommended Next Steps:
1. [Immediate actions or self-care measures]
2. [When to seek professional medical care]
3. [Suggested medical tests or examinations]

Warning Signs:
- [List specific symptoms or changes that require immediate medical attention]

Preventive Measures:
1. [Lifestyle modifications]
2. [Preventive actions]
3. [General health recommendations]

Note: This is an AI-generated analysis for informational purposes only. Please consult with a healthcare provider for proper medical diagnosis and treatment."""

            response = text_model.generate_content(prompt)
            
            if not response or not response.text:
                return jsonify({
                    'success': False,
                    'message': 'No response received from AI. Please try again.'
                }), 500
            
            processed_response = response.text.replace("*", "").replace("•", "")
            
            sections = [
                "Possible Conditions:",
                "Key Symptoms Analysis:",
                "Risk Factors:",
                "Recommended Next Steps:",
                "Warning Signs:",
                "Preventive Measures:"
            ]
            
            formatted_response = processed_response
            for section in sections:
                if section not in formatted_response:
                    base_section = section.replace(":", "")
                    formatted_response = formatted_response.replace(base_section, section)
            
            # Save the text analysis
            new_check.ai_analysis = formatted_response
            
            # Process image if provided
            image_analysis_result = None
            if has_image and new_check.image_data:
                try:
                    image_analysis_result = analyze_medical_image(new_check.image_data, symptoms, age, gender, medical_history)
                    new_check.image_analysis = image_analysis_result
                    
                    # Create structured sections for the image analysis
                    create_image_analysis_sections(new_check.id, image_analysis_result)
                except Exception as img_err:
                    app.logger.error(f"Image analysis error: {str(img_err)}")
                    # Continue without image analysis if it fails
            
            # Commit the changes
            db.session.commit()
            
            return jsonify({
                'success': True,
                'analysis': formatted_response,
                'has_image': has_image,
                'image_analysis': image_analysis_result if has_image else None,
                'check_id': new_check.id
            })
            
        except Exception as e:
            db.session.rollback()
            app.logger.error(f"Symptom checker error: {str(e)}")
            return jsonify({
                'success': False,
                'message': 'An error occurred while analyzing symptoms. Please try again.'
            }), 500
    
    return render_template('symptom_checker.html')


# Function to analyze medical images using Google Gemini's Vision API
def analyze_medical_image(base64_image, symptoms, age, gender, medical_history):
    try:
        import base64
        from PIL import Image
        import io
        
        # Decode base64 image data
        image_data = base64.b64decode(base64_image)
        image = Image.open(io.BytesIO(image_data))
        
        # Create the prompt
        prompt = f"""As a medical AI assistant, analyze this medical image with the following patient information:

Patient Information:
- Age: {age}
- Gender: {gender}
- Reported Symptoms: {symptoms}
- Medical History: {medical_history}

Please provide a detailed analysis of the visible symptoms or conditions in the image.
Structure your analysis in the following sections:

Visual Findings:
[Describe all visible symptoms, abnormalities, or medical conditions shown in the image]

Potential Diagnoses:
[List possible diagnoses based on the visual findings, ordered by likelihood]

Recommended Medical Specialties:
[Suggest which medical specialists would be appropriate for follow-up care]

Important Notes:
[Include any critical observations or warnings about the condition]

This is for educational purposes only and not a substitute for professional medical diagnosis.
"""

        # Generate content with the image using Gemini Pro Vision
        response = vision_model.generate_content([prompt, image])
        
        # Extract and return the analysis
        if response and hasattr(response, 'text'):
            return response.text
        else:
            raise Exception("No response generated from Gemini model")
        
    except Exception as e:
        app.logger.error(f"Gemini Vision API error: {str(e)}")
        raise Exception(f"Error analyzing medical image: {str(e)}")


# Function to split image analysis into structured sections
def create_image_analysis_sections(symptom_check_id, analysis_text):
    try:
        # Define the sections to look for
        sections = {
            "Visual Findings:": 1,
            "Potential Diagnoses:": 2,
            "Recommended Medical Specialties:": 3,
            "Important Notes:": 4
        }
        
        # Split the text by sections
        current_section = None
        section_content = {}
        
        # Initialize all sections with empty content
        for section in sections:
            section_content[section] = ""
        
        # Process the analysis line by line
        for line in analysis_text.split('\n'):
            found_section = False
            for section in sections:
                if line.strip().startswith(section):
                    current_section = section
                    found_section = True
                    break
            
            if found_section:
                continue
                
            if current_section and line.strip():
                section_content[current_section] += line + "\n"
        
        # Create database entries for each section
        for section, order in sections.items():
            content = section_content[section].strip()
            if content:
                section_entry = ImageAnalysisSection(
                    symptom_check_id=symptom_check_id,
                    section_title=section,
                    section_content=content,
                    section_order=order
                )
                db.session.add(section_entry)
                
    except Exception as e:
        app.logger.error(f"Error creating image sections: {str(e)}")
        # Continue even if section creation fails

# Doctor finder route
@app.route('/doctor-finder')
@login_required
@patient_required
def doctor_finder():
    specialization = request.args.get('specialization', '')
    
    # Get all doctors or filter by specialization
    if specialization:
        doctors_list = Doctor.query.filter(
            Doctor.specialization.ilike(f'%{specialization}%')
        ).all()
    else:
        doctors_list = Doctor.query.all()
    
    return render_template('doctor_finder.html', doctors=doctors_list, specialization=specialization)

# Profile route
@app.route('/profile', methods=['GET'])
@login_required
def profile():
    user_id = session.get('user_id')
    user_type = session.get('user_type')
    
    if user_type == 'doctor':
        user_data = Doctor.query.filter_by(user_id=user_id).first()
    else:
        user_data = Patient.query.filter_by(user_id=user_id).first()
    
    if not user_data:
        session.clear()
        flash('Profile not found', 'danger')
        return redirect(url_for('login'))
    
    return render_template('profile.html', user_type=user_type, user_data=user_data)

# Update profile route
@app.route('/api/profile', methods=['PUT'])
@login_required
def update_profile():
    try:
        user_id = session.get('user_id')
        user_type = session.get('user_type')
        data = request.json
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({'success': False, 'message': 'User not found'}), 404
        
        # Update user data
        if user_type == 'doctor':
            doctor = Doctor.query.filter_by(user_id=user_id).first()
            if doctor:
                doctor.name = data.get('name', doctor.name)
                doctor.phone = data.get('phone', doctor.phone)
                doctor.specialization = data.get('specialization', doctor.specialization)
                doctor.address = data.get('address', doctor.address)
                doctor.city = data.get('city', doctor.city)
                doctor.state = data.get('state', doctor.state)
                doctor.zip_code = data.get('zip_code', doctor.zip_code)
                doctor.bio = data.get('bio', doctor.bio)
                
                # Update latitude and longitude if provided
                if 'latitude' in data and 'longitude' in data:
                    doctor.latitude = data['latitude']
                    doctor.longitude = data['longitude']
        else:
            patient = Patient.query.filter_by(user_id=user_id).first()
            if patient:
                patient.name = data.get('name', patient.name)
                patient.phone = data.get('phone', patient.phone)
                patient.address = data.get('address', patient.address)
                patient.city = data.get('city', patient.city)
                patient.state = data.get('state', patient.state)
                patient.zip_code = data.get('zip_code', patient.zip_code)
                patient.medical_history = data.get('medical_history', patient.medical_history)
                patient.allergies = data.get('allergies', patient.allergies)
                
                # Parse and set date of birth if provided
                if data.get('dob'):
                    try:
                        patient.dob = datetime.strptime(data['dob'], '%Y-%m-%d').date()
                    except ValueError:
                        pass
                
                # Update gender if provided
                if data.get('gender'):
                    patient.gender = data['gender']
                
                # Update latitude and longitude if provided
                if 'latitude' in data and 'longitude' in data:
                    patient.latitude = data['latitude']
                    patient.longitude = data['longitude']
        
        # Update password if provided
        if data.get('new_password') and data.get('current_password'):
            if not user.check_password(data['current_password']):
                return jsonify({'success': False, 'message': 'Current password is incorrect'}), 400
            user.set_password(data['new_password'])
        
        db.session.commit()
        return jsonify({'success': True, 'message': 'Profile updated successfully'})
        
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"Profile update error: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while updating profile'}), 500

# Book appointment route
@app.route('/book-appointment', methods=['GET', 'POST'])
@login_required
@patient_required
def book_appointment():
    user_id = session.get('user_id')
    patient = Patient.query.filter_by(user_id=user_id).first()
    
    if not patient:
        flash('Patient profile not found', 'danger')
        return redirect(url_for('dashboard'))
    
    if request.method == 'POST':
        try:
            doctor_id = request.form.get('doctor_id')
            date_str = request.form.get('date')
            time_str = request.form.get('time')
            reason = request.form.get('reason')
            
            # Validate input
            if not all([doctor_id, date_str, time_str]):
                flash('Doctor, date and time are required', 'danger')
                return redirect(url_for('book_appointment'))
            
            # Parse date and time
            appointment_date = datetime.strptime(date_str, '%Y-%m-%d').date()
            appointment_time = datetime.strptime(time_str, '%H:%M').time()
            
            # Check if doctor exists
            doctor = Doctor.query.get(doctor_id)
            if not doctor:
                flash('Selected doctor not found', 'danger')
                return redirect(url_for('book_appointment'))
            
            # Create new appointment with pending status
            new_appointment = Appointment(
                doctor_id=doctor.id,
                patient_id=patient.id,
                date=appointment_date,
                time=appointment_time,
                status='pending',  # Changed from 'scheduled' to 'pending'
                reason=reason
            )
            
            db.session.add(new_appointment)
            db.session.flush()  # Get the ID without committing yet
            
            # Create notification for the doctor
            doctor_user = User.query.get(doctor.user_id)
            if doctor_user:
                formatted_date = appointment_date.strftime('%A, %B %d, %Y')
                formatted_time = appointment_time.strftime('%I:%M %p')
                
                doctor_notification = Notification(
                    user_id=doctor_user.id,
                    appointment_id=new_appointment.id,
                    message=f"New appointment request from {patient.name} for {formatted_date} at {formatted_time}.",
                    type="appointment_request"
                )
                db.session.add(doctor_notification)
            
            # Create notification for the patient
            patient_notification = Notification(
                user_id=patient.user_id,
                appointment_id=new_appointment.id,
                message=f"Your appointment request with Dr. {doctor.name} for {formatted_date} at {formatted_time} has been sent and is pending approval.",
                type="appointment_pending"
            )
            db.session.add(patient_notification)
            
            db.session.commit()
            
            flash('Appointment request sent! Waiting for doctor approval.', 'success')
            return redirect(url_for('dashboard'))
            
        except ValueError:
            flash('Invalid date or time format', 'danger')
        except SQLAlchemyError as e:
            db.session.rollback()
            app.logger.error(f"Appointment booking error: {str(e)}")
            flash('An error occurred while requesting the appointment', 'danger')
    
    # Get all doctors for selection
    doctors_list = Doctor.query.all()
    doctor_id = request.args.get('doctor_id')
    selected_doctor = None
    
    if doctor_id:
        selected_doctor = Doctor.query.get(doctor_id)
    
    return render_template(
        'book_appointment.html',
        doctors=doctors_list,
        selected_doctor=selected_doctor
    )

# Appointments route
@app.route('/appointments')
@login_required
def appointments():
    user_id = session.get('user_id')
    user_type = session.get('user_type')
    
    if user_type == 'doctor':
        doctor = Doctor.query.filter_by(user_id=user_id).first()
        if not doctor:
            flash('Doctor profile not found', 'danger')
            return redirect(url_for('dashboard'))
        
        appointments_list = Appointment.query.filter_by(doctor_id=doctor.id).all()
    else:
        patient = Patient.query.filter_by(user_id=user_id).first()
        if not patient:
            flash('Patient profile not found', 'danger')
            return redirect(url_for('dashboard'))
        
        appointments_list = Appointment.query.filter_by(patient_id=patient.id).all()
    
    return render_template('appointments.html', appointments=appointments_list, user_type=user_type)

# API routes for AJAX calls
@app.route('/api/doctors')
@login_required
def get_doctors():
    doctors_list = Doctor.query.all()
    doctors_data = []
    
    for doctor in doctors_list:
        doctors_data.append({
            'id': doctor.id,
            'name': doctor.name,
            'specialization': doctor.specialization,
            'address': doctor.address,
            'city': doctor.city,
            'state': doctor.state,
            'latitude': doctor.latitude,
            'longitude': doctor.longitude
        })
    
    return jsonify(doctors_data)

@app.route('/api/appointments/<int:appointment_id>', methods=['PUT'])
@login_required
def update_appointment_status(appointment_id):
    try:
        data = request.json
        new_status = data.get('status')
        notes = data.get('notes', '')
        
        if not new_status or new_status not in ['approved', 'rejected', 'scheduled', 'completed', 'cancelled']:
            return jsonify({'success': False, 'message': 'Invalid status'}), 400
        
        appointment = Appointment.query.get(appointment_id)
        if not appointment:
            return jsonify({'success': False, 'message': 'Appointment not found'}), 404
        
        # Check authorization
        user_id = session.get('user_id')
        user_type = session.get('user_type')
        old_status = appointment.status
        
        # Formatted date and time for notifications
        formatted_date = appointment.date.strftime('%A, %B %d, %Y')
        formatted_time = appointment.time.strftime('%I:%M %p')
        
        if user_type == 'doctor':
            doctor = Doctor.query.filter_by(user_id=user_id).first()
            if not doctor or appointment.doctor_id != doctor.id:
                return jsonify({'success': False, 'message': 'Not authorized'}), 403
            
            # Only doctors can approve or reject appointment requests
            patient = Patient.query.get(appointment.patient_id)
            
            # Handle status change for doctor
            if new_status == 'approved' and old_status == 'pending':
                # Update appointment and create notification for the patient
                patient_notification = Notification(
                    user_id=patient.user_id,
                    appointment_id=appointment.id,
                    message=f"Dr. {doctor.name} has approved your appointment for {formatted_date} at {formatted_time}.",
                    type="appointment_approved"
                )
                db.session.add(patient_notification)
                
            elif new_status == 'rejected' and old_status == 'pending':
                # Update appointment and create notification for the patient
                patient_notification = Notification(
                    user_id=patient.user_id,
                    appointment_id=appointment.id,
                    message=f"Dr. {doctor.name} has declined your appointment request for {formatted_date} at {formatted_time}. Reason: {notes}",
                    type="appointment_rejected"
                )
                db.session.add(patient_notification)
            
            elif new_status == 'completed' and old_status == 'scheduled':
                # Create notification for the patient about completed appointment
                patient_notification = Notification(
                    user_id=patient.user_id,
                    appointment_id=appointment.id,
                    message=f"Your appointment with Dr. {doctor.name} on {formatted_date} at {formatted_time} has been marked as completed.",
                    type="appointment_completed"
                )
                db.session.add(patient_notification)
                
        else:
            patient = Patient.query.filter_by(user_id=user_id).first()
            if not patient or appointment.patient_id != patient.id:
                return jsonify({'success': False, 'message': 'Not authorized'}), 403
            
            # Patients can only cancel appointments, not mark them completed/approved/rejected
            if new_status in ['completed', 'approved', 'rejected']:
                return jsonify({'success': False, 'message': f'Not authorized to mark appointment as {new_status}'}), 403
            
            # Handle cancellation by patient
            if new_status == 'cancelled' and old_status in ['pending', 'scheduled', 'approved']:
                doctor = Doctor.query.get(appointment.doctor_id)
                # Create notification for the doctor
                doctor_notification = Notification(
                    user_id=doctor.user_id,
                    appointment_id=appointment.id,
                    message=f"{patient.name} has cancelled their appointment for {formatted_date} at {formatted_time}. Reason: {notes}",
                    type="appointment_cancelled"
                )
                db.session.add(doctor_notification)
        
        # Update appointment status and notes
        appointment.status = new_status
        if notes:
            appointment.notes = notes
        
        db.session.commit()
        
        return jsonify({'success': True, 'message': f'Appointment {new_status} successfully'})
        
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"Appointment update error: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred while updating appointment'}), 500

# Error handlers
@app.errorhandler(404)
def page_not_found(e):
    return render_template('error.html', code=404, message='Page not found'), 404

@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', code=500, message='Server error'), 500


# Notifications route
@app.route('/notifications')
@login_required
def notifications():
    user_id = session.get('user_id')
    
    # Get all unread notifications for the user
    user_notifications = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).order_by(
        Notification.created_at.desc()
    ).all()
    
    # Get read notifications (limited to most recent 20)
    read_notifications = Notification.query.filter_by(
        user_id=user_id,
        is_read=True
    ).order_by(
        Notification.created_at.desc()
    ).limit(20).all()
    
    return render_template(
        'notifications.html',
        unread_notifications=user_notifications,
        read_notifications=read_notifications
    )


# API route to mark notification as read
@app.route('/api/notifications/<int:notification_id>/read', methods=['PUT'])
@login_required
def mark_notification_read(notification_id):
    try:
        notification = Notification.query.get(notification_id)
        
        if not notification:
            return jsonify({'success': False, 'message': 'Notification not found'}), 404
        
        # Check if notification belongs to the user
        user_id = session.get('user_id')
        if notification.user_id != user_id:
            return jsonify({'success': False, 'message': 'Not authorized'}), 403
        
        notification.is_read = True
        db.session.commit()
        
        return jsonify({'success': True})
        
    except SQLAlchemyError as e:
        db.session.rollback()
        app.logger.error(f"Notification update error: {str(e)}")
        return jsonify({'success': False, 'message': 'An error occurred'}), 500


# API route to get unread notification count
@app.route('/api/notifications/count')
@login_required
def get_notification_count():
    user_id = session.get('user_id')
    
    count = Notification.query.filter_by(
        user_id=user_id,
        is_read=False
    ).count()
    
    return jsonify({
        'count': count
    })
