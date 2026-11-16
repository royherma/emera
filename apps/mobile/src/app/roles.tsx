import { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { Icon } from "@/components/Icon";
import { RoleBadge } from "@/components/RoleBadge";
import { Screen } from "@/components/Screen";
import { IconButton, Segmented } from "@/components/ui";
import { api } from "@/lib/api";
import { radius, space, type } from "@/lib/theme";
import { ApiError, type SettableRole, type User } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useTheme } from "@/state/theme";
import { useToast } from "@/state/toast";

const OPTIONS: { value: SettableRole; label: string }[] = [
  { value: "member", label: "Member" },
  { value: "mod", label: "Mod" },
  { value: "creator", label: "Creator" },
];

const settable = (u: User): SettableRole => (u.role === "mod" || u.role === "creator" ? u.role : "member");

export default function Roles() {
  const router = useRouter();
  const toast = useToast();
  const { c } = useTheme();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.admin) return;
    let alive = true;
    const t = setTimeout(() => {
      api.adminUsers(q).then((r) => alive && (setPeople(r), setError(null)), (e) => alive && setError(e instanceof ApiError ? e.message : "Could not load people."));
    }, 200);
    return () => { alive = false; clearTimeout(t); };
  }, [q, user?.admin]);

  const change = async (u: User, role: SettableRole) => {
    const before = people;
    setPeople((old) => old?.map((p) => (p.id === u.id ? { ...p, role: role === "member" ? null : role } : p)) ?? old);
    try {
      await api.setRole(u.handle, role);
      toast(`@${u.handle} is now ${OPTIONS.find((o) => o.value === role)!.label}`);
    } catch (e) {
      setPeople(before);
      toast(e instanceof ApiError ? e.message : "Could not change the role.");
    }
  };

  return (
    <Screen maxWidth={720}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], marginBottom: space[4] }}>
        <IconButton icon="back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace("/settings"))} />
        <Text style={[type.h1, { color: c.ink }]}>Roles</Text>
      </View>
      {!user?.admin ? (
        <Text style={[type.body, { color: c.ink2 }]}>Only admins can change roles.</Text>
      ) : (
        <View style={{ gap: space[3] }}>
          <View style={{ height: 46, borderRadius: radius.field + 1, backgroundColor: c.sunk, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14 }}>
            <Icon name="search" size={19} color={c.ink3} />
            <TextInput
              value={q}
              onChangeText={setQ}
              placeholder="Find someone"
              placeholderTextColor={c.ink3}
              selectionColor={c.sun}
              accessibilityLabel="Find someone"
              autoCapitalize="none"
              autoCorrect={false}
              style={[{ flex: 1, height: 46, fontFamily: type.name.fontFamily, fontSize: 15, color: c.ink }, { outlineStyle: "none" } as object]}
            />
          </View>
          {error ? <Text style={[type.bodySm, { color: c.danger }]}>{error}</Text> : null}
          {people?.map((u) => (
            <View key={u.id} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingVertical: 6 }}>
              <Avatar user={u} size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text numberOfLines={1} style={[type.name, { color: c.ink, flexShrink: 1 }]}>{u.displayName}</Text>
                  <RoleBadge role={u.role} />
                </View>
                <Text numberOfLines={1} style={[type.meta, { color: c.ink3 }]}>@{u.handle}</Text>
              </View>
              {u.role === "admin" ? (
                <Text style={[type.meta, { color: c.ink3 }]}>Admin</Text>
              ) : (
                <View style={{ width: 300 }}>
                  <Segmented value={settable(u)} options={OPTIONS} onChange={(r) => void change(u, r)} />
                </View>
              )}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
