import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Platform, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { DesktopShell, isDesktopLayout } from "@/components/desktop-shell";
import { OutlineButton, PrimaryButton } from "@/components/workflow-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLocalAuth } from "@/hooks/use-local-auth";

export default function LoginScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && isDesktopLayout(width);
  const { login } = useLocalAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async () => {
    try {
      await login.mutateAsync({ email, password });
      router.replace("/" as any);
    } catch (error) {
      Alert.alert("Não foi possível entrar", error instanceof Error ? error.message : "Revise seu e-mail e senha.");
    }
  };

  const form = <View style={styles.formCard}>
    <View style={styles.formIntro}><Text style={styles.kicker}>ACESSO SEGURO</Text><Text style={styles.title}>Entrar no AssinaFluxo</Text><Text style={styles.subtitle}>Use a senha particular criada no cadastro. O acesso liberará somente os processos e campos associados à sua função.</Text></View>
    <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-mail institucional" placeholderTextColor="#8293A5" keyboardType="email-address" autoCapitalize="none" />
    <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Senha particular" placeholderTextColor="#8293A5" secureTextEntry />
    <PrimaryButton label={login.isPending ? "Entrando..." : "Entrar"} onPress={submit} disabled={login.isPending} />
    <OutlineButton label="Cadastrar por link" onPress={() => router.replace("/cadastro" as any)} />
  </View>;

  if (isDesktop) return <DesktopShell active="inicio" title="Acesso institucional" subtitle="Entre para consultar e assinar seus processos" action={<View style={styles.desktopAction}><OutlineButton label="Voltar ao início" onPress={() => router.replace("/" as any)} /></View>}><View style={styles.desktopCenter}>{form}</View></DesktopShell>;
  return <ScreenContainer className="px-5"><View style={styles.mobileCenter}>{form}</View></ScreenContainer>;
}

const styles = StyleSheet.create({
  desktopAction: { minWidth: 150 },
  desktopCenter: { alignItems: "center", paddingBottom: 48 },
  mobileCenter: { flex: 1, justifyContent: "center" },
  formCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E1E8", borderRadius: 18, borderWidth: 1, gap: 12, maxWidth: 520, padding: 28, width: "100%" },
  formIntro: { gap: 7, marginBottom: 4 },
  kicker: { color: "#B7791F", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: "#103A5B", fontSize: 27, fontWeight: "800", lineHeight: 34 },
  subtitle: { color: "#607385", fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: "#F7F9FB", borderColor: "#D9E1E8", borderRadius: 10, borderWidth: 1, color: "#1E2D3D", fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
});
