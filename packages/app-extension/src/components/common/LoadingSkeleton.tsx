import { useTheme } from "@coral-xyz/tamagui";

export function PopupLoadingSkeleton() {
  const theme = useTheme();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: theme.baseBackgroundL0.val,
        padding: "16px",
      }}
    >
      {/* Header skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <SkeletonBox width="120px" height="32px" />
        <SkeletonBox width="40px" height="40px" borderRadius="50%" />
      </div>

      {/* Wallet address skeleton */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <SkeletonBox width="200px" height="24px" />
      </div>

      {/* Balance skeleton */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginBottom: "32px",
        }}
      >
        <SkeletonBox width="150px" height="48px" marginBottom="8px" />
        <SkeletonBox width="100px" height="20px" />
      </div>

      {/* Action buttons skeleton */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        <SkeletonBox width="100%" height="48px" />
        <SkeletonBox width="100%" height="48px" />
      </div>

      {/* Token list skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <TokenRowSkeleton />
        <TokenRowSkeleton />
        <TokenRowSkeleton />
        <TokenRowSkeleton />
      </div>
    </div>
  );
}

function TokenRowSkeleton() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px",
      }}
    >
      <SkeletonBox width="40px" height="40px" borderRadius="50%" />
      <div style={{ flex: 1 }}>
        <SkeletonBox width="80px" height="16px" marginBottom="8px" />
        <SkeletonBox width="60px" height="14px" />
      </div>
      <div style={{ textAlign: "right" }}>
        <SkeletonBox width="80px" height="16px" marginBottom="8px" />
        <SkeletonBox width="60px" height="14px" />
      </div>
    </div>
  );
}

function SkeletonBox({
  width,
  height,
  borderRadius = "8px",
  marginBottom = "0",
}: {
  width: string;
  height: string;
  borderRadius?: string;
  marginBottom?: string;
}) {
  const theme = useTheme();

  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        marginBottom,
        backgroundColor: theme.baseBackgroundL1.val,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    >
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
