const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {}),
  });
  const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const ready = () =>
    p.waitForFunction(
      () => document.getElementById("results").getAttribute("aria-busy") === "false",
      null,
      { timeout: 90000 },
    );
  try {
    await p.goto(process.env.PREVIEW_URL || "http://localhost:8765/notebook.html");
    await ready();
    await p.context().setOffline(true);
    assert.equal(await p.locator(".value-table tbody tr").count(), 1);
    await p.getByRole("button", { name: "Add next assignment →" }).click();
    assert.equal(await p.locator(".value-table tbody tr").count(), 2);
    await p.locator('[data-mode="build"]').click();
    await ready();
    assert.match(await p.locator("#decision").textContent(), /Accepted/);
    await p.getByRole("button", { name: "Start empty", exact: true }).click();
    await ready();
    await p.locator('[data-operation="token"]').dragTo(p.locator("#block-drop"));
    await ready();
    assert.equal(await p.locator("[data-block]").count(), 1);
    await p.locator('[data-operation="count"]').click();
    await ready();
    await p.locator('[data-operation="compare"]').click();
    await ready();
    assert.equal(await p.locator("[data-block]").count(), 3);
    await p.getByRole("button", { name: "Move A2 up", exact: true }).click();
    assert.match(await p.locator("#interaction-message").textContent(), /before it is defined/);
    assert.equal(await p.locator("[data-block]").first().getAttribute("data-block"), "A1");
    await p.getByRole("button", { name: "Remove A1", exact: true }).click();
    assert.match(await p.locator("#interaction-message").textContent(), /used by another/);
    await p.locator('[data-mode="repair"]').click();
    await ready();
    assert.match(await p.locator("#repair-feedback").textContent(), /Does not match/);
    await p.locator(".puzzle-rule select").nth(0).selectOption("<");
    await p.locator(".puzzle-rule select").nth(1).selectOption("and");
    await ready();
    assert.match(await p.locator("#decision").textContent(), /Rejected/);
    assert.match(await p.locator("#repair-feedback").textContent(), /Matches/);
    await p.getByRole("button", { name: "()(()) · should accept", exact: true }).click();
    assert.match(await p.locator("#repair-feedback").textContent(), /Matches/);
    await p.locator('[data-mode="tokens"]').click();
    await ready();
    await p.locator('[data-position="0"]').click();
    await ready();
    assert.match(await p.locator("#decision").textContent(), /Rejected/);
    assert.equal(await p.locator(".live-summary strong").nth(2).textContent(), "0");
    await p.locator('[data-mode="predict"]').click();
    await ready();
    assert.equal(await p.locator(".value-table").count(), 0);
    await p.locator(".prediction-options").getByRole("button", { name: "3", exact: true }).click();
    assert.match(await p.locator("#prediction-feedback").textContent(), /Correct/);
    assert.equal(await p.locator(".value-table").count(), 1);
    await p.getByRole("button", { name: "Next question →" }).click();
    assert.equal(await p.locator(".value-table").count(), 0);
    for (const id of ["walk", "build", "repair", "tokens", "predict"]) {
      await p.locator(`[data-mode="${id}"]`).click();
      await ready();
      await p.setViewportSize({ width: 390, height: 844 });
      assert.equal(
        await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),
        false,
        `${id} mobile overflow`,
      );
    }
    await p.locator('[data-mode="build"]').click();
    await ready();
    assert.deepEqual(errors, []);
    console.log(
      "PASS: five modes, local evaluator, drag/drop, invalid move/removal protection, repair, live edits, prediction and mobile widths.",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
