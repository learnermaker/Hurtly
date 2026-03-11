# BodyTrace

An interactive health intelligence platform for tracking and analyzing pain symptoms over time.

## Overview

BodyTrace is a comprehensive health tracking application that allows users to:
- Record pain locations on an interactive 3D body model
- Characterize symptoms with detailed descriptors
- Track symptom progression over time
- Generate insight reports with patterns and trends
- Export data for healthcare providers

## Features

- **Interactive 3D Body Model**: Click or drag on a 3D human figure to mark pain locations
- **Symptom Characterization**: Detailed pain type, intensity, frequency, and duration tracking
- **AI-Powered Follow-ups**: Context-aware questions based on symptom patterns
- **Timeline View**: Chronological visualization of symptom progression
- **Insight Reports**: Automated analysis of patterns, trends, and intensity changes
- **Accessibility**: Full keyboard navigation and screen reader support
- **Offline Support**: Continue tracking even without internet connection
- **Security**: AES-256 encryption, TLS 1.2+, and comprehensive audit logging

## Tech Stack

### Frontend
- React 19 + TypeScript
- Three.js for 3D rendering
- Vite for build tooling
- Vitest for testing

### Backend
- Node.js + Express
- PostgreSQL database
- TypeScript
- Property-based testing with fast-check

### Testing
- 393 total tests (232 backend + 161 frontend)
- Unit tests and integration tests
- Property-based tests for correctness validation

## Project Structure

```
bodytrace/
├── frontend/          # React frontend application
│   ├── src/
│   │   ├── components/    # UI components
│   │   ├── services/      # API client and utilities
│   │   └── __tests__/     # Test files
├── backend/           # Node.js backend API
│   ├── src/
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── middleware/    # Auth and logging
│   │   ├── db/           # Database migrations
│   │   └── __tests__/    # Test files
├── shared/            # Shared TypeScript types
└── package.json       # Workspace configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- PostgreSQL 14+
- Git

### Installation

1. Clone the repository:
```bash
git clone https://github.com/learnermaker/bodytrace.git
cd bodytrace
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
# Create PostgreSQL database
createdb bodytrace

# Run migrations
cd backend
npm run migrate
```

4. Configure environment variables:
```bash
# Create .env file in backend directory
cp backend/.env.example backend/.env

# Edit backend/.env with your database credentials:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=bodytrace
DB_USER=postgres
DB_PASSWORD=your_password
```

5. Start the development servers:
```bash
# Terminal 1 - Backend
npm run dev:backend

# Terminal 2 - Frontend
npm run dev:frontend
```

6. Open your browser to `http://localhost:5173`

## Running Tests

```bash
# Run all tests
npm test

# Run backend tests only
npm test --workspace=backend

# Run frontend tests only
npm test --workspace=frontend
```

## Database Setup

The application requires PostgreSQL. Run the migration script to create the necessary tables:

```bash
cd backend
node src/db/run-migration.ts
```

Or manually run the SQL migration:
```bash
psql -U postgres -d bodytrace -f backend/src/db/migrations/001_initial_schema.sql
```

## API Documentation

The backend exposes a REST API with the following endpoints:

- `POST /api/pain-sessions` - Create a new pain tracking session
- `GET /api/pain-sessions/:id` - Retrieve a session
- `POST /api/pain-sessions/:id/markers` - Add pain markers
- `GET /api/body-map/:userId` - Get complete body map
- `POST /api/body-map/:userId/filter` - Filter markers
- `GET /api/timeline/:userId/region/:regionId` - Get timeline data
- `POST /api/insight-reports/:userId` - Generate insight report
- `POST /api/insight-reports/:userId/export` - Export report as PDF

All endpoints require authentication via Bearer token.

## Security Features

- **Encryption**: AES-256-GCM for data at rest
- **Authentication**: Token-based authentication on all endpoints
- **TLS**: TLS 1.2+ for data in transit
- **Audit Logging**: Comprehensive logging without sensitive content
- **Data Deletion**: Complete user data removal on request

## Accessibility

BodyTrace follows WCAG 2.1 Level AA guidelines:
- Full keyboard navigation support
- Screen reader compatibility
- Text-based alternatives for 3D interactions
- Proper ARIA labels and semantic HTML
- Sufficient color contrast ratios
- Minimum touch target sizes (44x44px)

## Property-Based Testing

The application uses property-based testing to validate correctness properties:
- 25 correctness properties defined
- Automated testing with fast-check library
- Properties cover data integrity, security, and functional equivalence

## Contributing

This is a demonstration project. If you'd like to contribute:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

This project is private and not licensed for public use.

## Disclaimer

This application is for informational purposes only and does not constitute medical advice. Always consult with qualified healthcare professionals for medical concerns.

## Support

For questions or issues, please open an issue on GitHub.
