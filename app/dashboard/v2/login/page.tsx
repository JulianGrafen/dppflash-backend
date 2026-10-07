'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EnterMotion } from '@/components/ui/enter-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Clock, Database, ShieldCheck, Sparkles } from 'lucide-react';
import { DppflashLegalLinks } from '@/app/dashboard/v2/components/DppflashLegalLinks';

const DEMO_PASSWORD_HINT = 'Demo: mind. 8 Zeichen (z. B. demo-pass)';

const REGISTER_VALUE_PROPS = [
  {
    icon: ShieldCheck,
    title: 'Rechtssicher',
    description: 'ESPR-konform und revisionssicher — Compliance-Nachweis für 15 Jahre.',
  },
  {
    icon: Clock,
    title: 'Schnell & einfach',
    description: 'Digitalen Produktpass in 5 Minuten — ohne IT-Fachwissen.',
  },
  {
    icon: Sparkles,
    title: 'KI-gestützt',
    description: 'Automatische Extraktion aus PDFs & Spezifikationen mit Review.',
  },
  {
    icon: Database,
    title: 'Langzeit-Hosting',
    description: '15 Jahre sichere Speicherung — QR und Daten jederzeit abrufbar.',
  },
] as const;

function validatePassword(password: string): string | null {
  if (!password.trim()) {
    return 'Bitte geben Sie Ihr Passwort ein.';
  }
  if (password.length < 8) {
    return 'Das Passwort muss mindestens 8 Zeichen haben.';
  }
  return null;
}

export default function DashboardV2LoginPage() {
  const { login } = useSession();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('user@firma.de');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    setError(null);
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    setSubmitting(true);
    const result = login(email);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    router.push('/dashboard/v2/onboarding');
  }

  function onFormSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit();
  }

  return (
    <div className="grid min-h-screen bg-background text-foreground lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
      <section
        className="relative hidden flex-col bg-[#0c1929] px-10 py-12 text-white lg:flex"
        aria-label="DPP-Flash"
      >
        <div>
          <V2BrandLogo href="/dashboard/v2" priority onDarkBackground />
          <h1 className="mt-10 max-w-md text-3xl font-semibold leading-tight tracking-tight">
            Digitale Produktpässe für Batterien — schnell, konform, auditierbar.
          </h1>
        </div>
      </section>

      <section className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <V2BrandLogo href="/dashboard/v2" priority onDarkBackground />
          </div>

          <EnterMotion durationMs={350}>
          <Card variant="elevated" className="border-border bg-card ring-border/80">
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="text-xl font-semibold text-foreground">
                {mode === 'login' ? 'Willkommen zurück' : 'Kostenlose Pilot-Phase starten'}
              </CardTitle>
              <CardDescription className="text-pretty leading-relaxed">
                {mode === 'login'
                  ? 'Melden Sie sich mit Ihrer Firmen-E-Mail an. Freemail-Anbieter sind nicht zugelassen.'
                  : 'Testen Sie DPP-Flash unverbindlich — ESPR-konform, in 5 Minuten zum Produktpass-QR-Code, ohne IT-Fachwissen.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Tabs
                value={mode}
                onValueChange={(value) => {
                  setMode(value as 'login' | 'register');
                  setError(null);
                }}
              >
                <TabsList className="mb-6 grid w-full grid-cols-2 bg-muted">
                  <TabsTrigger value="login" className="cursor-pointer data-active:bg-card">
                    Anmelden
                  </TabsTrigger>
                  <TabsTrigger value="register" className="cursor-pointer data-active:bg-card">
                    Registrieren
                  </TabsTrigger>
                </TabsList>

                <form onSubmit={onFormSubmit} className="space-y-4">
                  <TabsContent value="login" className="mt-0 space-y-4">
                    <LoginFields
                      email={email}
                      password={password}
                      onEmailChange={setEmail}
                      onPasswordChange={setPassword}
                      emailId="email-login"
                      passwordId="password-login"
                    />
                  </TabsContent>
                  <TabsContent value="register" className="mt-0 space-y-4">
                    <RegisterPilotHighlights />
                    <LoginFields
                      email={email}
                      password={password}
                      onEmailChange={setEmail}
                      onPasswordChange={setPassword}
                      emailId="email-register"
                      passwordId="password-register"
                    />
                  </TabsContent>

                  {error ? (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                      {error}
                    </p>
                  ) : null}

                  <Button
                    type="submit"
                    className="w-full cursor-pointer"
                    disabled={submitting}
                  >
                    {mode === 'login' ? 'Anmelden' : 'Pilot-Phase starten'}
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">{DEMO_PASSWORD_HINT}</p>
                </form>
              </Tabs>
            </CardContent>
          </Card>
          </EnterMotion>

          {mode === 'register' ? (
            <p className="mt-4 text-center text-xs text-muted-foreground">
              Made in Germany · DSGVO-konform · Daten bleiben in Deutschland
            </p>
          ) : null}

          <DppflashLegalLinks
            showMarketingHome
            className="mt-6 text-center text-[11px]"
          />
        </div>
      </section>
    </div>
  );
}

function RegisterPilotHighlights() {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Warum DPP-Flash?
      </p>
      <ul className="space-y-3">
        {REGISTER_VALUE_PROPS.map(({ icon: Icon, title, description }) => (
          <li key={title} className="flex gap-3">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
              aria-hidden
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        <span className="font-medium text-foreground">Fristen laufen:</span> Batteriepass ab Februar
        2027 — ohne DPP fehlt der Konformitätsnachweis.
      </p>
    </div>
  );
}

function LoginFields({
  email,
  password,
  onEmailChange,
  onPasswordChange,
  emailId,
  passwordId,
}: {
  email: string;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  emailId: string;
  passwordId: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={emailId}>Geschäftliche E-Mail</Label>
        <Input
          id={emailId}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => onEmailChange(e.target.value)}
          placeholder="name@ihre-firma.de"
          className="h-10 bg-background"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={passwordId}>Passwort</Label>
        <Input
          id={passwordId}
          type="password"
          autoComplete={emailId.includes('register') ? 'new-password' : 'current-password'}
          value={password}
          onChange={(e) => onPasswordChange(e.target.value)}
          placeholder="••••••••"
          className="h-10 bg-background"
        />
      </div>
    </>
  );
}
