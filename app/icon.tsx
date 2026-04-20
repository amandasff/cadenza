import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          background: "#1A1714",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
        }}
      >
        <svg viewBox="0 0 120 120" width="48" height="48">
          <path d="M42 8 L92 4 L92 22 L42 26 Z" fill="#F8F4EE"/>
          <rect x="39" y="26" width="6" height="52" fill="#F8F4EE"/>
          <rect x="86" y="18" width="6" height="42" fill="#F8F4EE"/>
          <circle cx="28" cy="82" r="20" fill="#F8F4EE"/>
          <circle cx="21" cy="77" r="2.8" fill="#1A1714"/>
          <circle cx="35" cy="77" r="2.8" fill="#1A1714"/>
          <path d="M20 85 Q28 94 36 85" stroke="#1A1714" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
          <circle cx="76" cy="64" r="20" fill="#F8F4EE"/>
          <circle cx="69" cy="59" r="2.8" fill="#1A1714"/>
          <circle cx="83" cy="59" r="2.8" fill="#1A1714"/>
          <path d="M68 67 Q76 76 84 67" stroke="#1A1714" strokeWidth="2.8" fill="none" strokeLinecap="round"/>
        </svg>
      </div>
    ),
    { width: 64, height: 64 }
  );
}
