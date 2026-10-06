'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from '@/app/dashboard/v2/context/SessionProvider';
import { V2BrandLogo } from '@/app/dashboard/v2/components/V2BrandLogo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
const DEMO_PASSWORD_HINT = 'Demo: mind. 8 Zeichen (z. B. demo-pass)';

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
    <div className="grid min-h-screen bg-[#eef1f6] lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
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

          <Card className="border-slate-200/90 bg-white shadow-md ring-slate-200/80">
            <CardHeader className="border-b border-slate-100 pb-4">
              <CardTitle className="text-xl font-semibold text-[#0c1929]">
                {mode === 'login' ? 'Willkommen zurück' : 'Konto anlegen'}
              </CardTitle>
              <CardDescription className="text-slate-600">
                Melden Sie sich mit Ihrer Firmen-E-Mail an. Freemail-Anbieter sind nicht zugelassen.
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
                <TabsList className="mb-6 grid w-full grid-cols-2 bg-slate-100/80">
                  <TabsTrigger value="login" className="cursor-pointer data-[state=active]:bg-white">
                    Anmelden
                  </TabsTrigger>
                  <TabsTrigger value="register" className="cursor-pointer data-[state=active]:bg-white">
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
                    {mode === 'login' ? 'Anmelden' : 'Konto anlegen & starten'}
                  </Button>
                  <p className="text-center text-xs text-slate-500">{DEMO_PASSWORD_HINT}</p>
                </form>
              </Tabs>
            </CardContent>
          </Card>

          <p className="mt-6 text-center text-[11px] text-slate-500">
            <span className="underline">Impressum</span>
            {' · '}
            <span className="underline">Datenschutz</span>
            {' · '}
            <span className="underline">AGB</span>
          </p>
        </div>
      </section>
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
          className="h-10 bg-white"
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
          className="h-10 bg-white"
        />
      </div>
    </>
  );
}
