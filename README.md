# Dr. Ratish Juyal Neuro & Spine Clinic Management System

A production-ready clinic appointment and management web app for **Dr. Ratish Juyal** (DM Neurology, KGMU Lucknow) and integrated **Neuro-Physiotherapy** rehabilitation services.

Features include:
- **Patient Online Booking & Appointment Scheduling** (OPD Timings: 12:00 PM – 05:00 PM)
- **Specialist Profiles:** Dr. Ratish Juyal (Senior Consultant Neurologist) & Dr. Amit K. Sharma (Neuro-Physiotherapist)
- **Digital Prescription Writing Pad:** Stylus / Apple Pencil pressure-sensitive canvas drawing with live cloud auto-save and external companion tablet connection (`/pad/[id]`)
- **Backend & Real-Time Sync:** Firebase (Cloud Firestore, Auth, Storage) with offline-safe fallbacks
- **Prescription PDF Generation:** Digitally signed prescriptions with embedded handwritten pad notes
- **Clinic Administration & Doctor Portal:** Manage schedules, consultation records, and patients

---

## Tech Stack
- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (Strict)
- **Styling:** Tailwind CSS 4
- **Database & Sync:** Firebase (Firestore, Auth, Storage)
- **Deployment Target:** Vercel

---

## Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Configure environment variables
# Copy .env.example to .env.local and enter your Firebase credentials
cp .env.example .env.local

# 3. Seed initial clinic data to Firebase (optional)
npm run seed:firebase

# 4. Run local development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the clinic web app.

---

## Vercel Deployment Guide

### Step 1: Push Code to GitHub
Ensure all code is pushed to your GitHub repository:
```bash
git add .
git commit -m "Deploy Dr. Ratish Juyal Clinic Management System with Firebase"
git branch -M main
git push -u origin main
```

### Step 2: Import into Vercel
1. Login to [Vercel](https://vercel.com).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository: `Anku9991/Dr-Ratish-Juyal-Cllinic`.
4. Framework Preset will automatically be detected as **Next.js**.

### Step 3: Add Environment Variables in Vercel
Under the **Environment Variables** section in the Vercel project settings, add the following variables:

| Variable Name | Value |
|---|---|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | `AIzaSyDVQ-zbMl2R_IH3T7Wm4lncNyeKf3iwMXU` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | `dr-ratish-juyal-clinic.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | `dr-ratish-juyal-clinic` |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | `dr-ratish-juyal-clinic.firebasestorage.app` |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | `103748510830` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | `1:103748510830:web:3ebfd1a72c7ff14f0c727f` |
| `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID` | `G-EKNC6S9YDC` |
| `NEXT_PUBLIC_APP_URL` | `https://your-project-name.vercel.app` (or your custom domain) |
| `CRON_SECRET` | Generate any random string or secure token |
| `RAZORPAY_KEY_ID` | (Optional: Razorpay Key ID) |
| `RAZORPAY_KEY_SECRET` | (Optional: Razorpay Key Secret) |
| `RAZORPAY_WEBHOOK_SECRET` | (Optional: Razorpay Webhook Secret) |

### Step 4: Deploy
Click **Deploy**. Vercel will build and deploy the Next.js application live on a secure HTTPS URL.

---

## Firebase Console Setup
1. Open the [Firebase Console](https://console.firebase.google.com/) and navigate to project `dr-ratish-juyal-clinic`.
2. Go to **Firestore Database** > Click **Create database**.
3. Choose your nearest location (e.g. `asia-south1` Mumbai) and start in Test or Production mode.
4. Go to **Rules** and configure permissions for read/write access.
