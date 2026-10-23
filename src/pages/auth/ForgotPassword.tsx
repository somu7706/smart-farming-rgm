import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { KeyRound, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email");
      return;
    }

    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSubmitted(true);
      toast.success("Password reset instructions sent to your email!");
    } catch (err: any) {
      toast.error(err.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2 text-primary">
            <KeyRound className="w-6 h-6" />
          </div>
          <CardTitle className="font-display text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your registered email and we'll send a password recovery link
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-800 dark:text-emerald-200 text-sm">
                <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-600" />
                <p className="font-medium">Reset link dispatched</p>
                <p className="text-xs text-muted-foreground mt-1">
                  If an account exists for <strong>{email}</strong>, a password reset link has been delivered. Please check your inbox.
                </p>
              </div>
              <Button asChild className="w-full" variant="outline">
                <Link to="/auth/login">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back to Sign In
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Sending Reset Link...
                  </>
                ) : (
                  "Send Password Reset Link"
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  to="/auth/login"
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center"
                >
                  <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ForgotPassword;
