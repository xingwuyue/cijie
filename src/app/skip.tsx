import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Frame, GradeBar, PrimaryButton, QuietButton, SentenceText, SpeakChip, releaseWebFocus } from "../components/ui";
import { WORDS, ensureExamples, examplesFor, getWord } from "../data/lexicon";
import { countUnintroducedInBand, nextUnintroduced } from "../logic/plan";
import { BANDS } from "../logic/types";
import { speakEnglish } from "../speech";
import { useApp } from "../state/AppState";
import { theme, uiFont, wordFont } from "../theme";

export default function SkipScreen() {
  const app = useApp();
  const state = app.state;
  const [skipped, setSkipped] = useState(0);
  const [confirmBand, setConfirmBand] = useState(false);
  const [readyExamples, setReadyExamples] = useState(false);
  const word = state ? nextUnintroduced(state, WORDS) : null;

  useEffect(() => {
    if (!word) return;
    let cancelled = false;
    void ensureExamples([word.band]).then(() => {
      if (!cancelled) setReadyExamples(true);
    });
    return () => {
      cancelled = true;
    };
  }, [word?.band]);

  const stop = (study: boolean) => {
    releaseWebFocus();
    if (study) router.replace("/study");
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (!state) {
    return (
      <Frame>
        <Text style={styles.lead}>正在打开。</Text>
      </Frame>
    );
  }

  if (!word) {
    return (
      <Frame footer={<PrimaryButton label="回到首页" onPress={() => stop(false)} />}>
        <Text style={styles.kicker}>跳过已会的词</Text>
        <Text style={styles.title}>后面没有未学的词了</Text>
        <Text style={styles.lead}>这一次标成已会的有 {skipped} 个。它们不会进明天的复习。</Text>
      </Frame>
    );
  }

  const entry = getWord(word.id);
  const example = readyExamples ? examplesFor(word.id)[0] : undefined;
  const band = BANDS[state.currentBand];
  const leftInBand = countUnintroducedInBand(state, WORDS, state.currentBand);

  return (
    <Frame
      footer={
        confirmBand ? (
          <View style={styles.stack}>
            <PrimaryButton
              label="确认，这一档我都会"
              onPress={() => {
                const before = leftInBand;
                app.knowCurrentBand();
                setSkipped((count) => count + before);
                setConfirmBand(false);
              }}
            />
            <QuietButton label="取消" onPress={() => setConfirmBand(false)} />
          </View>
        ) : (
          <View style={styles.stack}>
            <GradeBar
              onGrade={(grade) => {
                if (grade === "known") {
                  app.skipKnown(word.id);
                  setSkipped((count) => count + 1);
                  return;
                }
                stop(true);
              }}
            />
            <QuietButton label="先停在这里" onPress={() => stop(false)} />
          </View>
        )
      }
    >
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={() => stop(false)} hitSlop={12}>
          <Text style={styles.back}>关闭</Text>
        </Pressable>
        <Text style={styles.progress}>已跳过 {skipped}</Text>
      </View>
      <Text style={styles.kicker}>继续学到不熟为止 · {band.name}</Text>
      {confirmBand ? (
        <Text style={styles.title}>
          把{band.name}还没学的 {leftInBand} 个词标成已会，并立刻进入下一阶？这些词不会进入明天的复习。
        </Text>
      ) : entry ? (
        <View style={styles.block}>
          <View style={styles.wordRow}>
            <Text style={styles.word}>{entry.word}</Text>
            {state.speechOn ? <SpeakChip onPress={() => void speakEnglish(entry.word)} /> : null}
          </View>
          {entry.ipa ? <Text style={styles.ipa}>/{entry.ipa}/</Text> : null}
          {entry.pos ? <Text style={styles.pos}>{entry.pos}</Text> : null}
          <Text style={styles.gloss}>{entry.gloss || "暂无中文释义"}</Text>
          {example ? (
            <>
              <SentenceText text={example.en} form={example.form} style={styles.sentence} />
              <Text style={styles.translation}>{example.zh}</Text>
            </>
          ) : (
            <Text style={styles.note}>{readyExamples ? "这个词暂时没有例句。" : "例句准备中。"}</Text>
          )}
          <Text style={styles.note}>认识就跳过，不进复习。模糊或不认识会停在这里，接着按每天的词量学。</Text>
          <QuietButton label={`这一档我都会（还剩 ${leftInBand}）`} onPress={() => setConfirmBand(true)} />
        </View>
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, marginBottom: 12 },
  back: { fontFamily: uiFont, fontSize: 16, color: theme.pineText, fontWeight: "700" },
  progress: { fontFamily: uiFont, fontSize: 14, color: theme.muted },
  kicker: { fontFamily: uiFont, fontSize: 13, color: theme.pineText, fontWeight: "700" },
  title: { marginTop: 12, fontFamily: uiFont, fontSize: 22, lineHeight: 32, fontWeight: "700", color: theme.ink },
  block: { gap: 8, marginTop: 12 },
  wordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  word: { flex: 1, fontFamily: wordFont, fontSize: 44, lineHeight: 52, color: theme.ink },
  ipa: { fontFamily: uiFont, fontSize: 18, color: theme.muted },
  pos: { fontFamily: uiFont, fontSize: 14, color: theme.pineText, fontWeight: "700" },
  gloss: { fontFamily: uiFont, fontSize: 22, lineHeight: 32, color: theme.ink, fontWeight: "600" },
  sentence: { fontFamily: wordFont, fontSize: 22, lineHeight: 34, color: theme.ink, marginTop: 6 },
  translation: { fontFamily: uiFont, fontSize: 16, lineHeight: 24, color: theme.muted },
  note: { fontFamily: uiFont, fontSize: 13, lineHeight: 20, color: theme.muted, marginTop: 6 },
  lead: { marginTop: 12, fontFamily: uiFont, fontSize: 16, lineHeight: 24, color: theme.ink },
  stack: { gap: 4 },
});
