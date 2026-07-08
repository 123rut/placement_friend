import React, { useState, useEffect, useRef } from "react";

export interface AlertNotification {
  id: string;
  drive_id: string;
  company_name: string;
  role: string;
  channel: string;
  read: boolean;
  sent_at: string;
}

interface NotificationBellProps {
  onSelectDrive?: (driveId: string) => void;
}

export default function NotificationBell({ onSelectDrive }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<AlertNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter(n => !n.read).length;

  const fetchNotifications = async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const result = await res.json();
        setNotifications(result.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  };

  useEffect(() => {
    fetchNotifications();

    // Poll notifications every 60s to refresh the unread badge
    const timer = setInterval(fetchNotifications, 60000);
    return () => clearInterval(timer);
  }, []);

  // Handle clicks outside of dropdown to close it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (alertId: string, driveId: string) => {
    try {
      const res = await fetch(`/api/notifications/${alertId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read: true })
      });
      if (res.ok) {
        // Optimistically update read status locally
        setNotifications(prev =>
          prev.map(n => (n.id === alertId ? { ...n, read: true } : n))
        );
        if (onSelectDrive) {
          onSelectDrive(driveId);
        }
      }
    } catch (err) {
      console.error("Failed to mark alert as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "PATCH"
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("Failed to mark all alerts as read:", err);
    }
  };

  const getRelativeTime = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  return (
    <div style={{ position: "relative" }} ref={dropdownRef}>
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications(); // refresh when opening
        }}
        style={{
          background: "none",
          border: "none",
          fontSize: "1.5rem",
          padding: "8px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--muted)",
          cursor: "pointer",
          borderRadius: "50%",
          transition: "background 0.2s"
        }}
        className="nav-btn-hover"
        title="View Notifications"
      >
        🔔
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: "4px",
              right: "4px",
              background: "#ef4444",
              color: "#ffffff",
              borderRadius: "50%",
              minWidth: "18px",
              height: "18px",
              fontSize: "0.68rem",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              border: "2px solid var(--bg)"
            }}
          >
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "8px",
            width: "360px",
            maxHeight: "480px",
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: "var(--radius)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.15)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "var(--surface-muted)"
            }}
          >
            <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>Notifications</strong>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllAsRead}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--accent)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: 0
                }}
              >
                Mark all as read
              </button>
            )}
          </div>

          <div style={{ overflowY: "auto", flex: 1, padding: "4px 0" }}>
            {notifications.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--muted)", fontSize: "0.88rem" }}>
                No notifications yet.
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkAsRead(n.id, n.drive_id)}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--line)",
                    cursor: "pointer",
                    background: n.read ? "transparent" : "var(--accent-soft)",
                    opacity: n.read ? 0.82 : 1,
                    transition: "background 0.2s",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "10px"
                  }}
                  className="notification-item-hover"
                >
                  <span style={{ fontSize: "1.1rem", marginTop: "2px" }}>💼</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "0.86rem", fontWeight: n.read ? 500 : 700, color: "var(--text)", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                      New matching opening at {n.company_name}
                    </div>
                    <div style={{ fontSize: "0.8rem", color: "var(--muted)", marginTop: "2px" }}>
                      {n.role}
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--muted)", marginTop: "4px" }}>
                      {getRelativeTime(n.sent_at)}
                    </div>
                  </div>
                  {!n.read && (
                    <span
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: "var(--accent)",
                        alignSelf: "center"
                      }}
                    />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
