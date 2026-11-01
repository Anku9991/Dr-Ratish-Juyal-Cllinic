-- Clinic Management System: core schema
-- Conventions: dates/times a patient sees are in the clinic timezone; starts_at/ends_at are UTC (timestamptz).
-- Money: consultation_fee is INR rupees (numeric); payments.amount is integer paise.

-- ---------- enums ----------
create type user_role as enum ('patient', 'doctor', 'admin');
create type appointment_status as enum
  ('pending_payment', 'confirmed', 'checked_in', 'in_consultation', 'completed', 'cancelled', 'no_show', 'expired');
create type payment_status as enum
  ('created', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');
create type hold_status as enum ('active', 'converted', 'released', 'expired');
create type consultation_status as enum ('draft', 'finalized');
create type prescription_status as enum ('draft', 'issued', 'amended', 'cancelled');

-- ---------- helpers ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create sequence patient_code_seq start 1000;
create sequence doctor_code_seq start 100;
create sequence appointment_seq start 10000;
create sequence receipt_seq start 10000;
create sequence prescription_seq start 10000;

-- ---------- identity ----------
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role user_role not null default 'patient',
  full_name text not null check (char_length(full_name) between 1 and 120),
  mobile text check (mobile is null or mobile ~ '^\+?[0-9]{10,15}$'),
  email text,
  is_active boolean not null default true,
  -- explicit extra permissions for admin users: 'manage_staff', 'medical_records'
  permissions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index profiles_mobile_key on profiles (mobile) where mobile is not null;
create index profiles_role_idx on profiles (role);

create table patients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles (id) on delete cascade,
  patient_code text not null unique default ('UHID' || lpad(nextval('patient_code_seq')::text, 6, '0')),
  date_of_birth date check (date_of_birth is null or date_of_birth <= current_date),
  gender text check (gender in ('male', 'female', 'other')),
  address text check (char_length(address) <= 500),
  emergency_contact text check (char_length(emergency_contact) <= 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Medical details live apart from demographics so admin access can be restricted separately.
create table patient_medical (
  patient_id uuid primary key references patients (id) on delete cascade,
  allergies text check (char_length(allergies) <= 2000),
  medical_history text check (char_length(medical_history) <= 4000),
  updated_at timestamptz not null default now()
);

create table doctors (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references profiles (id) on delete cascade,
  doctor_code text not null unique default ('DR' || lpad(nextval('doctor_code_seq')::text, 4, '0')),
  speciality text not null check (char_length(speciality) between 1 and 100),
  qualification text check (char_length(qualification) <= 200),
  registration_number text check (char_length(registration_number) <= 60),
  consultation_fee numeric(10, 2) not null check (consultation_fee >= 0 and consultation_fee <= 100000),
  bio text check (char_length(bio) <= 2000),
  signature_storage_path text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index doctors_speciality_idx on doctors (speciality) where is_active;

-- ---------- availability ----------
create table doctor_schedules (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_duration_minutes smallint not null check (slot_duration_minutes between 5 and 120),
  is_active boolean not null default true,
  check (end_time > start_time),
  unique (doctor_id, weekday, start_time)
);
create index doctor_schedules_doctor_idx on doctor_schedules (doctor_id, weekday);

create table doctor_leaves (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  leave_date date not null,
  reason text check (char_length(reason) <= 200),
  unique (doctor_id, leave_date)
);

create table clinic_holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  name text not null check (char_length(name) between 1 and 120)
);

create table clinic_settings (
  id smallint primary key default 1 check (id = 1),
  clinic_name text,
  address text,
  phone text,
  email text,
  logo_storage_path text,
  prescription_footer text,
  timezone text not null default 'Asia/Kolkata',
  cancellation_window_hours integer not null default 24 check (cancellation_window_hours between 0 and 720),
  slot_hold_minutes integer not null default 10 check (slot_hold_minutes between 5 and 60),
  booking_horizon_days integer not null default 30 check (booking_horizon_days between 1 and 180),
  record_retention_years integer not null default 3 check (record_retention_years between 1 and 30),
  updated_at timestamptz not null default now()
);
insert into clinic_settings (id) values (1);

-- ---------- appointments ----------
create table appointments (
  id uuid primary key default gen_random_uuid(),
  appointment_number text not null unique default ('APT' || lpad(nextval('appointment_seq')::text, 6, '0')),
  patient_id uuid not null references patients (id) on delete restrict,
  doctor_id uuid not null references doctors (id) on delete restrict,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status appointment_status not null default 'pending_payment',
  booking_source text not null default 'online' check (booking_source in ('online', 'admin', 'walk_in')),
  reason text check (char_length(reason) <= 500),
  notes text check (char_length(notes) <= 1000),
  hold_id uuid unique,
  payment_expires_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references profiles (id),
  cancel_reason text check (char_length(cancel_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time and ends_at > starts_at)
);
-- The core double-booking guard: one live appointment per doctor per slot.
create unique index appointments_live_slot_key on appointments (doctor_id, starts_at)
  where status in ('pending_payment', 'confirmed', 'checked_in', 'in_consultation', 'completed');
create index appointments_patient_idx on appointments (patient_id, starts_at desc);
create index appointments_doctor_day_idx on appointments (doctor_id, appointment_date);
create index appointments_status_idx on appointments (status);
create index appointments_pending_expiry_idx on appointments (payment_expires_at) where status = 'pending_payment';

create table appointment_holds (
  id uuid primary key default gen_random_uuid(),
  doctor_id uuid not null references doctors (id) on delete cascade,
  patient_id uuid not null references patients (id) on delete cascade,
  appointment_date date not null,
  start_time time not null,
  end_time time not null,
  starts_at timestamptz not null,
  hold_token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  status hold_status not null default 'active',
  created_at timestamptz not null default now()
);
create unique index appointment_holds_active_slot_key on appointment_holds (doctor_id, starts_at) where status = 'active';
create index appointment_holds_patient_idx on appointment_holds (patient_id) where status = 'active';
create index appointment_holds_expiry_idx on appointment_holds (expires_at) where status = 'active';

alter table appointments add constraint appointments_hold_fk foreign key (hold_id) references appointment_holds (id);

-- ---------- payments ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references appointments (id) on delete restrict,
  receipt_number text not null unique default ('RCPT' || lpad(nextval('receipt_seq')::text, 6, '0')),
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,
  amount integer not null check (amount > 0), -- paise
  currency text not null default 'INR' check (currency = 'INR'),
  status payment_status not null default 'created',
  method text,
  failure_reason text check (char_length(failure_reason) <= 300),
  refunded_amount integer not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount),
  refund_required boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index payments_appointment_idx on payments (appointment_id);
create index payments_status_idx on payments (status);
-- at most one open order per appointment; a retry reuses it (or supersedes it) instead of piling up orders
create unique index payments_open_order_key on payments (appointment_id) where status in ('created', 'authorized');

create table payment_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references payments (id) on delete restrict,
  razorpay_refund_id text unique,
  amount integer not null check (amount > 0),
  status text not null default 'processed',
  reason text check (char_length(reason) <= 300),
  created_by uuid references profiles (id),
  created_at timestamptz not null default now()
);
create index payment_refunds_payment_idx on payment_refunds (payment_id);

-- Razorpay webhook idempotency ledger (event id comes from the x-razorpay-event-id header).
create table webhook_events (
  event_id text primary key,
  event_type text not null,
  result text,
  received_at timestamptz not null default now()
);

-- ---------- clinical ----------
create table consultations (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references appointments (id) on delete restrict,
  doctor_id uuid not null references doctors (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  symptoms text check (char_length(symptoms) <= 4000),
  examination_notes text check (char_length(examination_notes) <= 4000),
  diagnosis text check (char_length(diagnosis) <= 2000),
  blood_pressure text check (blood_pressure is null or blood_pressure ~ '^[0-9]{2,3}/[0-9]{2,3}$'),
  pulse smallint check (pulse is null or pulse between 20 and 300),
  temperature numeric(4, 1) check (temperature is null or temperature between 90 and 110), -- degrees Fahrenheit
  spo2 smallint check (spo2 is null or spo2 between 50 and 100),
  weight numeric(5, 1) check (weight is null or weight between 1 and 500), -- kg
  advice text check (char_length(advice) <= 4000),
  follow_up_date date,
  status consultation_status not null default 'draft',
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index consultations_patient_idx on consultations (patient_id, created_at desc);
create index consultations_doctor_idx on consultations (doctor_id, created_at desc);

create table prescriptions (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references consultations (id) on delete restrict,
  prescription_number text unique,
  doctor_id uuid not null references doctors (id) on delete restrict,
  patient_id uuid not null references patients (id) on delete restrict,
  pdf_storage_path text,
  issued_at timestamptz,
  status prescription_status not null default 'draft',
  amends_prescription_id uuid references prescriptions (id),
  status_reason text check (char_length(status_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status = 'draft' or (prescription_number is not null and issued_at is not null))
);
create unique index prescriptions_open_per_consultation_key on prescriptions (consultation_id)
  where status in ('draft', 'issued');
create index prescriptions_patient_idx on prescriptions (patient_id, issued_at desc);
create index prescriptions_doctor_idx on prescriptions (doctor_id, issued_at desc);

create table prescription_medicines (
  id uuid primary key default gen_random_uuid(),
  prescription_id uuid not null references prescriptions (id) on delete cascade,
  medicine_name text not null check (char_length(medicine_name) between 1 and 200),
  strength text check (char_length(strength) <= 60),
  dosage text not null check (char_length(dosage) between 1 and 100),
  frequency text not null check (char_length(frequency) between 1 and 100),
  duration text not null check (char_length(duration) between 1 and 100),
  instructions text check (char_length(instructions) <= 300),
  sort_order integer not null default 0
);
create index prescription_medicines_rx_idx on prescription_medicines (prescription_id, sort_order);

-- ---------- audit ----------
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs (created_at desc);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);
create index audit_logs_actor_idx on audit_logs (actor_id);

-- ---------- updated_at triggers ----------
create trigger trg_profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger trg_patients_updated before update on patients for each row execute function set_updated_at();
create trigger trg_doctors_updated before update on doctors for each row execute function set_updated_at();
create trigger trg_appointments_updated before update on appointments for each row execute function set_updated_at();
create trigger trg_payments_updated before update on payments for each row execute function set_updated_at();
create trigger trg_consultations_updated before update on consultations for each row execute function set_updated_at();
create trigger trg_prescriptions_updated before update on prescriptions for each row execute function set_updated_at();
create trigger trg_settings_updated before update on clinic_settings for each row execute function set_updated_at();

-- ---------- new auth user -> profile + patient ----------
-- Role is ALWAYS 'patient' here. user_metadata is client-controlled and is never trusted for role.
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text;
  v_mobile text;
  v_pid uuid;
begin
  v_name := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(coalesce(new.email, 'patient'), '@', 1));
  v_mobile := nullif(regexp_replace(coalesce(new.raw_user_meta_data ->> 'mobile', ''), '[^0-9+]', '', 'g'), '');
  if v_mobile is not null and v_mobile !~ '^\+?[0-9]{10,15}$' then
    v_mobile := null;
  end if;
  insert into profiles (id, role, full_name, mobile, email)
  values (new.id, 'patient', left(v_name, 120), v_mobile, new.email);
  insert into patients (profile_id) values (new.id) returning id into v_pid;
  insert into patient_medical (patient_id) values (v_pid);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------- storage buckets (private; accessed only through server-side signed URLs) ----------
insert into storage.buckets (id, name, public) values ('prescriptions', 'prescriptions', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('clinic-assets', 'clinic-assets', false) on conflict (id) do nothing;
