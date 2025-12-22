# MongoDB Setup Guide

This guide covers two options: **MongoDB Atlas (Cloud - Recommended)** and **Local MongoDB Installation**.

---

## Option 1: MongoDB Atlas (Cloud) - RECOMMENDED ⭐

MongoDB Atlas is free, cloud-hosted, and perfect for development and production.

### Step 1: Create MongoDB Atlas Account

1. Go to https://www.mongodb.com/cloud/atlas/register
2. Sign up with your email (or use Google/GitHub)
3. Verify your email address

### Step 2: Create a Free Cluster

1. After login, click **"Build a Database"**
2. Choose **"M0 FREE"** (Free tier - perfect for development)
3. Select **Cloud Provider**: AWS (or Azure/GCP)
4. Select **Region**: Choose closest to you (e.g., `eu-west-1` for Europe, `us-east-1` for US)
5. Click **"Create"** (takes 3-5 minutes)

### Step 3: Create Database User

1. In the **"Database Access"** section (left sidebar)
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Enter:
   - **Username**: `sunmega-admin` (or your choice)
   - **Password**: Generate a strong password (click "Autogenerate Secure Password" and **SAVE IT**)
5. Set **User Privileges**: "Atlas admin" (or "Read and write to any database")
6. Click **"Add User"**

### Step 4: Whitelist Your IP Address

1. In the **"Network Access"** section (left sidebar)
2. Click **"Add IP Address"**
3. For development, click **"Add Current IP Address"**
4. For production, you can add **"Allow Access from Anywhere"** (0.0.0.0/0) - **Only for production!**
5. Click **"Confirm"**

### Step 5: Get Connection String

1. Go to **"Database"** section (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select **Driver**: Node.js
5. Select **Version**: 5.5 or later
6. Copy the connection string (looks like):
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```

### Step 6: Update Your .env File

1. Open `backend/.env` (create from `.env.example` if not exists)
2. Replace the connection string:
   ```env
   MONGODB_URI=mongodb+srv://sunmega-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/sunmega?retryWrites=true&w=majority
   ```
   Replace:
   - `sunmega-admin` with your username
   - `YOUR_PASSWORD` with your actual password (URL encode special characters)
   - `cluster0.xxxxx` with your cluster name
   - `sunmega` is the database name (you can change this)

**Important**: If your password has special characters, URL encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`

### Step 7: Test Connection

```bash
cd backend
npm run dev
```

You should see:
```
[INFO] MongoDB Connected: cluster0-shard-00-00.xxxxx.mongodb.net:27017
[INFO] Server running in development mode on port 5000
```

✅ **Done!** Your MongoDB Atlas is ready.

---

## Option 2: Local MongoDB Installation (Windows)

### Step 1: Download MongoDB Community Server

1. Go to https://www.mongodb.com/try/download/community
2. Select:
   - **Version**: Latest (7.0+)
   - **Platform**: Windows
   - **Package**: MSI
3. Click **"Download"**

### Step 2: Install MongoDB

1. Run the downloaded `.msi` file
2. Click **"Next"** through the setup wizard
3. Choose **"Complete"** installation
4. Check **"Install MongoDB as a Service"**
5. Service Name: `MongoDB`
6. Check **"Run service as Network Service user"**
7. **Uncheck** "Install MongoDB Compass" (optional GUI tool)
8. Click **"Install"**
9. Wait for installation to complete
10. Click **"Finish"**

### Step 3: Verify Installation

1. Open **Command Prompt** or **PowerShell** as Administrator
2. Check if MongoDB service is running:
   ```powershell
   Get-Service MongoDB
   ```
   Should show: `Running`

3. If not running, start it:
   ```powershell
   Start-Service MongoDB
   ```

### Step 4: Test MongoDB Connection

1. Open a new terminal
2. Connect to MongoDB:
   ```bash
   mongosh
   ```
   Or if `mongosh` is not found:
   ```bash
   mongo
   ```

3. You should see:
   ```
   Current Mongosh Log ID: ...
   Connecting to: mongodb://127.0.0.1:27017/?directConnection=true&serverSelectionTimeoutMS=2000
   Using MongoDB: 7.0.x
   Using Mongosh: 1.x.x
   ```

4. Test with:
   ```javascript
   db.version()
   ```
   Should return MongoDB version.

5. Exit:
   ```javascript
   exit
   ```

### Step 5: Update Your .env File

1. Open `backend/.env`
2. Set:
   ```env
   MONGODB_URI=mongodb://localhost:27017/sunmega
   ```

### Step 6: Test Connection from Backend

```bash
cd backend
npm run dev
```

You should see:
```
[INFO] MongoDB Connected: localhost:27017
[INFO] Server running in development mode on port 5000
```

✅ **Done!** Your local MongoDB is ready.

---

## Troubleshooting

### MongoDB Atlas Connection Issues

**Error: "MongoServerError: bad auth"**
- Check username and password in connection string
- Make sure password is URL encoded
- Verify database user exists in Atlas

**Error: "MongoServerError: IP not whitelisted"**
- Go to Network Access in Atlas
- Add your current IP address
- Wait 1-2 minutes for changes to propagate

**Error: "MongoNetworkError: connection timeout"**
- Check your internet connection
- Verify firewall isn't blocking MongoDB ports
- Try connecting from a different network

### Local MongoDB Issues

**Error: "MongoServerError: connection refused"**
- Check if MongoDB service is running:
  ```powershell
  Get-Service MongoDB
  ```
- Start the service:
  ```powershell
  Start-Service MongoDB
  ```

**Error: "mongosh: command not found"**
- MongoDB Shell might not be in PATH
- Use full path: `C:\Program Files\MongoDB\Server\7.0\bin\mongosh.exe`
- Or reinstall MongoDB and check "Add to PATH" option

**Error: "Port 27017 already in use"**
- Another MongoDB instance might be running
- Check running processes:
  ```powershell
  Get-Process | Where-Object {$_.ProcessName -like "*mongo*"}
  ```
- Stop conflicting services

### General Connection Issues

**Error: "MongooseError: Operation timed out"**
- Check `MONGODB_URI` in `.env` is correct
- Verify MongoDB is accessible (Atlas: check IP whitelist, Local: check service)
- Check firewall settings

**Error: "ENOTFOUND" or "ECONNREFUSED"**
- Verify connection string format
- For Atlas: Check cluster is running (not paused)
- For Local: Check MongoDB service is running

---

## Quick Test Script

Create `backend/test-connection.js`:

```javascript
require('dotenv').config()
const mongoose = require('mongoose')

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB Connected Successfully!')
    console.log('Database:', mongoose.connection.name)
    console.log('Host:', mongoose.connection.host)
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ MongoDB Connection Failed:', error.message)
    process.exit(1)
  })
```

Run:
```bash
node test-connection.js
```

---

## Recommendation

**For Development**: Use **MongoDB Atlas (Free Tier)** - No installation needed, works anywhere, free forever.

**For Production**: Use **MongoDB Atlas (Paid Tier)** - Better performance, backups, monitoring.

**For Learning**: Use **Local MongoDB** - Full control, no internet needed.

---

## Next Steps

Once MongoDB is connected:

1. ✅ Test connection with `npm run dev`
2. ✅ Proceed to Phase 2: Authentication System
3. ✅ Database will auto-create collections when you start using models

---

**Need Help?** Check MongoDB documentation:
- Atlas: https://docs.atlas.mongodb.com/
- Local: https://docs.mongodb.com/manual/installation/

