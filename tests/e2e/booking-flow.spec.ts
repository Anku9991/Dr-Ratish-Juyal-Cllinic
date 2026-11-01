import { test, expect, type Page } from "@playwright/test";

/**
 * End-to-end booking flow, matching the spec's required sequence:
 * patient login -> select doctor -> select date -> select slot -> pay (Razorpay TEST mode) ->
 * verify payment -> appointment confirmed -> doctor login -> opens appointment -> creates
 * prescription -> patient views prescription.
 *
 * REQUIRES a real environment: a Supabase project with the migrations applied and seed data
 * loaded (npm run seed), Razorpay TEST keys in .env.local, and the app running at E2E_BASE_URL
 * (defaults to http://localhost:3000, started automatically by playwright.config.ts).
 * This sandbox has no network access to Supabase or Razorpay, so this spec is written and
 * typechecked here but has not been executed. Run it yourself after `npm run seed`:
 *
 *   npm run build && npm run start &
 *   npm run test:e2e
 *
 * Razorpay test-mode checkout is an iframe from checkout.razorpay.com; the "pay with test card"
 * step below uses Razorpay's documented test card (4111 1111 1111 1111, any future expiry, any
 * CVV, OTP 000000/111111 in test mode) — see RAZORPAY_TEST_GUIDE.md.
 */

const PATIENT_EMAIL = "patient.one@example.com";
const DOCTOR_EMAIL = "dr.asha@sunriseclinic.example";
const DEMO_PASSWORD = "Demo@1234";

async function login(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function payWithRazorpayTestCard(page: Page) {
  const frame = page.frameLocator('iframe[src*="checkout.razorpay.com"]');
  // Razorpay's test checkout may default to a saved method; explicitly choose Card.
  const cardTab = frame.getByText("Card", { exact: true }).first();
  if (await cardTab.isVisible().catch(() => false)) await cardTab.click();
  await frame.getByPlaceholder(/card number/i).fill("4111 1111 1111 1111");
  await frame.getByPlaceholder(/valid thru|expiry/i).fill("12/30");
  await frame.getByPlaceholder(/cvv/i).fill("123");
  await frame.getByRole("button", { name: /pay/i }).click();
  // Test-mode OTP screen, when shown
  const otpField = frame.getByPlaceholder(/otp/i);
  if (await otpField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await otpField.fill("111111");
    await frame.getByRole("button", { name: /submit|continue/i }).click();
  }
}

test.describe("full booking-to-prescription flow", () => {
  test("patient books and pays, doctor consults and issues a prescription, patient views it", async ({ page }) => {
    // 1. Patient login
    await login(page, PATIENT_EMAIL);
    await expect(page).toHaveURL(/\/patient/);

    // 2. Select doctor
    await page.goto("/doctors");
    await page.getByRole("link", { name: /Dr\. Asha Verma/i }).click();
    await expect(page.getByRole("heading", { name: /Dr\. Asha Verma/i })).toBeVisible();

    // 3. Select an available date (first enabled day pill), 4. select a slot
    const dayButtons = page.getByRole("option");
    await dayButtons.nth(1).click(); // tomorrow, to avoid "no slots left today" flakiness
    const firstSlot = page.getByRole("button", { name: /am|pm/i }).first();
    await expect(firstSlot).toBeVisible({ timeout: 10_000 });
    await firstSlot.click();

    // navigates to /patient/book/[doctorId]
    await expect(page).toHaveURL(/\/patient\/book\//);
    await page.getByRole("button", { name: /Pay .* and book/i }).click();

    // 5. Create payment order in test mode (Razorpay Checkout opens) + 6. verify payment
    await payWithRazorpayTestCard(page);
    await expect(page).toHaveURL(/\/patient\/payment-status\//, { timeout: 20_000 });
    await expect(page.getByText(/confirmed/i)).toBeVisible({ timeout: 15_000 });

    // 7. Confirm appointment — capture the appointment number for the doctor step
    await page.getByRole("link", { name: "Appointment details" }).click();
    const apptNumber = await page.locator("h1").innerText();

    // 8. Doctor logs in
    await page.getByRole("button", { name: /sign out/i }).click();
    await login(page, DOCTOR_EMAIL);
    await expect(page).toHaveURL(/\/doctor/);

    // 9. Doctor opens the appointment
    await page.getByRole("button", { name: /Start consultation/i }).first().click();
    await expect(page).toHaveURL(/\/doctor\/appointments\//);

    // 10. Doctor creates a prescription
    await page.getByLabel("Diagnosis").fill("Viral fever");
    await page.getByRole("button", { name: "+ Add medicine" }).click();
    await page.getByLabel("Name").fill("Paracetamol");
    await page.getByLabel("Dosage").fill("1-0-1");
    await page.getByLabel("Frequency").fill("Twice daily");
    await page.getByLabel("Duration").fill("3 days");
    await page.getByRole("button", { name: /Finalize & issue prescription/i }).click();
    await expect(page).toHaveURL(/\/doctor\/prescriptions\//, { timeout: 15_000 });
    const rxNumber = await page.locator("h1").innerText();
    expect(rxNumber).toMatch(/RX/);

    // 11. Patient views the prescription
    await page.getByRole("button", { name: /sign out/i }).click();
    await login(page, PATIENT_EMAIL);
    await page.goto("/patient/prescriptions");
    await expect(page.getByRole("link", { name: new RegExp(rxNumber) })).toBeVisible();
    await page.getByRole("link", { name: new RegExp(rxNumber) }).click();
    await expect(page.locator("iframe[title='Prescription PDF']")).toBeVisible();

    void apptNumber; // kept for readability of the flow; not asserted further
  });

  test("double booking is prevented: a slot taken by one patient disappears for another", async ({ browser }) => {
    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await login(page1, PATIENT_EMAIL);
    await page1.goto("/doctors");
    await page1.getByRole("link", { name: /Dr\. Rohan Gupta/i }).click();
    await page1.getByRole("option").nth(1).click();
    const slot = page1.getByRole("button", { name: /am|pm/i }).first();
    await expect(slot).toBeVisible({ timeout: 10_000 });
    const slotLabel = await slot.innerText();
    await slot.click();
    await expect(page1).toHaveURL(/\/patient\/book\//);
    await page1.getByRole("button", { name: /Pay .* and book/i }).click();
    // Slot is now held (not yet paid) — second patient should not see it.

    await login(page2, "patient.two@example.com");
    await page2.goto(page1.url().split("?")[0]!.replace("/patient/book/", "/doctors/"));
    await page2.getByRole("option").nth(1).click();
    await expect(page2.getByRole("button", { name: slotLabel, exact: true })).toHaveCount(0, { timeout: 10_000 });
  });
});
