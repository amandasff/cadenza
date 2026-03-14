import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 512,
          height: 512,
          background: "#1A1714",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 120,
        }}
      >
        {/* C lettermark with a small note accent */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
          <span
            style={{
              fontSize: 320,
              fontWeight: 700,
              color: "#F8F4EE",
              lineHeight: 1,
              fontFamily: "Georgia, serif",
              letterSpacing: "-0.04em",
              marginTop: 8,
            }}
          >
            C
          </span>
          <span
            style={{
              position: "absolute",
              bottom: 52,
              right: -8,
              fontSize: 120,
              color: "#B85C3A",
              lineHeight: 1,
            }}
          >
            ♩
          </span>
        </div>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
