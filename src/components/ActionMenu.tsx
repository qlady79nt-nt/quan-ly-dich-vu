import { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

export const ActionMenu = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="action-menu-container" ref={menuRef}>
      <button 
        className="action-menu-trigger" 
        onClick={() => setIsOpen(!isOpen)}
        title="Thao tác"
      >
        <MoreVertical size={20} />
      </button>
      <div 
        className={`action-menu-dropdown ${isOpen ? 'open' : ''}`}
        onClick={() => setIsOpen(false)}
      >
        {children}
      </div>
    </div>
  );
};
