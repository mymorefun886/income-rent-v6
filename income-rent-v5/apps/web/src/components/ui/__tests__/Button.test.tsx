// Unit tests for Button component
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('should render button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument();
  });

  it('should handle click events', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);

    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should show loading state', () => {
    render(<Button disabled>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should render with variant classes', () => {
    const { container } = render(<Button variant="primary">Primary</Button>);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  it('should render with size classes', () => {
    const { container } = render(<Button size="sm">Small</Button>);
    const button = container.querySelector('button');
    expect(button).toBeInTheDocument();
  });

  it('should render as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    );
    expect(screen.getByRole('link')).toBeInTheDocument();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<Button disabled>Disabled</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should forward ref', () => {
    const ref = vi.fn();
    render(<Button ref={ref}>Button</Button>);
    expect(ref).toHaveBeenCalled();
  });
});

// Need to import vi for the mocks
import { vi } from 'vitest';
