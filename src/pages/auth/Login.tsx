import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowRight, Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { login, resendVerification } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setUnverifiedEmail(null);

    try {
      const data = await login({ email, password });
      toast.success("Welcome back!");
      if (data.role === "consumer") {
        navigate("/consumer/dashboard");
      } else {
        navigate("/farmer/dashboard");
      }
    } catch (err: any) {
      if (err.data?.needsVerification || err.status === 403) {
        setUnverifiedEmail(email);
        toast.error("Email not verified. Please check your inbox or resend the verification link.");
      } else {
        toast.error(err.message || "Invalid email or password");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!unverifiedEmail) return;
    setResending(true);
    try {
      await resendVerification(unverifiedEmail);
      toast.success("A fresh verification link has been sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification link.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full agri-gradient flex items-center justify-center mb-2">
            <span className="text-lg font-bold text-primary-foreground">A</span>
          </div>
          <CardTitle className="font-display text-2xl">Welcome to AgriAssist</CardTitle>
          <CardDescription>Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          {unverifiedEmail && (
            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-800 dark:text-amber-200">
              <div className="flex items-center gap-2 mb-1.5 font-medium">
                <Mail className="w-4 h-4" />
                <span>Verification Pending</span>
              </div>
              <p className="text-xs mb-2">
                We sent a link to <strong>{unverifiedEmail}</strong>. Please check your inbox and spam folder.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResend}
                disabled={resending}
                className="w-full text-xs h-8"
              >
                {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Resend Verification Email
              </Button>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  to="/auth/forgot-password"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-4">
            Don't have an account?{" "}
            <Link to="/auth/register" className="text-primary underline">
              Create Account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
