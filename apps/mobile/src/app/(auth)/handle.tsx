import { useState } from "react";
import { AuthShell } from "@/components/AuthShell";
import { Banner, Button, Field } from "@/components/ui";
import { api } from "@/lib/api";
import { HANDLE_RE } from "@/lib/format";
import { PUBLIC_ORIGIN } from "@/lib/config";
import { ApiError } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { pendingSignup } from "@/lib/signup";

const toHandle = (s: string) => s.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20);

export default function Handle() {
  const { finishHandle } = useAuth();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState(() => toHandle(pendingSignup.email.split("@")[0] ?? ""));
  const [handleEdited, setHandleEdited] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = HANDLE_RE.test(handle);
  const handleError = handle.length > 0 && !valid ? "Use 3 to 20 letters, numbers or underscores." : null;

  const onName = (t: string) => {
    setName(t);
    if (!handleEdited && toHandle(t).length >= 3) setHandle(toHandle(t));
  };

  const submit = async () => {
    if (!valid || busy) return;
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
    <AuthShell title="What's your name?" lead="It shows on everything you post." back={false}>
      <Field label="Name" value={name} onChangeText={onName} placeholder="Your name" autoComplete="name" autoFocus maxLength={50} onSubmitEditing={submit} />
      <Field label="Handle" value={handle} onChangeText={(t) => { setHandleEdited(true); setHandle(toHandle(t)); }} placeholder="yourhandle" autoCapitalize="none" autoCorrect={false} error={handleError} hint={valid ? `${PUBLIC_ORIGIN.replace(/^https?:\/\//, "")}/@${handle}` : undefined} onSubmitEditing={submit} />
      {error && <Banner text={error} />}
      <Button label="Start" size="lg" busy={busy} disabled={!valid} onPress={submit} />
    </AuthShell>
  );
}
