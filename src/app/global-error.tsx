"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body style={{ 
        margin: 0, 
        padding: 0, 
        display: "flex", 
        alignItems: "center", 
        justifyContent: "center", 
        height: "100vh",
        backgroundColor: "#09090b",
        color: "#fafafa",
        fontFamily: "system-ui, sans-serif"
      }}>
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <h2 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
            ⚠️ Critical Error
          </h2>
          <p style={{ color: "#a1a1aa", marginBottom: "1rem" }}>
            {error.message || "Something went wrong"}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "0.5rem",
              cursor: "pointer"
            }}
          >
            Reload App
          </button>
        </div>
      </body>
    </html>
  );
}
