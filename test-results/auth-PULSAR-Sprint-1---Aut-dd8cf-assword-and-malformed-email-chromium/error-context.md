# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> PULSAR Sprint 1 - Authentication & RBAC E2E Suite >> E2E-02: Form validation prevents submission of weak password and malformed email
- Location: e2e/auth.spec.ts:17:3

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Đăng ký tài khoản' }) resolved to 2 elements:
    1) <button class="flex-1 pb-3 text-sm font-semibold text-center transition border-b-2 border-indigo-500 text-indigo-400">Đăng ký tài khoản</button> aka getByRole('button', { name: 'Đăng ký tài khoản' }).first()
    2) <button type="submit" class="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-lg transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2">…</button> aka locator('form').getByRole('button', { name: 'Đăng ký tài khoản' })

Call log:
  - waiting for getByRole('button', { name: 'Đăng ký tài khoản' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - banner [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e6]:
        - generic [ref=e7] [cursor=pointer]:
          - generic [ref=e8]: P
          - generic [ref=e9]:
            - generic [ref=e10]:
              - generic [ref=e11]: PULSAR
              - generic [ref=e12]: Sprint 1 Core
            - paragraph [ref=e13]: Auth • RLS • RBAC • Orgs
        - navigation [ref=e14]:
          - button "Console" [ref=e15]
          - button "RLS Security" [ref=e16]
          - button "Vitest Suite (27)" [ref=e20]
          - button "SQL Migrations" [ref=e23]
      - generic [ref=e28]:
        - generic [ref=e29]: Supabase Live
        - button "Đăng nhập / Đăng ký" [ref=e32]
  - main [ref=e33]:
    - generic [ref=e35]:
      - generic [ref=e36]: "Sprint 1 Kiến trúc Nền tảng: Database, Auth, RLS, RBAC & Audit"
      - heading "PULSAR Platform Architecture Console" [level=1] [ref=e41]
      - paragraph [ref=e42]: Nền tảng kết nối doanh nghiệp với freelancer và chuyên gia giải quyết bài toán thực tế. Sprint 1 được bảo mật nghiêm ngặt với PostgreSQL Row Level Security (RLS), Zod validation, và kiểm thử tự động 27 tests đạt chuẩn.
      - generic [ref=e43]:
        - generic [ref=e44]: 27 Unit Tests PASS (100%)
        - generic [ref=e48]: 4 Migrations SQL Sẵn sàng
        - generic [ref=e49]: Chống leo thang quyền (Anti-Escalation)
        - generic [ref=e50]: Audit Logs Bất biến (Immutable)
    - generic [ref=e52]:
      - generic [ref=e53]:
        - generic [ref=e54]: "Thử nghiệm nhanh theo Persona (Kiểm thử RBAC):"
        - generic [ref=e59]:
          - button "🧑‍💻 Creator" [ref=e60]
          - button "🏢 Business" [ref=e61]
          - button "🛡️ Admin" [ref=e62]
      - generic [ref=e63]:
        - button "Đăng nhập" [ref=e64]
        - button "Đăng ký tài khoản" [ref=e65]
      - generic [ref=e66]:
        - generic [ref=e67]:
          - generic [ref=e68]: Tên hiển thị (Display Name)
          - 'textbox "Ví dụ: Hoàng Long" [ref=e73]'
        - generic [ref=e74]:
          - generic [ref=e75]: Email
          - textbox "creator@pulsar.dev" [ref=e80]: invalid-email
        - generic [ref=e81]:
          - generic [ref=e82]: Mật khẩu (≥ 8 ký tự, có số)
          - textbox "••••••••" [active] [ref=e87]: "123"
        - generic [ref=e88]:
          - generic [ref=e89]: Vai trò ban đầu
          - generic [ref=e90]:
            - button "Creator Sinh viên, Freelancer, Chuyên gia" [ref=e91]:
              - generic [ref=e92]: Creator
              - generic [ref=e96]: Sinh viên, Freelancer, Chuyên gia
            - button "Business Doanh nghiệp, Tổ chức giải quyết đề bài" [ref=e97]:
              - generic [ref=e98]: Business
              - generic [ref=e102]: Doanh nghiệp, Tổ chức giải quyết đề bài
          - paragraph [ref=e103]: Role Admin không thể đăng ký công khai (được cấp qua bootstrap bảo mật).
        - button "Đăng ký tài khoản" [ref=e106]
  - contentinfo [ref=e109]:
    - generic [ref=e110]:
      - generic [ref=e111]: PULSAR Sprint 1 • Production-Ready Auth, RLS & Database Architecture
      - generic [ref=e112]:
        - generic [ref=e113]: TypeScript Strict Mode
        - generic [ref=e114]: PostgreSQL RLS
        - generic [ref=e115]: Vitest 27 Passed
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
> 27 |     await page.getByRole('button', { name: 'Đăng ký tài khoản' }).click();
     |                                                                   ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: 'Đăng ký tài khoản' }) resolved to 2 elements:
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
  92 |     await expect(page.getByText('Bạn chưa đăng nhập')).toBeVisible();
  93 |     await expect(page.getByRole('button', { name: 'Đăng nhập vào PULSAR' })).toBeVisible();
  94 |   });
  95 | });
  96 | 
```