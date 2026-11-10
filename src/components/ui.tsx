import { useMemo, type ReactNode } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme, uiFont, wordFont } from "../theme";

const pointer = Platform.OS === "web" ? ({ cursor: "pointer" } as ViewStyle) : undefined;

export function releaseWebFocus() {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const active = document.activeElement;
  if (active instanceof HTMLElement) active.blur();
}

export function Frame({
  children,
  footer,
  scroll = true,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.flex}>{children}</View>
  );
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.column}>
        {body}
        {footer ? (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 14) }]}>{footer}</View>
        ) : null}
      </View>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        releaseWebFocus();
        onPress();
      }}
      style={({ pressed }) => [
        styles.primary,
        pointer,
        pressed && !disabled && styles.primaryPressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.primaryText}>{label}</Text>
    </Pressable>
  );
}

export function QuietButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        releaseWebFocus();
        onPress();
      }}
      style={[styles.quiet, pointer]}
    >
      <Text style={styles.quietText}>{label}</Text>
    </Pressable>
  );
}

export function SentenceText({
  text,
  form,
  style,
}: {
  text: string;
  form?: string;
  style?: StyleProp<TextStyle>;
}) {
  const match = useMemo(() => {
    if (!form) return null;
    const escaped = form.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const found = text.match(new RegExp(`\\b(${escaped})\\b`, "i"));
    if (!found || found.index === undefined) return null;
    return { index: found.index, length: found[0].length };
  }, [form, text]);
  if (!match) {
    return (
      <Text selectable style={style}>
        {text}
      </Text>
    );
  }
  return (
    <Text selectable style={style}>
      {text.slice(0, match.index)}
      <Text style={styles.hit}>{text.slice(match.index, match.index + match.length)}</Text>
      {text.slice(match.index + match.length)}
    </Text>
  );
}

export function SpeakChip({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="朗读"
      onPress={() => {
        releaseWebFocus();
        onPress();
      }}
      style={({ pressed }) => [styles.speak, pointer, pressed && styles.speakPressed]}
    >
      <Text style={styles.speakText}>听</Text>
    </Pressable>
  );
}

export function GradeBar({ onGrade }: { onGrade: (grade: "unknown" | "fuzzy" | "known") => void }) {
  return (
    <View style={styles.grades}>
      <GradeButton label="不认识" tone="unknown" onPress={() => onGrade("unknown")} />
      <GradeButton label="模糊" tone="fuzzy" onPress={() => onGrade("fuzzy")} />
      <GradeButton label="认识" tone="known" onPress={() => onGrade("known")} />
    </View>
  );
}

function GradeButton({
  label,
  tone,
  onPress,
}: {
  label: string;
  tone: "unknown" | "fuzzy" | "known";
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        releaseWebFocus();
        onPress();
      }}
      style={({ pressed }) => [
        styles.grade,
        tone === "unknown" && styles.unknown,
        tone === "fuzzy" && styles.fuzzy,
        tone === "known" && styles.known,
        pointer,
        pressed && styles.gradePressed,
      ]}
    >
      <Text
        style={[
          styles.gradeText,
          tone === "unknown" && styles.unknownText,
          tone === "fuzzy" && styles.fuzzyText,
          tone === "known" && styles.knownText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  column: { flex: 1, width: "100%", maxWidth: 480, alignSelf: "center" },
  flex: { flex: 1 },
  scroll: { paddingHorizontal: 20, paddingBottom: 28, paddingTop: 8 },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.line,
    backgroundColor: theme.bg,
  },
  primary: {
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: theme.pine,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryPressed: { backgroundColor: theme.pineDeep },
  disabled: { opacity: 0.45 },
  primaryText: { color: theme.white, fontFamily: uiFont, fontSize: 17, fontWeight: "700" },
  quiet: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  quietText: { color: theme.pineText, fontFamily: uiFont, fontSize: 16, fontWeight: "600" },
  hit: {
    backgroundColor: theme.highlight,
    color: theme.pineText,
    fontWeight: "700",
  },
  speak: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.pineSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  speakPressed: { opacity: 0.7 },
  speakText: { color: theme.pineText, fontFamily: uiFont, fontSize: 16, fontWeight: "700" },
  grades: { flexDirection: "row", gap: 8 },
  grade: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  gradePressed: { opacity: 0.82 },
  gradeText: { fontFamily: uiFont, fontSize: 16, fontWeight: "700" },
  unknown: { backgroundColor: theme.unknownSoft, borderColor: "#E7C8C4" },
  unknownText: { color: theme.unknown },
  fuzzy: { backgroundColor: theme.fuzzySoft, borderColor: "#E7D3AE" },
  fuzzyText: { color: theme.fuzzy },
  known: { backgroundColor: theme.pine, borderColor: theme.pine },
  knownText: { color: theme.white },
});
