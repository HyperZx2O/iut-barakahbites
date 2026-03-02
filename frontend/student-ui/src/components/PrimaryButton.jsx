import React from 'react';

export default function PrimaryButton({ children, onClick, type = 'button' }) {
  return (
    <button type={type} className="btn-primary flex items-center justify-center text-xs px-4" onClick={onClick}>
      {children}
    </button>
  );
}
