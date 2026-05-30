import { Link } from 'react-router-dom';
import { Scissors, CheckCircle, Shield, Zap, LayoutGrid, Users, BarChart3, ArrowRight } from 'lucide-react';

const Landing = () => {
  return (
    <div style={{ background: 'white', minHeight: '100vh' }}>
      {/* Header công khai */}
      <header style={{ height: '80px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 5%', position: 'sticky', top: 0, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(10px)', zIndex: 1000, borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <Scissors size={24} />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, color: 'var(--text-primary)' }}>Spa & POS</h1>
        </div>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <Link to="/login" style={{ textDecoration: 'none', color: 'var(--text-primary)', fontWeight: '600' }}>Đăng nhập</Link>
          <Link to="/register" className="btn btn-primary" style={{ textDecoration: 'none' }}>Dùng thử miễn phí</Link>
        </div>
      </header>

      {/* Hero Section */}
      <section style={{ padding: '100px 5%', textAlign: 'center', background: 'radial-gradient(circle at top right, rgba(109, 40, 217, 0.05), transparent)' }}>
        <div className="animate-fade" style={{ maxWidth: '900px', margin: '0 auto' }}>
          <span style={{ padding: '0.5rem 1rem', background: 'rgba(109, 40, 217, 0.1)', color: 'var(--primary)', borderRadius: '2rem', fontSize: '0.875rem', fontWeight: '700', marginBottom: '2rem', display: 'inline-block' }}>
            ✨ Giải pháp quản lý Spa 4.0
          </span>
          <h2 style={{ fontSize: '4rem', fontWeight: '900', color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '1.5rem' }}>
            Vận hành Spa thông minh, <br />
            <span className="text-gradient">Tăng trưởng doanh thu.</span>
          </h2>
          <p style={{ fontSize: '1.25rem', color: 'var(--text-secondary)', marginBottom: '3rem', maxWidth: '700px', margin: '0 auto 3rem' }}>
            Nền tảng SaaS tối giản giúp bạn quản lý chỗ, nhân viên, hoa hồng và báo cáo tài chính chỉ trên một màn hình duy nhất.
          </p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/register" className="btn btn-primary" style={{ padding: '1rem 2rem', fontSize: '1.125rem', height: 'auto' }}>
              Bắt đầu ngay bây giờ <ArrowRight size={20} />
            </Link>
            <Link to="/login" className="btn" style={{ padding: '1rem 2rem', fontSize: '1.125rem', height: 'auto', background: 'var(--bg-main)' }}>
              Xem Demo
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section style={{ padding: '80px 5%' }}>
        <div className="grid grid-cols-3" style={{ gap: '2rem' }}>
          {[
            { icon: LayoutGrid, title: 'Quản lý Chỗ', desc: 'Theo dõi trạng thái chỗ trống/đang làm theo thời gian thực.' },
            { icon: Users, title: 'Hoa hồng Nhân viên', desc: 'Tự động tính hoa hồng chính xác theo từng dịch vụ hoặc bán gói.' },
            { icon: BarChart3, title: 'Báo cáo Chuyên sâu', desc: 'Tách biệt doanh thu và dòng tiền giúp bạn kiểm soát lãi lỗ thực.' },
            { icon: Shield, title: 'Bảo mật SaaS', desc: 'Mỗi cửa hàng là một phân đoạn dữ liệu riêng biệt, an toàn tuyệt đối.' },
            { icon: Zap, title: 'Đăng ký trong 30s', desc: 'Không cần cài đặt rườm rà, tạo shop và bắt đầu vận hành ngay.' },
            { icon: CheckCircle, title: 'Giao diện Tối giản', desc: 'Tập trung vào trải nghiệm người dùng, nhân viên làm quen trong 5 phút.' },
          ].map((feat, i) => (
            <div key={i} className="premium-card" style={{ padding: '2rem' }}>
              <div style={{ width: '50px', height: '50px', background: 'rgba(109, 40, 217, 0.1)', color: 'var(--primary)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
                <feat.icon size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.75rem' }}>{feat.title}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Footer */}
      <section style={{ padding: '100px 5%', textAlign: 'center', background: 'var(--bg-main)', margin: '4rem 5%', borderRadius: '2rem' }}>
        <h2 style={{ fontSize: '2.5rem', fontWeight: '800', marginBottom: '1.5rem' }}>Sẵn sàng nâng tầm Spa của bạn?</h2>
        <p style={{ marginBottom: '2.5rem', color: 'var(--text-secondary)' }}>Tham gia cùng hàng trăm chủ Spa đã tối ưu hóa vận hành cùng chúng tôi.</p>
        <Link to="/register" className="btn btn-primary" style={{ padding: '1rem 3rem', fontSize: '1.125rem' }}>
          Đăng ký miễn phí ngay
        </Link>
      </section>

      <footer style={{ padding: '40px 5%', textAlign: 'center', color: 'var(--text-light)', fontSize: '0.875rem' }}>
        © 2026 Spa & POS Platform. Thiết kế cho sự phát triển bền vững. 0905550738
      </footer>
    </div>
  );
};

export default Landing;
