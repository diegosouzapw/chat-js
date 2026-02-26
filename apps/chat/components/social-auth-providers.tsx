"use client";

import { Github, MailIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import authClient from "@/lib/auth-client";
import { config } from "@/lib/config";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <title>Google</title>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

function VercelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <title>Vercel</title>
      <path d="M12 1L24 22H0L12 1z" />
    </svg>
  );
}

export function SocialAuthProviders() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [magicLinkError, setMagicLinkError] = useState<string | null>(null);

  const hasAnyProvider =
    config.authentication.google ||
    config.authentication.github ||
    config.authentication.vercel;

  const hasMagicLink = config.authentication.magicLink;

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setMagicLinkLoading(true);
    setMagicLinkError(null);

    try {
      const { error } = await authClient.signIn.magicLink({
        email: email.trim(),
        callbackURL: "/",
      });
      if (error) {
        setMagicLinkError(error.message || "Failed to send magic link");
      } else {
        setMagicLinkSent(true);
      }
    } catch {
      setMagicLinkError("Failed to send magic link. Please try again.");
    } finally {
      setMagicLinkLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Social Providers */}
      <div className="space-y-2">
        {config.authentication.google ? (
          <Button
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "google" })}
            type="button"
            variant="outline"
          >
            <GoogleIcon className="mr-2 h-4 w-4" />
            Continue with Google
          </Button>
        ) : null}
        {config.authentication.github ? (
          <Button
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "github" })}
            type="button"
            variant="outline"
          >
            <Github className="mr-2 h-4 w-4" />
            Continue with GitHub
          </Button>
        ) : null}
        {config.authentication.vercel ? (
          <Button
            className="w-full"
            onClick={() => authClient.signIn.social({ provider: "vercel" })}
            type="button"
            variant="outline"
          >
            <VercelIcon className="mr-2 h-4 w-4" />
            Continue with Vercel
          </Button>
        ) : null}
      </div>

      {/* Magic Link */}
      {hasMagicLink && (
        <>
          {hasAnyProvider && (
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  or
                </span>
              </div>
            </div>
          )}

          {magicLinkSent ? (
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center dark:border-green-800 dark:bg-green-950">
              <MailIcon className="mx-auto mb-2 h-8 w-8 text-green-600 dark:text-green-400" />
              <p className="text-sm font-medium text-green-800 dark:text-green-200">
                Check your email
              </p>
              <p className="mt-1 text-xs text-green-600 dark:text-green-400">
                We sent a magic link to <strong>{email}</strong>
              </p>
              <Button
                className="mt-3"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setMagicLinkSent(false);
                  setEmail("");
                }}
              >
                Try a different email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="space-y-2">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={magicLinkLoading}
              />
              <Button
                className="w-full"
                type="submit"
                disabled={magicLinkLoading || !email.trim()}
              >
                {magicLinkLoading ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <MailIcon className="mr-2 h-4 w-4" />
                )}
                Continue with Magic Link
              </Button>
              {magicLinkError && (
                <p className="text-center text-sm text-destructive">
                  {magicLinkError}
                </p>
              )}
            </form>
          )}
        </>
      )}

      {/* Guest fallback */}
      {!hasAnyProvider && !hasMagicLink && (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-center text-sm">
            No authentication providers configured.
          </p>
          <Button
            className="w-full"
            onClick={() => router.push("/")}
            type="button"
          >
            Continue as Guest
          </Button>
        </div>
      )}
    </div>
  );
}
