import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Users, HardHat, Clock, Copy, Check, RefreshCw, Loader2, Link2, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useRequireRole } from "@/hooks/useRequireRole";
import { AppShell, PageLoader } from "@/components/layout/AppShell";
import { QRCodeSVG } from "qrcode.react";

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
        description: error.message || "Could not create invitation",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const inviteLink = invitationCode ? `${window.location.origin}/auth?code=${invitationCode}` : "";

  const copyToClipboard = async () => {
    if (!inviteLink) return;
    
    await navigator.clipboard.writeText(inviteLink);
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

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <AppShell role="manager" fullName={fullName}>
      <div className="mx-auto w-full max-w-xl space-y-6">
        <section className="space-y-1">
          <h1 className="text-2xl font-bold">Invite team members</h1>
          <p className="text-sm text-muted-foreground">Single-use secure invitations with QR code and link</p>
        </section>

        <Card className="border border-border shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Staff Invitation</CardTitle>
                <CardDescription>Generate an expiring pass for a builder or manager</CardDescription>
              </div>
              <QrCode className="h-5 w-5 text-brand" />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Invite as</Label>
              <Select 
                value={role} 
                onValueChange={(value: "builder" | "manager") => setRole(value)}
                disabled={Boolean(invitationCode)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="builder">
                    <div className="flex items-center gap-2">
                      <HardHat className="h-4 w-4" />
                      Builder (Worker)
                    </div>
                  </SelectItem>
                  <SelectItem value="manager">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Manager (Admin)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* QR Code Display */}
            {invitationCode ? (
              <div className="space-y-6">
                {/* Timer Banner */}
                <div className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
                  timeRemaining <= 60
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : "border-border bg-muted/40 text-foreground"
                }`}>
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    <span>Active countdown:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-lg font-bold tabular-nums">
                      {formatTime(timeRemaining)}
                    </span>
                    <Badge variant={timeRemaining <= 60 ? "destructive" : "secondary"}>
                      {timeRemaining <= 60 ? "Expiring soon" : "Valid"}
                    </Badge>
                  </div>
                </div>

                {/* QR Code Vector SVG */}
                <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-white p-6 shadow-xs">
                  <div className="relative">
                    <QRCodeSVG
                      value={inviteLink}
                      size={220}
                      level="M"
                      includeMargin
                    />
                    {timeRemaining === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/80 backdrop-blur-xs">
                        <span className="font-semibold text-destructive">Expired</span>
                      </div>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">Scan with phone camera or QR reader</p>
                </div>

                {/* Code & Copy Button */}
                <div className="space-y-2">
                  <Label>Invitation Code</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-xl border border-input bg-muted/50 px-4 py-2.5 font-mono text-base font-semibold tracking-wider">
                      {invitationCode}
                    </code>
                    <Button variant="outline" onClick={copyToClipboard} className="shrink-0 gap-2">
                      {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      {copied ? "Copied" : "Copy Link"}
                    </Button>
                  </div>
                </div>

                {/* Generate New */}
                <Button 
                  onClick={() => {
                    setInvitationCode(null);
                    setExpiresAt(null);
                  }}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Generate a different invitation
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground space-y-2">
                  <p className="font-semibold text-foreground flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-success" /> How invitations work:
                  </p>
                  <p>1. Choose the role (Builder or Manager) and tap Generate.</p>
                  <p>2. The code & QR expire automatically after 5 minutes.</p>
                  <p>3. Once used by the team member, it cannot be reused.</p>
                </div>

                <Button 
                  onClick={generateInvitation} 
                  className="w-full h-11"
                  disabled={isGenerating}
                  variant="brand"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <QrCode className="mr-2 h-4 w-4" />
                  )}
                  {isGenerating ? "Creating..." : "Generate Invitation QR Code"}
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