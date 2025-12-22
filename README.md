# Sun Mega Limited - Backend API

E-commerce backend API for Sun Mega Limited solar products platform.

## 🚀 Quick Start

### Prerequisites
- Node.js v18+ 
- MongoDB (local or Atlas)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file from `.env.example`:
```bash
cp .env.example .env
```

3. Update `.env` with your configuration:
- MongoDB connection string
- JWT secrets
- Email credentials
- Payment gateway keys

4. Start development server:
```bash
npm run dev
```

5. Server will run on `http://localhost:5000`

## 📁 Project Structure

```
backend/
├── config/          # Configuration files
├── controllers/     # Route controllers
├── middleware/      # Custom middleware
├── models/         # Mongoose models
├── routes/         # API routes
├── services/       # Business logic services
├── utils/          # Utility functions
├── tests/          # Test files
└── server.js       # Entry point
```

## 🔌 API Endpoints

See `API_ENDPOINTS_SUMMARY.md` for complete API documentation.

## 🔒 Security Features

- JWT Authentication
- Password hashing (bcrypt)
- Rate limiting
- Input validation
- XSS protection
- CORS configuration
- Security headers (Helmet)

## 📝 Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## 🌍 Environment Variables

See `.env.example` for all required environment variables.

## 📚 Development Phases

- ✅ Phase 1: Project Setup (Current)
- ⏳ Phase 2: Authentication System
- ⏳ Phase 3: Product Management
- ⏳ Phase 4: Cart & Order Management
- ⏳ Phase 5: Payment Integration
- ⏳ Phase 6: Additional Features
- ⏳ Phase 7: Security & Optimization
- ⏳ Phase 8: Testing & Documentation

## 📄 License

ISC

