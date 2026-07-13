import type { ButtonHTMLAttributes, ComponentType, ReactNode } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: string;
  size?: string;
  className?: string;
  isLoading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  Icon?: ComponentType<{ className?: string }>;
}

declare const Button: (props: ButtonProps) => JSX.Element;
export default Button;
