import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Icon, IconName } from "./Icon";
import { Pulse } from "./ui";
import { api } from "@/lib/api";
import { fullDate, shortHash } from "@/lib/format";
import { alpha, radius, space, type } from "@/lib/theme";
import type { Post, PostProof } from "@/lib/types";
import { useAuth } from "@/state/auth";
import { useSheetBody, type SheetBody } from "@/state/sheet";
import { useTheme } from "@/state/theme";

function Row({ icon, title, line, good = true }: { icon: IconName; title: string; line: string; good?: boolean }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", gap: space[3], alignItems: "flex-start" }}>
      <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: good ? alpha(c.sun, 0.16) : alpha(c.danger, 0.14), alignItems: "center", justifyContent: "center", marginTop: 1 }}>
        <Icon name={icon} size={17} color={good ? c.sunInk : c.danger} strokeWidth={2.1} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={[type.name, { color: c.ink }]}>{title}</Text>
        <Text style={[type.bodySm, { color: c.ink2 }]}>{line}</Text>
      </View>
    </View>
  );
}

function ProofBody({ post, close }: { post: Post; close: (then?: () => void) => void }) {
  const { c } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const [proof, setProof] = useState<PostProof | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    api.proof(post.id).then((p) => live && setProof(p), () => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [post.id]);

  const own = user?.id === post.author.id;
  const fingerprint = post.media[0]?.proof.sha256;
  const allMatch = !!proof && proof.files.intact === proof.files.total;
  return (
    <View style={{ gap: space[4], paddingHorizontal: space[3], paddingTop: space[2], paddingBottom: space[2] }}>
      <View style={{ gap: 2 }}>
        <Text style={[type.title, { color: c.ink }]}>Proof</Text>
        <Text style={[type.meta, { color: c.ink3 }]}>What Emera checked on this post</Text>
      </View>
      {failed ? (
        <Text style={[type.body, { color: c.ink2 }]}>Couldn't load the proof. Try again.</Text>
      ) : !proof ? (
        <View style={{ gap: space[3] }}>
          <Pulse style={{ height: 44 }} />
          <Pulse style={{ height: 44 }} />
          <Pulse style={{ height: 44 }} />
        </View>
      ) : (
        <View style={{ gap: space[4] }}>
          <Row icon="user" title={`Posted by @${proof.author.handle}`} line={`${proof.author.displayName}. Signed in with a verified email${proof.author.role === "creator" ? ", creator account" : ""}.`} />
          <Row icon="clock" title="First posted on Emera" line={fullDate(proof.firstPostedAt)} />
          {allMatch ? (
            <Row icon="check" title="This is the original upload" line={`The file matches the fingerprint Emera signed at upload${fingerprint ? ` (${shortHash(fingerprint)})` : ""}.`} />
          ) : (
            <Row good={false} icon="flag" title="File does not match" line={`${proof.files.total - proof.files.intact} of ${proof.files.total} files no longer match what was uploaded.`} />
          )}
          {proof.imported ? (
            <Row icon="link" title={`Brought over from ${proof.imported.from ?? "another site"}`} line={`Originally posted ${fullDate(proof.imported.originalDate)}.`} />
          ) : (
            <Row icon="image" title="Uploaded on Emera" line="Not imported from another site." />
          )}
        </View>
      )}
      {own && (
        <Pressable accessibilityRole="link" onPress={() => close(() => router.push({ pathname: "/report", params: { id: post.id } }))} style={{ height: 44, borderRadius: radius.field, backgroundColor: c.sunk, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: space[2] }}>
          <Icon name="flag" size={16} color={c.ink} />
          <Text style={[type.button, { color: c.ink }]}>Found a copy of this?</Text>
        </Pressable>
      )}
    </View>
  );
}

export function useProofSheet() {
  const open = useSheetBody();
  return (post: Post) => open(((close) => <ProofBody post={post} close={close} />) as SheetBody);
}
