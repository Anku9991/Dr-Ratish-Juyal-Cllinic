-- Row Level Security. Default is deny: every table has RLS enabled and only the SELECT policies below.
-- All writes go through server-side route handlers using the service role (which bypasses RLS) after
-- explicit authorization checks, or through the SECURITY DEFINER functions in 0002.

alter table profiles enable row level security;
alter table patients enable row level security;
alter table patient_medical enable row level security;
alter table doctors enable row level security;
alter table doctor_schedules enable row level security;
alter table doctor_leaves enable row level security;
alter table clinic_holidays enable row level security;
alter table clinic_settings enable row level security;
alter table appointments enable row level security;
alter table appointment_holds enable row level security;
alter table payments enable row level security;
alter table payment_refunds enable row level security;
alter table webhook_events enable row level security;
alter table consultations enable row level security;
alter table prescriptions enable row level security;
alter table prescription_medicines enable row level security;
alter table audit_logs enable row level security;

-- profiles: self, admins, and (for doctors) the profile of a patient they have an appointment with
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or my_role() = 'admin'
  or exists (select 1 from patients pt where pt.profile_id = profiles.id and doctor_has_patient(pt.id))
);

-- patients (demographics only)
create policy patients_select on patients for select to authenticated using (
  profile_id = auth.uid() or my_role() = 'admin' or doctor_has_patient(id)
);

-- patient_medical: NOT visible to admin unless explicitly granted 'medical_records'
create policy patient_medical_select on patient_medical for select to authenticated using (
  patient_id = my_patient_id() or doctor_has_patient(patient_id) or has_permission('medical_records')
);

-- doctors: a doctor sees their own row, admin sees all. The public directory uses the public_doctors view.
create policy doctors_select on doctors for select to authenticated using (
  profile_id = auth.uid() or my_role() = 'admin'
);

-- schedules, leaves, holidays and settings contain no personal data
create policy doctor_schedules_select on doctor_schedules for select to authenticated using (true);
create policy doctor_leaves_select on doctor_leaves for select to authenticated using (true);
create policy clinic_holidays_select on clinic_holidays for select to authenticated using (true);
create policy clinic_settings_select on clinic_settings for select to authenticated using (true);

-- appointments
create policy appointments_select on appointments for select to authenticated using (
  patient_id = my_patient_id()
  or (doctor_id = my_doctor_id() and status <> 'pending_payment')
  or my_role() = 'admin'
);

create policy holds_select on appointment_holds for select to authenticated using (
  patient_id = my_patient_id() or my_role() = 'admin'
);

-- payments (doctors do not see money)
create policy payments_select on payments for select to authenticated using (
  my_role() = 'admin'
  or exists (select 1 from appointments a where a.id = payments.appointment_id and a.patient_id = my_patient_id())
);
create policy refunds_select on payment_refunds for select to authenticated using (
  my_role() = 'admin'
  or exists (select 1 from payments p join appointments a on a.id = p.appointment_id
             where p.id = payment_refunds.payment_id and a.patient_id = my_patient_id())
);

-- consultations: doctor (own), patient (own, finalized only), admin only with 'medical_records'
create policy consultations_select on consultations for select to authenticated using (
  doctor_id = my_doctor_id()
  or (patient_id = my_patient_id() and status = 'finalized')
  or has_permission('medical_records')
);

create policy prescriptions_select on prescriptions for select to authenticated using (
  doctor_id = my_doctor_id()
  or (patient_id = my_patient_id() and status = 'issued')
  or has_permission('medical_records')
);

-- evaluated under the caller's RLS on prescriptions, so it inherits the rules above
create policy prescription_medicines_select on prescription_medicines for select to authenticated using (
  exists (select 1 from prescriptions p where p.id = prescription_medicines.prescription_id)
);

create policy audit_logs_select on audit_logs for select to authenticated using (my_role() = 'admin');

-- ---------- public, column-limited views (owner privileges; expose no personal contact data) ----------
create view public_doctors as
  select d.id, d.doctor_code, p.full_name, d.speciality, d.qualification, d.registration_number, d.consultation_fee, d.bio
    from doctors d join profiles p on p.id = d.profile_id
   where d.is_active and p.is_active;

create view public_clinic as
  select clinic_name, address, phone, email, logo_storage_path, timezone, cancellation_window_hours,
         slot_hold_minutes, booking_horizon_days
    from clinic_settings where id = 1;

-- ---------- grants ----------
revoke all on webhook_events from anon, authenticated;
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;
grant select on public_doctors, public_clinic to anon, authenticated;

-- RPC surface: deny by default, then allow only what the policies need
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function my_role(), has_permission(text), my_doctor_id(), my_patient_id(), doctor_has_patient(uuid)
  to authenticated;
grant execute on all functions in schema public to service_role;
