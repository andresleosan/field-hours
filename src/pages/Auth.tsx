import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HardHat, QrCode, AlertTriangle, Camera, Check } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
// html5-qrcode is ~300 kB and only needed once the camera is actually opened.
const QRScannerDialog = lazy(() =>
  import("@/components/auth/QRScannerDialog").then((m) => ({ default: m.QRScannerDialog })),
);

// Validation schemas
const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string().min(1, "Password is required").max(72, "Password is too long"),
});

const signUpSchema = z.object({
  email: z.string().trim().toLowerCase().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password is too long")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  fullName: z.string().trim().min(1, "Full name is required").max(100, "Name is too long"),
  phone: z.string().trim().regex(/^(\+?[0-9\s\-()]+)?$/, "Please enter a valid phone number").max(20, "Phone number is too long").optional().or(z.literal("")),
});

interface InvitationData {
  valid: boolean;
  role: "builder" | "manager";
  invitation_id: string;
  error_message: string | null;
}

const Auth = () => {
  const [searchParams] = useSearchParams();
  const invitationCodeFromUrl = searchParams.get("code");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(!!invitationCodeFromUrl);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [invitationCode, setInvitationCode] = useState(invitationCodeFromUrl || "");
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(invitationCodeFromUrl ? "signup" : "signin");
  const [showQRScanner, setShowQRScanner] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        navigate("/dashboard");
      }
    };
    checkUser();
  }, [navigate]);

  // Validate invitation code from URL
  useEffect(() => {
    if (invitationCodeFromUrl) {
      validateInvitationCode(invitationCodeFromUrl);
    }
  }, [invitationCodeFromUrl]);

  const validateInvitationCode = async (code: string) => {
    if (!code.trim()) {
      setInvitationData(null);
      setCodeError(null);
      return;
    }

    setIsValidatingCode(true);
    setCodeError(null);
    
    try {
      const { data, error } = await supabase.rpc("validate_invitation_code", {
        invitation_code: code.trim().toUpperCase(),
      });

      if (error) throw error;

      const result = data?.[0] as InvitationData | undefined;
      
      if (result?.valid) {
        setInvitationData(result);
        setCodeError(null);
      } else {
        setInvitationData(null);
        setCodeError(result?.error_message || "Invalid invitation code");
      }
    } catch (error: any) {
      setInvitationData(null);
      setCodeError("Failed to validate invitation code");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Must have valid invitation
    if (!invitationData?.valid) {
      toast({
        title: "Invalid Invitation",
        description: "You need a valid QR code invitation to sign up. Please contact a manager.",
        variant: "destructive",
      });
      return;
    }

    // Validate input with Zod
    const validationResult = signUpSchema.safeParse({ email, password, fullName, phone });
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    const validatedData = validationResult.data;

    setIsLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.fullName,
            phone: validatedData.phone || "",
          },
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Add role to user_roles table
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: authData.user.id, role: invitationData.role });

        if (roleError) throw roleError;

        // Mark invitation as used
        await supabase.rpc("use_invitation", {
          invitation_id: invitationData.invitation_id,
          user_id: authData.user.id,
        });

        toast({
          title: "Account created!",
          description: `Welcome to BuildTrack Pro as a ${invitationData.role}`,
        });
        navigate("/dashboard");
      }
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate input with Zod
    const validationResult = signInSchema.safeParse({ email, password });
    if (!validationResult.success) {
      const firstError = validationResult.error.errors[0];
      toast({
        title: "Validation Error",
        description: firstError.message,
        variant: "destructive",
      });
      return;
    }

    const validatedData = validationResult.data;

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: validatedData.email,
        password: validatedData.password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "Successfully signed in",
      });
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background p-4">
      <div className="blueprint-grid pointer-events-none absolute inset-0" aria-hidden="true" />
      <Card className="reveal relative w-full max-w-md overflow-hidden shadow-md">
        <div className="hi-vis-rule h-1" aria-hidden="true" />
        <CardHeader className="space-y-1 text-center">
          <div className="mb-4 flex justify-center">
            <div className="rounded-lg bg-primary p-3">
              <HardHat className="h-7 w-7 text-primary-foreground" strokeWidth={1.75} />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">BuildTrack Pro</CardTitle>
          <CardDescription>Construction project management</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign In</TabsTrigger>
              <TabsTrigger value="signup">Sign Up</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    required
                    maxLength={255}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">Password</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    required
                    maxLength={72}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Invitation Code Input */}
                <div className="space-y-2">
                  <Label htmlFor="signup-invitation-code" className="flex items-center gap-2">
                    <QrCode className="h-4 w-4" />
                    Invitation Code *
                  </Label>
                  <div className="relative">
                    <Input
                      id="signup-invitation-code"
                      type="text"
                      placeholder="Enter code from QR scan"
                      value={invitationCode}
                      onChange={(e) => {
                        setInvitationCode(e.target.value.toUpperCase());
                        if (e.target.value.length >= 12) {
                          validateInvitationCode(e.target.value);
                        } else {
                          setInvitationData(null);
                          setCodeError(null);
                        }
                      }}
                      onBlur={() => validateInvitationCode(invitationCode)}
                      disabled={isLoading}
                      required
                      maxLength={12}
                      className="font-mono tracking-wider uppercase"
                    />
                    {isValidatingCode && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  
                  {/* Validation Status */}
                  {invitationData?.valid && (
                    <Badge variant="success">
                      <Check className="h-3 w-3" strokeWidth={2.25} />
                      Valid invitation for {invitationData.role}
                    </Badge>
                  )}
                  {codeError && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertTriangle className="h-4 w-4" />
                      {codeError}
                    </div>
                  )}
                  {!invitationData && !codeError && !isValidatingCode && (
                    <p className="text-xs text-muted-foreground">
                      Scan the QR code from a manager to get your invitation code
                    </p>
                  )}
                </div>

                {/* Only show rest of form if invitation is valid */}
                {invitationData?.valid && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signup-name">Full Name *</Label>
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={isLoading}
                        required
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-email">Email *</Label>
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isLoading}
                        required
                        maxLength={255}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-phone">Phone</Label>
                      <Input
                        id="signup-phone"
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={isLoading}
                        maxLength={20}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="signup-password">Password *</Label>
                      <Input
                        id="signup-password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isLoading}
                        required
                        maxLength={72}
                      />
                      <p className="text-xs text-muted-foreground">
                        Min 8 characters with uppercase, lowercase, and number
                      </p>
                    </div>
                    <Button type="submit" className="w-full" disabled={isLoading}>
                      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create Account as {invitationData.role.charAt(0).toUpperCase() + invitationData.role.slice(1)}
                    </Button>
                  </>
                )}

                {/* QR Scanner Button */}
                {!invitationData?.valid && !isValidatingCode && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowQRScanner(true)}
                    className="flex h-auto w-full flex-col items-center gap-3 border-2 border-dashed border-border py-6 transition-colors hover:border-brand hover:bg-brand/5"
                  >
                    <div className="rounded-lg border border-border bg-muted p-3">
                      <Camera className="h-7 w-7 text-foreground" strokeWidth={1.75} />
                    </div>
                    <div className="text-center">
                      <p className="text-base font-semibold text-foreground">
                        Touch here to scan the QR code
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Ask a manager for an invitation QR code
                      </p>
                    </div>
                  </Button>
                )}

                {/* QR Scanner Dialog */}
                {showQRScanner && (
                  <Suspense fallback={null}>
                    <QRScannerDialog
                      open={showQRScanner}
                      onClose={() => setShowQRScanner(false)}
                      onScan={(code) => {
                        setInvitationCode(code.toUpperCase());
                        validateInvitationCode(code);
                      }}
                    />
                  </Suspense>
                )}
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;