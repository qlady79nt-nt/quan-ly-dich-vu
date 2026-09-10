import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Save, Sparkles, AlertCircle, Calendar, Percent, Users, FileSpreadsheet } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { 
  getShopFakeRevenueConfig, 
  saveShopFakeRevenueConfig,
  getExcludedExcelFilesFromConfig,
  validateExcelFileName
} from '../lib/fakeRevenueService';

interface FakeRevenueConfigModalProps {
  shopId: string;
  shopName: string;
  onClose: () => void;
}

const FakeRevenueConfigModal = ({ shopId, shopName, onClose }: FakeRevenueConfigModalProps) => {
  const { profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fakeStartDate, setFakeStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [variationPercent, setVariationPercent] = useState(10);
  
  // Danh sách nhân viên thật của shop & danh sách được chọn
  const [staffList, setStaffList] = useState<{ id: string; full_name: string; position?: string }[]>([]);
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);

  // Danh sách file Excel bị loại trừ khỏi Auto Sync (Chỉ Super Admin)
  const [excludedFiles, setExcludedFiles] = useState<string[]>([]);
  const [newFileName, setNewFileName] = useState('');

  // 31 ngày BASE (1 -> 31)
  const [baseConfig, setBaseConfig] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (let i = 1; i <= 31; i++) {
      init[String(i)] = 5000000;
    }
    return init;
  });

  const [bulkValue, setBulkValue] = useState('5000000');

  useEffect(() => {
    loadConfig();
  }, [shopId]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      // 1. Tải danh sách nhân viên thật của Shop (chỉ lấy active, chưa xóa)
      const { data: staffs, error: staffErr } = await supabase
        .from('staffs')
        .select('id, full_name, position')
        .eq('shop_id', shopId)
        .eq('status', 'active')
        .is('deleted_at', null)
        .order('full_name');

      if (staffErr) {
        console.warn('Lỗi khi tải danh sách nhân viên:', staffErr.message);
      }
      const loadedStaffs = staffs || [];
      setStaffList(loadedStaffs);

      // 2. Tải cấu hình shop_fake_revenue_configs
      const config = await getShopFakeRevenueConfig(shopId);
      if (config) {
        if (config.fake_start_date) setFakeStartDate(config.fake_start_date);
        if (config.variation_percent) setVariationPercent(config.variation_percent);
        if (config.base_config) {
          // Tách riêng các key 1..31 cho baseConfig để không bị lẫn selected_staff_ids
          const daysOnly: Record<string, number> = {};
          for (let i = 1; i <= 31; i++) {
            if (config.base_config[String(i)] !== undefined) {
              daysOnly[String(i)] = Number(config.base_config[String(i)]);
            }
          }
          setBaseConfig(prev => ({ ...prev, ...daysOnly }));

          // Nạp selected_staff_ids nếu đã cấu hình
          if (Array.isArray(config.base_config.selected_staff_ids)) {
            setSelectedStaffIds(config.base_config.selected_staff_ids);
          }

          // Nạp excluded_excel_files nếu đã cấu hình (Section 2, 6)
          const loadedExclusions = getExcludedExcelFilesFromConfig(config);
          setExcludedFiles(loadedExclusions);
        }
      }
    } catch (err) {
      console.error('Lỗi khi nạp cấu hình:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (day: number, value: string) => {
    const num = parseInt(value.replace(/\D/g, ''), 10) || 0;
    setBaseConfig(prev => ({ ...prev, [String(day)]: num }));
  };

  const handleBulkApply = () => {
    const num = parseInt(bulkValue.replace(/\D/g, ''), 10) || 0;
    if (num <= 0) {
      alert('Vui lòng nhập số tiền hợp lệ!');
      return;
    }
    const updated: Record<string, number> = {};
    for (let i = 1; i <= 31; i++) {
      updated[String(i)] = num;
    }
    setBaseConfig(updated);
  };

  const handleToggleStaff = (id: string) => {
    setSelectedStaffIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllStaff = () => {
    setSelectedStaffIds(staffList.map(s => s.id));
  };

  const handleDeselectAllStaff = () => {
    setSelectedStaffIds([]);
  };

  const handleAddExcludedFile = () => {
    if (!isSuperAdmin) {
      alert('Chỉ Super Admin mới có quyền thêm file loại trừ.');
      return;
    }
    const res = validateExcelFileName(newFileName, excludedFiles);
    if (!res.valid) {
      alert(res.error);
      return;
    }
    setExcludedFiles(prev => [...prev, res.cleanName!]);
    setNewFileName('');
  };

  const handleRemoveExcludedFile = (fileNameToRemove: string) => {
    if (!isSuperAdmin) {
      alert('Chỉ Super Admin mới có quyền xóa file khỏi danh sách loại trừ.');
      return;
    }
    // Section 11: Chỉ xóa quy tắc exclusion, tuyệt đối KHÔNG xóa file vật lý trên đĩa
    setExcludedFiles(prev => 
      prev.filter(f => f.trim().toLowerCase() !== fileNameToRemove.trim().toLowerCase())
    );
  };

  const handleSave = async () => {
    if (selectedStaffIds.length === 0) {
      const confirmEmpty = confirm(
        'CẢNH BÁO QUAN TRỌNG:\n\nBạn chưa chọn bất kỳ nhân viên nào cho doanh số giả lập.\n\nTheo quy định hệ thống:\n- Hệ thống sẽ KHÔNG sinh doanh số giả lập cho các ngày tới.\n- Không tạo lịch sử giả lập.\n- AutoSync sẽ không tạo file Excel rỗng.\n\nBạn có chắc chắn muốn lưu với 0 nhân viên được chọn?'
      );
      if (!confirmEmpty) return;
    }

    setSaving(true);
    const res = await saveShopFakeRevenueConfig(
      shopId, 
      fakeStartDate, 
      baseConfig, 
      variationPercent, 
      selectedStaffIds,
      excludedFiles
    );
    setSaving(false);
    if (res.success) {
      alert('Lưu cấu hình doanh số ảo thành công!');
      onClose();
    } else {
      alert('Lỗi lưu cấu hình: ' + (res.error || ''));
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 999999,
      padding: '1rem'
    }}>
      <div className="modal-content animate-fade-up" style={{
        maxWidth: '750px',
        width: '100%',
        maxHeight: '90vh',
        background: 'var(--bg-main, #fff)',
        borderRadius: '1rem',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.25rem 1.5rem',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--primary)' }}>
              Cấu hình Doanh số Ảo 31 Ngày
            </h3>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Áp dụng cho cửa hàng: <strong>{shopName}</strong>
            </p>
          </div>
          <button onClick={onClose} className="btn" style={{ padding: '0.4rem', borderRadius: '50%' }}>
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
              Đang tải cấu hình...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Lưu ý nghiệp vụ */}
              <div style={{
                background: 'rgba(59, 130, 246, 0.08)',
                border: '1px solid rgba(59, 130, 246, 0.2)',
                borderRadius: '0.75rem',
                padding: '1rem',
                fontSize: '0.85rem',
                color: 'var(--text-main)',
                display: 'flex',
                gap: '0.75rem'
              }}>
                <AlertCircle size={20} style={{ color: '#3b82f6', flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong>Quy tắc hệ thống:</strong>
                  <ul style={{ margin: '0.25rem 0 0 1rem', padding: 0, listStyle: 'disc' }}>
                    <li><strong>Hôm nay:</strong> Nhân viên luôn xem doanh số THẬT từ hóa đơn.</li>
                    <li><strong>Ngày quá khứ:</strong> Tự động sinh dựa trên BASE, dao động có kiểm soát và <strong>KHÓA CỐ ĐỊNH</strong> vĩnh viễn trong Database.</li>
                    <li><strong>Ngày tương lai hoặc trước ngày bắt đầu:</strong> Doanh số = 0.</li>
                    <li><strong>Làm tròn:</strong> Doanh số cuối cùng luôn là bội số của 10.000 VNĐ.</li>
                  </ul>
                </div>
              </div>

              {/* Thông số chung */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                    <Calendar size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Ngày bắt đầu sinh fake:
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={fakeStartDate}
                    onChange={e => setFakeStartDate(e.target.value)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Các ngày trước ngày này sẽ có doanh số = 0
                  </span>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem' }}>
                    <Percent size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    Biên độ dao động (±%):
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="30"
                    className="form-input"
                    value={variationPercent}
                    onChange={e => setVariationPercent(parseInt(e.target.value, 10) || 10)}
                    style={{ width: '100%', padding: '0.5rem 0.75rem' }}
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Mặc định ±10% quanh mức BASE
                  </span>
                </div>
              </div>

              {/* Chọn nhân viên dùng cho doanh thu giả lập */}
              <div style={{
                border: '1px solid var(--border)',
                borderRadius: '0.75rem',
                padding: '1rem',
                background: 'var(--bg-secondary, #f8fafc)'
              }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '0.75rem',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={18} style={{ color: 'var(--primary)' }} />
                    <strong style={{ fontSize: '0.95rem' }}>Nhân viên dùng cho Doanh thu Giả lập</strong>
                    <span style={{
                      fontSize: '0.75rem',
                      padding: '0.15rem 0.5rem',
                      borderRadius: '1rem',
                      background: selectedStaffIds.length > 0 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: selectedStaffIds.length > 0 ? '#16a34a' : '#dc2626',
                      fontWeight: '700'
                    }}>
                      Đã chọn: {selectedStaffIds.length} / {staffList.length}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      type="button"
                      onClick={handleSelectAllStaff}
                      className="btn"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        background: 'white',
                        border: '1px solid var(--border)',
                        cursor: 'pointer'
                      }}
                    >
                      Chọn tất cả
                    </button>
                    <button
                      type="button"
                      onClick={handleDeselectAllStaff}
                      className="btn"
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        background: 'white',
                        border: '1px solid var(--border)',
                        cursor: 'pointer'
                      }}
                    >
                      Bỏ chọn tất cả
                    </button>
                  </div>
                </div>

                <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Chỉ những nhân viên được tick chọn mới được phân bổ doanh thu trong lịch sử giả lập và xuất file Excel.
                  Nếu không chọn nhân viên nào, hệ thống sẽ <strong>không sinh doanh số giả lập</strong>.
                </p>

                {staffList.length === 0 ? (
                  <div style={{
                    padding: '1rem',
                    textAlign: 'center',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                    background: 'white',
                    borderRadius: '0.5rem',
                    border: '1px dashed var(--border)'
                  }}>
                    Không tìm thấy nhân viên đang hoạt động nào trong cửa hàng.
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                    gap: '0.5rem',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    padding: '0.5rem',
                    background: 'white',
                    borderRadius: '0.5rem',
                    border: '1px solid var(--border)'
                  }}>
                    {staffList.map(staff => {
                      const isChecked = selectedStaffIds.includes(staff.id);
                      return (
                        <label
                          key={staff.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.4rem 0.6rem',
                            borderRadius: '0.375rem',
                            cursor: 'pointer',
                            background: isChecked ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                            border: `1px solid ${isChecked ? 'rgba(59, 130, 246, 0.3)' : 'transparent'}`,
                            userSelect: 'none',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleStaff(staff.id)}
                            style={{ cursor: 'pointer' }}
                          />
                          <div style={{ overflow: 'hidden' }}>
                            <div style={{
                              fontSize: '0.85rem',
                              fontWeight: isChecked ? '600' : '400',
                              color: isChecked ? 'var(--primary)' : 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}>
                              {staff.full_name}
                            </div>
                            {staff.position && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                                {staff.position}
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Công cụ gán nhanh */}
              <div style={{
                background: 'var(--bg-secondary, #f8fafc)',
                padding: '1rem',
                borderRadius: '0.75rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                  <Sparkles size={16} style={{ display: 'inline', marginRight: '4px', color: 'var(--primary)' }} />
                  Gán nhanh 31 ngày:
                </span>
                <input
                  type="text"
                  className="form-input"
                  value={Number(bulkValue).toLocaleString('vi-VN')}
                  onChange={e => setBulkValue(e.target.value.replace(/\D/g, ''))}
                  style={{ width: '160px', padding: '0.4rem 0.75rem' }}
                />
                <button
                  type="button"
                  onClick={handleBulkApply}
                  className="btn btn-secondary"
                  style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                >
                  Áp dụng cho tất cả
                </button>
              </div>

              {/* Bảng 31 ngày */}
              <div>
                <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '0.95rem', fontWeight: '700' }}>
                  Mức BASE từng ngày trong tháng (Ngày 01 đến 31):
                </h4>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: '0.75rem'
                }}>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
                    <div
                      key={day}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        border: '1px solid var(--border)',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.5rem',
                        background: 'var(--bg-main)'
                      }}
                    >
                      <span style={{
                        fontSize: '0.8rem',
                        fontWeight: '700',
                        color: 'var(--primary)',
                        width: '58px'
                      }}>
                        Ngày {String(day).padStart(2, '0')}:
                      </span>
                      <input
                        type="text"
                        className="form-input"
                        value={Number(baseConfig[String(day)] || 0).toLocaleString('vi-VN')}
                        onChange={e => handleDayChange(day, e.target.value)}
                        style={{
                          width: '100%',
                          textAlign: 'right',
                          padding: '0.3rem 0.5rem',
                          fontWeight: '600',
                          fontSize: '0.85rem'
                        }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>đ</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Khu vực: File Excel không tự động đồng bộ (Chỉ Super Admin được xem và quản lý - Section 3, 4) */}
              {isSuperAdmin && (
                <div style={{
                  border: '1px solid var(--border)',
                  borderRadius: '0.75rem',
                  padding: '1.25rem',
                  background: 'var(--bg-secondary, #f8fafc)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <FileSpreadsheet size={18} style={{ color: 'var(--primary)' }} />
                    <strong style={{ fontSize: '0.95rem' }}>File Excel không tự động đồng bộ</strong>
                  </div>
                  <p style={{ margin: '0 0 0.75rem 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Nhập chính xác tên file Excel mà hệ thống không được tự động tạo, sửa, ghi đè hoặc đồng bộ.
                  </p>

                  {/* Form nhập tên file */}
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="DoanhThu_2026-09-11.xlsx"
                      value={newFileName}
                      onChange={e => setNewFileName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddExcludedFile();
                        }
                      }}
                      style={{ flex: 1, padding: '0.45rem 0.75rem', fontSize: '0.85rem' }}
                    />
                    <button
                      type="button"
                      onClick={handleAddExcludedFile}
                      className="btn btn-secondary"
                      style={{
                        padding: '0.45rem 1rem',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                        whiteSpace: 'nowrap',
                        color: 'var(--primary)',
                        fontWeight: '600'
                      }}
                    >
                      + Thêm
                    </button>
                  </div>

                  {/* Danh sách file đang exclude */}
                  <div style={{ fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                    Danh sách ({excludedFiles.length}):
                  </div>

                  {excludedFiles.length === 0 ? (
                    <div style={{
                      padding: '0.75rem 1rem',
                      textAlign: 'center',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)',
                      background: 'white',
                      borderRadius: '0.5rem',
                      border: '1px dashed var(--border)'
                    }}>
                      Chưa có file nào trong danh sách loại trừ.
                    </div>
                  ) : (
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.35rem',
                      maxHeight: '160px',
                      overflowY: 'auto',
                      background: 'white',
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--border)'
                    }}>
                      {excludedFiles.map((file, idx) => (
                        <div
                          key={`${file}_${idx}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '0.35rem 0.6rem',
                            borderRadius: '0.375rem',
                            background: 'var(--bg-main, #fff)',
                            border: '1px solid var(--border)'
                          }}
                        >
                          <span style={{ fontSize: '0.85rem', fontFamily: 'monospace', fontWeight: '500' }}>
                            {file}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExcludedFile(file)}
                            className="btn"
                            style={{
                              padding: '0.2rem 0.5rem',
                              fontSize: '0.75rem',
                              color: '#dc2626',
                              background: 'rgba(239, 68, 68, 0.1)',
                              border: 'none',
                              borderRadius: '0.25rem',
                              cursor: 'pointer'
                            }}
                            title="Xóa quy tắc này khỏi danh sách (không xóa file thật trên đĩa)"
                          >
                            [Xóa]
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '0.75rem',
          background: 'var(--bg-secondary, #f8fafc)'
        }}>
          <button type="button" onClick={onClose} className="btn" disabled={saving}>
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Save size={16} />
            {saving ? 'Đang lưu...' : 'Lưu cấu hình'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default FakeRevenueConfigModal;
