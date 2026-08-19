import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { stageStatusLabel, type WorkflowStageStatus } from "@/lib/workflow-rules";

const tones: Record<WorkflowStageStatus, { background: string; foreground: string; icon: keyof typeof MaterialIcons.glyphMap }> = {
  waiting: { background: "#E9EEF4", foreground: "#536576", icon: "schedule" },
  active: { background: "#FFF3D7", foreground: "#976C18", icon: "edit-note" },
  signed: { background: "#DFF3E8", foreground: "#1C7C54", icon: "verified" },
  skipped: { background: "#EFF2F5", foreground: "#64748B", icon: "remove-circle-outline" },
};

export function StageStatusPill({ status }: { status: WorkflowStageStatus }) {
  const tone = tones[status];
  return (
    <View style={[styles.pill, { backgroundColor: tone.background }]}>
      <MaterialIcons name={tone.icon} size={14} color={tone.foreground} />
      <Text style={[styles.pillText, { color: tone.foreground }]}>{stageStatusLabel(status)}</Text>
    </View>
  );
}

export function PrimaryButton({ label, onPress, disabled, loading, icon = "arrow-forward" }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean; icon?: keyof typeof MaterialIcons.glyphMap }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.disabledButton, pressed && styles.pressedButton]}
    >
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <>
        <Text style={styles.primaryButtonText}>{label}</Text>
        <MaterialIcons name={icon} size={20} color="#FFFFFF" />
      </>}
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, icon = "notifications-none", disabled }: { label: string; onPress: () => void; icon?: keyof typeof MaterialIcons.glyphMap; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.outlineButton, disabled && styles.disabledOutline, pressed && styles.pressedOutline]}
    >
      <MaterialIcons name={icon} size={19} color="#103A5B" />
      <Text style={styles.outlineButtonText}>{label}</Text>
    </Pressable>
  );
}

export function CertificationNotice() {
  return (
    <View style={styles.certificationNotice}>
      <MaterialIcons name="shield" size={20} color="#8A661D" />
      <View style={styles.noticeTextWrap}>
        <Text style={styles.noticeTitle}>Evidência eletrônica registrada</Text>
        <Text style={styles.noticeText}>A certificação qualificada exige a conclusão do credenciamento institucional.</Text>
      </View>
    </View>
  );
}

/**
 * Tells the signer whether what they see is the shared document or a local
 * copy. Without this the fallback mode is invisible and someone could sign a
 * planilha the other participants never receive.
 */
export function SourceNotice({ source }: { source: "server" | "local" }) {
  if (source === "server") {
    return (
      <View style={styles.sharedNotice}>
        <MaterialIcons name="cloud-done" size={20} color="#1C7C54" />
        <View style={styles.noticeTextWrap}>
          <Text style={styles.sharedNoticeTitle}>Documento compartilhado</Text>
          <Text style={styles.sharedNoticeText}>Todos os signatários deste processo veem esta mesma versão, na ordem definida.</Text>
        </View>
      </View>
    );
  }
  return (
    <View style={styles.localNotice}>
      <MaterialIcons name="cloud-off" size={20} color="#9A3412" />
      <View style={styles.noticeTextWrap}>
        <Text style={styles.localNoticeTitle}>Modo local — não compartilhado</Text>
        <Text style={styles.localNoticeText}>Entre com sua conta para trabalhar na versão compartilhada. As alterações feitas agora ficam apenas neste navegador.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignItems: "center", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 9, paddingVertical: 5 },
  pillText: { fontSize: 12, fontWeight: "700" },
  primaryButton: { alignItems: "center", backgroundColor: "#103A5B", borderRadius: 14, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 52, paddingHorizontal: 18 },
  primaryButtonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  disabledButton: { backgroundColor: "#8FA0AF" },
  pressedButton: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  outlineButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#B7C5D1", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 50, paddingHorizontal: 16 },
  outlineButtonText: { color: "#103A5B", fontSize: 15, fontWeight: "700" },
  disabledOutline: { opacity: 0.45 },
  pressedOutline: { opacity: 0.7 },
  certificationNotice: { alignItems: "flex-start", backgroundColor: "#FFF8E7", borderColor: "#E7C770", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  noticeTextWrap: { flex: 1, gap: 2 },
  noticeTitle: { color: "#6C5018", fontSize: 14, fontWeight: "800" },
  noticeText: { color: "#705D36", fontSize: 13, lineHeight: 18 },
  sharedNotice: { alignItems: "flex-start", backgroundColor: "#EAF6EF", borderColor: "#A8D5BC", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  sharedNoticeTitle: { color: "#1C6B48", fontSize: 14, fontWeight: "800" },
  sharedNoticeText: { color: "#356B52", fontSize: 13, lineHeight: 18 },
  localNotice: { alignItems: "flex-start", backgroundColor: "#FEF2E7", borderColor: "#F0B78B", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  localNoticeTitle: { color: "#9A3412", fontSize: 14, fontWeight: "800" },
  localNoticeText: { color: "#8A4B22", fontSize: 13, lineHeight: 18 },
});
