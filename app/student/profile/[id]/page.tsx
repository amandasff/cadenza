"use client";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfileRedirectPage() {
  const params = useParams();
  const id = params.id as string;
  const router = useRouter();

  useEffect(() => {
    if (id) router.replace(`/student/studio/${id}`);
  }, [id, router]);

  return null;
}
