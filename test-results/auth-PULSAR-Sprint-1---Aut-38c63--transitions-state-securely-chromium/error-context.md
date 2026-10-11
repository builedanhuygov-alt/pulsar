# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> PULSAR Sprint 1 - Authentication & RBAC E2E Suite >> E2E-07: Sign out flow transitions state securely
- Location: e2e/auth.spec.ts:87:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('Bạn chưa đăng nhập')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByText('Bạn chưa đăng nhập') with timeout 5000ms
  - waiting for getByText('Bạn chưa đăng nhập')

```

```yaml
- banner:
  - text: P PULSAR Sprint 1 Core
  - paragraph: Auth • RLS • RBAC • Orgs
  - navigation:
    - button "Console"
    - button "RLS Security"
    - button "Vitest Suite (27)"
    - button "SQL Migrations"
  - text: Supabase Live
  - button "Đăng nhập / Đăng ký"
- main:
  - text: "Sprint 1 Kiến trúc Nền tảng: Database, Auth, RLS, RBAC & Audit"
  - heading "PULSAR Platform Architecture Console" [level=1]
  - paragraph: Nền tảng kết nối doanh nghiệp với freelancer và chuyên gia giải quyết bài toán thực tế. Sprint 1 được bảo mật nghiêm ngặt với PostgreSQL Row Level Security (RLS), Zod validation, và kiểm thử tự động 27 tests đạt chuẩn.
  - text: "27 Unit Tests PASS (100%) 4 Migrations SQL Sẵn sàng Chống leo thang quyền (Anti-Escalation) Audit Logs Bất biến (Immutable) Thử nghiệm nhanh theo Persona (Kiểm thử RBAC):"
  - button "🧑‍💻 Creator"
  - button "🏢 Business"
  - button "🛡️ Admin"
  - button "Đăng nhập"
  - button "Đăng ký tài khoản"
  - text: Email
  - textbox "name@pulsar.dev"
  - text: Mật khẩu
  - button "Quên mật khẩu?"
  - textbox "••••••••"
  - button "Đăng nhập vào PULSAR"
- contentinfo: PULSAR Sprint 1 • Production-Ready Auth, RLS & Database Architecture TypeScript Strict Mode PostgreSQL RLS Vitest 27 Passed
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('PULSAR Sprint 1 - Authentication & RBAC E2E Suite', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     await page.goto('/');
  6  |   });
  7  | 
  8  |   test('E2E-01: Render application console and navigation bar correctly', async ({ page }) => {
  9  |     await expect(page.getByText('PULSAR', { exact: true })).toBeVisible();
  10 |     await expect(page.getByText('Sprint 1 Core', { exact: true })).toBeVisible();
  11 |     await expect(page.getByRole('button', { name: 'Console' })).toBeVisible();
  12 |     await expect(page.getByRole('button', { name: 'RLS Security' })).toBeVisible();
  13 |     await expect(page.getByRole('button', { name: /Vitest Suite/ })).toBeVisible();
  14 |     await expect(page.getByRole('button', { name: /SQL Migrations/ })).toBeVisible();
  15 |   });
  16 | 
  17 |   test('E2E-02: Form validation prevents submission of weak password and malformed email', async ({ page }) => {
  18 |     // Navigate to Auth View
  19 |     await page.click('button[title="Đăng xuất"]');
  20 | 
  21 |     // Switch to Register form
  22 |     await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();
  23 | 
  24 |     // Fill invalid email and weak password
  25 |     await page.fill('input[placeholder="creator@pulsar.dev"]', 'invalid-email');
  26 |     await page.fill('input[placeholder="••••••••"]', '123');
  27 |     await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();
  28 | 
  29 |     // Expect Zod validation messages
  30 |     await expect(page.getByText('Địa chỉ email không hợp lệ')).toBeVisible();
  31 |     await expect(page.getByText('Mật khẩu phải có ít nhất 8 ký tự')).toBeVisible();
  32 |   });
  33 | 
  34 |   test('E2E-03: Quick Persona switching validates Role-Based Access Control (RBAC)', async ({ page }) => {
  35 |     // Switch to Creator Persona
  36 |     await page.getByRole('button', { name: 'Creator' }).click();
  37 |     await expect(page.getByText('Role: creator')).toBeVisible();
  38 |     await expect(page.getByText('Xem log cá nhân (Actor scope)')).toBeVisible();
  39 | 
  40 |     // Switch to Business Persona
  41 |     await page.getByRole('button', { name: 'Business' }).click();
  42 |     await expect(page.getByText('Role: business')).toBeVisible();
  43 | 
  44 |     // Switch to Admin Persona
  45 |     await page.getByRole('button', { name: 'Admin' }).click();
  46 |     await expect(page.getByText('Role: admin')).toBeVisible();
  47 |     await expect(page.getByText('Đặc quyền: Xem toàn bộ audit log')).toBeVisible();
  48 |   });
  49 | 
  50 |   test('E2E-04: User Profile updates enforce whitelist schema', async ({ page }) => {
  51 |     // Change display name
  52 |     const displayNameInput = page.locator('input[placeholder="Tên của bạn"]');
  53 |     await displayNameInput.fill('Kỹ Sư PULSAR Đã Xác Minh');
  54 | 
  55 |     // Submit profile update
  56 |     await page.getByRole('button', { name: 'Lưu thông tin hồ sơ' }).click();
  57 | 
  58 |     // Expect success message
  59 |     await expect(page.getByText('Hồ sơ cá nhân đã được cập nhật thành công!')).toBeVisible();
  60 |   });
  61 | 
  62 |   test('E2E-05: Organization creation automatically assigns Owner role', async ({ page }) => {
  63 |     await page.getByRole('button', { name: 'Tạo Tổ chức mới' }).click();
  64 | 
  65 |     // Fill organization modal
  66 |     await page.fill('input[placeholder*="Đại học Bách Khoa"]', 'E2E Testing Org');
  67 |     await page.getByRole('button', { name: 'Xác nhận tạo' }).click();
  68 | 
  69 |     // Verify created and owner badge is present
  70 |     await expect(page.getByText('E2E Testing Org')).toBeVisible();
  71 |     await expect(page.locator('span:has-text("owner")').first()).toBeVisible();
  72 |   });
  73 | 
  74 |   test('E2E-06: RLS Security Matrix verifies database policies', async ({ page }) => {
  75 |     await page.getByRole('button', { name: 'RLS Security' }).click();
  76 | 
  77 |     // Check key policies
  78 |     await expect(page.getByText('User A sửa hồ sơ của User B')).toBeVisible();
  79 |     await expect(page.getByText('Creator tự nâng quyền thành Admin')).toBeVisible();
  80 |     await expect(page.getByText('Client giả mạo hoặc xóa Audit Logs bảo mật')).toBeVisible();
  81 |     await expect(page.getByText('Chống truy cập vòng lặp vô hạn trong RLS')).toBeVisible();
  82 | 
  83 |     // Check pass badge
  84 |     await expect(page.locator('text=100% Passed')).toBeVisible();
  85 |   });
  86 | 
  87 |   test('E2E-07: Sign out flow transitions state securely', async ({ page }) => {
  88 |     // Click logout button in header
  89 |     await page.click('button[title="Đăng xuất"]');
  90 | 
  91 |     // Verify state transitioned
> 92 |     await expect(page.getByText('Bạn chưa đăng nhập')).toBeVisible();
     |                                                        ^ Error: expect(locator).toBeVisible() failed
  93 |     await expect(page.getByRole('button', { name: 'Đăng nhập vào PULSAR' })).toBeVisible();
  94 |   });
  95 | });
  96 | 
```