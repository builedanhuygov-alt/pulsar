import { test, expect } from '@playwright/test';

test.describe('PULSAR Sprint 1 - Authentication & RBAC E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('E2E-01: Render application console and navigation bar correctly', async ({ page }) => {
    await expect(page.getByText('PULSAR', { exact: true })).toBeVisible();
    await expect(page.getByText('Sprint 1 Core', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'RLS Security' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Vitest Suite/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /SQL Migrations/ })).toBeVisible();
  });

  test('E2E-02: Form validation prevents submission of weak password and malformed email', async ({ page }) => {
    // Navigate to Auth View
    await page.click('button[title="Đăng xuất"]');

    // Switch to Register form
    await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();

    // Fill invalid email and weak password
    await page.fill('input[placeholder="creator@pulsar.dev"]', 'invalid-email');
    await page.fill('input[placeholder="••••••••"]', '123');
    await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();

    // Expect Zod validation messages
    await expect(page.getByText('Địa chỉ email không hợp lệ')).toBeVisible();
    await expect(page.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeVisible();
  });

  test('E2E-03: Quick Persona switching validates Role-Based Access Control (RBAC)', async ({ page }) => {
    // Switch to Creator Persona
    await page.getByRole('button', { name: 'Creator' }).click();
    await expect(page.getByText('Role: creator')).toBeVisible();
    await expect(page.getByText('Xem log cá nhân (Actor scope)')).toBeVisible();

    // Switch to Business Persona
    await page.getByRole('button', { name: 'Business' }).click();
    await expect(page.getByText('Role: business')).toBeVisible();

    // Switch to Admin Persona
    await page.getByRole('button', { name: 'Admin' }).click();
    await expect(page.getByText('Role: admin')).toBeVisible();
    await expect(page.getByText('Đặc quyền: Xem toàn bộ audit log')).toBeVisible();
  });

  test('E2E-04: User Profile updates enforce whitelist schema', async ({ page }) => {
    // Change display name
    const displayNameInput = page.locator('input[placeholder="Tên của bạn"]');
    await displayNameInput.fill('Kỹ Sư PULSAR Đã Xác Minh');

    // Submit profile update
    await page.getByRole('button', { name: 'Lưu thông tin hồ sơ' }).click();

    // Expect success message
    await expect(page.getByText('Hồ sơ cá nhân đã được cập nhật thành công!')).toBeVisible();
  });

  test('E2E-05: Organization creation automatically assigns Owner role', async ({ page }) => {
    await page.getByRole('button', { name: 'Tạo Tổ chức mới' }).click();

    // Fill organization modal
    await page.fill('input[placeholder*="Đại học Bách Khoa"]', 'E2E Testing Org');
    await page.getByRole('button', { name: 'Xác nhận tạo' }).click();

    // Verify created and owner badge is present
    await expect(page.getByText('E2E Testing Org')).toBeVisible();
    await expect(page.locator('span:has-text("owner")').first()).toBeVisible();
  });

  test('E2E-06: RLS Security Matrix verifies database policies', async ({ page }) => {
    await page.getByRole('button', { name: 'RLS Security' }).click();

    // Check key policies
    await expect(page.getByText('User A sửa hồ sơ của User B')).toBeVisible();
    await expect(page.getByText('Creator tự nâng quyền thành Admin')).toBeVisible();
    await expect(page.getByText('Client giả mạo hoặc xóa Audit Logs bảo mật')).toBeVisible();
    await expect(page.getByText('Chống truy cập vòng lặp vô hạn trong RLS')).toBeVisible();

    // Check pass badge
    await expect(page.locator('text=100% Passed')).toBeVisible();
  });

  test('E2E-07: Sign out flow transitions state securely', async ({ page }) => {
    // Click logout button in header
    await page.click('button[title="Đăng xuất"]');

    // Verify state transitioned
    await expect(page.getByText('Bạn chưa đăng nhập')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng nhập vào PULSAR' })).toBeVisible();
  });
});
