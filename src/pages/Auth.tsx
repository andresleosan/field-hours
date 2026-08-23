import { useState, useEffect, Suspense, lazy } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, HardHat, QrCode, AlertTriangle, Camera, Check, Users } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  const [signupMode, setSignupMode] = useState<"direct" | "invite">(invitationCodeFromUrl ? "invite" : "direct");
  const [directRole, setDirectRole] = useState<"manager" | "builder">("manager");
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
    
    const roleToAssign: "manager" | "builder" = signupMode === "invite" 
      ? (invitationData?.role || "builder") 
      : directRole;

    if (signupMode === "invite" && !invitationData?.valid) {
      toast({
        title: "Invalid Invitation",
        description: "Please enter a valid invitation code or switch to direct registration.",
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
          .upsert({ user_id: authData.user.id, role: roleToAssign });

        if (roleError) console.warn("Role assignment note:", roleError.message);

        // Mark invitation as used if it was an invite
        if (signupMode === "invite" && invitationData?.invitation_id) {
          try {
            await supabase.rpc("use_invitation", {
              invitation_id: invitationData.invitation_id,
              user_id: authData.user.id,
            });
          } catch {
            // non-fatal
          }
        }

        toast({
          title: "Account created!",
          description: `Welcome to BuildTrack Pro as a ${roleToAssign}`,
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
        description: error.message || "Invalid email or password",
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
                <Button type="submit" className="w-full" disabled={isLoading} variant="brand">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign In
                </Button>
                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab("signup")}
                    className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                  >
                    Don't have an account? Sign up here
                  </button>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                {/* Mode Selector */}
                <div className="flex gap-2 rounded-lg border border-border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => setSignupMode("direct")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                      signupMode === "direct" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Direct Sign Up
                  </button>
                  <button
                    type="button"
                    onClick={() => setSignupMode("invite")}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition ${
                      signupMode === "invite" ? "bg-background text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Have QR / Code
                  </button>
                </div>

                {signupMode === "direct" ? (
                  <div className="space-y-2">
                    <Label htmlFor="signup-role">Role</Label>
                    <Select value={directRole} onValueChange={(val: "manager" | "builder") => setDirectRole(val)}>
                      <SelectTrigger id="signup-role" className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manager">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Manager (Admin / Project Manager)
                          </div>
                        </SelectItem>
                        <SelectItem value="builder">
                          <div className="flex items-center gap-2">
                            <HardHat className="h-4 w-4" />
                            Builder (On-site Worker)
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="signup-invitation-code" className="flex items-center gap-2">
                      <QrCode className="h-4 w-4" />
                      Invitation Code
                    </Label>
                    <div className="relative">
                      <Input
                        id="signup-invitation-code"
                        type="text"
                        placeholder="Enter code or scan QR"
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
                        maxLength={12}
                        className="font-mono tracking-wider uppercase"
                      />
                      {isValidatingCode && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    
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

                    {!invitationData?.valid && !isValidatingCode && (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowQRScanner(true)}
                        className="mt-2 w-full flex items-center justify-center gap-2"
                        size="sm"
                      >
                        <Camera className="h-4 w-4" />
                        Scan QR Code with Camera
                      </Button>
                    )}
                  </div>
                )}

                {/* Form fields */}
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Full Name *</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Luis Martinez"
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
                    placeholder="+44 7123 456789"
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
                  <p className="text-[11px] text-muted-foreground">
                    Min 8 characters with uppercase, lowercase, and a number (e.g. Test1234!)
                  </p>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading} variant="brand">
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Account {signupMode === "direct" ? `as ${directRole === "manager" ? "Manager" : "Builder"}` : ""}
                </Button>
              </form>

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
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;