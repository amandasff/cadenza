"use client";
import { useEffect, use } from "react";
import { useRouter } from "next/navigation";

export default function InvoiceRedirect({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = use(params);
  const router = useRouter();
  useEffect(() => {
    router.replace(`/teacher/billing/${studentId}`);
  }, [studentId, router]);
  return null;
}
