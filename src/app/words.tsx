import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Frame, SentenceText, SpeakChip } from "../components/ui";
import { WORDS, ensureExamples, examplesFor, getWord, type WordEntry } from "../data/lexicon";
import { formatMonthDay } from "../logic/dates";
import type { Grade, WordProgress } from "../logic/types";
import { speakEnglish } from "../speech";
import { useApp } from "../state/AppState";
import { theme, uiFont, wordFont } from "../theme";

const GRADE: Record<Grade, string> = { known: "认识", fuzzy: "模糊", unknown: "不认识" };

export default function WordsScreen() {
  const app = useApp();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);
  const [examplesReady, setExamplesReady] = useState(false);
  const state = app.state;

  useEffect(() => {
    void ensureExamples([1, 2, 3, 4, 5]).then(() => setExamplesReady(true));
  }, []);

  const learned = useMemo(() => {
    if (!state) return [];
    return Object.entries(state.words)
      .map(([id, progress]) => {
        const word = getWord(Number(id));
        return word ? { word, progress } : null;
      })
      .filter((item): item is { word: WordEntry; progress: WordProgress } => item !== null)
      .sort(
        (a, b) =>
          b.progress.introducedOn.localeCompare(a.progress.introducedOn) || a.word.rank - b.word.rank,
      );
  }, [state]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return learned;
    return learned.filter(
      (item) => item.word.word.toLowerCase().includes(q) || item.word.gloss.includes(query.trim()),
    );
  }, [learned, query]);

  if (!state) {
    return (
      <Frame>
        <Text style={styles.muted}>正在读取学过的词。</Text>
      </Frame>
    );
  }

  return (
    <Frame scroll={false}>
      <View style={styles.pad}>
        <Pressable accessibilityRole="button" onPress={() => (router.canGoBack() ? router.back() : router.replace("/"))}>
          <Text style={styles.back}>返回</Text>
        </Pressable>
        <Text style={styles.title}>学过的词</Text>
        <Text style={styles.muted}>共 {learned.length} 个</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="搜索英文或中文"
          placeholderTextColor={theme.faint}
          style={styles.search}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>
      <FlatList
        data={shown}
        keyExtractor={(item) => String(item.word.id)}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={styles.empty}>
            {learned.length === 0 ? "还没有学过的词。从首页开始今天的新词，它们会留在这里。" : "没有匹配的词。"}
          </Text>
        }
        renderItem={({ item }) => {
          const open = openId === item.word.id;
          const due = item.progress.nextReviewOn <= app.today;
          return (
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpenId(open ? null : item.word.id)}
              style={styles.row}
            >
              <View style={styles.rowTop}>
                <Text style={styles.word}>{item.word.word}</Text>
                <Text style={styles.when}>{due ? "今天到期" : formatMonthDay(item.progress.nextReviewOn)}</Text>
              </View>
              <Text style={styles.gloss} numberOfLines={open ? 3 : 1}>
                {item.word.gloss || "暂无释义"}
              </Text>
              <Text style={styles.meta}>
                {item.progress.lastGrade ? GRADE[item.progress.lastGrade] : "新学"} · 复习 {item.progress.reviewCount} 次
              </Text>
              {open ? <Detail word={item.word} speech={state.speechOn} ready={examplesReady} /> : null}
            </Pressable>
          );
        }}
      />
    </Frame>
  );
}

function Detail({ word, speech, ready }: { word: WordEntry; speech: boolean; ready: boolean }) {
  const examples = ready ? examplesFor(word.id) : [];
  return (
    <View style={styles.detail}>
      <View style={styles.detailHead}>
        <View>
          {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}
          {word.pos ? <Text style={styles.pos}>{word.pos}</Text> : null}
        </View>
        {speech ? <SpeakChip onPress={() => void speakEnglish(word.word)} /> : null}
      </View>
      {examples.length === 0 ? (
        <Text style={styles.meta}>{ready ? "这个词暂时没有例句。" : "例句加载中。"}</Text>
      ) : (
        examples.map((example) => (
          <View key={example.en} style={styles.example}>
            <SentenceText text={example.en} form={example.form} style={styles.sentence} />
            <Text style={styles.zh}>{example.zh}</Text>
            {example.src === "tatoeba" ? <Text style={styles.source}>例句：Tatoeba · CC BY</Text> : null}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20, paddingTop: 8 },
  back: { fontFamily: uiFont, fontSize: 16, color: theme.pineText, fontWeight: "700" },
  title: { marginTop: 10, fontFamily: uiFont, fontSize: 32, fontWeight: "700", color: theme.ink },
  muted: { marginTop: 4, fontFamily: uiFont, fontSize: 14, color: theme.muted },
  search: {
    marginTop: 14,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    fontFamily: uiFont,
    fontSize: 16,
    color: theme.ink,
  },
  flex: { flex: 1 },
  list: { paddingHorizontal: 20, paddingBottom: 32 },
  row: { paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.line },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  word: { fontFamily: wordFont, fontSize: 22, color: theme.ink },
  when: { fontFamily: uiFont, fontSize: 13, color: theme.pineText, marginTop: 6 },
  gloss: { marginTop: 4, fontFamily: uiFont, fontSize: 15, color: theme.ink },
  meta: { marginTop: 4, fontFamily: uiFont, fontSize: 13, color: theme.muted },
  empty: { marginTop: 28, fontFamily: uiFont, fontSize: 16, lineHeight: 24, color: theme.muted },
  detail: { marginTop: 10, gap: 8 },
  detailHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ipa: { fontFamily: uiFont, fontSize: 15, color: theme.muted },
  pos: { fontFamily: uiFont, fontSize: 13, color: theme.pineText, fontWeight: "700" },
  example: { gap: 4, marginTop: 6 },
  sentence: { fontFamily: wordFont, fontSize: 18, lineHeight: 28, color: theme.ink },
  zh: { fontFamily: uiFont, fontSize: 15, lineHeight: 22, color: theme.muted },
  source: { fontFamily: uiFont, fontSize: 11, color: theme.faint },
});
