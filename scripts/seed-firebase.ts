/**
 * Firebase Firestore Seeder for Dr. Ratish Juyal Clinic
 * Run with: npx tsx scripts/seed-firebase.ts
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDVQ-zbMl2R_IH3T7Wm4lncNyeKf3iwMXU",
  authDomain: "dr-ratish-juyal-clinic.firebaseapp.com",
  projectId: "dr-ratish-juyal-clinic",
  storageBucket: "dr-ratish-juyal-clinic.firebasestorage.app",
  messagingSenderId: "103748510830",
  appId: "1:103748510830:web:3ebfd1a72c7ff14f0c727f",
  measurementId: "G-EKNC6S9YDC"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);

async function main() {
  console.log("-------------------------------------------------------------------");
  console.log("Seeding Dr. Ratish Juyal Clinic to Firebase Firestore Console...");
  console.log("Project: dr-ratish-juyal-clinic");
  console.log("-------------------------------------------------------------------");

  try {
    // 1. Clinic Settings
    console.log("1. Setting clinic_settings/main_clinic...");
    await setDoc(doc(db, "clinic_settings", "main_clinic"), {
      clinic_name: "Dr. Ratish Juyal Neuro & Spine Clinic",
      address: "M3/460, Sector H, LDA Colony (Near Power House Crossing) & Aashiyana / Medanta OPD, Lucknow, UP 226012",
      phone: "+91 94500 56789",
      email: "care@drratishjuyal.com",
      prescription_footer: "Dr. Ratish Juyal | DM (Neurology, KGMU), MD (Medicine) | Senior Consultant Neurologist, Lucknow | Tel: +91 94500 56789",
      timezone: "Asia/Kolkata",
      cancellation_window_hours: 24,
      slot_hold_minutes: 10,
      booking_horizon_days: 30,
      record_retention_years: 5,
      updated_at: new Date().toISOString(),
    });

    // 2. Dr. Ratish Juyal (Neurologist)
    console.log("2. Setting doctors/dr-ratish-juyal (Timing: 12pm to 5pm)...");
    await setDoc(doc(db, "doctors", "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b"), {
      id: "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b",
      doctor_code: "DOC-JUYAL",
      full_name: "Dr. Ratish Juyal",
      speciality: "Neurologist (Brain, Spine & Nerve Specialist)",
      qualification: "MBBS, MD (Medicine), DM (Neurology - KGMU, Lucknow)",
      registration_number: "UPMC/54821",
      consultation_fee: 1000,
      bio: "Dr. Ratish Juyal is a renowned Senior Consultant Neurologist in Lucknow with DM superspeciality training from King George's Medical University (KGMU). Affiliated with Medanta Super Speciality Hospital, Lucknow, he specializes in Stroke, Epilepsy, Migraine, Parkinson's, Neuropathy, Sciatica, and Dementia.",
      is_active: true,
      timing: "12:00 PM to 05:00 PM (Mon-Sat)",
      updated_at: new Date().toISOString(),
    });

    // 3. Physiotherapist
    console.log("3. Setting doctors/dr-amit-sharma-physio (Timing: 12pm to 5pm)...");
    await setDoc(doc(db, "doctors", "8c0b6a3f-5d4e-4f2b-9a0c-1d3e4f5a6b7c"), {
      id: "8c0b6a3f-5d4e-4f2b-9a0c-1d3e4f5a6b7c",
      doctor_code: "DOC-PHYSIO",
      full_name: "Dr. Amit K. Sharma (PT)",
      speciality: "Neuro Physiotherapist & Rehabilitation Specialist",
      qualification: "BPT, MPT (Neuro-Physiotherapy & Neuro-Rehabilitation)",
      registration_number: "UPPTC-88312",
      consultation_fee: 500,
      bio: "Dedicated Neuro-Physiotherapist specializing in post-stroke paralysis recovery, Parkinson's gait therapy, spine & disc rehabilitation (Sciatica, Cervical spondylosis), and post-neurosurgical physical therapy.",
      is_active: true,
      timing: "12:00 PM to 05:00 PM (Mon-Sat)",
      updated_at: new Date().toISOString(),
    });

    // 4. Schedules (12 PM to 5 PM, Mon-Sat)
    console.log("4. Setting 12pm to 5pm schedules for Dr. Ratish Juyal & Physiotherapist...");
    const days = [1, 2, 3, 4, 5, 6];
    for (const d of days) {
      await setDoc(doc(db, "doctor_schedules", `dr_juyal_w${d}`), {
        doctorId: "7b9a5f2e-4c3d-4e1a-8f9b-0c2d3e4f5a6b",
        weekday: d,
        startTime: "12:00",
        endTime: "17:00",
        slotDurationMinutes: 20,
        isActive: true,
      });
      await setDoc(doc(db, "doctor_schedules", `physio_w${d}`), {
        doctorId: "8c0b6a3f-5d4e-4f2b-9a0c-1d3e4f5a6b7c",
        weekday: d,
        startTime: "12:00",
        endTime: "17:00",
        slotDurationMinutes: 30,
        isActive: true,
      });
    }

    console.log("-------------------------------------------------------------------");
    console.log("SUCCESS: Dr. Ratish Juyal & Neuro-Physiotherapist saved to Firestore!");
    console.log("-------------------------------------------------------------------");
    process.exit(0);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes("PERMISSION_DENIED") || errorMsg.includes("Cloud Firestore API has not been used")) {
      console.log("\n[NOTE FOR USER]");
      console.log("In your Firebase Console (https://console.firebase.google.com/project/dr-ratish-juyal-clinic/firestore):");
      console.log("1. Click 'Create database'");
      console.log("2. Select 'Start in test mode' (or production mode with allow read, write: if true)");
      console.log("3. Choose location (e.g., asia-south1 Mumbai or nam5)");
      console.log("Once created, run 'npm run seed:firebase' to populate the cloud database!\n");
    } else {
      console.error("Firebase seed error:", err);
    }
    process.exit(0);
  }
}

main();
