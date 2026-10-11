# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: auth.spec.ts >> PULSAR Sprint 1 - Authentication & RBAC E2E Suite >> E2E-05: Organization creation automatically assigns Owner role
- Location: e2e/auth.spec.ts:62:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('E2E Testing Org')
Expected: visible
Error: strict mode violation: getByText('E2E Testing Org') resolved to 3 elements:
    1) <div class="p-3 bg-emerald-950/40 border border-emerald-800 text-emerald-300 rounded-lg text-xs flex items-center gap-2">…</div> aka getByText('Tổ chức "E2E Testing Org')
    2) <span>E2E Testing Org</span> aka getByRole('button', { name: 'E2E Testing Org owner' })
    3) <h3 class="text-sm font-semibold text-slate-200">E2E Testing Org</h3> aka getByRole('heading', { name: 'E2E Testing Org' })

Call log:
  - Expect "toBeVisible" getByText('E2E Testing Org') with timeout 5000ms
  - waiting for getByText('E2E Testing Org')

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
        - generic [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: Minh Quang (Creator)
            - generic [ref=e35]: creator
          - button "Đăng xuất" [ref=e36]
  - main [ref=e40]:
    - generic [ref=e42]:
      - generic [ref=e43]: "Sprint 1 Kiến trúc Nền tảng: Database, Auth, RLS, RBAC & Audit"
      - heading "PULSAR Platform Architecture Console" [level=1] [ref=e48]
      - paragraph [ref=e49]: Nền tảng kết nối doanh nghiệp với freelancer và chuyên gia giải quyết bài toán thực tế. Sprint 1 được bảo mật nghiêm ngặt với PostgreSQL Row Level Security (RLS), Zod validation, và kiểm thử tự động 27 tests đạt chuẩn.
      - generic [ref=e50]:
        - generic [ref=e51]: 27 Unit Tests PASS (100%)
        - generic [ref=e55]: 4 Migrations SQL Sẵn sàng
        - generic [ref=e56]: Chống leo thang quyền (Anti-Escalation)
        - generic [ref=e57]: Audit Logs Bất biến (Immutable)
    - generic [ref=e58]:
      - generic [ref=e59]:
        - generic [ref=e60]:
          - img "Avatar" [ref=e61]
          - generic [ref=e62]:
            - generic [ref=e63]:
              - text: Minh Quang (Creator)
              - generic [ref=e64]: "Role: creator"
            - generic [ref=e65]: creator.developer@pulsar.dev
        - generic [ref=e66]:
          - generic [ref=e67]: "Chuyển Persona kiểm thử:"
          - button "Creator" [ref=e68]
          - button "Business" [ref=e69]
          - button "Admin" [ref=e70]
      - generic [ref=e71]:
        - generic [ref=e72]:
          - generic [ref=e73]:
            - generic [ref=e79]:
              - heading "Hồ sơ người dùng (Profiles Table)" [level=2] [ref=e80]
              - paragraph [ref=e81]:
                - text: "RLS Policy: Chỉ chủ sở hữu"
                - code [ref=e82]: auth.uid() = id
                - text: mới được cập nhật.
            - generic [ref=e83]: "Vai trò: creator"
          - generic [ref=e85]:
            - generic [ref=e86]:
              - generic [ref=e87]:
                - generic [ref=e88]: Tên hiển thị (display_name)
                - textbox "Tên của bạn" [ref=e89]: Minh Quang (Creator)
              - generic [ref=e90]:
                - generic [ref=e91]: Avatar URL
                - textbox "https://..." [ref=e92]: https://api.dicebear.com/7.x/identicon/svg?seed=creator
            - generic [ref=e93]:
              - generic [ref=e94]: Tiểu sử & Chuyên môn (bio)
              - textbox "Mô tả kỹ năng hoặc giới thiệu doanh nghiệp..." [ref=e95]: Freelancer & Kỹ sư AI tại PULSAR, sẵn sàng giải quyết các bài toán thực tế.
            - generic [ref=e96]:
              - generic [ref=e97]: "Các trường hệ thống (Bất biến, chặn sửa đổi từ Client):"
              - generic [ref=e102]:
                - generic [ref=e103]: "user_id (auth.uid()):"
                - generic [ref=e104]: usr-creator-001
              - generic [ref=e105]:
                - generic [ref=e106]: "email (auth.users):"
                - generic [ref=e107]: creator.developer@pulsar.dev
              - generic [ref=e108]:
                - generic [ref=e109]: "user_roles table:"
                - generic [ref=e110]: creator (Chỉ Admin / Bootstrap được gán)
              - generic [ref=e111]:
                - generic [ref=e112]: "created_at (UTC):"
                - generic [ref=e113]: 2026-01-15T08:00:00Z
            - button "Lưu thông tin hồ sơ" [ref=e115]
        - generic [ref=e118]:
          - generic [ref=e119]:
            - generic [ref=e126]:
              - heading "Quản lý Tổ chức & Thành viên" [level=2] [ref=e127]
              - paragraph [ref=e128]: "RLS: Chỉ thành viên được đọc tổ chức; chỉ \"owner\" được mời và phân quyền."
            - button "Tạo Tổ chức mới" [ref=e129]
          - generic [ref=e131]: Tổ chức "E2E Testing Org" đã được tạo. Bạn được tự động gán quyền "owner".
          - generic [ref=e134]:
            - generic [ref=e135]:
              - button "AI Innovators Hub owner" [ref=e136]:
                - generic [ref=e137]: AI Innovators Hub
                - generic [ref=e138]: owner
              - button "E2E Testing Org owner" [ref=e139]:
                - generic [ref=e140]: E2E Testing Org
                - generic [ref=e141]: owner
            - generic [ref=e142]:
              - generic [ref=e144]:
                - generic [ref=e145]:
                  - heading "E2E Testing Org" [level=3] [ref=e146]
                  - paragraph [ref=e147]:
                    - text: "slug:"
                    - generic [ref=e148]: /e2e-testing-org
                    - text: "• loại: business"
                - generic [ref=e149]: "Quyền của bạn: owner"
              - generic [ref=e150]:
                - generic [ref=e151]: Thành viên trong tổ chức
                - generic [ref=e159]:
                  - textbox "email-thanh-vien@pulsar.dev" [ref=e160]
                  - combobox [ref=e161]:
                    - option "Thành viên (member)" [selected]
                    - option "Đồng sở hữu (owner)"
                  - button "Mời" [ref=e162]
                - generic [ref=e167]:
                  - generic [ref=e168]:
                    - generic [ref=e169]: M
                    - generic [ref=e170]:
                      - generic [ref=e171]: Minh Quang (Creator) (Bạn)
                      - generic [ref=e172]: creator.developer@pulsar.dev
                  - generic [ref=e173]: owner
      - generic [ref=e174]:
        - generic [ref=e175]:
          - generic [ref=e180]:
            - heading "Bảo mật & Audit Logs Bất biến" [level=2] [ref=e181]
            - paragraph [ref=e182]: Chỉ backend service_role đặc quyền mới có quyền ghi. Client hoàn toàn bị chặn INSERT / UPDATE / DELETE.
          - generic [ref=e183]: Xem log cá nhân (Actor scope)
        - generic [ref=e189]:
          - text: "RLS Immutability Enforcement: Bảng"
          - code [ref=e190]: public.audit_logs
          - text: "đã được thực thi lệnh SQL:"
          - code [ref=e191]: REVOKE INSERT, UPDATE, DELETE FROM public, anon, authenticated;
          - text: . Mọi hành vi sửa xóa log bảo mật đều bị chặn ngay ở tầng PostgreSQL.
        - table [ref=e193]:
          - rowgroup [ref=e194]:
            - row [ref=e195]:
              - columnheader "Thời gian (UTC)" [ref=e196]
              - columnheader "Hành động" [ref=e197]
              - columnheader "Tài nguyên" [ref=e198]
              - columnheader "Actor ID" [ref=e199]
              - columnheader "Chi tiết Metadata (JSONB)" [ref=e200]
          - rowgroup [ref=e201]:
            - row [ref=e202]:
              - cell "14:27:37 9/10/2026" [ref=e203]
              - cell "auth.user_logged_in" [ref=e204]
              - cell "auth_session (sess-849204)" [ref=e205]:
                - text: auth_session
                - generic [ref=e206]: (sess-849204)
              - cell "usr-creator-001" [ref=e207]
              - 'cell "{\"ip\":\"127.0.0.1\",\"client\":\"Pulsar Web Client v1.0\",\"mode\":\"secure_jwt\"}" [ref=e208]'
            - row [ref=e209]:
              - cell "12:30:37 9/10/2026" [ref=e210]
              - cell "admin.bootstrap_system" [ref=e211]
              - cell "system (init_migration)" [ref=e212]:
                - text: system
                - generic [ref=e213]: (init_migration)
              - cell "00000000-0000-0000-0000-000000000000" [ref=e214]
              - 'cell "{\"version\":\"Sprint 1.0\",\"migration\":\"20240101000003_admin_bootstrap_procedure.sql\"}" [ref=e215]'
            - row [ref=e216]:
              - cell "14:18:37 9/10/2026" [ref=e217]
              - cell "profile.updated" [ref=e218]
              - cell "profiles (usr-creator-001)" [ref=e219]:
                - text: profiles
                - generic [ref=e220]: (usr-creator-001)
              - cell "usr-creator-001" [ref=e221]
              - 'cell "{\"fields_changed\":[\"display_name\",\"bio\"],\"rls_policy\":\"Users can update only their own profile\"}" [ref=e222]'
  - contentinfo [ref=e223]:
    - generic [ref=e224]:
      - generic [ref=e225]: PULSAR Sprint 1 • Production-Ready Auth, RLS & Database Architecture
      - generic [ref=e226]:
        - generic [ref=e227]: TypeScript Strict Mode
        - generic [ref=e228]: PostgreSQL RLS
        - generic [ref=e229]: Vitest 27 Passed
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
> 70 |     await expect(page.getByText('E2E Testing Org')).toBeVisible();
     |                                                     ^ Error: expect(locator).toBeVisible() failed
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