import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useRouter } from "expo-router";
import { type PropsWithChildren, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useLocalAuth } from "@/hooks/use-local-auth";

type DesktopSection = "inicio" | "processos" | "avisos";

const navigation: { id: DesktopSection; label: string; icon: keyof typeof MaterialIcons.glyphMap; route: string }[] = [
  { id: "inicio", label: "Visão geral", icon: "space-dashboard", route: "/" },
  { id: "processos", label: "Processos", icon: "folder-open", route: "/processos" },
  { id: "avisos", label: "Pendências", icon: "notifications", route: "/avisos" },
];

export function DesktopShell({ active, title, subtitle, action, children }: PropsWithChildren<{ active: DesktopSection; title: string; subtitle: string; action?: ReactNode }>) {
  const router = useRouter();
  const { account } = useLocalAuth();
  const initials = account?.name?.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase() ?? "??";
  return <View style={styles.page}>
    <View style={styles.sidebar}>
      <View style={styles.brand}><View style={styles.brandMark}><MaterialIcons name="verified" size={20} color="#FFFFFF" /></View><View><Text style={styles.brandName}>ASSINAFLUXO</Text><Text style={styles.brandCaption}>Tramitação LMP</Text></View></View>
      <View style={styles.navigation}>{navigation.map((item) => <Pressable key={item.id} onPress={() => router.replace(item.route as any)} style={({ pressed }) => [styles.navItem, active === item.id && styles.navItemActive, pressed && styles.pressed]}><MaterialIcons name={item.icon} size={21} color={active === item.id ? "#FFFFFF" : "#8FA9BF"} /><Text style={[styles.navLabel, active === item.id && styles.navLabelActive]}>{item.label}</Text></Pressable>)}</View>
      <View style={styles.sidebarBottom}><View style={styles.securityCard}><MaterialIcons name="shield" size={20} color="#D6B35D" /><View style={styles.securityBody}><Text style={styles.securityTitle}>Trilha protegida</Text><Text style={styles.securityText}>Evidências registradas em cada etapa.</Text></View></View>{account ? <View style={styles.userRow}><View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View><View style={styles.userCopy}><Text numberOfLines={1} style={styles.userName}>{account.name}</Text><Text style={styles.userRole}>{account.role === "coordinator" ? "Coordenação" : account.role === "signer" ? "Signatário" : "Consulta"}</Text></View></View> : <View style={styles.authPrompt}><Text style={styles.authPromptTitle}>Acesso institucional</Text><Text style={styles.authPromptText}>Entre para assinar sua etapa.</Text><View style={styles.authPromptActions}><Pressable onPress={() => router.push("/login" as any)}><Text style={styles.authPromptLink}>Entrar</Text></Pressable><Pressable onPress={() => router.push("/cadastro" as any)}><Text style={styles.authPromptLink}>Cadastrar</Text></Pressable></View></View>}</View>
    </View>
    <View style={styles.main}><View style={styles.topbar}><View><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageSubtitle}>{subtitle}</Text></View>{action}</View><View style={styles.content}>{children}</View></View>
  </View>;
}

export function isDesktopLayout(width: number) {
  return width >= 960;
}

const styles = StyleSheet.create({
  page: { backgroundColor: "#F5F7FA", flex: 1, flexDirection: "row", minHeight: "100%" },
  sidebar: { backgroundColor: "#0B2F4C", justifyContent: "space-between", padding: 24, width: 264 },
  brand: { alignItems: "center", flexDirection: "row", gap: 10 },
  brandMark: { alignItems: "center", backgroundColor: "#B48A2C", borderRadius: 12, height: 38, justifyContent: "center", width: 38 },
  brandName: { color: "#FFFFFF", fontSize: 14, fontWeight: "900", letterSpacing: 1.1 },
  brandCaption: { color: "#9CB4C8", fontSize: 11, marginTop: 2 },
  navigation: { gap: 6, marginTop: 44 },
  navItem: { alignItems: "center", borderRadius: 12, flexDirection: "row", gap: 12, minHeight: 47, paddingHorizontal: 13 },
  navItemActive: { backgroundColor: "#18517A" },
  navLabel: { color: "#B7CAD9", fontSize: 15, fontWeight: "700" },
  navLabelActive: { color: "#FFFFFF" },
  pressed: { opacity: 0.72 },
  sidebarBottom: { gap: 18 },
  securityCard: { alignItems: "flex-start", backgroundColor: "#123B5D", borderColor: "#285A81", borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 10, padding: 12 },
  securityBody: { flex: 1, gap: 3 },
  securityTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  securityText: { color: "#AFC2D3", fontSize: 11, lineHeight: 15 },
  userRow: { alignItems: "center", borderTopColor: "#285A81", borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 17 },
  userCopy: { flex: 1, minWidth: 0 },
  authPrompt: { borderTopColor: "#285A81", borderTopWidth: 1, paddingTop: 17 },
  authPromptTitle: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  authPromptText: { color: "#9CB4C8", fontSize: 11, marginTop: 3 },
  authPromptActions: { flexDirection: "row", gap: 18, marginTop: 11 },
  authPromptLink: { color: "#D6B35D", fontSize: 12, fontWeight: "800" },
  avatar: { alignItems: "center", backgroundColor: "#DCEAF4", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  avatarText: { color: "#103A5B", fontSize: 12, fontWeight: "900" },
  userName: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  userRole: { color: "#9CB4C8", fontSize: 11, marginTop: 2 },
  main: { flex: 1, minWidth: 0 },
  topbar: { alignItems: "center", backgroundColor: "#FFFFFF", borderBottomColor: "#D9E1E8", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 88, paddingHorizontal: 38 },
  pageTitle: { color: "#17212B", fontSize: 23, fontWeight: "800" },
  pageSubtitle: { color: "#607385", fontSize: 13, marginTop: 4 },
  content: { flex: 1, padding: 30 },
});
