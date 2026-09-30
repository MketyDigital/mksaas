'use client';

import type { MouseEvent, ReactNode } from 'react';

interface ConfirmSubmitButtonProps {
  children: ReactNode;
  className?: string;
  confirmMessage: string;
  name?: string;
  value?: string;
}

export function ConfirmSubmitButton({
  children,
  className,
  confirmMessage,
  name,
  value,
}: ConfirmSubmitButtonProps) {
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (!window.confirm(confirmMessage)) {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  return (
    <button
      className={className}
      name={name}
      onClick={handleClick}
      type="submit"
      value={value}
    >
      {children}
    </button>
  );
}
