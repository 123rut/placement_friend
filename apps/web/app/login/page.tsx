"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { getCollegeByEmailDb } from "../../lib/supabase/colleges";

type AuthTab = "magic-link" | "password";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [activeTab, setActiveTab] = useState<AuthTab>("magic-link");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createClient();
    
    // 1. Resolve and validate college email from db
    const college = await getCollegeByEmailDb(supabase, email);
    if (!college) {
      setError("Please use a valid college email address. Personal emails are not allowed.");
      setLoading(false);
      return;
    }

    // 2. Trigger Supabase magic link
    const { error: signInError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    });

    if (signInError) {
      setError(signInError.message);
    } else {
      setMessage(`A magic link has been sent to ${email}. Please check your inbox.`);
    }

    setLoading(false);
  };

  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const supabase = createClient();

    // 1. Resolve and validate college email from db
    const college = await getCollegeByEmailDb(supabase, email);
    if (!college) {
      setError("Please use a valid college email address. Personal emails are not allowed.");
      setLoading(false);
      return;
    }

    if (isSignUp) {
      // Sign Up Flow
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        setLoading(false);
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setMessage("Account created successfully! Redirecting...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
      }
    } else {
      // Sign In Flow
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
      } else {
        setMessage("Logged in successfully! Redirecting...");
        setTimeout(() => {
          window.location.href = "/";
        }, 1000);
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
            <h2>Placement & Alert Agent</h2>
          </div>
        </div>

        {/* Auth Method Tabs */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${activeTab === "magic-link" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("magic-link");
              setError("");
              setMessage("");
            }}
          >
            Magic Link
          </button>
          <button
            type="button"
            className={`auth-tab ${activeTab === "password" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("password");
              setError("");
              setMessage("");
            }}
          >
            Password
          </button>
        </div>

        {activeTab === "magic-link" ? (
          <form onSubmit={handleMagicLink} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="field">
              <span>College email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
                required
              />
            </label>

            {error && <p className="status-warn" style={{ padding: '10px', marginTop: '8px', borderRadius: 'var(--radius)' }}>{error}</p>}
            {message && <p className="status-good" style={{ padding: '10px', marginTop: '8px', borderRadius: 'var(--radius)' }}>{message}</p>}

            <button
              type="submit"
              disabled={loading}
              className="primary-link"
              style={{ border: 'none', width: '100%', marginTop: '12px' }}
            >
              {loading ? "Sending link..." : "Send Magic Link"}
            </button>
          </form>
        ) : (
          <form onSubmit={handlePasswordAuth} className="form-grid" style={{ gridTemplateColumns: '1fr' }}>
            <label className="field">
              <span>College email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@college.edu"
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
                  Already have an account?
                  <button type="button" className="btn-toggle" onClick={() => setIsSignUp(false)}>
                    Sign In
                  </button>
                </span>
              ) : (
                <span>
                  Don't have an account?
                  <button type="button" className="btn-toggle" onClick={() => setIsSignUp(true)}>
                    Sign Up
                  </button>
                </span>
              )}
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
