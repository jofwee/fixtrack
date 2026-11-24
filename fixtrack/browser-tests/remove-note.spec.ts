import { test, expect } from '@playwright/test';
test('admin can cancel or confirm note removal without removing stage history', async ({ page }) => {
  await page.goto('/app/repairs/preview-0');
  await page.getByRole('button', { name: 'Add update', exact: true }).click();
  await page.getByLabel('Update', { exact: true }).fill('A note added by mistake.');
  await page.getByRole('button', { name: 'Confirm & save', exact: true }).click();
  const item = page.locator('.event-timeline li').filter({ hasText: 'A note added by mistake.' });
  await item.getByRole('button', { name: 'Remove note', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('A private administrative audit copy will be retained.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: 'Remove note', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Remove note', exact: true }).click();
  await expect(item).toHaveCount(0);
  await page.reload(); await expect(page.locator('.event-timeline')).not.toContainText('A note added by mistake.');
  await expect(page.locator('.event-timeline').getByText('Received', { exact: true })).toBeVisible();
  await expect(page.locator('.event-timeline').getByText('Repairing', { exact: true })).toBeVisible();
});
