
import React from 'react';

interface FormulaProps {
  text: string;
  className?: string;
}

export const Formula: React.FC<FormulaProps> = ({ text, className = "" }) => {
  // Regex to find numbers and wrap them in <sub> tags
  const parts = text.split(/(\d+)/);
  return (
    <span className={`chem-font inline-flex items-baseline ${className}`}>
      {parts.map((part, i) => 
        /^\d+$/.test(part) ? <sub key={i}>{part}</sub> : <span key={i}>{part}</span>
      )}
    </span>
  );
};
