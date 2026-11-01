/** Money is INR. The database stores rupees as numeric(10,2) for fees and integer paise for payments. */

export function rupeesToPaise(value: number | string): number {
  const str = typeof value === "number" ? value.toFixed(2) : value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(str)) throw new Error(`Invalid rupee amount: ${value}`);
  const [whole = "0", frac = ""] = str.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(paise / 100);
}

export function formatRupees(rupees: number | string): string {
  return formatINR(rupeesToPaise(rupees));
}
