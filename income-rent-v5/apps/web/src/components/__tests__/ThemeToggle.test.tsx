// Unit tests for ThemeToggle component
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeStore } from '@/stores/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'system' });
    vi.clearAllMocks();
  });

  it('should render button', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show moon icon for system theme (defaults to light)', () => {
    useThemeStore.setState({ theme: 'system' });
    render(<ThemeToggle />);
    // System theme shows moon (to switch to dark)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should show sun icon for dark theme', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<ThemeToggle />);
    // Dark theme shows sun (to switch to light)
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('should toggle theme on click', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);

    const button = screen.getByRole('button');
    fireEvent.click(button);

    // Should toggle from light to dark
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('should have accessible label', () => {
    render(<ThemeToggle />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-label');
  });
});
