import { AuthForm } from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main 
      className="grid min-h-screen place-items-center px-4 py-8 sm:px-6"
      style={{
        backgroundColor: "#F5F2F7",
        backgroundImage: `
          radial-gradient(circle at 15% 15%, rgba(210, 193, 235, 0.35), transparent 40%),
          radial-gradient(circle at 85% 20%, rgba(239, 207, 222, 0.30), transparent 35%),
          radial-gradient(circle at 80% 80%, rgba(202, 220, 240, 0.30), transparent 40%),
          radial-gradient(circle at 20% 85%, rgba(243, 232, 215, 0.30), transparent 35%)
        `,
      }}
    >
      <AuthForm />
    </main>
  );
}
