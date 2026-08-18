// Unit tests for ThemeToggle component (segmented control)
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useThemeStore } from '@/stores/theme';

describe('ThemeToggle', () => {
  beforeEach(() => {
    useThemeStore.setState({ theme: 'system' });
    vi.clearAllMocks();
  });

  it('should render segmented control with 3 options', () => {
    render(<ThemeToggle />);
    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(3);
  });

  it('should render radiogroup', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('radiogroup')).toBeInTheDocument();
  });

  it('should show active state for current theme', () => {
    useThemeStore.setState({ theme: 'dark' });
    render(<ThemeToggle />);
    const darkButton = screen.getByRole('radio', { name: '深色' });
    expect(darkButton).toHaveAttribute('aria-checked', 'true');
  });

  it('should set theme on click', () => {
    useThemeStore.setState({ theme: 'light' });
    render(<ThemeToggle />);

    const darkButton = screen.getByRole('radio', { name: '深色' });
    fireEvent.click(darkButton);

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('should have accessible labels on all buttons', () => {
    render(<ThemeToggle />);
    expect(screen.getByRole('radio', { name: '浅色' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '深色' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '系统' })).toBeInTheDocument();
  });
});
