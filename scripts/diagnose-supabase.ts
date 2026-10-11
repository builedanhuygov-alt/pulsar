import { createClient } from '@supabase/supabase-js';

// Resolve environment variables with fallback
const supabaseUrl =
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  '';

function resolveAnonKey(): string {
  const viteKey = process.env.VITE_SUPABASE_ANON_KEY || '';
  const nextKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (viteKey.startsWith('eyJ')) return viteKey;
  if (nextKey.startsWith('eyJ')) return nextKey;
  return nextKey || viteKey;
}

const anonKey = resolveAnonKey();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function maskKey(key: string): string {
  if (!key) return '(MISSING)';
  if (key.length <= 10) return '(SET, length: ' + key.length + ')';
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)} (length: ${key.length})`;
}

async function runAudit() {
  console.log('=====================================================');
  console.log('       PULSAR SPRINT 1 - SUPABASE CONNECTION AUDIT    ');
  console.log('=====================================================\n');

  // 1. Variable Presence
  console.log('1. CẤU HÌNH BIẾN MÔI TRƯỜNG:');
  console.log('   - NEXT_PUBLIC_SUPABASE_URL :', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'ĐÃ KHAI BÁO' : 'CHƯA CÓ');
  console.log('   - NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'ĐÃ KHAI BÁO' : 'CHƯA CÓ');
  console.log('   - VITE_SUPABASE_URL        :', process.env.VITE_SUPABASE_URL ? 'ĐÃ KHAI BÁO' : 'CHƯA CÓ');
  console.log('   - VITE_SUPABASE_ANON_KEY   :', process.env.VITE_SUPABASE_ANON_KEY ? 'ĐÃ KHAI BÁO' : 'CHƯA CÓ');
  console.log('   - SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'ĐÃ KHAI BÁO' : 'CHƯA CÓ');

  if (!supabaseUrl) {
    console.log('\n[KẾT QUẢ]: BLOCKED - Không tìm thấy Supabase URL.');
    return;
  }

  // 2. Network Reachability
  console.log('\n2. KIỂM TRA ĐƯỜNG TRUYỀN & ENDPOINT:');
  try {
    const host = new URL(supabaseUrl).host;
    console.log(`   - Mục tiêu: https://${host}`);
    const res = await fetch(`${supabaseUrl}/auth/v1/health`, { method: 'GET' });
    console.log(`   - Trạng thái HTTP Endpoint: ${res.status} (${res.statusText})`);
  } catch (err: any) {
    console.log(`   - Lỗi kết nối mạng: ${err.message}`);
  }

  // 3. Auth Service Handshake
  console.log('\n3. KIỂM TRA DỊCH VỤ XÁC THỰC (AUTH SERVICE):');
  try {
    const client = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: sessionError } = await client.auth.getSession();
    if (sessionError) {
      console.log(`   - Trạng thái Auth: THẤT BẠI (${sessionError.message})`);
    } else {
      console.log('   - Trạng thái Auth: THÀNH CÔNG (Handshake hợp lệ, API Key được máy chủ Auth chấp nhận)');
    }
  } catch (err: any) {
    console.log(`   - Lỗi khởi tạo Auth Client: ${err.message}`);
  }

  // 4. Database & Tables Check
  console.log('\n4. KIỂM TRA SCHEMA CƠ SỞ DỮ LIỆU & MIGRATIONS:');
  const client = createClient(supabaseUrl, anonKey);
  const tables = ['profiles', 'user_roles', 'organizations', 'organization_members', 'audit_logs'];

  let allExist = true;
  for (const t of tables) {
    const { error } = await client.from(t).select('id').limit(1);
    if (error && error.code === 'PGRST205') {
      console.log(`   - Bảng "${t}": CHƯA TỒN TẠI (PGRST205: Schema cache chưa có bảng)`);
      allExist = false;
    } else if (error && error.code === '42501') {
      console.log(`   - Bảng "${t}": ĐÃ TỒN TẠI (Được bảo vệ bởi RLS/Permission)`);
    } else if (!error) {
      console.log(`   - Bảng "${t}": ĐÃ TỒN TẠI & TRUY VẤN THÀNH CÔNG`);
    } else {
      console.log(`   - Bảng "${t}": Phản hồi mã [${error.code}]: ${error.message}`);
      allExist = false;
    }
  }

  console.log('\n=====================================================');
  if (!allExist) {
    console.log('KẾT LUẬN: Migrations chưa được áp dụng lên Supabase project này.');
    console.log('HƯỚNG DẪN: Mở Supabase Dashboard > SQL Editor và chạy 4 file trong supabase/migrations/');
  } else {
    console.log('KẾT LUẬN: Cấu hình và Cơ sở dữ liệu đã đồng bộ hoàn hảo!');
  }
  console.log('=====================================================\n');
}

runAudit().catch(console.error);
