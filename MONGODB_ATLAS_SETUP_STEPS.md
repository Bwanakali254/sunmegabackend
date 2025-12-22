# MongoDB Atlas M10 Setup - Step by Step Guide

## ✅ Step-by-Step Setup Instructions

### Step 1: Choose Cluster Tier

**Select: M10** ($0.09/hour = ~$57/month)
- ✅ Dedicated cluster for production
- ✅ 10 GB storage (enough for e-commerce)
- ✅ 2 GB RAM
- ✅ 2 vCPUs
- ✅ Automated backups included
- ✅ 99.95% SLA

**DO NOT select:**
- ❌ Flex - Shared resources, not for production
- ❌ Free - Too limited for production

---

### Step 2: Cluster Name

**Name**: `Cluster0` (or `sunmega-production`)

**Recommendation**: 
- Keep `Cluster0` if this is your first cluster
- Or use `sunmega-production` to be more descriptive
- You can't change this later, but it's just a label

---

### Step 3: Cloud Provider

**Choose: AWS** (Recommended)
- Most widely used
- Best performance
- Most regions available

**Alternative options:**
- GCP (Google Cloud) - Also good
- Azure - Good if you use Microsoft services

**Recommendation**: **AWS** is the safest choice.

---

### Step 4: Region Selection

**Current Selection**: Bahrain (me-south-1)

**IMPORTANT**: Choose the region closest to your users!

**For Kenya/East Africa:**
- ✅ **eu-west-1** (Ireland) - Recommended for East Africa
- ✅ **eu-central-1** (Frankfurt) - Good alternative
- ✅ **af-south-1** (Cape Town) - Closest, but newer region

**Why Region Matters:**
- Lower latency = faster database queries
- Better user experience
- Lower data transfer costs

**Recommendation**: 
- If serving Kenya/East Africa: **eu-west-1 (Ireland)** or **af-south-1 (Cape Town)**
- If serving globally: **us-east-1 (N. Virginia)** or **eu-west-1 (Ireland)**

**To Change Region:**
1. Click on the region dropdown
2. Search for "Ireland" or "Frankfurt" or "Cape Town"
3. Select the region

---

### Step 5: Tags (Optional)

**Skip for now** - You can add tags later to organize resources.

---

### Step 6: Quick Setup Options

#### ✅ "Automate security setup" - **CHECK THIS BOX**

This will:
- Create a database user automatically
- Set up IP whitelist
- Generate connection string
- Save you time!

#### ❌ "Preload sample dataset" - **UNCHECK THIS**

You don't need sample data for production.

---

### Step 7: Create Cluster

1. Review your selections:
   - ✅ M10 tier
   - ✅ AWS provider
   - ✅ Region (closest to users)
   - ✅ Cluster name
   - ✅ Automate security setup (checked)

2. Click **"Create Cluster"** button

3. Wait 3-5 minutes for cluster to be created

---

## After Cluster Creation

### Step 8: Security Setup (If you checked "Automate security setup")

You'll be prompted to:

1. **Create Database User:**
   - Username: `sunmega-admin` (or your choice)
   - Password: **Generate secure password** (click "Autogenerate Secure Password")
   - **SAVE THE PASSWORD** - You'll need it!
   - Click "Create Database User"

2. **Network Access:**
   - Click "Add My Current IP Address"
   - For production, you'll also need to add your server's IP
   - Click "Finish and Close"

3. **Connection String:**
   - You'll see a connection string
   - Copy it - you'll need it for your `.env` file

---

### Step 9: Get Connection String (If not shown)

1. Go to **"Database"** section (left sidebar)
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Select:
   - **Driver**: Node.js
   - **Version**: 5.5 or later
5. Copy the connection string

It looks like:
```
mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

---

### Step 10: Update Your .env File

1. Open `backend/.env` (create from `.env.example` if needed)

2. Update the connection string:
   ```env
   MONGODB_URI=mongodb+srv://sunmega-admin:YOUR_PASSWORD@cluster0.xxxxx.mongodb.net/sunmega?retryWrites=true&w=majority
   ```

3. Replace:
   - `sunmega-admin` with your actual username
   - `YOUR_PASSWORD` with your actual password
   - `cluster0.xxxxx` with your actual cluster name
   - `sunmega` is your database name (you can change this)

**Important**: If password has special characters, URL encode them:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`

---

### Step 11: Test Connection

Run the test script:
```bash
cd backend
node test-connection.js
```

You should see:
```
✅ MongoDB Connected Successfully!
Database: sunmega
Host: cluster0-shard-00-00.xxxxx.mongodb.net
```

---

## Configuration Summary

### ✅ Recommended Settings:

| Setting | Value | Why |
|---------|-------|-----|
| **Tier** | M10 | Production-ready, backups, SLA |
| **Provider** | AWS | Most reliable, best performance |
| **Region** | eu-west-1 (Ireland) or af-south-1 (Cape Town) | Closest to Kenya/East Africa |
| **Cluster Name** | Cluster0 or sunmega-production | Your choice |
| **Automate Security** | ✅ Yes | Saves time, sets up properly |
| **Sample Dataset** | ❌ No | Not needed for production |

---

## Cost Information

**M10 Pricing:**
- $0.09/hour
- ~$65/month (if running 24/7)
- Billed hourly (you can pause to save money)
- First month might have credits/discounts

**What You Get:**
- 10 GB storage
- 2 GB RAM
- 2 vCPUs
- Automated daily backups
- 99.95% uptime SLA
- Performance monitoring

---

## Important Notes

1. **Don't pause the cluster** - Production needs to run 24/7
2. **Save your password** - Store it securely, you'll need it
3. **IP Whitelist** - Add your server IP when deploying
4. **Backups** - Enabled automatically with M10
5. **Monitoring** - Check cluster performance in Atlas dashboard

---

## Troubleshooting

### Connection Issues?
- Check IP whitelist in Network Access
- Verify username/password in connection string
- Ensure password is URL encoded if it has special characters

### Can't find connection string?
- Go to Database → Connect → Connect your application
- Select Node.js driver

### Wrong region?
- You can create a new cluster in the correct region
- Or contact support (though region change isn't always possible)

---

## Next Steps After Setup

1. ✅ Test connection: `node test-connection.js`
2. ✅ Start server: `npm run dev`
3. ✅ Verify connection in server logs
4. ✅ Proceed to Phase 2: Authentication

---

**Ready to create? Follow the steps above!** 🚀

