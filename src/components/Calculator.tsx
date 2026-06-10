import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Delete } from 'lucide-react';

interface CalculatorProps {
  initialValue: number;
  onConfirm: (value: number) => void;
  onClose: () => void;
  title?: string;
}

const Calculator: React.FC<CalculatorProps> = ({ initialValue, onConfirm, onClose, title = 'Máy tính' }) => {
  const [display, setDisplay] = useState(initialValue ? initialValue.toString() : '0');
  const [equation, setEquation] = useState('');
  const [isNewNumber, setIsNewNumber] = useState(true);

  const handleNum = (num: string) => {
    if (isNewNumber) {
      setDisplay(num);
      setIsNewNumber(false);
    } else {
      setDisplay(display === '0' ? num : display + num);
    }
  };

  const handleOp = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setIsNewNumber(true);
  };

  const handleEqual = () => {
    if (!equation) return;
    try {
      // Evaluate the equation string safely
      const fullEq = equation + display;
      // Note: we only allow basic math characters so eval is safe enough here, or we can parse it
      const result = new Function('return ' + fullEq)();
      setDisplay(String(result));
      setEquation('');
      setIsNewNumber(true);
    } catch (e) {
      setDisplay('Error');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
    setIsNewNumber(true);
  };

  const handleDel = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
      setIsNewNumber(true);
    }
  };

  const handleConfirm = () => {
    let finalVal = Number(display);
    if (equation) {
      try {
        finalVal = new Function('return ' + equation + display)();
      } catch (e) {}
    }
    onConfirm(isNaN(finalVal) ? 0 : finalVal);
  };

  return createPortal(
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999999, padding: '1rem' }}>
      <div className="animate-fade-up" style={{ width: '100%', maxWidth: '320px', background: 'var(--bg-main)', borderRadius: '1rem', padding: '1.5rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold' }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '0.75rem', marginBottom: '1rem', textAlign: 'right', border: '1px solid var(--border)' }}>
          <div style={{ height: '1.2rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            {equation}
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {Number(display).toLocaleString()}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--danger)', fontWeight: 'bold' }} onClick={handleClear}>C</button>
          <button className="btn" style={{ background: 'var(--bg-card)' }} onClick={handleDel}><Delete size={18} /></button>
          <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => handleOp('/')}>/</button>
          <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => handleOp('*')}>x</button>

          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('7')}>7</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('8')}>8</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('9')}>9</button>
          <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => handleOp('-')}>-</button>

          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('4')}>4</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('5')}>5</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('6')}>6</button>
          <button className="btn" style={{ background: 'var(--bg-card)', color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => handleOp('+')}>+</button>

          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('1')}>1</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('2')}>2</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('3')}>3</button>
          <button className="btn btn-primary" style={{ gridRow: 'span 2' }} onClick={handleEqual}>=</button>

          <button className="btn" style={{ background: 'white', fontWeight: 'bold', gridColumn: 'span 2' }} onClick={() => handleNum('0')}>0</button>
          <button className="btn" style={{ background: 'white', fontWeight: 'bold' }} onClick={() => handleNum('000')}>000</button>
        </div>

        <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem', padding: '0.75rem', fontSize: '1.1rem' }} onClick={handleConfirm}>
          Xác nhận
        </button>
      </div>
    </div>,
    document.body
  );
};

export default Calculator;
