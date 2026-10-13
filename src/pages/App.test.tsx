import { render, screen } from '@testing-library/react';
import { App } from './App';

describe('App shell', () => {
  it('shows the empty-state actions', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: 'New model' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open ArchiMate XML' })).toBeInTheDocument();
  });
});
