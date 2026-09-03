export function PageLoader() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid var(--foreground, #e2e8f0)",
          borderTopColor: "transparent",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
    </div>
  );
}
