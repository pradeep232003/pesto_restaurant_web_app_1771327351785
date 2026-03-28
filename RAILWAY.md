# Jolly's Kafe - Railway Deployment Guide

## Quick Deploy

1. Push this repo to GitHub
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Railway will auto-detect the `Dockerfile` and build

## Required Environment Variables

Set these in Railway dashboard → your service → Variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URL` | Yes | MongoDB connection string (add Railway's MongoDB plugin or use MongoDB Atlas) |
| `DB_NAME` | Yes | Database name, e.g. `pesto_restaurant` |
| `JWT_SECRET` | Yes | Random secret for JWT tokens. Generate with: `openssl rand -hex 32` |
| `ADMIN_EMAIL` | Yes | Admin login email, e.g. `admin@jollys.com` |
| `ADMIN_PASSWORD` | Yes | Admin login password, e.g. `Admin123!` |
| `RESEND_API_KEY` | No | For email notifications (order ready, receipts) |
| `SENDER_EMAIL` | No | Sender email for Resend, default: `onboarding@resend.dev` |
| `TWILIO_ACCOUNT_SID` | No | For SMS notifications |
| `TWILIO_AUTH_TOKEN` | No | Twilio auth token |
| `TWILIO_PHONE_NUMBER` | No | Twilio sender phone number |
| `PORT` | Auto | Railway sets this automatically |

## Adding MongoDB

Option A: **Railway MongoDB Plugin**
- In your Railway project, click "+ New" → "Database" → "MongoDB"
- Copy the `MONGO_URL` from the plugin variables and add to your service

Option B: **MongoDB Atlas** (free tier available)
- Create a cluster at [mongodb.com/atlas](https://www.mongodb.com/atlas)
- Get connection string and set as `MONGO_URL`

## What Gets Deployed

- **Frontend**: React app built and served as static files via FastAPI
- **Backend**: FastAPI on the `PORT` Railway assigns
- **Database**: External MongoDB (not included in the Docker image)

## Health Check

The app exposes `/api/health` for Railway's health checks (configured in `railway.toml`).
