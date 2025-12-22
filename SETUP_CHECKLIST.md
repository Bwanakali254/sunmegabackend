# MongoDB Setup Checklist ✅

Follow these steps in order to set up MongoDB for your project.

## Quick Setup (Choose One)

### ☐ Option A: MongoDB Atlas (Cloud - 5 minutes) ⭐ RECOMMENDED
- [ ] 1. Sign up at https://www.mongodb.com/cloud/atlas/register
- [ ] 2. Create free M0 cluster
- [ ] 3. Create database user (save password!)
- [ ] 4. Whitelist your IP address
- [ ] 5. Copy connection string
- [ ] 6. Update `.env` file with connection string
- [ ] 7. Test connection: `node test-connection.js`

### ☐ Option B: Local MongoDB (Windows - 15 minutes)
- [ ] 1. Download MongoDB from https://www.mongodb.com/try/download/community
- [ ] 2. Install MongoDB Community Server
- [ ] 3. Verify service is running: `Get-Service MongoDB`
- [ ] 4. Test connection: `mongosh`
- [ ] 5. Update `.env` file: `MONGODB_URI=mongodb://localhost:27017/sunmega`
- [ ] 6. Test connection: `node test-connection.js`

## Environment Setup

- [ ] 1. Copy `.env.example` to `.env`:
  ```bash
  cd backend
  copy .env.example .env
  ```
- [ ] 2. Update `.env` with your MongoDB connection string
- [ ] 3. Generate JWT secrets (minimum 32 characters):
  ```bash
  # You can use any random string generator
  # Or use Node.js:
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] 4. Update `JWT_SECRET` and `JWT_REFRESH_SECRET` in `.env`

## Test Your Setup

- [ ] 1. Run connection test:
  ```bash
  node test-connection.js
  ```
  Should show: ✅ MongoDB Connected Successfully!

- [ ] 2. Start the server:
  ```bash
  npm run dev
  ```
  Should show: [INFO] MongoDB Connected: ...

- [ ] 3. Test health endpoint:
  ```bash
  curl http://localhost:5000/health
  ```
  Or open in browser: http://localhost:5000/health

## Common Issues

### Connection Failed?
- ✅ Check `.env` file exists and has `MONGODB_URI`
- ✅ For Atlas: Check IP whitelist in Network Access
- ✅ For Local: Check MongoDB service is running
- ✅ Verify connection string format

### Still Having Issues?
- 📖 Read `MONGODB_SETUP.md` for detailed instructions
- 🔍 Check troubleshooting section
- 💬 Verify your connection string format

## Next Steps

Once MongoDB is connected:
- ✅ Proceed to Phase 2: Authentication System
- ✅ Database collections will auto-create when needed

---

**Status**: ☐ Not Started | ⏳ In Progress | ✅ Complete

