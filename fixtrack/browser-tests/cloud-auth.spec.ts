import { test, expect } from '@playwright/test';
const user = { id: '11111111-1111-4111-8111-111111111111', email: 'admin@example.test', aud: 'authenticated', role: 'authenticated', created_at: '2026-11-24T00:00:00Z', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, factors: [] };
const shop = { id: '22222222-2222-4222-8222-222222222222', name: 'Cloud Test Shop', phone: '0917 555 0100', address: 'Manila' };
const encode = (data: object) => Buffer.from(JSON.stringify(data)).toString('base64url');
const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, aud: 'authenticated', role: 'authenticated', aal: 'aal1', amr: [], exp: Math.floor(Date.now() / 1000) + 3600 })}.test-signature`;

test('configured Supabase has no preview bypass and denies invalid credentials', async ({ page }) => {
  await page.route('https://abcdefghijklmnopqrst.supabase.co/**', async route => {
    await route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }) });
  });
  await page.goto('/app'); await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('link', { name: 'Explore the preview' })).toHaveCount(0);
  await page.getByLabel('Email address', { exact: true }).fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Unable to sign in');
  await expect(page).toHaveURL(/\/login$/); await expect(page.getByText('Alex Rivera', { exact: true })).toHaveCount(0);
});

test('authenticated login survives refresh and logout protects the dashboard', async ({ page }) => {
  // These are API contract mocks, not a claim that hosted Supabase was tested.
  await page.route('https://abcdefghijklmnopqrst.supabase.co/**', async route => {
    const url = new URL(route.request().url());
    let body: unknown;
    if (url.pathname.endsWith('/token')) body = { access_token: token, refresh_token: 'browser-test-refresh-token', expires_in: 3600, token_type: 'bearer', user };
    else if (url.pathname.endsWith('/user')) body = user;
    else if (url.pathname.endsWith('/logout')) { await route.fulfill({ status: 204 }); return; }
    else if (url.pathname.endsWith('/memberships')) body = [{ shop_id: shop.id, role: 'owner', display_name: 'Cloud Test Admin' }];
    else if (url.pathname.endsWith('/shops')) body = shop;
    else body = [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  await page.goto('/login');
  await page.getByLabel('Email address', { exact: true }).fill(user.email); await page.getByLabel('Password', { exact: true }).fill('browser-test-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await expect(page.getByText('Cloud Test Admin', { exact: true })).toBeVisible();
  await expect(page.getByText('Local preview', { exact: true })).toHaveCount(0);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Overview', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page).toHaveURL(/\/login$/);
  await page.goto('/app'); await expect(page).toHaveURL(/\/login$/);
});
