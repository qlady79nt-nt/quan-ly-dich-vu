import { Users, Scissors, Package, ShoppingCart, ArrowRight, LayoutGrid } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../lib/auth';

const Dashboard = () => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const quickActions = isSuperAdmin ? [
    { label: 'Danh sách Cửa hàng', icon: LayoutGrid, path: '/app/shops', color: 'var(--primary)' }
  ] : [
    { label: 'Bán lẻ & Làm dịch vụ', icon: ShoppingCart, path: '/app/pos', color: 'var(--primary)' },
    { label: 'Trừ buổi liệu trình', icon: Package, path: '/app/pos', color: 'var(--success)' },
    { label: 'Thêm dịch vụ mới', icon: Scissors, path: '/app/services', color: 'var(--secondary)' },
    { label: 'Quản lý nhân viên', icon: Users, path: '/app/staff', color: 'var(--warning)' },
  ];

  return (
    <div className="animate-fade">
      <div style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>Chào buổi sáng! 👋</h2>
        <p style={{ color: 'var(--text-secondary)' }}>Hôm nay bạn muốn thực hiện thao tác nào?</p>
      </div>

      <div className="grid grid-cols-4" style={{ marginBottom: '3rem' }}>
        {quickActions.map((action, idx) => (
          <Link key={idx} to={action.path} style={{ textDecoration: 'none' }}>
            <div className="premium-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: '1rem', cursor: 'pointer' }}>
              <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: `${action.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: action.color }}>
                <action.icon size={30} />
              </div>
              <div style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{action.label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--primary)', fontWeight: '600' }}>
                Thực hiện ngay <ArrowRight size={14} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-2">
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem' }}>{isSuperAdmin ? 'Lưu ý Quản trị Hệ thống' : 'Lưu ý vận hành'}</h3>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {isSuperAdmin ? [
              'Tất cả dữ liệu của các cửa hàng được phân tách hoàn toàn (Multi-tenant).',
              'Chỉ Super Admin mới có quyền tạo mã cửa hàng và chỉnh sửa thời hạn sử dụng.',
              'Mỗi cửa hàng có một tài khoản Shop Admin riêng để tự vận hành.',
              'Tuyệt đối không cấp quyền Super Admin cho người ngoài.'
            ].map((note, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <div style={{ color: 'var(--success)' }}>✔</div>
                {note}
              </li>
            )) : [
              'Doanh thu chỉ được tính khi dịch vụ ĐÃ thực hiện.',
              'Bán liệu trình chỉ ghi nhận tiền mặt thu về, chưa tính doanh thu.',
              'Hoa hồng nhân viên phát sinh tại thời điểm làm dịch vụ hoặc bán gói.',
              'Luôn kiểm tra số dư nguyên vật liệu trước khi làm.'
            ].map((note, i) => (
              <li key={i} style={{ display: 'flex', gap: '0.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                <div style={{ color: 'var(--success)' }}>✔</div>
                {note}
              </li>
            ))}
          </ul>
        </div>

        <div className="premium-card" style={{ background: 'linear-gradient(135deg, var(--primary), var(--primary-light))', color: 'white' }}>
          <h3 style={{ marginBottom: '1rem' }}>{isSuperAdmin ? 'Trung tâm Điều khiển' : 'Mẹo quản lý'}</h3>
          <p style={{ fontSize: '0.875rem', opacity: 0.9, lineHeight: 1.6 }}>
            {isSuperAdmin 
              ? 'Đây là phiên bản Quản lý SaaS (Software as a Service). Nhiệm vụ của bạn là kiểm soát các tài khoản khách hàng đăng ký sử dụng phần mềm.'
              : 'Hệ thống của bạn đang được cấu hình theo mô hình quản lý Spa hiện đại nhất. Việc tách biệt Doanh thu và Dòng tiền giúp bạn kiểm soát chính xác lãi lỗ thực tế hàng tháng.'}
          </p>
          <div style={{ marginTop: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.1)', borderRadius: '0.5rem', fontSize: '0.75rem' }}>
            💡 Gợi ý: {isSuperAdmin ? 'Theo dõi danh sách cửa hàng thường xuyên để nhắc gia hạn gói cước.' : 'Hãy kiểm tra báo cáo vào cuối ngày để đối soát hoa hồng nhân viên.'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
