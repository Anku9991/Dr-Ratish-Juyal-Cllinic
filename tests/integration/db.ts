import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

export type Db = PGlite;

/** Boots an in-process Postgres and applies the real migration files in order. */
export async function createDb(): Promise<Db> {
  const db = new PGlite();
  await db.exec(readFileSync(path.join(root, "tests/integration/supabase-stub.sql"), "utf8"));
  const dir = path.join(root, "supabase/migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(path.join(dir, file), "utf8"));
  }
  return db;
}

export type Actor = { role: "anon" | "authenticated" | "service_role"; userId?: string };

/** Runs a callback with the session role/JWT subject set the way PostgREST would set them. */
export async function as<T>(db: Db, actor: Actor, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role ${actor.role}`);
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [actor.userId ?? ""]);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role`);
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}

export async function createUser(db: Db, email: string, meta: Record<string, string> = {}): Promise<string> {
  const r = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id`,
    [email, JSON.stringify(meta)],
  );
  return r.rows[0]!.id;
}

export interface Seeded {
  adminId: string;
  doctorUserId: string;
  doctor2UserId: string;
  doctorId: string;
  doctor2Id: string;
  patientUserId: string;
  patientId: string;
  patient2UserId: string;
  patient2Id: string;
}

/** Next date (yyyy-mm-dd, clinic tz) that falls on the given weekday, at least `minDays` ahead. */
export async function futureDate(db: Db, weekday: number, minDays = 2): Promise<string> {
  const r = await db.query<{ d: string }>(
    `select to_char(d, 'YYYY-MM-DD') as d from generate_series(
       (now() at time zone 'Asia/Kolkata')::date + $1::int, (now() at time zone 'Asia/Kolkata')::date + 30, interval '1 day') d
     where extract(dow from d) = $2 limit 1`,
    [minDays, weekday],
  );
  return r.rows[0]!.d;
}

export async function seed(db: Db): Promise<Seeded> {
  const adminId = await createUser(db, "admin@clinic.test", { full_name: "Admin User" });
  await db.query(`update profiles set role = 'admin', permissions = '{manage_staff}' where id = $1`, [adminId]);
  await db.query(`delete from patients where profile_id = $1`, [adminId]);

  const mkDoctor = async (email: string, name: string, speciality: string, fee: number) => {
    const userId = await createUser(db, email, { full_name: name });
    await db.query(`delete from patients where profile_id = $1`, [userId]);
    await db.query(`update profiles set role = 'doctor' where id = $1`, [userId]);
    const d = await db.query<{ id: string }>(
      `insert into doctors (profile_id, speciality, qualification, registration_number, consultation_fee)
       values ($1, $2, 'MBBS, MD', 'REG-1234', $3) returning id`,
      [userId, speciality, fee],
    );
    const doctorId = d.rows[0]!.id;
    // Monday to Friday 09:00-12:00, 30 minute slots
    for (const wd of [1, 2, 3, 4, 5]) {
      await db.query(
        `insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_duration_minutes) values ($1, $2, '09:00', '12:00', 30)`,
        [doctorId, wd],
      );
    }
    return { userId, doctorId };
  };
  const d1 = await mkDoctor("dr.one@clinic.test", "Dr. Asha Verma", "General Medicine", 500);
  const d2 = await mkDoctor("dr.two@clinic.test", "Dr. Rohan Gupta", "Paediatrics", 700.5);

  const patientUserId = await createUser(db, "pat.one@example.com", { full_name: "Patient One", mobile: "9876543210" });
  const patient2UserId = await createUser(db, "pat.two@example.com", { full_name: "Patient Two", mobile: "9876543211" });
  const p1 = await db.query<{ id: string }>(`select id from patients where profile_id = $1`, [patientUserId]);
  const p2 = await db.query<{ id: string }>(`select id from patients where profile_id = $1`, [patient2UserId]);

  return {
    adminId,
    doctorUserId: d1.userId,
    doctor2UserId: d2.userId,
    doctorId: d1.doctorId,
    doctor2Id: d2.doctorId,
    patientUserId,
    patientId: p1.rows[0]!.id,
    patient2UserId,
    patient2Id: p2.rows[0]!.id,
  };
}
