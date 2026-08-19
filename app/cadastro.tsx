import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { DesktopShell, isDesktopLayout } from "@/components/desktop-shell";
import { OutlineButton, PrimaryButton } from "@/components/workflow-ui";
import { ScreenContainer } from "@/components/screen-container";
import { useLocalAuth } from "@/hooks/use-local-auth";

export default function RegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ convite?: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && isDesktopLayout(width);
  const { register } = useLocalAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [registrationId, setRegistrationId] = useState("");
  const [registrationCode, setRegistrationCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  const submit = async () => {
    if (password !== confirmation) {
      Alert.alert("Senhas diferentes", "Confirme a mesma senha particular nos dois campos.");
      return;
    }
    try {
      await register.mutateAsync({ name, email, registrationId, registrationCode, password, inviteToken: typeof params.convite === "string" ? params.convite : undefined });
      Alert.alert("Cadastro concluído", "Sua conta foi criada. A etapa correspondente estará disponível quando chegar a sua vez.", [{ text: "Acessar", onPress: () => router.replace("/" as any) }]);
    } catch (error) {
      Alert.alert("Não foi possível concluir", error instanceof Error ? error.message : "Revise os dados e tente novamente.");
    }
  };

  const form = <View style={styles.formCard}>
    <View style={styles.formIntro}><Text style={styles.kicker}>CADASTRO INSTITUCIONAL</Text><Text style={styles.title}>Crie seu acesso ao AssinaFluxo</Text><Text style={styles.subtitle}>Use o código recebido pela instituição e defina uma senha particular para acessar e assinar apenas as etapas atribuídas à sua função.</Text></View>
    <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Nome completo" placeholderTextColor="#8293A5" autoCapitalize="words" />
    <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="E-mail institucional" placeholderTextColor="#8293A5" keyboardType="email-address" autoCapitalize="none" />
    <TextInput style={styles.input} value={registrationId} onChangeText={setRegistrationId} placeholder="Matrícula ou identificação funcional" placeholderTextColor="#8293A5" autoCapitalize="characters" />
    <TextInput style={styles.input} value={registrationCode} onChangeText={setRegistrationCode} placeholder="Código padrão de cadastro" placeholderTextColor="#8293A5" secureTextEntry />
    <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Senha particular" placeholderTextColor="#8293A5" secureTextEntry />
    <Text style={styles.helper}>A senha deve ter pelo menos 10 caracteres, incluindo maiúscula, minúscula e número.</Text>
    <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder="Confirme sua senha" placeholderTextColor="#8293A5" secureTextEntry />
    <PrimaryButton label={register.isPending ? "Criando acesso..." : "Criar meu acesso"} onPress={submit} disabled={register.isPending} />
    <OutlineButton label="Já tenho acesso" onPress={() => router.replace("/login" as any)} />
  </View>;

  if (isDesktop) return <DesktopShell active="inicio" title="Novo acesso" subtitle="Cadastro individual por link e função" action={<View style={styles.desktopAction}><OutlineButton label="Voltar ao início" onPress={() => router.replace("/" as any)} /></View>}><View style={styles.desktopCenter}>{form}</View></DesktopShell>;
  return <ScreenContainer className="px-5"><ScrollView contentContainerStyle={styles.mobileContent}>{form}</ScrollView></ScreenContainer>;
}

const styles = StyleSheet.create({
  desktopAction: { minWidth: 150 },
  desktopCenter: { alignItems: "center", paddingBottom: 48 },
  mobileContent: { paddingVertical: 24 },
  formCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E1E8", borderRadius: 18, borderWidth: 1, gap: 12, maxWidth: 560, padding: 28, width: "100%" },
  formIntro: { gap: 7, marginBottom: 4 },
  kicker: { color: "#B7791F", fontSize: 11, fontWeight: "800", letterSpacing: 1.1 },
  title: { color: "#103A5B", fontSize: 27, fontWeight: "800", lineHeight: 34 },
  subtitle: { color: "#607385", fontSize: 14, lineHeight: 21 },
  input: { backgroundColor: "#F7F9FB", borderColor: "#D9E1E8", borderRadius: 10, borderWidth: 1, color: "#1E2D3D", fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  helper: { color: "#607385", fontSize: 12, lineHeight: 17, marginTop: -4 },
});
