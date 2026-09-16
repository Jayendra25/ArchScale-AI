"use client";

export default function LoadingScreen({ message = "Loading..." }: { message?: string }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.spinner} />
      <p style={styles.text}>{message}</p>
      <style>{`
        @keyframes archflow-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    background: "var(--bg, #f9fafb)",
    zIndex: 9999,
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid var(--border, #e5e7eb)",
    borderTopColor: "var(--primary, #0f766e)",
    borderRadius: "50%",
    animation: "archflow-spin 0.8s linear infinite",
  },
  text: {
    fontSize: "14px",
    color: "var(--muted, #6b7280)",
    fontWeight: 500,
  },
};