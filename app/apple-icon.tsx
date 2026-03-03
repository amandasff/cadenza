import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          background: "#2C2824",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <span style={{ fontSize: 108, color: "#F8F6F2", lineHeight: 1, marginTop: -6 }}>
          ♩
        </span>
      </div>
    ),
    { width: 180, height: 180 }
  );
}
