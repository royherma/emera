import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { HANDLE_RE } from "@/lib/format";
import { PUBLIC_ORIGIN } from "@/lib/config";
import { ApiError } from "@/lib/types";
import { useAuth } from "@/state/auth";

export default function Handle() {
  const { finishHandle } = useAuth();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = HANDLE_RE.test(handle);
  const handleError = handle.length > 0 && !valid ? "Use 3 to 20 letters, numbers or underscores." : null;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await api.setHandle({ handle, displayName: name.trim() || handle });
      finishHandle(user);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Pick your handle" lead="This is how people find you. Your handle and name are signed into everything you post." back={false}>
      <Field label="Name" value={name} onChangeText={setName} placeholder="Your name or studio" autoComplete="name" autoFocus maxLength={50} />
      <Field label="Handle" value={handle} onChangeText={(t) => setHandle(t.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))} placeholder="yourhandle" autoCapitalize="none" autoCorrect={false} error={handleError} hint={handle ? `Your page: ${PUBLIC_ORIGIN}/@${handle}` : undefined} />
      {error && <Banner text={error} />}
      <Button label="Finish" size="lg" busy={busy} disabled={!valid} onPress={submit} />
    </AuthShell>
  );
}
