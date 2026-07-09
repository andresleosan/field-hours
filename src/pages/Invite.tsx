import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Users, HardHat, Clock, Copy, Check, RefreshCw } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";

const Invite = () => {
  const { fullName, isLoading } = useRequireRole("manager");
  const [isGenerating, setIsGenerating] = useState(false);
  const [role, setRole] = useState<"builder" | "manager">("builder");
  const [invitationCode, setInvitationCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  // Timer countdown
  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
      setTimeRemaining(remaining);

      if (remaining === 0) {
        setInvitationCode(null);
        setExpiresAt(null);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const generateInvitation = async () => {
    setIsGenerating(true);
    try {
      // Generate a random code
      const code = crypto.randomUUID().replace(/-/g, "").substring(0, 12).toUpperCase();
      const expires = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const { error } = await supabase.from("invitations").insert({
        code,
        role,
        created_by: session.user.id,
        expires_at: expires.toISOString(),
      });

      if (error) throw error;

      setInvitationCode(code);
      setExpiresAt(expires);
      setTimeRemaining(300); // 5 minutes in seconds

      toast({
        title: "Invitation created!",
        description: `Valid for 5 minutes for ${role} role`,
      });
    } catch (error: any) {
      toast({
        title: "Failed to generate invitation",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    if (!invitationCode) return;
    
    const signupUrl = `${window.location.origin}/auth?code=${invitationCode}`;
    await navigator.clipboard.writeText(signupUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    
    toast({
      title: "Copied!",
      description: "Invitation link copied to clipboard",
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const generateQRCodeUrl = (code: string) => {
    const signupUrl = `${window.location.origin}/auth?code=${code}`;
    // Using QR Code API
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(signupUrl)}&bgcolor=ffffff&color=000000&format=svg`;
  };

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <AppShell role="manager" fullName={fullName}>
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <section className="space-y-1">
          <h1 className="text-2xl font-bold">Invite team members</h1>
          <p className="text-sm text-muted-foreground">Single-use QR invitations that expire in 5 minutes</p>
        </section>
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <QrCode className="h-6 w-6 text-primary" />
              Generate Invitation QR Code
            </CardTitle>
            <CardDescription>
              Create a secure, single-use invitation that expires in 5 minutes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Invite as</Label>
              <Select 
                value={role} 
                onValueChange={(value: "builder" | "manager") => setRole(value)}
                disabled={!!invitationCode}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">
                    <div className="flex items-center gap-2">
                      <HardHat className="h-4 w-4" />
                      Builder
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Manager
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* QR Code Display */}
            {invitationCode ? (
              <div className="space-y-6">
                {/* Timer */}
                <div className="flex items-center justify-center gap-2">
                  <Clock className={`h-5 w-5 ${timeRemaining <= 60 ? 'text-destructive' : 'text-primary'}`} />
                  <span className={`text-2xl font-mono font-bold ${timeRemaining <= 60 ? 'text-destructive' : 'text-primary'}`}>
                    {formatTime(timeRemaining)}
                  </span>
                  <Badge variant={timeRemaining <= 60 ? "destructive" : "secondary"}>
                    {timeRemaining <= 60 ? "Expiring soon!" : "Active"}
                  </Badge>
                </div>

                {/* QR Code */}
                <div className="flex justify-center">
                  <div className="relative p-4 bg-white rounded-2xl shadow-lg">
                    <img
                      src={generateQRCodeUrl(invitationCode)}
                      alt="Invitation QR Code"
                      className="w-64 h-64"
                    />
                    {/* Overlay when expired */}
                    {timeRemaining === 0 && (
                      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-2xl">
                        <span className="text-destructive font-semibold">Expired</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Invitation Code Display */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Invitation Code</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="px-4 py-2 bg-muted rounded-lg font-mono text-lg tracking-wider">
                      {invitationCode}
                    </code>
                    <Button variant="outline" size="icon" onClick={copyToClipboard}>
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                {/* Role Badge */}
                <div className="flex justify-center">
                  <Badge variant="outline" className="text-base px-4 py-2">
                    {role === "builder" ? (
                      <><HardHat className="h-4 w-4 mr-2" /> Builder Invitation</>
                    ) : (
                      <><Users className="h-4 w-4 mr-2" /> Manager Invitation</>
                    )}
                  </Badge>
                </div>

                {/* Generate New Button */}
                <Button 
                  onClick={() => {
                    setInvitationCode(null);
                    setExpiresAt(null);
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Generate New Code
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Instructions */}
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <h4 className="font-medium">How it works:</h4>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Select the role for the new team member</li>
                    <li>Generate a QR code invitation</li>
                    <li>Share the QR code with the new member</li>
                    <li>They scan it to sign up within 5 minutes</li>
                    <li>Each code can only be used once</li>
                  </ol>
                </div>

                {/* Generate Button */}
                <Button 
                  onClick={generateInvitation} 
                  className="w-full h-12 text-lg"
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  ) : (
                    <QrCode className="h-5 w-5 mr-2" />
                  )}
                  Generate QR Code
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
};

export default Invite;