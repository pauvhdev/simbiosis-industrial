"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogIn, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Mode = "login" | "register";

/**
 * Acceso de empresa.
 *
 * La cuenta identifica a la empresa ante la plataforma, no ante las demás
 * empresas: el nombre y el email viven en la tabla privada y no aparecen en
 * ninguna publicación. Se explica aquí porque pedir la razón social justo
 * debajo del reclamo "anónimo" parece una contradicción si no se dice.
 */
export function AuthPanel() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "register" ? { companyName, email, password } : { email, password },
        ),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.issues?.[0]?.message ?? data.error ?? "No se ha podido continuar.");
        return;
      }

      // La sesión vive en una cookie httpOnly, así que el estado lo tiene el
      // servidor: se recarga el árbol en lugar de guardar el usuario en React.
      router.refresh();
    } catch {
      setError("No se ha podido conectar con el servidor.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "login" ? (
            <LogIn className="size-4" aria-hidden />
          ) : (
            <UserPlus className="size-4" aria-hidden />
          )}
          {mode === "login" ? "Entrar" : "Crear cuenta de empresa"}
        </CardTitle>
        <CardDescription>
          Necesitas una cuenta para publicar y para solicitar contacto. Es lo que impide
          que alguien publique o pida un descruce en tu nombre.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          {mode === "register" ? (
            <div className="space-y-1.5">
              <Label htmlFor="auth-company">Razón social</Label>
              <Input
                id="auth-company"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Quesos del Moncayo S.L."
                autoComplete="organization"
                required
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="produccion@empresa.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Contraseña</Label>
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              minLength={mode === "register" ? 10 : undefined}
              required
            />
            {mode === "register" ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                Mínimo 10 caracteres. Mejor una frase larga que un símbolo raro.
              </p>
            ) : null}
          </div>

          {error ? (
            <p className="flex items-start gap-2 rounded-md border border-[var(--destructive)]/30 bg-[var(--destructive)]/10 p-2.5 text-sm text-[var(--destructive)]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {error}
            </p>
          ) : null}

          <Button type="submit" disabled={pending} className="w-full">
            {pending
              ? "Un momento…"
              : mode === "login"
                ? "Entrar"
                : "Crear cuenta y entrar"}
          </Button>

          <p className="text-center text-sm text-[var(--muted-foreground)]">
            {mode === "login" ? "¿Todavía no tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
            <button
              type="button"
              className="font-medium text-[var(--primary)] underline-offset-2 hover:underline"
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
            >
              {mode === "login" ? "Crear una" : "Entrar"}
            </button>
          </p>
        </form>

        <p className="mt-5 flex items-start gap-2 border-t border-[var(--border)] pt-4 text-xs text-[var(--muted-foreground)]">
          <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Tu razón social y tu email quedan en la tabla privada. No aparecen en ninguna
          publicación ni se revelan a nadie hasta que aceptes un contacto.
        </p>
      </CardContent>
    </Card>
  );
}
