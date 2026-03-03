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
          background: "#2C2824",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 112,
        }}
      >
        <span style={{ fontSize: 300, color: "#F8F6F2", lineHeight: 1, marginTop: -16 }}>
          ♩
        </span>
      </div>
    ),
    { width: 512, height: 512 }
  );
}
