import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setSuccess(false);
      setMessage("Missing or invalid verification link. Please check your email.");
      return;
    }

    const verify = async () => {
      try {
        const res = await api.post("/auth/verify-email", { token });
        setSuccess(true);
        setMessage(res.message || "Your email has been verified successfully!");
        toast.success("Email verified successfully! You can now log in.");
      } catch (err: any) {
        setSuccess(false);
        setMessage(err.message || "Invalid or expired verification token.");
        toast.error(err.message || "Email verification failed.");
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-lg border text-center">
        <CardHeader>
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-3">
            {loading ? (
              <div className="bg-primary/10 text-primary p-3 rounded-full">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : success ? (
              <div className="bg-emerald-500/10 text-emerald-600 p-3 rounded-full">
                <CheckCircle2 className="w-8 h-8" />
              </div>
            ) : (
              <div className="bg-rose-500/10 text-rose-600 p-3 rounded-full">
                <XCircle className="w-8 h-8" />
              </div>
            )}
          </div>
          <CardTitle className="font-display text-2xl">
            {loading ? "Verifying Email..." : success ? "Email Verified!" : "Verification Failed"}
          </CardTitle>
          <CardDescription>
            {loading
              ? "Validating your single-use verification token with AgriAssist..."
              : message}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!loading && (
            <div className="pt-2">
              {success ? (
                <Button asChild className="w-full">
                  <Link to="/auth/login">
                    Continue to Sign In <ArrowRight className="w-4 h-4 ml-2" />
                  </Link>
                </Button>
              ) : (
                <div className="space-y-2">
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/auth/login">Back to Sign In</Link>
                  </Button>
                  <Button asChild className="w-full">
                    <Link to="/auth/register">Create a New Account</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VerifyEmail;
