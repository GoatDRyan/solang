import { useState } from 'react';
import { useAuth } from '../../../app/providers/AuthProvider';

export default function LoginForm() {
  const { signInWithPassword, signUpWithPassword } = useAuth();

  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isLogin = mode === 'login';

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: '', message: '' });

    try {
      if (isLogin) {
        await signInWithPassword({ email, password });
      } else {
        await signUpWithPassword({ email, password });
        setStatus({
          type: 'success',
          message: 'Account created. Check your email if confirmation is enabled.',
        });
      }
    } catch (error) {
      setStatus({
        type: 'error',
        message: error?.message || 'Authentication failed.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-[1.5rem] bg-surface p-8 shadow-[var(--shadow-card)] ring-1 ring-border">
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Solang</p>
        <h1 className="mt-2 text-3xl font-bold text-text">
          {isLogin ? 'Welcome back' : 'Create your account'}
        </h1>
        <p className="mt-2 text-sm text-text-muted">
          Sign in to access your language workspace.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-text">Email</span>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-text">Password</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            className="w-full rounded-2xl border border-border bg-surface-muted px-4 py-3 text-sm text-text outline-none transition focus:border-primary focus:bg-surface"
            placeholder="••••••••"
          />
        </label>

        {status.message && (
          <div
            className={[
              'rounded-2xl p-3 text-sm',
              status.type === 'error'
                ? 'bg-danger-soft text-danger-text'
                : 'bg-success-soft text-success-text',
            ].join(' ')}
          >
            {status.message}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? 'Please wait...'
            : isLogin
            ? 'Sign in'
            : 'Create account'}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isLogin ? 'signup' : 'login');
          setStatus({ type: '', message: '' });
        }}
        className="mt-4 text-sm font-medium text-primary hover:underline"
      >
        {isLogin ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
      </button>
    </div>
  );
}