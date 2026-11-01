import type { Db } from "./db";
import type { AppointmentForPayment, BookingDb, PaymentLookup } from "@/lib/booking-db";
import { HttpError } from "@/lib/errors";
import { mapDbError } from "@/lib/errors";

/**
 * BookingDb implementation backed by the in-process Postgres (pglite), running as service_role so it can
 * call the SECURITY DEFINER SQL functions exactly like the real Supabase service-role client does.
 */
export function createPgliteBookingDb(db: Db): BookingDb {
  const asService = async <T>(fn: () => Promise<T>): Promise<T> => {
    await db.exec("set role service_role");
    try {
      return await fn();
    } finally {
      await db.exec("reset role");
    }
  };

  const rowToPayment = (r: Record<string, unknown>): PaymentLookup => ({
    id: r.id as string,
    appointment_id: r.appointment_id as string,
    patient_id: r.patient_id as string,
    razorpay_order_id: r.razorpay_order_id as string,
    razorpay_payment_id: (r.razorpay_payment_id as string | null) ?? null,
    amount: r.amount as number,
    status: r.status as PaymentLookup["status"],
    refunded_amount: r.refunded_amount as number,
    failure_reason: (r.failure_reason as string | null) ?? null,
  });

  return {
    async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
      const keys = Object.keys(args);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ");
      // row_to_json recursively converts composite return types (e.g. `appointments`) to nested JSON,
      // matching what postgrest/supabase-js hands back for RPC calls; plain node-pg would otherwise give
      // us the composite value as an opaque "(a,b,c)" string. Works for scalar and void returns too.
      const sql = `select row_to_json(t) as row from (select ${fn}(${placeholders}) as v) t`;
      return asService(async () => {
        try {
          const res = await db.query<{ row: { v: unknown } }>(sql, keys.map((k) => args[k]));
          return res.rows[0]?.row.v as T;
        } catch (err) {
          throw mapDbError(err as { message?: string });
        }
      });
    },

    async paymentByOrder(orderId) {
      return asService(async () => {
        const r = await db.query(
          `select p.*, a.patient_id from payments p join appointments a on a.id = p.appointment_id where p.razorpay_order_id = $1`,
          [orderId],
        );
        return r.rows[0] ? rowToPayment(r.rows[0] as Record<string, unknown>) : null;
      });
    },
    async paymentByRzpId(id) {
      return asService(async () => {
        const r = await db.query(
          `select p.*, a.patient_id from payments p join appointments a on a.id = p.appointment_id where p.razorpay_payment_id = $1`,
          [id],
        );
        return r.rows[0] ? rowToPayment(r.rows[0] as Record<string, unknown>) : null;
      });
    },
    async paymentById(id) {
      return asService(async () => {
        const r = await db.query(`select p.*, a.patient_id from payments p join appointments a on a.id = p.appointment_id where p.id = $1`, [id]);
        return r.rows[0] ? rowToPayment(r.rows[0] as Record<string, unknown>) : null;
      });
    },

    async appointmentForPayment(appointmentId): Promise<AppointmentForPayment | null> {
      return asService(async () => {
        const r = await db.query(
          `select a.id, a.appointment_number, a.patient_id, a.doctor_id, a.status, a.payment_expires_at, a.starts_at, d.consultation_fee as fee
             from appointments a join doctors d on d.id = a.doctor_id where a.id = $1`,
          [appointmentId],
        );
        const row = r.rows[0] as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
          id: row.id as string,
          appointment_number: row.appointment_number as string,
          patient_id: row.patient_id as string,
          doctor_id: row.doctor_id as string,
          status: row.status as string,
          payment_expires_at: (row.payment_expires_at as string | null) ?? null,
          starts_at: row.starts_at as string,
          fee: row.fee as number,
        };
      });
    },

    async paymentsForAppointment(appointmentId) {
      return asService(async () => {
        const r = await db.query(`select p.*, a.patient_id from payments p join appointments a on a.id = p.appointment_id where p.appointment_id = $1 order by p.created_at desc`, [appointmentId]);
        return (r.rows as Record<string, unknown>[]).map(rowToPayment);
      });
    },

    async supersedeOpenPayments(appointmentId) {
      await asService(() => db.query(`update payments set status = 'failed', failure_reason = 'superseded' where appointment_id = $1 and status in ('created','authorized')`, [appointmentId]));
    },

    async insertPayment({ appointmentId, orderId, amount }) {
      return asService(async () => {
        try {
          const r = await db.query(
            `insert into payments (appointment_id, razorpay_order_id, amount, currency, status) values ($1,$2,$3,'INR','created')
             returning *, (select patient_id from appointments where id = $1) as patient_id`,
            [appointmentId, orderId, amount],
          );
          return rowToPayment(r.rows[0] as Record<string, unknown>);
        } catch (err) {
          const e = err as { message?: string };
          if (e.message?.includes("payments_open_order_key")) throw new HttpError(409, "conflict", "A payment is already open for this appointment.");
          throw mapDbError(e);
        }
      });
    },

    async flagRefundRequired(paymentId) {
      await asService(() => db.query(`update payments set refund_required = true where id = $1`, [paymentId]));
    },
  };
}
