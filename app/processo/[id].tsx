import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { DesktopShell, isDesktopLayout } from "@/components/desktop-shell";
import { desktopProcessStyles } from "@/components/desktop-process-styles";
import { ScreenContainer } from "@/components/screen-container";
import { CertificationNotice, OutlineButton, PrimaryButton, SourceNotice, StageStatusPill } from "@/components/workflow-ui";
import { type WorkflowStage } from "@/lib/workflow-rules";
import { type AuditEvent, type WorkflowDocument, useWorkflow } from "@/lib/workflow-store";
import { downloadWorkflowPdf } from "@/lib/pdf-export";
import { trpc } from "@/lib/trpc";

function formatDate(iso?: string) {
  if (!iso) return "";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

function EventIcon({ type }: { type: AuditEvent["type"] }) {
  const icon: Record<AuditEvent["type"], keyof typeof MaterialIcons.glyphMap> = { created: "add-circle-outline", saved: "save", signed: "verified", forwarded: "arrow-forward", reminder: "notifications-active", skipped: "remove-circle-outline" };
  const color: Record<AuditEvent["type"], string> = { created: "#103A5B", saved: "#607385", signed: "#1C7C54", forwarded: "#B7791F", reminder: "#B7791F", skipped: "#607385" };
  return <View style={[styles.eventIcon, { backgroundColor: `${color[type]}16` }]}><MaterialIcons name={icon[type]} size={17} color={color[type]} /></View>;
}

export default function WorkflowDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && isDesktopLayout(width);
  const { getDocument, isReady, source } = useWorkflow();
  const document = getDocument(id);
  const [selectedStageId, setSelectedStageId] = useState<string | null>(null);

  useEffect(() => {
    if (document && !selectedStageId) setSelectedStageId(document.stages.find((stage) => stage.status === "active")?.id ?? document.stages[0]?.id ?? null);
  }, [document, selectedStageId]);

  if (!isReady) return <ScreenContainer className="items-center justify-center"><ActivityIndicator size="large" color="#103A5B" /></ScreenContainer>;
  if (!document) return <ScreenContainer className="items-center justify-center px-5"><MaterialIcons name="find-in-page" size={38} color="#607385" /><Text style={styles.notFoundTitle}>Processo não encontrado</Text><Text style={styles.notFoundText}>Volte à lista de processos e selecione uma LMP disponível.</Text><View style={styles.notFoundButton}><PrimaryButton label="Ver processos" onPress={() => router.replace("/processos" as any)} /></View></ScreenContainer>;

  const selectedStage = document.stages.find((stage) => stage.id === selectedStageId) ?? document.stages[0];
  const completed = document.stages.filter((stage) => stage.status === "signed" || stage.status === "skipped").length;
  const progress = Math.round((completed / document.stages.length) * 100);

  if (isDesktop) return <DesktopProcessDocument document={document} selectedStageId={selectedStage.id} onSelectStage={setSelectedStageId} completed={completed} progress={progress} source={source} />;

  return <ScreenContainer className="px-5"><FlatList
    data={[...document.events].reverse()}
    keyExtractor={(item) => item.id}
    contentContainerStyle={styles.content}
    ListHeaderComponent={<View style={styles.headerWrap}>
      <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}><MaterialIcons name="arrow-back" size={21} color="#103A5B" /><Text style={styles.backText}>Processos</Text></Pressable>
      <View style={styles.hero}><View style={styles.heroIcon}><MaterialIcons name="description" size={25} color="#103A5B" /></View><View style={styles.heroBody}><Text style={styles.eyebrow}>{document.source} · {document.protocol}</Text><Text style={styles.title}>{document.candidateRank} {document.candidateName}</Text><Text style={styles.subtitle}>{document.opm} · Láurea do Mérito Pessoal — {document.grade}</Text></View></View>
      <View style={styles.progressCard}><View style={styles.progressHeader}><View><Text style={styles.progressTitle}>Tramitação em curso</Text><Text style={styles.progressText}>{completed} de {document.stages.length} etapas concluídas</Text></View><Text style={styles.progressPercent}>{progress}%</Text></View><View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress}%` }]} /></View></View>
      <PdfExportAction workflow={document} />
      <SourceNotice source={source} />
      <CertificationNotice />
      <Text style={styles.sectionTitle}>Sequência de assinaturas</Text>
      <FlatList
        horizontal
        data={document.stages}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stageList}
        renderItem={({ item }) => <Pressable onPress={() => setSelectedStageId(item.id)} style={({ pressed }) => [styles.stageCard, selectedStage.id === item.id && styles.stageCardSelected, pressed && styles.pressed]}><View style={styles.stageNumber}><Text style={styles.stageNumberText}>{item.order}</Text></View><Text numberOfLines={2} style={styles.stageTitle}>{item.title}</Text><StageStatusPill status={item.status} /></Pressable>}
      />
      <StagePanel documentId={document.id} stage={selectedStage} />
      <Text style={styles.sectionTitle}>Linha do tempo</Text>
    </View>}
    renderItem={({ item }) => <View style={styles.event}><EventIcon type={item.type} /><View style={styles.eventBody}><Text style={styles.eventDescription}>{item.description}</Text><Text style={styles.eventMeta}>{item.actor} · {formatDate(item.at)}</Text>{item.hash ? <Text numberOfLines={1} style={styles.hash}>Hash SHA-256: {item.hash}</Text> : null}</View></View>}
    ListFooterComponent={<View style={styles.timelineFooter}><Text style={styles.timelineFooterText}>Os eventos acima são preservados no processo e mostram cada transição de etapa.</Text></View>}
  /></ScreenContainer>;
}

function DesktopProcessDocument({ document, selectedStageId, onSelectStage, completed, progress, source }: { document: WorkflowDocument; selectedStageId: string; onSelectStage: (stageId: string) => void; completed: number; progress: number; source: "server" | "local" }) {
  const router = useRouter();
  const selectedStage = document.stages.find((stage) => stage.id === selectedStageId) ?? document.stages[0];
  const createInvite = trpc.localAuth.createInvite.useMutation();
  const createInviteLink = async () => {
    try {
      const result = await createInvite.mutateAsync({ processId: document.id, stageId: selectedStage.id, functionKey: selectedStage.role, signatureOrder: selectedStage.order, expiresInHours: 72 });
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const link = `${base}/cadastro?convite=${result.token}`;
      if (typeof navigator !== "undefined" && navigator.clipboard) await navigator.clipboard.writeText(link);
      Alert.alert("Link de cadastro criado", `${link}${typeof navigator !== "undefined" && navigator.clipboard ? "\n\nO link foi copiado para a área de transferência." : ""}`);
    } catch (error) {
      Alert.alert("Não foi possível criar o link", error instanceof Error ? error.message : "Entre com uma conta de coordenação e tente novamente.");
    }
  };
  return <DesktopShell active="processos" title={`Processo ${document.protocol}`} subtitle={`${document.candidateRank} ${document.candidateName} · ${document.opm} · LMP ${document.grade}`} action={<View style={styles.desktopHeaderActions}><PdfExportAction workflow={document} /><OutlineButton label={createInvite.isPending ? "Criando link..." : "Link da etapa"} icon="link" onPress={createInviteLink} disabled={createInvite.isPending} /><OutlineButton label="Voltar aos processos" icon="arrow-back" onPress={() => router.replace("/processos" as any)} /></View>}>
    <View style={styles.desktopDetailLayout}>
      <View style={styles.desktopMainColumn}>
        <View style={styles.desktopDocumentCard}><View style={styles.desktopDocumentTop}><View style={styles.desktopDocumentIdentity}><View style={styles.desktopDocumentIcon}><MaterialIcons name="description" size={25} color="#103A5B" /></View><View><Text style={styles.desktopDocumentLabel}>FORMULÁRIO DIGITAL</Text><Text style={styles.desktopDocumentTitle}>Láurea do Mérito Pessoal</Text><Text style={styles.desktopDocumentMeta}>{document.source} · {document.protocol}</Text></View></View><StageStatusPill status={selectedStage.status} /></View><View style={styles.desktopProgressRow}><View style={styles.desktopProgressText}><Text style={styles.desktopProgressTitle}>Andamento do processo</Text><Text style={styles.desktopProgressSubtitle}>{completed} de {document.stages.length} blocos concluídos</Text></View><Text style={styles.desktopProgressValue}>{progress}%</Text></View><View style={styles.desktopProgressTrack}><View style={[styles.desktopProgressFill, { width: `${progress}%` }]} /></View></View>
        <View style={styles.desktopSequenceSection}><View style={styles.desktopSequenceHead}><View><Text style={styles.desktopSectionHeading}>Sequência de assinaturas</Text><Text style={styles.desktopSectionCopy}>Selecione uma etapa para consultar dados e tomar a ação disponível.</Text></View><Text style={styles.desktopSequenceLegend}>Campos assinados permanecem bloqueados</Text></View><FlatList horizontal data={document.stages} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.desktopStageList} renderItem={({ item }) => <Pressable onPress={() => onSelectStage(item.id)} style={({ pressed }) => [styles.desktopStageCard, selectedStage.id === item.id && styles.desktopStageCardSelected, pressed && styles.pressed]}><View style={styles.desktopStageCardHeader}><View style={styles.desktopStageNumber}><Text style={styles.desktopStageNumberText}>{item.order}</Text></View><StageStatusPill status={item.status} /></View><Text numberOfLines={2} style={styles.desktopStageCardTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.desktopStageCardSigner}>{item.signerName}</Text></Pressable>} /></View>
        <StagePanel documentId={document.id} stage={selectedStage} />
      </View>
      <View style={styles.desktopSideColumn}>
        <SourceNotice source={source} />
        <CertificationNotice />
        <View style={styles.desktopSidebarCard}><View style={styles.desktopSideTitleRow}><View><Text style={styles.desktopSideTitle}>Participantes</Text><Text style={styles.desktopSideSubtitle}>Ordem prevista no processo</Text></View><MaterialIcons name="group" size={21} color="#607385" /></View><FlatList data={document.stages} keyExtractor={(item) => item.id} scrollEnabled={false} renderItem={({ item }) => <Pressable onPress={() => onSelectStage(item.id)} style={({ pressed }) => [styles.desktopParticipant, pressed && styles.pressed]}><View style={[styles.desktopParticipantIndex, item.status === "signed" && styles.desktopParticipantIndexDone]}><Text style={[styles.desktopParticipantIndexText, item.status === "signed" && styles.desktopParticipantIndexTextDone]}>{item.order}</Text></View><View style={styles.desktopParticipantInfo}><Text style={styles.desktopParticipantRole}>{item.title}</Text><Text style={styles.desktopParticipantName}>{item.signerName}</Text></View><MaterialIcons name={item.status === "signed" ? "lock" : item.status === "active" ? "edit" : "schedule"} size={17} color={item.status === "signed" ? "#1C7C54" : item.status === "active" ? "#B7791F" : "#718397"} /></Pressable>} /></View>
        <View style={styles.desktopSidebarCard}><View style={styles.desktopSideTitleRow}><View><Text style={styles.desktopSideTitle}>Auditoria recente</Text><Text style={styles.desktopSideSubtitle}>Eventos preservados no processo</Text></View><MaterialIcons name="history" size={21} color="#607385" /></View><FlatList data={[...document.events].reverse().slice(0, 5)} keyExtractor={(item) => item.id} scrollEnabled={false} renderItem={({ item }) => <View style={styles.desktopTimelineItem}><EventIcon type={item.type} /><View style={styles.desktopTimelineCopy}><Text numberOfLines={2} style={styles.desktopTimelineDescription}>{item.description}</Text><Text style={styles.desktopTimelineMeta}>{item.actor} · {formatDate(item.at)}</Text></View></View>} /><Pressable onPress={() => onSelectStage(selectedStage.id)}><Text style={styles.desktopAuditLink}>Consultar linha do tempo completa na etapa selecionada</Text></Pressable></View>
      </View>
    </View>
  </DesktopShell>;
}

function PdfExportAction({ workflow }: { workflow: WorkflowDocument }) {
  const [generating, setGenerating] = useState(false);
  const generate = async () => {
    setGenerating(true);
    try {
      await downloadWorkflowPdf(workflow);
    } catch (error) {
      Alert.alert("Não foi possível gerar o PDF", error instanceof Error ? error.message : "Tente novamente em instantes.");
    } finally {
      setGenerating(false);
    }
  };
  return <OutlineButton label={generating ? "Gerando PDF..." : "Gerar PDF"} icon="picture-as-pdf" onPress={generate} disabled={generating} />;
}

function StagePanel({ documentId, stage }: { documentId: string; stage: WorkflowStage }) {
  const { updateStage, signActiveStage, skipActiveStage, sendReminder } = useWorkflow();
  const authorization = trpc.localAuth.authorization.useQuery({ processId: documentId, stageId: stage.id }, { retry: false, staleTime: 15_000 });
  const [fields, setFields] = useState<Record<string, string | boolean>>(stage.fields);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setFields(stage.fields); }, [stage.id, stage.fields]);

  const set = (key: string, value: string | boolean) => setFields((current) => ({ ...current, [key]: value }));
  const required = [...(stage.id === "indicacao" ? ["sintese"] : stage.id === "pessoal" ? ["tempoServico", "avaliacao"] : stage.id === "disciplinar" ? ["comportamento", "processo"] : ["decisao"]), "consentimento"];
  const ready = required.every((key) => typeof fields[key] === "boolean" || (typeof fields[key] === "string" && fields[key].trim().length > 0));
  const locked = stage.status === "signed" || stage.status === "skipped";
  const canEdit = Boolean(authorization.data) && !locked;

  const save = async () => { if (!canEdit) { Alert.alert("Acesso necessário", "Entre com sua conta particular para editar esta etapa."); return; } setBusy(true); try { await updateStage(documentId, stage.id, fields); Alert.alert("Rascunho salvo", "O conteúdo permanece editável enquanto a etapa estiver pendente."); } catch (error) { Alert.alert("Não foi possível salvar", error instanceof Error ? error.message : "Tente novamente."); } finally { setBusy(false); } };
  // Authorisation, stage order, consent and document version are all re-checked
  // inside the server transaction; this only keeps the UI honest beforehand.
  const sign = async () => { if (!canEdit) { Alert.alert("Assinatura não autorizada", "Sua conta não está vinculada ao campo desta etapa."); return; } if (!ready) { Alert.alert("Preencha os campos obrigatórios", "Revise as informações deste bloco antes de registrar a assinatura."); return; } setBusy(true); try { await signActiveStage(documentId, stage.id, fields); Alert.alert("Etapa registrada", "O bloco foi bloqueado, a evidência de integridade foi registrada e a próxima etapa foi liberada."); } catch (error) { Alert.alert("Não foi possível assinar", error instanceof Error ? error.message : "Tente novamente."); } finally { setBusy(false); } };

  return <View style={styles.panel}>
    <View style={styles.panelHeader}><View><Text style={styles.panelKicker}>ETAPA {stage.order}</Text><Text style={styles.panelTitle}>{stage.title}</Text><Text style={styles.panelRole}>{stage.signerName} · {stage.role}</Text></View><StageStatusPill status={stage.status} /></View>
    {locked ? <LockedStage stage={stage} /> : stage.status === "waiting" ? <WaitingStage stage={stage} onReminder={async () => { await sendReminder(documentId); Alert.alert("Aviso registrado", "O reenvio foi incluído na linha do tempo do processo."); }} /> : <>
      <Text style={styles.panelInstruction}>Preencha os campos abaixo. A confirmação de assinatura congelará este bloco e preservará o registro na linha do tempo.</Text>
      <StageFields stage={stage} fields={fields} set={set} disabled={!canEdit} />
      <View style={styles.consentBox}><BooleanField label="Li os dados desta etapa e confirmo a minha manifestação de vontade." value={Boolean(fields.consentimento)} onChange={() => set("consentimento", !fields.consentimento)} disabled={!canEdit} /></View>
      <View style={styles.panelActions}><OutlineButton label="Salvar rascunho" icon="save" onPress={save} disabled={busy || !canEdit} /><PrimaryButton label={canEdit ? "Confirmar assinatura" : "Entrar para assinar"} icon="verified" onPress={sign} loading={busy} disabled={busy || !canEdit} /></View>
      {stage.optional ? <Pressable disabled={!canEdit} onPress={async () => { await skipActiveStage(documentId, stage.id); Alert.alert("Etapa marcada", "A etapa opcional foi registrada como não aplicável e a próxima foi liberada."); }}><Text style={[styles.skipText, !canEdit && { opacity: 0.45 }]}>Marcar esta etapa como não aplicável</Text></Pressable> : null}
    </>}
  </View>;
}

function LockedStage({ stage }: { stage: WorkflowStage }) { return <View style={styles.lockedWrap}><View style={styles.lockedMessage}><MaterialIcons name={stage.status === "signed" ? "lock" : "remove-circle-outline"} size={20} color={stage.status === "signed" ? "#1C7C54" : "#607385"} /><Text style={styles.lockedText}>{stage.status === "signed" ? `Assinada em ${formatDate(stage.signedAt)}. Os campos estão bloqueados.` : "Etapa opcional registrada como não aplicável."}</Text></View>{Object.entries(stage.fields).map(([key, value]) => <View key={key} style={styles.readField}><Text style={styles.readLabel}>{fieldLabel(key)}</Text><Text style={styles.readValue}>{String(value === true ? "Sim" : value === false ? "Não" : value)}</Text></View>)}{stage.integrityHash ? <Text numberOfLines={2} style={styles.integrity}>Integridade: {stage.integrityHash}</Text> : null}</View>; }

function WaitingStage({ stage, onReminder }: { stage: WorkflowStage; onReminder: () => void }) { return <View style={styles.waitingWrap}><MaterialIcons name="schedule" size={27} color="#607385" /><Text style={styles.waitingTitle}>Aguardando etapa anterior</Text><Text style={styles.waitingText}>Este bloco será liberado automaticamente após a assinatura da etapa anterior. Enquanto isso, os dados já consolidados continuam visíveis no processo.</Text><View style={styles.waitingButton}><OutlineButton label="Registrar lembrete" icon="notifications-none" onPress={onReminder} /></View></View>; }

function StageFields({ stage, fields, set, disabled }: { stage: WorkflowStage; fields: Record<string, string | boolean>; set: (key: string, value: string | boolean) => void; disabled: boolean }) {
  const generic = <><FormField disabled={disabled} label="Decisão ou parecer" value={String(fields.decisao ?? "")} onChangeText={(value) => set("decisao", value)} placeholder="Informe o resultado desta etapa" /><FormField disabled={disabled} label="Observações" value={String(fields.observacoes ?? "")} onChangeText={(value) => set("observacoes", value)} placeholder="Registre justificativas, se necessário" multiline /></>;
  if (stage.id === "indicacao") return <><FormField disabled={disabled} label="Síntese histórica" value={String(fields.sintese ?? "")} onChangeText={(value) => set("sintese", value)} placeholder="Descreva o mérito e a justificativa da indicação" multiline /><FormField disabled={disabled} label="Justificativa de extemporaneidade" value={String(fields.extemporaneidade ?? "")} onChangeText={(value) => set("extemporaneidade", value)} placeholder="Preencher apenas quando aplicável" multiline /></>;
  if (stage.id === "pessoal") return <><FormField disabled={disabled} label="Tempo de serviço" value={String(fields.tempoServico ?? "")} onChangeText={(value) => set("tempoServico", value)} placeholder="Ex.: 14 anos e 8 meses" /><FormField disabled={disabled} label="Grau da LMP anterior" value={String(fields.grauAnterior ?? "")} onChangeText={(value) => set("grauAnterior", value)} placeholder="Ex.: 4º grau" /><FormField disabled={disabled} label="Resultado da avaliação" value={String(fields.avaliacao ?? "")} onChangeText={(value) => set("avaliacao", value)} placeholder="Ex.: Superior" /><BooleanField disabled={disabled} label="Preenche os requisitos" value={Boolean(fields.requisitos)} onChange={() => set("requisitos", !fields.requisitos)} /></>;
  if (stage.id === "disciplinar") return <><FormField disabled={disabled} label="Comportamento" value={String(fields.comportamento ?? "")} onChangeText={(value) => set("comportamento", value)} placeholder="Ex.: Excelente" /><FormField disabled={disabled} label="Processo ou procedimento disciplinar" value={String(fields.processo ?? "")} onChangeText={(value) => set("processo", value)} placeholder="Ex.: Não" /><FormField disabled={disabled} label="Cassação de LMP anterior" value={String(fields.cassacao ?? "")} onChangeText={(value) => set("cassacao", value)} placeholder="Ex.: Não" /><BooleanField disabled={disabled} label="Preenche os requisitos" value={Boolean(fields.requisitos)} onChange={() => set("requisitos", !fields.requisitos)} /></>;
  return generic;
}

function FormField({ label, value, onChangeText, placeholder, multiline, disabled }: { label: string; value: string; onChangeText: (value: string) => void; placeholder: string; multiline?: boolean; disabled?: boolean }) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput editable={!disabled} accessibilityLabel={label} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#94A3B8" multiline={multiline} returnKeyType="done" style={[styles.input, multiline && styles.textarea, disabled && styles.inputDisabled]} /></View>; }

function BooleanField({ label, value, onChange, disabled }: { label: string; value: boolean; onChange: () => void; disabled?: boolean }) { return <Pressable disabled={disabled} onPress={onChange} style={({ pressed }) => [styles.booleanField, pressed && styles.pressed, disabled && styles.inputDisabled]}><View style={[styles.checkbox, value && styles.checkboxActive]}>{value ? <MaterialIcons name="check" color="#FFFFFF" size={16} /> : null}</View><Text style={styles.booleanLabel}>{label}</Text></Pressable>; }

function fieldLabel(key: string) { return ({ sintese: "Síntese histórica", extemporaneidade: "Extemporaneidade", tempoServico: "Tempo de serviço", grauAnterior: "Grau anterior", avaliacao: "Avaliação", requisitos: "Preenche os requisitos", comportamento: "Comportamento", processo: "Processo disciplinar", cassacao: "Cassação anterior", decisao: "Decisão", observacoes: "Observações", consentimento: "Manifestação de vontade" } as Record<string, string>)[key] ?? key; }

const styles: any = Object.assign(StyleSheet.create({
  content: { gap: 14, paddingBottom: 28, paddingTop: 10 }, headerWrap: { gap: 16 }, backButton: { alignItems: "center", flexDirection: "row", gap: 6, alignSelf: "flex-start" }, backText: { color: "#103A5B", fontSize: 14, fontWeight: "800" }, hero: { alignItems: "flex-start", flexDirection: "row", gap: 12 }, heroIcon: { alignItems: "center", backgroundColor: "#EAF0F5", borderRadius: 16, height: 47, justifyContent: "center", width: 47 }, heroBody: { flex: 1, gap: 3 }, eyebrow: { color: "#B48A2C", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, title: { color: "#17212B", fontSize: 23, fontWeight: "800", letterSpacing: -0.3 }, subtitle: { color: "#607385", fontSize: 13, lineHeight: 18 }, progressCard: { backgroundColor: "#EAF0F5", borderRadius: 16, gap: 10, padding: 15 }, progressHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, progressTitle: { color: "#17212B", fontSize: 15, fontWeight: "800" }, progressText: { color: "#607385", fontSize: 12, marginTop: 3 }, progressPercent: { color: "#103A5B", fontSize: 20, fontWeight: "800" }, progressTrack: { backgroundColor: "#D2DDE6", borderRadius: 8, height: 8, overflow: "hidden" }, progressFill: { backgroundColor: "#B48A2C", borderRadius: 8, height: 8 }, sectionTitle: { color: "#17212B", fontSize: 18, fontWeight: "800", marginTop: 3 }, stageList: { gap: 9, paddingRight: 5 }, stageCard: { backgroundColor: "#FFFFFF", borderColor: "#D9E1E8", borderRadius: 15, borderWidth: 1, gap: 8, minHeight: 128, padding: 12, width: 156 }, stageCardSelected: { borderColor: "#103A5B", borderWidth: 2 }, stageNumber: { alignItems: "center", backgroundColor: "#EAF0F5", borderRadius: 12, height: 25, justifyContent: "center", width: 25 }, stageNumberText: { color: "#103A5B", fontSize: 12, fontWeight: "800" }, stageTitle: { color: "#17212B", flex: 1, fontSize: 14, fontWeight: "800", lineHeight: 18 }, panel: { backgroundColor: "#FFFFFF", borderColor: "#D9E1E8", borderRadius: 18, borderWidth: 1, gap: 14, padding: 16 }, panelHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, panelKicker: { color: "#B48A2C", fontSize: 11, fontWeight: "800", letterSpacing: 1 }, panelTitle: { color: "#17212B", fontSize: 20, fontWeight: "800", marginTop: 3 }, panelRole: { color: "#607385", fontSize: 12, marginTop: 4, maxWidth: 205 }, panelInstruction: { color: "#536576", fontSize: 13, lineHeight: 19 }, field: { gap: 7 }, fieldLabel: { color: "#43576A", fontSize: 13, fontWeight: "700" }, input: { backgroundColor: "#F8FAFC", borderColor: "#D9E1E8", borderRadius: 11, borderWidth: 1, color: "#17212B", fontSize: 15, minHeight: 47, paddingHorizontal: 12 }, inputDisabled: { opacity: 0.58 }, textarea: { minHeight: 92, paddingTop: 12, textAlignVertical: "top" }, booleanField: { alignItems: "center", backgroundColor: "#F8FAFC", borderColor: "#D9E1E8", borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, paddingHorizontal: 12 }, checkbox: { alignItems: "center", borderColor: "#91A2B2", borderRadius: 5, borderWidth: 1, height: 20, justifyContent: "center", width: 20 }, checkboxActive: { backgroundColor: "#103A5B", borderColor: "#103A5B" }, booleanLabel: { color: "#17212B", fontSize: 14, fontWeight: "700" }, consentBox: { backgroundColor: "#EEF3F7", borderRadius: 12, padding: 4 }, panelActions: { gap: 10, marginTop: 2 }, skipText: { color: "#607385", fontSize: 13, fontWeight: "700", textAlign: "center", textDecorationLine: "underline" }, lockedWrap: { gap: 10 }, lockedMessage: { alignItems: "flex-start", backgroundColor: "#EAF5EE", borderRadius: 12, flexDirection: "row", gap: 9, padding: 12 }, lockedText: { color: "#356B52", flex: 1, fontSize: 13, lineHeight: 18 }, readField: { borderTopColor: "#EDF1F5", borderTopWidth: 1, gap: 3, paddingTop: 9 }, readLabel: { color: "#718397", fontSize: 11, fontWeight: "800", textTransform: "uppercase" }, readValue: { color: "#17212B", fontSize: 14, lineHeight: 20 }, integrity: { color: "#607385", fontFamily: "monospace", fontSize: 11, lineHeight: 16 }, waitingWrap: { alignItems: "center", backgroundColor: "#F7F9FB", borderRadius: 13, gap: 7, padding: 19 }, waitingTitle: { color: "#43576A", fontSize: 16, fontWeight: "800" }, waitingText: { color: "#607385", fontSize: 13, lineHeight: 19, textAlign: "center" }, waitingButton: { alignSelf: "stretch", marginTop: 5 }, event: { alignItems: "flex-start", flexDirection: "row", gap: 10 }, eventIcon: { alignItems: "center", borderRadius: 14, height: 30, justifyContent: "center", width: 30 }, eventBody: { borderBottomColor: "#E4EAF0", borderBottomWidth: 1, flex: 1, gap: 3, paddingBottom: 13 }, eventDescription: { color: "#17212B", fontSize: 14, fontWeight: "600", lineHeight: 19 }, eventMeta: { color: "#718397", fontSize: 12 }, hash: { color: "#607385", fontFamily: "monospace", fontSize: 10, marginTop: 2 }, timelineFooter: { backgroundColor: "#EEF3F7", borderRadius: 12, marginTop: 2, padding: 13 }, timelineFooterText: { color: "#536576", fontSize: 12, lineHeight: 18 }, notFoundTitle: { color: "#17212B", fontSize: 20, fontWeight: "800", marginTop: 12 }, notFoundText: { color: "#607385", fontSize: 14, lineHeight: 20, marginTop: 5, textAlign: "center" }, notFoundButton: { alignSelf: "stretch", marginTop: 20 }, pressed: { opacity: 0.7 },
}), desktopProcessStyles);
