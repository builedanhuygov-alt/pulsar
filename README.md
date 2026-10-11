<<<<<<< HEAD
# PULSAR — Sprint 1 Core Platform

> **Nền tảng kết nối doanh nghiệp với freelancer, sinh viên và chuyên gia để giải quyết bài toán thực tế.**
> **Sprint 1: Database & Migrations, Supabase Auth, Profiles, Strict RBAC, Organizations, Audit Logs & RLS Security.**

---

## 1. TỔNG QUAN KIẾN TRÚC SPRINT 1

Sprint 1 tập trung xây dựng nền móng an ninh, dữ liệu và kiểm thử vững chắc cho PULSAR:

1. **Database & Migrations**:
   - `profiles`: Gắn chặt với `auth.users(id) ON DELETE CASCADE`.
   - `user_roles`: Phân quyền RBAC (`creator`, `business`, `admin`).
   - `organizations`: Quản lý tổ chức (`business`, `agency`, `school`, `partner`).
   - `organization_members`: Thành viên tổ chức với quyền `owner` và `member`.
   - `audit_logs`: Bảng nhật ký kiểm toán bất biến (**Immutable**), chỉ backend đặc quyền với `service_role` mới được ghi.
   - Timestamps luôn chuẩn hóa **UTC** (`timestamptz`).
   - Triggers: Tự động khởi tạo `profile` khi đăng ký, gán quyền an toàn (chống tiêm nhiễm quyền `admin`), gán `owner` khi tạo tổ chức.

2. **Bảo mật Row Level Security (RLS)**:
   - Kích hoạt RLS trên **100%** bảng chứa dữ liệu người dùng (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`).
   - Viết các hàm `SECURITY DEFINER` với `SET search_path = public` (`is_admin()`, `is_org_member()`, `is_org_owner()`) nhằm **chống đệ quy vô hạn (infinite recursion)**.
   - Thu hồi toàn bộ quyền sửa/xóa audit log: `REVOKE INSERT, UPDATE, DELETE ON TABLE public.audit_logs FROM public, anon, authenticated;`.

3. **Xác thực & Ủy quyền (Auth & RBAC)**:
   - Xác thực qua Supabase Auth (Email / Password).
   - Validation chặt chẽ tầng ứng dụng bằng **Zod**.
   - Phân quyền theo ma trận `ROLE_PERMISSIONS` (Creator, Business, Admin).
   - Ngăn chặn hoàn toàn việc tự thăng quyền (Privilege Escalation).
   - Quy trình bootstrap Admin đầu tiên thông qua Stored Procedure đặc quyền (`bootstrap_admin_user`).

---

## 2. CẤU TRÚC THƯ MỤC DỰ ÁN

```
pulsar/
├── app/                           # Next.js App Router (Pages & API Routes)
│   ├── layout.tsx                 # Root Layout
│   ├── page.tsx                   # Trang chủ điều hướng
│   └── api/
│       └── admin/bootstrap/       # API khởi tạo Admin đặc quyền
├── components/                    # React UI Components
│   ├── Navbar.tsx                 # Header & Navigation
│   ├── AuthForms.tsx              # Đăng ký, Đăng nhập, Quên mật khẩu & Persona Switcher
│   ├── ProfileManager.tsx         # Quản lý hồ sơ & RLS Profile
│   ├── OrgManager.tsx             # Quản lý Tổ chức & Phân quyền Owner/Member
│   ├── AuditLogViewer.tsx         # Giám sát Audit Log bất biến
│   ├── RlsTester.tsx              # Bộ mô phỏng & kiểm chứng 7 kịch bản RLS
│   ├── TestRunnerPanel.tsx        # Trình chạy kiểm thử Vitest giao diện
│   └── MigrationViewer.tsx        # Trình xem & sao chép SQL Migrations
├── lib/
│   ├── supabase/                  # Clients & Middleware
│   │   ├── client.ts              # Browser Client (Anon Key)
│   │   ├── server.ts              # Next.js Server Client (@supabase/ssr)
│   │   ├── admin.ts               # Privileged Admin Client (Service Role Key - Server only)
│   │   └── middleware.ts          # Route Guard & Session Refresh
│   ├── auth/                      # Business Logic & RBAC
│   │   ├── roles.ts               # Ma trận quyền & Logic chống thăng cấp
│   │   ├── session.ts             # Trích xuất phiên & tải hồ sơ/vai trò
│   │   └── audit.ts               # Hàm ghi log kiểm toán an toàn
│   └── validation/                # Zod Schemas
│       ├── auth.schema.ts         # Schema đăng ký, đăng nhập, reset mật khẩu
│       ├── profile.schema.ts      # Schema cập nhật hồ sơ (chặn chèn id/role)
│       ├── org.schema.ts          # Schema tạo tổ chức, slug, mời thành viên
│       └── audit.schema.ts        # Schema payload audit log (giới hạn 8KB)
├── supabase/
│   └── migrations/                # SQL Migrations tuần tự
│       ├── 20240101000000_create_base_schema.sql
│       ├── 20240101000001_create_rls_policies.sql
│       ├── 20240101000002_create_auth_triggers.sql
│       └── 20240101000003_admin_bootstrap_procedure.sql
├── tests/                         # Unit & Integration Tests (Vitest)
│   ├── validation.test.ts         # 13 tests Zod validation
│   ├── roles.test.ts              # 5 tests RBAC & Privilege Escalation
│   ├── auth-flow.test.ts          # 4 tests Luồng xác thực & Trigger sanitization
│   └── rls-logic.test.ts          # 5 tests Kiểm chứng logic RLS PostgreSQL
├── e2e/                           # Playwright E2E Test Scenarios
│   └── auth.spec.ts               # Kịch bản kiểm thử End-to-End
├── types/                         # TypeScript Type Definitions
│   ├── database.types.ts          # Định nghĩa kiểu bảng Supabase
│   └── auth.types.ts              # Kiểu người dùng, Session, Quyền
├── .env.example                   # Mẫu biến môi trường
├── package.json                   # Dependencies & Scripts
├── vitest.config.ts               # Cấu hình Vitest
└── README.md                      # Tài liệu kỹ thuật
```

---

## 3. HƯỚNG DẪN CÀI ĐẶT & CHẠY LOCAL

### Yêu cầu hệ thống:
- **Node.js**: Phiên bản 20.x trở lên.
- **npm** hoặc **pnpm**.
- Hệ điều hành: **Windows (cmd / PowerShell)**, **macOS**, hoặc **Linux (Ubuntu/Debian)**.

### Bước 1: Clone và Cài đặt Dependencies

**Trên Windows (PowerShell / Command Prompt):**
```powershell
# Clone mã nguồn
git clone <URL_REPOSITORY>
cd pulsar

# Cài đặt toàn bộ thư viện
npm install
```

**Trên macOS / Linux:**
```bash
git clone <URL_REPOSITORY>
cd pulsar
npm install
```

---

## 4. KẾT NỐI SUPABASE & THIẾT LẬP BIẾN MÔI TRƯỜNG

1. Tạo một dự án mới tại [https://supabase.com](https://supabase.com).
2. Tạo tệp `.env.local` (hoặc sao chép từ `.env.example`):

```bash
cp .env.example .env.local
```

3. Điền các khóa bảo mật từ mục **Project Settings > API** trên Supabase Dashboard:

```env
# Supabase URL và Public Anon Key (Dùng an toàn cho Client-Side)
NEXT_PUBLIC_SUPABASE_URL="https://xxxxxxxxxxxxxxxx.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# VITE alias cho preview app
VITE_SUPABASE_URL="https://xxxxxxxxxxxxxxxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Supabase Service Role Key (CHỈ DÙNG PHÍA SERVER - TUYỆT ĐỐI KHÔNG LỘ RA CLIENT)
SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.service_role..."

# Khóa bí mật cho thủ tục bootstrap admin khẩn cấp
ADMIN_BOOTSTRAP_SECRET="super-strong-bootstrap-secret-change-me"
```

---

## 5. THỰC THI MIGRATIONS SQL

Bạn có thể chạy migrations bằng một trong 2 cách:

### Cách A: Chạy qua Supabase Dashboard SQL Editor (Đơn giản nhất)
1. Mở Supabase Dashboard > **SQL Editor**.
2. Sao chép và chạy lần lượt 4 file trong thư mục `supabase/migrations/`:
   - `20240101000000_create_base_schema.sql` (Tạo bảng & cấu trúc)
   - `20240101000001_create_rls_policies.sql` (Bật RLS & các chính sách an ninh)
   - `20240101000002_create_auth_triggers.sql` (Kích hoạt triggers tự động tạo profile & role)
   - `20240101000003_admin_bootstrap_procedure.sql` (Nạp thủ tục cấp quyền admin)

### Cách B: Sử dụng Supabase CLI
```bash
# Đăng nhập Supabase CLI
npx supabase login

# Liên kết với project
npx supabase link --project-ref your-project-ref

# Thực thi migration
npx supabase db push
```

---

## 6. QUY TRÌNH TẠO TÀI KHOẢN ADMIN ĐẦU TIÊN (BOOTSTRAP ADMIN)

> **Nguyên tắc bảo mật:** Không bao giờ mở đăng ký công khai cho vai trò `admin`. Mọi yêu cầu đăng ký tự xưng `admin` từ client đều bị trigger `handle_new_user` tự động khử khuẩn và ép về `creator`.

Để cấp quyền Super Admin cho một tài khoản ban đầu:
1. Đăng ký tài khoản người dùng bình thường qua giao diện với email, ví dụ: `admin@pulsar.dev`.
2. Mở **Supabase SQL Editor** và chạy thủ tục đặc quyền:
   ```sql
   SELECT * FROM public.bootstrap_admin_user('admin@pulsar.dev', 'Khởi tạo tài khoản quản trị hệ thống Sprint 1');
   ```
3. Kết quả trả về `success = true`, đồng thời một bản ghi kiểm toán được tự động lưu vào `audit_logs`.

---

## 7. KIỂM THỬ, LINT & BUILD PRODUCTION

### 1. Chạy Unit Tests (Vitest)
```bash
npm test
```
*Kết quả thực tế đã kiểm chứng: **4 Test Files passed (100%), 27 Tests passed***:
- `tests/validation.test.ts`: 13 tests.
- `tests/roles.test.ts`: 5 tests.
- `tests/rls-logic.test.ts`: 5 tests.
- `tests/auth-flow.test.ts`: 4 tests.

### 2. Kiểm tra TypeScript Strict Mode
```bash
npm run lint
```
Chạy `tsc --noEmit` xác thực toàn bộ kiểu dữ liệu không có bất kỳ lỗi nào.

### 3. Build Production
```bash
npm run build
```
Biên dịch dự án ra thư mục `dist/` sẵn sàng triển khai.

### 4. Chạy Development Server
```bash
npm run dev
```
Mở trình duyệt tại: `http://localhost:3000`

---

## 8. BÁO CÁO KẾT QUẢ KIỂM THỬ SPRINT 1

| Hạng mục | Số lượng tests | Trạng thái | Ghi chú |
| :--- | :---: | :---: | :--- |
| **A. Authentication Validation** | 7 tests | **PASS** | Kiểm tra email, độ mạnh mật khẩu, chặn role `admin`, khớp mật khẩu reset. |
| **B. Profile Security** | 2 tests | **PASS** | Kiểm tra cập nhật hợp lệ và chặn chèn trường hệ thống (`id`, `role`, `created_at`). |
| **C. Organization Validation** | 2 tests | **PASS** | Kiểm tra format slug regex, loại tổ chức (`business`, `agency`, `school`, `partner`). |
| **D. Audit Log Immutability** | 2 tests | **PASS** | Kiểm tra payload hợp lệ và chặn dữ liệu metadata vượt quá 8KB. |
| **E. RBAC & Permissions** | 5 tests | **PASS** | Kiểm tra Creator/Business/Admin matrix; chặn Creator/Business nâng cấp quyền. |
| **F. Luồng Auth & Sanitization** | 4 tests | **PASS** | Kiểm tra trigger logic tự động hạ cấp `role: admin` về `creator`. |
| **G. PostgreSQL RLS Policies** | 5 tests | **PASS** | Kiểm tra chặn User A sửa User B, chặn đọc org khác, chặn client sửa audit log. |
| **Tổng cộng** | **27 tests** | **100% PASS** | Đã thực thi qua `npx vitest run` trên môi trường thực tế. |

### Đánh giá Rủi ro & Khuyến nghị Sprint 2:
1. **Supabase Rate Limiting**: Trong môi trường production, cần bật Rate Limiting cho endpoint email để chống brute-force mật khẩu.
2. **MFA / 2FA**: Cần tích hợp Supabase TOTP / Multi-Factor Authentication cho các tài khoản có vai trò `admin`.
3. **E2E Testing trong CI/CD**: Khi gắn kết nối với Supabase Cloud thật trong pipeline GitHub Actions, chạy `npx playwright test` với cơ sở dữ liệu test chuyên dụng.
=======
<div align="center">

<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

  <h1>Built with AI Studio</h2>

  <p>The fastest path from prompt to production with Gemini.</p>

  <a href="https://aistudio.google.com/apps">Start building</a>

</div>
>>>>>>> bb81b37686936bdd164340c933cf2455cdb215b1
