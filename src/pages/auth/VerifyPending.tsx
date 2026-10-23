import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Mail, CheckCircle2, ArrowRight, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";

const VerifyPending = () => {
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email") || "";
  const { resendVerification } = useAuth();
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const handleResend = async () => {
    if (!email) {
      toast.error("No email specified. Please try logging in.");
      return;
    }
    setResending(true);
    try {
      await resendVerification(email);
      toast.success("A new verification link has been sent to your email!");
      setCooldown(60);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-3 text-primary">
            <Mail className="w-8 h-8" />
          </div>
          <CardTitle className="font-display text-2xl">Check Your Email</CardTitle>
          <CardDescription>
            We have sent a verification link to your registered email address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-3 bg-muted rounded-lg text-sm">
            <span className="text-muted-foreground">Sent to: </span>
            <strong className="text-foreground">{email || "your email"}</strong>
          </div>

          <p className="text-xs text-muted-foreground leading-relaxed">
            Click the link inside the email to verify and activate your AgriAssist account. 
            The link is single-use and will expire in 30 minutes. Be sure to check your spam or junk folder if you don't see it within a minute.
          </p>

          <div className="pt-2 space-y-2">
            <Button
              variant="outline"
              onClick={handleResend}
              disabled={resending || cooldown > 0}
              className="w-full"
            >
              {resending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Sending...
                </>
              ) : cooldown > 0 ? (
                `Resend email in ${cooldown}s`
              ) : (
                <>
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button asChild className="w-full">
              <Link to="/auth/login">
                Return to Sign In <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyPending;
