"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error");
      if (urlError) {
        setError(urlError);
      }
    }
  }, []);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const supabase = createClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=/`,
        },
      });

      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
      }
    } catch (err: any) {
      setError(err?.message || "Failed to initiate Google sign-in.");
      setLoading(false);
    }
  };

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

        {/* Google OAuth Button */}
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="google-auth-btn"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            padding: "11px 16px",
            borderRadius: "var(--radius)",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--text)",
            fontSize: "0.92rem",
            fontWeight: 500,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all 0.2s ease",
            marginBottom: "6px",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isSignUp ? "Sign up with Google" : "Continue with Google"}</span>
        </button>

        {/* Divider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            margin: "18px 0",
            color: "var(--muted)",
            fontSize: "0.8rem",
          }}
        >
          <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
          <span style={{ padding: "0 10px", textTransform: "uppercase", letterSpacing: "0.05em" }}>OR</span>
          <div style={{ flex: 1, height: "1px", background: "var(--line)" }} />
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
