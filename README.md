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

---

## 9. SPRINT 7 — COLLABORATION & COMMUNICATION ENGINE

Môi trường cộng tác an toàn giữa doanh nghiệp và Creator sau khi được kết nối/lựa chọn (kế thừa SP1 Auth & Orgs, SP2 Challenge, SP3 Submission, SP4 Outcome & Reward, SP5 Trust & Analytics, SP6 Matching).

### Files đã tạo / sửa
- `supabase/migrations/20240108000000_collaboration_hardening.sql` (mới, sau `20240107000000`, idempotent, không xóa dữ liệu, không chạy Cloud tự động)
- `types/collaboration.types.ts` (trạng thái chuẩn spec + normalize legacy + helpers overdue)
- `lib/validation/collaboration.schema.ts` (task/milestone/deliverable-review/notification schemas + idempotency)
- `lib/collaboration/collaborationService.ts` (sửa lỗi resolve challenge/outcome, idempotency, filters, history, reviewDeliverable, notifications fan-out)
- `lib/collaboration/notificationService.ts` (mới — recipient isolation, idempotency, body generic)
- `components/collaboration/`: `CollaborationWorkspace`, `MessagingCenter`, `ProjectTaskBoard`, `MilestoneTimeline`, `DeliverableReviewPanel`, `NotificationCenter`
- `src/App.tsx`, `components/Navbar.tsx` (tab "Cộng Tác"), `components/MigrationViewer.tsx` (hiển thị migration 07 + 08)
- `tests/collaboration-sprint7-hardening.test.ts` (10 tests H1–H10)

### Quyền RLS & tổ chức
- Đọc/gửi message, task, milestone, deliverable: chỉ active workspace member hoặc admin; notifications: `recipient_id = auth.uid()`.
- Tạo workspace: org member của challenge, admin, hoặc creator thắng giải/accepted (không tự mở từ matching).
- Duyệt: chỉ Owner/Reviewer/Admin; Creator không tự nghiệm thu (app + DB trigger `trg_deliverable_no_self_accept`).
- Thành viên bị `removed` mất quyền ngay (mọi policy check `status = 'active'`).

### Upload / realtime / notifications
- Upload thực tế **chưa tích hợp** Storage: chỉ lưu URL/metadata/version; cần private storage + signed URLs trước khi nhận binary.
- Không realtime giả: messaging/notifications dùng **polling thủ công** (toggle 15s) + nút Làm mới.
- Notifications chỉ in-app, body tóm tắt chung (không bí mật), không email/push.

### Test đã chạy
- `npx vitest run`: **13 files, 142 tests PASS** (gồm 19 SP7 gốc + 10 hardening H1–H10)
- `npx tsc --noEmit`: **PASS, 0 lỗi**
- `npm run build`: **PASS** (`dist/`, cảnh báo chunk >500KB có sẵn từ trước)

### Phần còn demo / chưa tích hợp
- Toàn bộ CollaborationService + NotificationService hiện là **in-memory local** (seed `ws-demo-001` gắn nhãn demo); chưa đấu Supabase Cloud — cần đấu API + RLS migration 07/08 rồi kiểm chứng lại trên Cloud.
- Chưa có Supabase Realtime / Storage / email-push provider.

### Kiểm tra thủ công
1. `npm install --legacy-peer-deps && npm run dev` → mở `http://localhost:3000` → tab **Cộng Tác**.
2. Persona Creator xem workspace `ws-demo-001`; gửi tin nhắn; tạo task quá hạn → kiểm tra cờ "Quá hạn".
3. Chuyển persona Business/Owner: mời member, duyệt deliverable, nghiệm thu milestone.
4. Thử truy cập workspace khi đã logout → bị chặn; thử Creator tự nghiệm thu → bị từ chối.
5. Áp migration: mở Supabase SQL Editor, chạy lần lượt `20240107000000` rồi `20240108000000` (thủ công, staging trước).

---

## 10. SP8A — FINANCIAL LEDGER & RECONCILIATION ENGINE

Nền tảng vận hành tài chính đáng tin cậy cho thưởng thử thách: sổ cái kép append-only, đối soát chỉ-đọc, điều chỉnh có phân tách nhiệm vụ. **Không phải tích hợp tiền thật — không kết nối cổng thanh toán, không khởi tạo chuyển tiền, không tuyên bố đã nhận/đã trả tiền.**

### Mô hình tài chính & giả định kế toán
- Phân biệt rõ: ngân sách dự kiến (ước tính) ≠ thưởng đã duyệt ≠ nợ phải trả ≠ attestation đang chờ ≠ đã xác minh thanh toán ≠ hủy/đảo/điều chỉnh.
- Số tiền là **số nguyên minor units** (USD/EUR cents, VND đồng), không dùng float, không gộp nhiều tiền tệ khi chưa có chính sách chuyển đổi.
- Tài khoản chỉ là buckets ghi nhớ — PULSAR **không giữ tiền khách hàng**, không có escrow pháp lý. `CASH_OPERATING_MEMO` là ghi nhớ, không phải bằng chứng ký quỹ/thanh toán. Không bịa quy tắc thuế/doanh thu.
- Nợ phải trả chỉ ghi nhận khi SP4 reward ở `approved`/`processing` (1 reward = 1 bút toán nợ, `reward_id UNIQUE`). Không tự quyết toán khi outcome tồn tại.
- **Xung đột SP4 đã ghi nhận (adapter, không sửa lịch sử):** SP4 `paid` là operator-attested qua mock adapter, không guard chuyển trạng thái — SP8A coi đó là *attested/đang chờ*, chỉ coi là verified-paid khi có payment record đối ứng.

### Files đã tạo / sửa
- `supabase/migrations/20240109000000_financial_ledger.sql` (mới, sau `20240108000000`; idempotent, không xóa dữ liệu, không chạy Cloud)
- `types/finance.types.ts`, `lib/validation/finance.schema.ts`, `lib/finance/money.ts`
- `lib/finance/financialService.ts` (journal draft/post/reverse, recognizePayable, recordPayment record-only, adjustments SoD, summary)
- `lib/finance/reconciliationService.ts` (9 luật discrepancy, fingerprint chống trùng, read-only)
- `components/finance/`: `FinancialOperations`, `FinancialOverview`, `LedgerExplorer` (table + detail), `ReconciliationDashboard` (runs + queue), `AdjustmentReviewPanel`, `FinancialAuditTimeline`
- `src/App.tsx` (tab `finance`), `components/Navbar.tsx` (nút Tài Chính), `components/MigrationViewer.tsx` (entry 09)
- `tests/finance-ledger.test.ts` (11 tests), `tests/finance-reconciliation.test.ts` (8 tests)

### Test đã chạy
- `npx vitest run`: **15 files, 161 tests PASS** (142 cũ + 19 SP8A), không regression SP1–SP7
- `npx tsc --noEmit`: **PASS, 0 lỗi** (= `npm run lint`)
- `npm run build`: **PASS** (`dist/`, cảnh báo chunk >500KB có sẵn từ trước)

---

## 11. SP8A.1 — FINANCIAL INTEGRITY HARDENING

Khắc phục vấn đề SP8A đã nêu: `updateRewardStatus` từng cho phép chuyển trạng thái tùy ý. Không triển khai SP8B, không chuyển tiền thật, không chạy migration Cloud.

### Ma trận chuyển trạng thái reward (TS + SQL đồng nhất)
| Từ \ Đến | planned | pending_approval | approved | processing | paid | failed | cancelled |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| planned | = | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| pending_approval | ❌ | = | ✅ | ❌ | ❌ | ❌ | ✅ |
| approved | ❌ | ❌ | = | ✅ | ❌ | ❌ | ✅ |
| processing | ❌ | ❌ | ❌ | = | ✅ (attested) | ✅ | ✅ |
| paid | ❌ | ❌ | ❌ | ✅ (re-processing) | = | ❌ | ❌ |
| failed / cancelled | ❌ | ❌ | ❌ | ❌ | ❌ | = | = |

Quy tắc kèm theo: chỉ chủ tổ chức hoặc admin được đổi trạng thái (member thường bị 403 — thắt chặt so với trước); người nhận không tự đổi; `planned` chỉ là trạng thái khởi tạo, không bao giờ quay lại; `paid` qua đường này là **attested** (xác nhận thủ công), verified-paid cần chứng từ đủ 100% số tiền (trước đây chỉ cần có bản ghi bất kỳ).

### Kiểm toán thực thi: SQL vs TypeScript/in-memory
| Bất biến | SQL (migration) | TS / in-memory | Ghi chú |
| :--- | :---: | :---: | :--- |
| Ma trận reward | `20240109000001` trigger `trg_rewards_status_guard` | `REWARD_TRANSITIONS` + `isRewardTransitionAllowed` (+ test G1–G4) | Đồng nhất hai lớp |
| Outcome finalized bất biến | `trg_outcomes_status_guard` | Không có mutator (kiểm chứng bằng grep) | proposed→finalized/cancelled rồi khóa |
| Sổ cái cân đối nợ=có, đơn tiền tệ | `trg_ledger_balance_guard` + `trg_ledger_posting_guard` (`20240109000000`) | `postJournal` kiểm tra trước khi mutate (+ test L1/L2/L3) | Đồng nhất hai lớp |
| Idempotency duy nhất | `UNIQUE(idempotency_key)` trên transactions/payments/adjustments | Map dedup trong adapter (+ test L5/L6/G6) | Đồng nhất hai lớp |
| Không xóa/sửa posted | `REVOKE DELETE`, không có DELETE policy | Không có API sửa posted; query trả bản sao (+ test L7/G7) | Đồng nhất hai lớp |
| SoD điều chỉnh (maker≠checker) | `CHECK (created_by IS DISTINCT FROM reviewed_by)` | `reviewAdjustment` từ chối tự duyệt (+ test L11) | Đồng nhất hai lớp |
| RLS phạm vi tổ chức | Policies org owner/admin ghi, member đọc (`20240109000000`) | `financeRoleFor` + test L10/R6/R8 | **TS không thay thế RLS — chưa kiểm chứng trên Cloud** |
| Verified-paid cần chứng từ đủ số tiền | Không (DB không thể xác minh chuyển tiền ngoài) | `rewardStage` full-coverage + đối soát `PAID_WITHOUT_EVIDENCE` (+ test G5/R3) | Giới hạn đã ghi rõ |
| Đối soát read-only, lặp ổn định | Không (logic ứng dụng) | Fingerprint dedup, không ghi sổ (+ test R5) | Chỉ tầng ứng dụng |

### Files đã tạo / sửa (SP8A.1)
- Mới: `supabase/migrations/20240109000001_reward_transition_guard.sql`, `tests/finance-transition-guard.test.ts` (8 tests G1–G8)
- Sửa: `lib/outcome/outcomeRewardService.ts` (`REWARD_TRANSITIONS`, `isRewardTransitionAllowed`, owner/admin + matrix trong `updateRewardStatus`), `lib/finance/financialService.ts` (verified đủ 100%, query trả bản sao), `tests/finance-ledger.test.ts` (L9b theo ma trận mới), `components/MigrationViewer.tsx` (entry 09.1), `README.md`

### Test đã chạy (SP8A.1)
- `npx vitest run`: **16 files, 169 tests PASS** (161 cũ + 8 mới G1–G8), không regression SP1–SP8A
- `npx tsc --noEmit`: **PASS, 0 lỗi**
- `npm run build`: **PASS** (`dist/`, cảnh báo chunk lớn có sẵn)

### Vấn đề chưa giải quyết / giới hạn còn lại (tính đến SP8A.1)
- Tích hợp RLS Cloud chưa kiểm chứng — xem §12 (đã sửa 5 điểm Critical/High, còn lại bước verify trên staging).
- Services tài chính vẫn in-memory (advisory lock dành cho production).
- ~~`paid→processing` giữ tương thích SEC-OUT-6~~ — **đã thay bằng workflow chuyên biệt trong SP8A.2** (xem §12, test SEC-OUT-6 cập nhật công khai).

---

## 12. SP8A.2 — FINAL FINANCIAL INTEGRITY REVIEW

Review toàn diện sau SP8A/SP8A.1. Không bắt đầu SP8B, không chạm Cloud, không chuyển tiền thật.

### Phát hiện (đã sửa toàn bộ mục Critical/High)
| Mức | Vấn đề | File | Sửa |
| :--- | :--- | :--- | :--- |
| 🔴 Critical | `rollback_sprint1_schema.sql` nằm trong `migrations/` — Supabase CLI sắp xếp theo tên nên file này chạy **cuối cùng** và DROP 5 bảng cốt lõi CASCADE | `supabase/migrations/rollback_*.sql` | Chuyển `rollback_*` + `consolidated_*` vào `supabase/archive/` (git mv, giữ lịch sử); thư mục migrations giờ là dãy timestamp thuần túy |
| 🔴 Critical | Trigger `handle_challenge_outcome_transition` đọc `profiles.role` (cột không tồn tại) và `organization_members.role` (tên đúng: `membership_role`) → **mọi** INSERT/UPDATE outcome đều lỗi DB | `.../20240104000000...sql:165-181` | Đọc role từ `user_roles`, sửa tên cột, dùng EXISTS boolean |
| 🔴 Critical | 7 policies SP7 kiểm tra `profiles.role = 'admin'` (cột không tồn tại) → Postgres không short-circuit OR, query RLS có thể lỗi toàn bộ | `.../20240107000000...sql` (7 vị trí) + 1× `om.role IN (...)` | Thay bằng `public.is_admin()`; `om.membership_role = 'owner'` |
| 🟠 High | Helpers `is_admin/is_org_member/is_org_owner` bản 1-arg, nhưng SP3/04/05/06 gọi 2-arg → `function does not exist` khi đánh giá policy | `.../20240101000001...sql` (+ xung đột với bản consolidated chạy sau) | Chuẩn hóa chữ ký linh hoạt `(UUID, UUID DEFAULT auth.uid())`, DROP overload cũ (bản consolidated đè ngược đã ra archive) |
| 🟠 High | `paid → processing` là flip thường qua `updateRewardStatus` (SEC-OUT-6) — tương đương thay đổi trạng thái được bảo vệ bằng một lời gọi duy nhất | `lib/outcome/outcomeRewardService.ts` | Ma trận ordinary: `paid` terminal; workflow chuyên biệt `requestRewardReprocessing()` (owner/admin + không phải recipient + lý do ≥15 ký tự + entry `REPROCESSING`); test SEC-OUT-6 cập nhật **công khai** (ordinary bị từ chối + workflow thành công) |
| 🟡 Medium | Nút RewardManager mở mọi chuyển trạng thái cho mọi user đăng nhập; nhãn "Đã Giải Ngân" gây hiểu là settlement | `components/outcomes/RewardManager.tsx` | Nút disable theo ma trận + `canManageReward` (owner/admin), thêm nút reprocessing khi paid, nhãn attested |
| 🟡 Medium | `toMinorUnits(10.5,'VND')` làm tròn câm thành 11; `parseMajorToMinor('12.5','VND')` cắt câm thành 12 | `lib/finance/money.ts` | Round-trip check + từ chối phần thập phân với tiền tệ 0-decimal (+ test G10) |
| 🔵 Low | `om.role IN ('owner','admin')` là nhánh chết (không có org-role `admin`) | 07 (đã gộp vào fix Critical) | Gộp thành `membership_role = 'owner'` (system admin đã có nhánh `is_admin()`) |

### Truy vết phân quyền (UI → TS → DB)
- UI (RewardManager/LedgerExplorer/AdjustmentReviewPanel): ẩn/disable theo ma trận + vai trò — **chỉ là gương**, service mới là thẩm quyền ở demo.
- TypeScript/in-memory: `updateRewardStatus` (owner/admin + matrix + recipient), `financeRoleFor` (viewer đọc / approver ghi), SoD, idempotency, copies chống mutate (+ test G4/G7/L10-L12).
- Database (chưa verify trên Cloud — nói rõ, không nhận tương đương): RLS owner-ghi/member-đọc, `REVOKE DELETE`, UNIQUE idempotency, trigger cân đối + guard chuyển trạng thái, SoD CHECK.
- Giới hạn trung thực: `private` của TS không phải boundary bảo mật; verified-paid không thể thực thi ở DB (không xác minh được chuyển tiền ngoài) — thuộc tầng ứng dụng + đối soát.

### Files đổi trong SP8A.2
- Sửa migrations: `20240101000001` (helpers), `20240104000000` (trigger SoD), `20240107000000` (7+1 policies), `20240109000001` (comment layering paid→processing)
- Di chuyển: `supabase/migrations/{consolidated,rollback}_*.sql` → `supabase/archive/`
- Sửa code: `outcomeRewardService.ts` (matrix + `requestRewardReprocessing`), `money.ts`, `RewardManager.tsx`, `MigrationViewer.tsx` (entry 09.1), `README.md`
- Sửa test: `outcome-reward-engine.test.ts` (SEC-OUT-6 theo workflow mới), `finance-transition-guard.test.ts` (G2/G4 + ma trận paid terminal)
- Mới: G9 (reprocessing rules), G10 (VND strictness) trong `finance-transition-guard.test.ts`

### Test đã chạy (SP8A.2)
- `npx vitest run`: **16 files, 171 tests PASS** (169 cũ + G9/G10), không regression SP1–SP8A.1
- `npx tsc --noEmit`: **PASS, 0 lỗi**
- `npm run build`: **PASS** (`dist/`, cảnh báo chunk lớn có sẵn)

### Rủi ro còn lại & staging readiness
- Rủi ro lớn nhất đã chuyển từ "lỗi chắc chắn khi deploy" (5 điểm Critical/High trên) sang "chưa kiểm chứng trên Cloud": cần staging project + `supabase db push --dry-run`, chạy lại toàn bộ trigger/policy bằng role anon/authenticated/service_role trước khi coi là xong.
- Services vẫn in-memory: staging cần adapter Supabase thật + advisory lock cho post/idempotency đa tiến trình.
- Kết luận: code **sẵn sàng cho controlled staging integration review** (theo đúng phạm vi: review migration + tests trên staging, không production, không tiền thật).
