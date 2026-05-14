import { TryOnStudio } from "@/components/tryon/TryOnStudio";
import AuthGuard from "@/components/AuthGuard";

export default function TryOnPage() {
  return (
    <AuthGuard>
      <TryOnStudio />
    </AuthGuard>
  );
}
