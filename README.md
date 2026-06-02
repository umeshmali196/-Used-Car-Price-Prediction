# Used Car Price Prediction and Marketplace

## 📌 Overview

A full-stack web application for predicting used-car prices, storing valuation history, 
creating car listings, and managing users/listings from an admin dashboard. 
The project combines a React + Vite frontend with a Flask backend, SQLite storage, and a Python price prediction model.

## ✨ Features

- User signup, login, and protected dashboard access
- Admin signup/login with admin-only dashboard
- Used-car price prediction based on year, KM driven, brand, fuel type, transmission, owner type, mileage, engine, power, city, insurance, accident history, service history, and inspection inputs
- Inspection score calculation for value adjustment
- Market price comparison with `Low`, `Fair`, and `High` price labels
- Prediction history saved per user
- CSV export for valuation history
- Marketplace listing creation from a valuation result
- Marketplace filters by brand, city, fuel, and price
- Favorite listings saved in browser local storage
- Admin analytics for users, predictions, listings, brands, fuel mix, and city-wise pricing
- Admin controls to block/unblock users and approve/block listings
- Printable valuation report view

## 🛠️ Tech Stack

### 🎨 Frontend

- React
- Vite
- React Router
- Axios
- Recharts
- Tailwind CSS

### ⚙️ Backend

- Python
- Flask
- Flask-CORS
- SQLite
- Werkzeug password hashing
- Pickle-based ML model loading
### 🤖 Machine Learning

- Custom `SimpleCarPriceModel` fallback model
- Model stored as `backend/model.pkl`
- Training/bootstrap script in `ml/train_model.py`

## 📂 Project Structure

```text
.
├── backend/
│   ├── app.py                 # Flask API server
│   ├── requirements.txt       # Backend Python dependencies
│   ├── simple_model.py        # Rule-based car price model
│   ├── model.pkl              # Serialized model file
│   ├── database.db            # SQLite database
│   └── templates/
│       └── index.html         # Basic Flask form page
├── frontend/
│   ├── src/
│   │   ├── App.jsx            # App routes
│   │   ├── Dashboard.jsx      # User dashboard
│   │   ├── AdminDashboard.jsx # Admin dashboard
│   │   ├── AuthPage.jsx       # User auth page
│   │   ├── AdminAuthPage.jsx  # Admin auth page
│   │   ├── api.js             # Axios API client
│   │   └── auth.jsx           # Auth context
│   ├── package.json           # Frontend scripts and dependencies
│   └── vite.config.js         # Vite config
├── ml/
│   ├── train_model.py         # Generates backend/model.pkl
│   └── train_model.ipynb      # Notebook version
├── generate_problem_pdf.py
├── Used_Car_Project_Problem_Solves.pdf
└── README.md
```

## 📋 Prerequisites

Install these before running the project:

- Python 3.10 or newer
- Node.js 18 or newer
- npm

## 🚀 Backend Setup

Open a terminal in the project root and run:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The Flask server will start at:

```text
http://127.0.0.1:5000
```

Health check endpoint:

```text
http://127.0.0.1:5000/api/health
```

## 🌐 Frontend Setup

Open a second terminal in the project root and run:

```bash
cd frontend
npm install
npm run dev
```

The Vite app will usually start at:

```text
http://localhost:5173
```
## 🔐 Environment Variables

The backend works with default values for local development, but these should be configured before deployment.

Create environment variables as needed:

```env
JWT_SECRET=replace-with-a-secure-secret
JWT_EXPIRY_HOURS=24
ADMIN_EMAILS=admin@example.com
CLIENT_ORIGIN=http://localhost:5173
```

For the frontend, create `frontend/.env` if your API URL is different:

```env
VITE_API_URL=http://127.0.0.1:5000/api
```

## ▶️ Running the Full Application

1. Start the backend:

```bash
cd backend
python app.py
```

2. Start the frontend:

```bash
cd frontend
npm run dev
```

3. Open the frontend URL in your browser.

4. Create a user account from `/signup`.

5. Create an admin account from `/admin-signup`.

6. Use `/dashboard` for valuation and marketplace features.

7. Use `/admin` for admin analytics and management.

## 🔗 API Endpoints


### 🌍 Public Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/health` | Check backend status |
| POST | `/api/auth/signup` | Register a user |
| POST | `/api/auth/login` | Login a user |
| POST | `/api/admin/auth/signup` | Register an admin |
| POST | `/api/admin/auth/login` | Login an admin |

### 👤 Authenticated User Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/auth/me` | Get current user |
| GET | `/api/model-info` | Get model information |
| POST | `/api/predict` | Predict used-car price |
| GET | `/api/history` | Get valuation history |
| GET | `/api/history/export` | Export history as CSV |
| DELETE | `/api/history/<id>` | Delete a prediction |
| GET | `/api/listings` | View marketplace listings |
| POST | `/api/listings` | Create a marketplace listing |

### 🛡️ Admin Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/admin/summary` | Get admin dashboard metrics |
| PATCH | `/api/admin/users/<id>/status` | Block or unblock a user |
| PATCH | `/api/admin/listings/<id>/status` | Update listing status |


## 🧠 Model Details

The project uses `SimpleCarPriceModel` as a local fallback prediction model. It estimates a used-car price from:

- Vehicle age
- KM driven
- Brand/company category
- Fuel type
- Transmission
- Owner type
- Mileage
- Engine capacity
- Power
- Inspection score adjustments
- Market context such as city, insurance, accident history, and service history

To regenerate the model file:

```bash
python ml/train_model.py
```

This saves a fresh model to:

```text
backend/model.pkl
```
## 🏗️ Build Commands

Frontend production build:

```bash
cd frontend
npm run build
```

Frontend lint:

```bash
cd frontend
npm run lint
```

Backend run:

```bash
cd backend
python app.py
```
## 📤 GitHub Upload Notes

Before uploading to GitHub, avoid committing generated or local files such as:

- `frontend/node_modules/`
- `frontend/dist/`
- `.venv/`
- `__pycache__/`
- `*.log`
- Local database files if you do not want to share sample data, such as `backend/database.db`

## 🚫 Recommended .gitignore

```gitignore
# Python
__pycache__/
*.pyc
.venv/
venv/

# Flask/local data
*.log
backend/database.db

# Node/Vite
frontend/node_modules/
frontend/dist/
frontend/.env

# Environment files
.env
```

Basic GitHub commands:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/your-username/your-repository-name.git
git push -u origin main
```

## 📈 Future Improvements


- Replace the fallback model with a trained machine learning model using a real used-car dataset
- Add image upload storage for car photos and documents
- Add email notifications for valuation and marketplace events
- Add pagination and search for listings and admin tables
- Add test coverage for backend API routes
- Add deployment configuration for Render, Railway, Vercel, or Docker

## License

This project is available for educational and portfolio use. Add a license file before publishing if you want to define exact usage rights.
