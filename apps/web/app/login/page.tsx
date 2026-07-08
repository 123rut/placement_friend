"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createClient();

    if (isSignUp) {
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      if (password.length < 8) {
        setError("Password must be at least 8 characters.");
        setLoading(false);
        return;
      }
      if (!/[A-Z]/.test(password)) {
        setError("Password must contain at least one uppercase letter.");
        setLoading(false);
        return;
      }
      if (!/[a-z]/.test(password)) {
        setError("Password must contain at least one lowercase letter.");
        setLoading(false);
        return;
      }
      if (!/[0-9]/.test(password)) {
        setError("Password must contain at least one number.");
        setLoading(false);
        return;
      }
      if (!/[^A-Za-z0-9]/.test(password)) {
        setError("Password must contain at least one special character (e.g. @, #, !).");
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({ email, password });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Account created! Redirecting...");
        setTimeout(() => { window.location.href = "/"; }, 1000);
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Logged in! Redirecting...");
        setTimeout(() => { window.location.href = "/"; }, 1000);
      }
    }

    setLoading(false);
  };

  return (
    <main className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="panel" style={{ maxWidth: '440px', width: '100%', padding: '28px' }}>
        <div className="panel-header" style={{ marginBottom: '24px' }}>
          <div>
            <div className="section-label">Welcome</div>
            <h2>CareerPilot AI</h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <label className="field" style={{ marginTop: '8px' }}>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>

          {isSignUp && password.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '0.78rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {[
                { label: 'At least 8 characters', ok: password.length >= 8 },
                { label: 'One uppercase letter (A–Z)', ok: /[A-Z]/.test(password) },
                { label: 'One lowercase letter (a–z)', ok: /[a-z]/.test(password) },
                { label: 'One number (0–9)', ok: /[0-9]/.test(password) },
                { label: 'One special character (@, #, ! …)', ok: /[^A-Za-z0-9]/.test(password) },
              ].map(({ label, ok }) => (
                <span key={label} style={{ color: ok ? 'var(--success, #4ade80)' : 'var(--muted)' }}>
                  {ok ? '✓' : '○'} {label}
                </span>
              ))}
            </div>
          )}

          {isSignUp && (
            <label className="field" style={{ marginTop: '8px' }}>
              <span>Confirm Password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>
          )}

          {error && <p className="status-warn" style={{ padding: '10px', marginTop: '8px', borderRadius: 'var(--radius)' }}>{error}</p>}
          {message && <p className="status-good" style={{ padding: '10px', marginTop: '8px', borderRadius: 'var(--radius)' }}>{message}</p>}

          <button
            type="submit"
            disabled={loading}
            className="primary-link"
            style={{ border: 'none', width: '100%', marginTop: '16px' }}
          >
            {loading ? "Processing..." : isSignUp ? "Create Account" : "Sign In"}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '0.9rem', color: 'var(--muted)' }}>
            {isSignUp ? (
              <span>
                Already have an account?{' '}
                <button type="button" className="btn-toggle" onClick={() => { setIsSignUp(false); setError(""); setMessage(""); }}>
                  Sign In
                </button>
              </span>
            ) : (
              <span>
                Don&apos;t have an account?{' '}
                <button type="button" className="btn-toggle" onClick={() => { setIsSignUp(true); setError(""); setMessage(""); }}>
                  Sign Up
                </button>
              </span>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
