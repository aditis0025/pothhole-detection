# Cevic-Aegis — AI-Powered Road Pothole Detection

Cevic-Aegis is an AI-powered computer vision system designed to automatically detect potholes and road damage from images using deep learning.

The system uses a YOLO-based object detection model to identify road potholes, process uploaded images, and return visual detection results through a web-based interface.

---

## 🚧 Project Overview

Road damage and potholes are major problems for road safety, vehicle maintenance, and urban infrastructure management. Traditional road inspection methods are often manual, time-consuming, and difficult to scale.

**Cevic-Aegis** aims to automate this process using Artificial Intelligence and Computer Vision.

A user can upload an image of a road through the web interface. The backend processes the image using a trained YOLO object detection model and returns the detected potholes along with their locations and severity information.

### Basic Workflow

```text
User
  │
  ▼
Web Interface
  │
  │ Upload Road Image
  ▼
FastAPI Backend
  │
  ▼
Image Processing
  │
  ▼
YOLO Object Detection Model
  │
  ▼
Pothole Detection
  │
  ▼
Severity Analysis
  │
  ▼
Detection Result
  │
  ▼
Frontend Visualization
