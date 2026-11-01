/**
 * Demo data seed script. Run with: npm run seed
 * Requires .env.local with real Supabase credentials (service role). Safe to re-run: it skips
 * anything that already exists by email/name rather than creating duplicates.
 *
 * Creates: clinic settings, 3 doctors (with schedules), 1 admin (with both permissions), 2 patients
 * (with completed profiles), and a handful of appointments in various states so every screen has data
 * to show immediately after seeding.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local) before seeding.");
  process.exit(1);
}
const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

const DEMO_PASSWORD = "Demo@1234";

async function findUserByEmail(email: string) {
  // admin.listUsers has no email filter in older SDKs; page through a small demo user set.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) return null;
    page += 1;
  }
}

async function upsertUser(email: string, fullName: string, mobile: string, role: "patient" | "doctor" | "admin") {
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await admin.auth.admin.createUser({ email, password: DEMO_PASSWORD, email_confirm: true, user_metadata: { full_name: fullName, mobile } });
    if (error) throw error;
    user = data.user;
    console.log(`  created auth user ${email}`);
  } else {
    console.log(`  found existing auth user ${email}`);
  }
  if (role !== "patient") {
    const { error } = await admin.from("profiles").update({ role, full_name: fullName }).eq("id", user.id);
    if (error) throw error;
    await admin.from("patients").delete().eq("profile_id", user.id);
  } else {
    await admin.from("profiles").update({ full_name: fullName }).eq("id", user.id);
  }
  return user.id;
}

async function upsertDoctor(email: string, fullName: string, mobile: string, speciality: string, qualification: string, reg: string, fee: number) {
  const userId = await upsertUser(email, fullName, mobile, "doctor");
  const { data: existing } = await admin.from("doctors").select("id").eq("profile_id", userId).maybeSingle();
  if (existing) {
    await admin.from("doctors").update({ speciality, qualification, registration_number: reg, consultation_fee: fee, is_active: true }).eq("id", existing.id);
    return { userId, doctorId: existing.id as string };
  }
  const { data, error } = await admin.from("doctors").insert({ profile_id: userId, speciality, qualification, registration_number: reg, consultation_fee: fee }).select("id").single();
  if (error) throw error;
  return { userId, doctorId: data.id as string };
}

async function setWeekdaySchedule(doctorId: string, days: number[], start: string, end: string, slotMinutes: number) {
  await admin.from("doctor_schedules").delete().eq("doctor_id", doctorId);
  const rows = days.map((weekday) => ({ doctor_id: doctorId, weekday, start_time: start, end_time: end, slot_duration_minutes: slotMinutes }));
  const { error } = await admin.from("doctor_schedules").insert(rows);
  if (error) throw error;
}

async function main() {
  console.log("Seeding clinic settings...");
  await admin
    .from("clinic_settings")
    .update({
      clinic_name: "Dr. Ratish Juyal Neuro & Spine Clinic",
      address: "M3/460, Sector H, LDA Colony (Near Power House Crossing) & Aashiyana / Medanta Super Speciality OPD, Lucknow, UP 226012",
      phone: "+91 94500 56789",
      email: "care@drratishjuyal.com",
      prescription_footer: "Dr. Ratish Juyal | DM (Neurology, KGMU), MD (Medicine) | Senior Consultant Neurologist, Lucknow | Tel: +91 94500 56789",
      timezone: "Asia/Kolkata",
      cancellation_window_hours: 24,
      slot_hold_minutes: 10,
      booking_horizon_days: 30,
      record_retention_years: 5,
    })
    .eq("id", 1);

  console.log("Seeding admin...");
  const adminId = await upsertUser("admin@drratishjuyal.com", "Clinic Manager", "9450012345", "admin");
  await admin.from("profiles").update({ permissions: ["manage_staff", "medical_records"] }).eq("id", adminId);

  console.log("Seeding doctors (Dr. Ratish Juyal & Physiotherapist with 12pm-5pm timing)...");
  // 1. Dr. Ratish Juyal (Neurologist)
  const d1 = await upsertDoctor(
    "dr.ratish@drratishjuyal.com",
    "Dr. Ratish Juyal",
    "9450056789",
    "Neurologist (Brain, Spine & Nerve Specialist)",
    "MBBS, MD (Medicine), DM (Neurology - KGMU, Lucknow)",
    "UPMC/54821",
    1000
  );
  // Mon-Sat, 12:00 PM to 05:00 PM (12:00 to 17:00), 20 min slots
  await setWeekdaySchedule(d1.doctorId, [1, 2, 3, 4, 5, 6], "12:00", "17:00", 20);

  // 2. Physiotherapist (Dr. Amit K. Sharma PT)
  const d2 = await upsertDoctor(
    "physio@drratishjuyal.com",
    "Dr. Amit K. Sharma (PT)",
    "9450067890",
    "Neuro Physiotherapist & Rehabilitation Specialist",
    "BPT, MPT (Neuro-Physiotherapy & Neuro-Rehabilitation)",
    "UPPTC-88312",
    500
  );
  // Mon-Sat, 12:00 PM to 05:00 PM (12:00 to 17:00), 30 min slots
  await setWeekdaySchedule(d2.doctorId, [1, 2, 3, 4, 5, 6], "12:00", "17:00", 30);

  console.log("Seeding patients...");
  const p1UserId = await upsertUser("patient.one@example.com", "Ramesh Kumar", "9450099001", "patient");
  const { data: p1 } = await admin.from("patients").select("id").eq("profile_id", p1UserId).single();
  await admin.from("patients").update({ date_of_birth: "1980-04-12", gender: "male", address: "Sector G, LDA Colony, Lucknow", emergency_contact: "Sunita Kumar, +91 9450099099" }).eq("id", p1!.id as string);
  await admin.from("patient_medical").upsert({ patient_id: p1!.id as string, allergies: "None", medical_history: "Chronic Migraine, Cervical Radiculopathy" });

  const p2UserId = await upsertUser("patient.two@example.com", "Anjali Singh", "9450099002", "patient");
  const { data: p2 } = await admin.from("patients").select("id").eq("profile_id", p2UserId).single();
  await admin.from("patients").update({ date_of_birth: "1992-11-02", gender: "female", address: "Aashiyana, Lucknow" }).eq("id", p2!.id as string);

  console.log("Done. Demo login password for seeded accounts:", DEMO_PASSWORD);
  console.log("  Admin:          admin@drratishjuyal.com");
  console.log("  Dr. Ratish Juyal: dr.ratish@drratishjuyal.com (Neurologist, 12pm-5pm)");
  console.log("  Physiotherapist: physio@drratishjuyal.com (Neuro Physiotherapist, 12pm-5pm)");
  console.log("  Patients:       patient.one@example.com, patient.two@example.com");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
