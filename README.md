# St. Rupert Clinic Appointment System Backend

This is the **backend API** for the St. Rupert Medical Clinic Appointment System. It provides RESTful endpoints for appointment booking, user authentication, admin dashboard analytics, and email notifications.

## Features

- RESTful API for appointment creation, management, and status updates
- Admin authentication and role-based access
- Email notifications for appointment verification and confirmation
- Time slot and schedule management
- Analytics endpoints for dashboard insights (e.g., completion rates, most common procedures)
- Secure password verification for admin actions
- CORS and environment-based configuration

## Tech Stack

- **Backend**:
  - Node.js
  - Express.js for REST API
  - Nodemailer for sending emails (verification, notifications)
  - JWT for authentication and session management
  - dotenv for environment variable management
  - CORS for cross-origin requests
- **Database**:
  - PostgreSQL (or MySQL, depending on deployment)
  - Sequelize ORM for database modeling and queries
- **Other**:
  - Deployed on Heroku, AWS, or similar platforms (configurable)
  - API documentation via OpenAPI/Swagger (if provided)

## Setup

### Prerequisites

- Node.js (v16 or higher)
- npm
- PostgreSQL or MySQL database

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd st-rupert-clinic-appointment-system-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the root directory and configure the following environment variables:
   ```bash
      EMAIL_USER=yourkey
      EMAIL_PASS=yourkey
      PAYMONGO_SECRET_KEY=yourkey
      PORT=3000
      SUPABASE_URL=yourkey
      SUPABASE_KEY=yourkey
   ```

4. Run database migrations and seeders if available.

5. Start the backend server:
   ```bash
   npm run dev
   ```

   The API will be available at `http://localhost:5000`.

### Deployment

- Deploy to your preferred cloud provider (Heroku, AWS, etc.).
- Ensure environment variables are set in your deployment environment.
- Make sure the frontend is configured to use the correct backend URL.

## Frontend Repository

The frontend for this project is available at:  
[https://github.com/kenny2125/st-rupert-clinic-appointment-system](https://github.com/kenny2125/st-rupert-clinic-appointment-system)

## License

This project is licensed under the MIT License. See the `LICENSE` file for details.
