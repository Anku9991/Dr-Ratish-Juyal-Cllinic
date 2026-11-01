-- Business logic that must be atomic lives here. Every function that accepts an actor id
-- (p_patient / p_doctor) is executable by service_role ONLY (see 0003_rls.sql), so a browser
-- client can never impersonate another user through RPC.

-- ---------- audit ----------
create or replace function write_audit(p_actor uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'::jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor, p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'::jsonb));
$$;

create or replace function audit_logs_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'AUDIT_LOG_IMMUTABLE';
end $$;
create trigger trg_audit_logs_immutable before update or delete on audit_logs
  for each row execute function audit_logs_append_only();

-- ---------- RLS helpers (security definer to avoid policy recursion) ----------
create or replace function my_role() returns user_role language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() and is_active;
$$;

create or replace function has_permission(p_permission text) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' and p_permission = any (permissions) from profiles where id = auth.uid() and is_active), false);
$$;

create or replace function my_doctor_id() returns uuid language sql stable security definer set search_path = public as $$
  select d.id from doctors d join profiles p on p.id = d.profile_id where d.profile_id = auth.uid() and p.is_active;
$$;

create or replace function my_patient_id() returns uuid language sql stable security definer set search_path = public as $$
  select pt.id from patients pt join profiles p on p.id = pt.profile_id where pt.profile_id = auth.uid() and p.is_active;
$$;

create or replace function doctor_has_patient(p_patient uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from appointments a
    where a.patient_id = p_patient and a.doctor_id = my_doctor_id() and a.status <> 'pending_payment'
  );
$$;

-- ---------- slot holds ----------
create or replace function expire_stale_holds() returns void language plpgsql security definer set search_path = public as $$
begin
  update appointment_holds set status = 'expired' where status = 'active' and expires_at <= now();
  update appointments set status = 'expired'
   where status = 'pending_payment' and payment_expires_at is not null and payment_expires_at <= now();
end $$;

create or replace function create_hold(p_doctor uuid, p_patient uuid, p_date date, p_start time)
returns appointment_holds language plpgsql security definer set search_path = public as $$
declare
  s clinic_settings%rowtype;
  d doctors%rowtype;
  sch doctor_schedules%rowtype;
  v_end time;
  v_starts timestamptz;
  v_hold appointment_holds%rowtype;
begin
  perform expire_stale_holds();
  select * into s from clinic_settings where id = 1;

  select * into d from doctors where id = p_doctor and is_active;
  if not found or not exists (select 1 from profiles where id = d.profile_id and is_active) then
    raise exception 'DOCTOR_UNAVAILABLE';
  end if;
  if not exists (select 1 from patients pt join profiles pr on pr.id = pt.profile_id where pt.id = p_patient and pr.is_active) then
    raise exception 'PATIENT_INVALID';
  end if;

  select * into sch from doctor_schedules ds
   where ds.doctor_id = p_doctor and ds.is_active
     and ds.weekday = extract(dow from p_date)::int
     and extract(epoch from p_start)::int >= extract(epoch from ds.start_time)::int
     and extract(epoch from p_start)::int + ds.slot_duration_minutes * 60 <= extract(epoch from ds.end_time)::int
     and mod(extract(epoch from p_start)::int - extract(epoch from ds.start_time)::int, ds.slot_duration_minutes * 60) = 0
   limit 1;
  if not found then raise exception 'SLOT_INVALID'; end if;

  v_end := p_start + make_interval(mins => sch.slot_duration_minutes);

  if exists (select 1 from doctor_leaves where doctor_id = p_doctor and leave_date = p_date) then
    raise exception 'DOCTOR_ON_LEAVE';
  end if;
  if exists (select 1 from clinic_holidays where holiday_date = p_date) then
    raise exception 'CLINIC_HOLIDAY';
  end if;

  v_starts := (p_date + p_start) at time zone s.timezone;
  if v_starts <= now() then raise exception 'SLOT_PAST'; end if;
  if p_date > (now() at time zone s.timezone)::date + s.booking_horizon_days then
    raise exception 'SLOT_OUT_OF_RANGE';
  end if;

  if exists (
    select 1 from appointments
     where doctor_id = p_doctor and starts_at = v_starts
       and status in ('pending_payment', 'confirmed', 'checked_in', 'in_consultation', 'completed')
  ) then
    raise exception 'SLOT_TAKEN';
  end if;

  -- one active hold per patient: choosing a new slot releases the previous one
  update appointment_holds set status = 'released' where patient_id = p_patient and status = 'active';

  begin
    insert into appointment_holds (doctor_id, patient_id, appointment_date, start_time, end_time, starts_at, expires_at)
    values (p_doctor, p_patient, p_date, p_start, v_end, v_starts, now() + make_interval(mins => s.slot_hold_minutes))
    returning * into v_hold;
  exception when unique_violation then
    raise exception 'SLOT_TAKEN';
  end;
  return v_hold;
end $$;

-- Converts an active hold into a pending_payment appointment. Safe to retry (idempotent per hold).
create or replace function create_pending_appointment(p_hold_token uuid, p_patient uuid, p_reason text)
returns appointments language plpgsql security definer set search_path = public as $$
declare
  h appointment_holds%rowtype;
  a appointments%rowtype;
begin
  perform expire_stale_holds();
  select * into h from appointment_holds where hold_token = p_hold_token for update;
  if not found or h.patient_id <> p_patient then raise exception 'HOLD_NOT_FOUND'; end if;

  if h.status = 'converted' then
    select * into a from appointments where hold_id = h.id;
    return a;
  end if;
  if h.status <> 'active' or h.expires_at <= now() then raise exception 'HOLD_EXPIRED'; end if;

  insert into appointments (patient_id, doctor_id, appointment_date, start_time, end_time, starts_at, ends_at,
                            status, reason, hold_id, payment_expires_at)
  values (h.patient_id, h.doctor_id, h.appointment_date, h.start_time, h.end_time, h.starts_at,
          h.starts_at + (h.end_time - h.start_time), 'pending_payment', nullif(trim(p_reason), ''), h.id, h.expires_at)
  returning * into a;

  update appointment_holds set status = 'converted' where id = h.id;
  return a;
end $$;

-- ---------- payments ----------
-- Called after signature verification (checkout callback) or a verified webhook. Idempotent.
-- Returns: confirmed | already_confirmed | slot_lost | appointment_cancelled
create or replace function confirm_appointment_payment(p_order_id text, p_payment_id text, p_method text default null)
returns text language plpgsql security definer set search_path = public as $$
declare
  pay payments%rowtype;
  appt appointments%rowtype;
begin
  select * into pay from payments where razorpay_order_id = p_order_id for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;

  if pay.status in ('captured', 'refunded', 'partially_refunded') then
    return 'already_confirmed';
  end if;

  select * into appt from appointments where id = pay.appointment_id for update;

  update payments
     set status = 'captured', razorpay_payment_id = coalesce(razorpay_payment_id, p_payment_id),
         method = coalesce(p_method, method), verified_at = now(), failure_reason = null
   where id = pay.id;

  if appt.status = 'confirmed' then
    return 'already_confirmed';
  end if;

  if appt.status in ('pending_payment', 'expired') then
    begin
      update appointments set status = 'confirmed', payment_expires_at = null where id = appt.id;
      perform write_audit(null, 'payment.confirmed', 'appointment', appt.id::text, jsonb_build_object('order', p_order_id));
      return 'confirmed';
    exception when unique_violation then
      -- The hold expired and someone else took the slot before the money arrived.
      update payments set refund_required = true where id = pay.id;
      update appointments set status = 'cancelled', cancelled_at = now(),
             cancel_reason = 'Slot no longer available after payment window expired'
       where id = appt.id;
      perform write_audit(null, 'payment.slot_lost', 'appointment', appt.id::text, jsonb_build_object('order', p_order_id));
      return 'slot_lost';
    end;
  end if;

  -- cancelled / no_show etc.: money received for an appointment that cannot proceed
  update payments set refund_required = true where id = pay.id;
  return 'appointment_cancelled';
end $$;

create or replace function fail_payment(p_order_id text, p_reason text) returns void
language sql security definer set search_path = public as $$
  update payments set status = 'failed', failure_reason = left(p_reason, 300)
   where razorpay_order_id = p_order_id and status in ('created', 'authorized', 'failed');
$$;

create or replace function mark_payment_authorized(p_order_id text, p_payment_id text) returns void
language sql security definer set search_path = public as $$
  update payments set status = 'authorized', razorpay_payment_id = coalesce(razorpay_payment_id, p_payment_id)
   where razorpay_order_id = p_order_id and status in ('created', 'failed');
$$;

-- Records a refund. Idempotent on razorpay_refund_id so the API path and the webhook path can both call it.
create or replace function record_refund(p_payment uuid, p_rzp_refund_id text, p_amount integer, p_reason text, p_actor uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  pay payments%rowtype;
  v_inserted uuid;
begin
  select * into pay from payments where id = p_payment for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND'; end if;
  if pay.status not in ('captured', 'partially_refunded', 'refunded') then raise exception 'PAYMENT_NOT_REFUNDABLE'; end if;

  if p_rzp_refund_id is not null and exists (select 1 from payment_refunds where razorpay_refund_id = p_rzp_refund_id) then
    return 'duplicate';
  end if;
  if p_amount <= 0 or p_amount > pay.amount - pay.refunded_amount then raise exception 'REFUND_AMOUNT_INVALID'; end if;

  insert into payment_refunds (payment_id, razorpay_refund_id, amount, reason, created_by)
  values (pay.id, p_rzp_refund_id, p_amount, left(p_reason, 300), p_actor) returning id into v_inserted;

  update payments
     set refunded_amount = pay.refunded_amount + p_amount,
         status = case when pay.refunded_amount + p_amount = pay.amount then 'refunded'::payment_status else 'partially_refunded'::payment_status end,
         refund_required = false
   where id = pay.id;
  perform write_audit(p_actor, 'payment.refunded', 'payment', pay.id::text, jsonb_build_object('amount', p_amount));
  return 'recorded';
end $$;

-- ---------- appointment lifecycle ----------
create or replace function cancel_appointment(p_appointment uuid, p_actor uuid, p_reason text)
returns appointments language plpgsql security definer set search_path = public as $$
declare a appointments%rowtype;
begin
  update appointments
     set status = 'cancelled', cancelled_at = now(), cancelled_by = p_actor, cancel_reason = left(nullif(trim(p_reason), ''), 300)
   where id = p_appointment and status in ('pending_payment', 'confirmed')
  returning * into a;
  if not found then raise exception 'CANNOT_CANCEL'; end if;
  perform write_audit(p_actor, 'appointment.cancelled', 'appointment', p_appointment::text, jsonb_build_object('reason', left(p_reason, 100)));
  return a;
end $$;

-- ---------- consultation & prescription ----------
create or replace function save_consultation_draft(p_appointment uuid, p_doctor uuid, p_data jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
  c consultations%rowtype;
  v_rx uuid;
begin
  select * into a from appointments where id = p_appointment and doctor_id = p_doctor for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND'; end if;

  select * into c from consultations where appointment_id = a.id for update;
  if found and c.status = 'finalized' then raise exception 'CONSULTATION_LOCKED'; end if;
  if not found and a.status not in ('confirmed', 'checked_in', 'in_consultation') then
    raise exception 'APPOINTMENT_NOT_READY';
  end if;

  insert into consultations (appointment_id, doctor_id, patient_id, symptoms, examination_notes, diagnosis,
                             blood_pressure, pulse, temperature, spo2, weight, advice, follow_up_date)
  values (a.id, a.doctor_id, a.patient_id,
          nullif(trim(p_data ->> 'symptoms'), ''), nullif(trim(p_data ->> 'examinationNotes'), ''),
          nullif(trim(p_data ->> 'diagnosis'), ''), nullif(trim(p_data ->> 'bloodPressure'), ''),
          nullif(p_data ->> 'pulse', '')::smallint, nullif(p_data ->> 'temperature', '')::numeric,
          nullif(p_data ->> 'spo2', '')::smallint, nullif(p_data ->> 'weight', '')::numeric,
          nullif(trim(p_data ->> 'advice'), ''), nullif(p_data ->> 'followUpDate', '')::date)
  on conflict (appointment_id) do update set
    symptoms = excluded.symptoms, examination_notes = excluded.examination_notes, diagnosis = excluded.diagnosis,
    blood_pressure = excluded.blood_pressure, pulse = excluded.pulse, temperature = excluded.temperature,
    spo2 = excluded.spo2, weight = excluded.weight, advice = excluded.advice, follow_up_date = excluded.follow_up_date
  returning * into c;

  select id into v_rx from prescriptions where consultation_id = c.id and status = 'draft';
  if v_rx is null then
    insert into prescriptions (consultation_id, doctor_id, patient_id) values (c.id, c.doctor_id, c.patient_id) returning id into v_rx;
  end if;

  delete from prescription_medicines where prescription_id = v_rx;
  insert into prescription_medicines (prescription_id, medicine_name, strength, dosage, frequency, duration, instructions, sort_order)
  select v_rx, trim(m ->> 'medicineName'), nullif(trim(m ->> 'strength'), ''), trim(m ->> 'dosage'),
         trim(m ->> 'frequency'), trim(m ->> 'duration'), nullif(trim(m ->> 'instructions'), ''), (ord - 1)::int
    from jsonb_array_elements(coalesce(p_data -> 'medicines', '[]'::jsonb)) with ordinality as t (m, ord);

  update appointments set status = 'in_consultation' where id = a.id and status in ('confirmed', 'checked_in');

  return jsonb_build_object('consultation_id', c.id, 'prescription_id', v_rx);
end $$;

create or replace function finalize_prescription(p_consultation uuid, p_doctor uuid)
returns prescriptions language plpgsql security definer set search_path = public as $$
declare
  c consultations%rowtype;
  rx prescriptions%rowtype;
  s clinic_settings%rowtype;
begin
  select * into c from consultations where id = p_consultation and doctor_id = p_doctor for update;
  if not found then raise exception 'CONSULTATION_NOT_FOUND'; end if;

  if c.status = 'finalized' then -- idempotent retry
    select * into rx from prescriptions where consultation_id = c.id and status = 'issued';
    if found then return rx; end if;
    raise exception 'ALREADY_FINALIZED';
  end if;

  select * into rx from prescriptions where consultation_id = c.id and status = 'draft' for update;
  if not found then raise exception 'NO_DRAFT'; end if;
  if c.diagnosis is null or trim(c.diagnosis) = '' then raise exception 'DIAGNOSIS_REQUIRED'; end if;
  if not exists (select 1 from prescription_medicines where prescription_id = rx.id) then
    raise exception 'MEDICINES_REQUIRED';
  end if;

  select * into s from clinic_settings where id = 1;
  update prescriptions
     set status = 'issued', issued_at = now(),
         prescription_number = 'RX' || to_char(now() at time zone s.timezone, 'YYMM') || lpad(nextval('prescription_seq')::text, 6, '0')
   where id = rx.id returning * into rx;

  update consultations set status = 'finalized', finalized_at = now() where id = c.id;
  update appointments set status = 'completed' where id = c.appointment_id and status in ('confirmed', 'checked_in', 'in_consultation');

  perform write_audit((select profile_id from doctors where id = p_doctor), 'prescription.issued', 'prescription', rx.id::text,
                      jsonb_build_object('number', rx.prescription_number));
  return rx;
end $$;

-- Controlled amendment: the issued prescription is kept (status 'amended', with a reason) and a new draft
-- linked to it is created for the doctor to edit and re-issue under a new number.
create or replace function amend_prescription(p_prescription uuid, p_doctor uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  rx prescriptions%rowtype;
  v_new uuid;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('app.allow_rx_edit', 'on', true);

  select * into rx from prescriptions where id = p_prescription and doctor_id = p_doctor for update;
  if not found or rx.status <> 'issued' then raise exception 'NOT_ISSUED'; end if;

  update prescriptions set status = 'amended', status_reason = left(trim(p_reason), 300) where id = rx.id;
  update consultations set status = 'draft', finalized_at = null where id = rx.consultation_id;

  insert into prescriptions (consultation_id, doctor_id, patient_id, amends_prescription_id)
  values (rx.consultation_id, rx.doctor_id, rx.patient_id, rx.id) returning id into v_new;

  insert into prescription_medicines (prescription_id, medicine_name, strength, dosage, frequency, duration, instructions, sort_order)
  select v_new, medicine_name, strength, dosage, frequency, duration, instructions, sort_order
    from prescription_medicines where prescription_id = rx.id;

  perform write_audit((select profile_id from doctors where id = p_doctor), 'prescription.amended', 'prescription', rx.id::text,
                      jsonb_build_object('new_draft', v_new, 'reason', left(trim(p_reason), 200)));
  perform set_config('app.allow_rx_edit', 'off', true);
  return v_new;
end $$;

create or replace function cancel_prescription(p_prescription uuid, p_doctor uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare rx prescriptions%rowtype;
begin
  if p_reason is null or char_length(trim(p_reason)) < 5 then raise exception 'REASON_REQUIRED'; end if;
  perform set_config('app.allow_rx_edit', 'on', true);
  select * into rx from prescriptions where id = p_prescription and doctor_id = p_doctor for update;
  if not found or rx.status <> 'issued' then raise exception 'NOT_ISSUED'; end if;
  update prescriptions set status = 'cancelled', status_reason = left(trim(p_reason), 300) where id = rx.id;
  perform write_audit((select profile_id from doctors where id = p_doctor), 'prescription.cancelled', 'prescription', rx.id::text,
                      jsonb_build_object('reason', left(trim(p_reason), 200)));
  perform set_config('app.allow_rx_edit', 'off', true);
end $$;

-- ---------- immutability guards ----------
create or replace function guard_prescriptions() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status <> 'draft' then raise exception 'PRESCRIPTION_IMMUTABLE'; end if;
    return old;
  end if;
  if old.status = 'draft' then return new; end if;
  if current_setting('app.allow_rx_edit', true) = 'on' then return new; end if;
  -- After issue, the only permitted change is attaching the generated PDF path exactly once.
  if old.pdf_storage_path is null and new.pdf_storage_path is not null
     and (to_jsonb(new) - 'pdf_storage_path' - 'updated_at') = (to_jsonb(old) - 'pdf_storage_path' - 'updated_at') then
    return new;
  end if;
  raise exception 'PRESCRIPTION_IMMUTABLE';
end $$;
create trigger trg_guard_prescriptions before update or delete on prescriptions
  for each row execute function guard_prescriptions();

create or replace function guard_prescription_medicines() returns trigger language plpgsql as $$
declare v_status prescription_status;
begin
  select status into v_status from prescriptions where id = coalesce(new.prescription_id, old.prescription_id);
  if v_status is null or v_status = 'draft' or current_setting('app.allow_rx_edit', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'PRESCRIPTION_IMMUTABLE';
end $$;
create trigger trg_guard_prescription_medicines before insert or update or delete on prescription_medicines
  for each row execute function guard_prescription_medicines();

create or replace function guard_consultations() returns trigger language plpgsql as $$
begin
  if old.status = 'finalized' and current_setting('app.allow_rx_edit', true) is distinct from 'on' then
    raise exception 'CONSULTATION_LOCKED';
  end if;
  return coalesce(new, old);
end $$;
create trigger trg_guard_consultations before update or delete on consultations
  for each row execute function guard_consultations();

-- ---------- webhook idempotency ----------
-- Returns 'new' (first delivery), 'reprocess' (earlier attempt never finished) or 'duplicate' (already handled).
create or replace function claim_webhook_event(p_event_id text, p_event_type text) returns text
language plpgsql security definer set search_path = public as $$
declare v_result text; v_inserted boolean;
begin
  insert into webhook_events (event_id, event_type) values (p_event_id, left(p_event_type, 80))
  on conflict (event_id) do nothing;
  get diagnostics v_inserted = row_count;
  if v_inserted then return 'new'; end if;
  select result into v_result from webhook_events where event_id = p_event_id;
  if v_result is null then return 'reprocess'; end if;
  return 'duplicate';
end $$;

create or replace function finish_webhook_event(p_event_id text, p_result text) returns void
language sql security definer set search_path = public as $$
  update webhook_events set result = left(p_result, 80) where event_id = p_event_id;
$$;

-- ---------- admin: atomic schedule replace ----------
create or replace function replace_doctor_schedule(p_doctor uuid, p_rules jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from doctors where id = p_doctor) then raise exception 'DOCTOR_UNAVAILABLE'; end if;
  delete from doctor_schedules where doctor_id = p_doctor;
  insert into doctor_schedules (doctor_id, weekday, start_time, end_time, slot_duration_minutes, is_active)
  select p_doctor, (r ->> 'weekday')::smallint, (r ->> 'startTime')::time, (r ->> 'endTime')::time,
         (r ->> 'slotMinutes')::smallint, coalesce((r ->> 'isActive')::boolean, true)
    from jsonb_array_elements(coalesce(p_rules, '[]'::jsonb)) as t (r);
end $$;
