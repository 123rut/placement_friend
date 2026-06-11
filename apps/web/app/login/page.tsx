"use client";

import { useState } from "react";
import { createClient } from "../../lib/supabase/client";
import { getCollegeByEmail } from "@piaa/domain";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    const college = getCollegeByEmail(email);
    if (!college) {
      setError("Please use a valid college email address. Personal emails are not allowed.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
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

  return (
    <main className="app-shell" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div className="panel" style={{ maxWidth: '400px', width: '100%' }}>
        <div className="panel-header">
          <div>
            <div className="section-label">Access</div>
            <h2>College Login</h2>
          </div>
        </div>

        <form onSubmit={handleLogin} className="form-grid">
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

          {error && <p className="status-warn" style={{ padding: '8px', marginTop: '8px' }}>{error}</p>}
          {message && <p className="status-good" style={{ padding: '8px', marginTop: '8px' }}>{message}</p>}

          <button type="submit" disabled={loading} style={{ marginTop: '16px', padding: '8px 16px', background: 'var(--blue-500)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {loading ? "Sending link..." : "Send Magic Link"}
          </button>
        </form>
      </div>
    </main>
  );
}
