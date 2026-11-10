import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Frame, GradeBar, PrimaryButton, QuietButton, SentenceText, SpeakChip, releaseWebFocus } from "../components/ui";
import { examplesFor, getWord, ensureExamples, WORDS } from "../data/lexicon";
import { countExtraDue, displayStreak, remainingCounts, sessionQueue } from "../logic/plan";
import type { CardKind, Grade } from "../logic/types";
import { speakEnglish } from "../speech";
import { useApp } from "../state/AppState";
import { theme, uiFont, wordFont } from "../theme";

const KIND: Record<CardKind, string> = {
  yesterday: "昨日复习",
  due: "间隔复习",
  new: "新词",
};

export default function StudyScreen() {
  const app = useApp();
  const state = app.state;
  const plan = state?.plan;
  const [phase, setPhase] = useState<"front" | "back">("front");
  const [showZh, setShowZh] = useState(false);
  const [speechNote, setSpeechNote] = useState("");
  const [readyExamples, setReadyExamples] = useState(false);
  const lock = useRef(false);
  const queue = plan && plan.date === app.today ? sessionQueue(plan) : [];
  const current = queue[0];

  useEffect(() => {
    void ensureExamples([1, 2, 3, 4, 5]).then(() => setReadyExamples(true));
  }, []);

  useEffect(() => {
    setPhase("front");
    setShowZh(false);
    lock.current = false;
  }, [current?.id, current?.kind]);

  if (!state || !plan || plan.date !== app.today) {
    return (
      <Frame>
        <Text style={styles.plain}>正在打开今天的学习。</Text>
      </Frame>
    );
  }

  const total = plan.yesterdayIds.length + plan.dueIds.length + plan.newIds.length;
  const position = Math.min(total, plan.done.length + 1);

  const exit = () => {
    releaseWebFocus();
    if (phase === "back") {
      setPhase("front");
      setShowZh(false);
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/");
  };

  if (!current) {
    const counts = remainingCounts(plan);
    const extra = countExtraDue(state, app.today, WORDS);
    const streak = displayStreak(state, app.today);
    return (
      <Frame
        footer={
          <View style={styles.stack}>
            {extra > 0 ? (
              <PrimaryButton
                label={`再复习 ${Math.min(12, extra)} 个到期词`}
                onPress={app.moreDue}
              />
            ) : null}
            <QuietButton label="回到首页" onPress={() => router.replace("/")} />
          </View>
        }
      >
        <Text style={styles.kicker}>今天</Text>
        <Text style={styles.doneTitle}>这一轮学完了</Text>
        <Text style={styles.lead}>
          新词完成 {counts.freshTotal - counts.fresh} 个，昨日复习完成 {counts.yesterdayTotal - counts.yesterday}{" "}
          个，间隔复习做了 {counts.dueTotal - counts.due} 个。
        </Text>
        <Text style={styles.lead}>{streak > 0 ? `连续学习 ${streak} 天。` : "明天继续，连续记录会从完成当天的目标算起。"}</Text>
        {state.pendingBand ? <Text style={styles.lead}>下一阶已经解锁，从明天开始出现新阶的词。</Text> : null}
      </Frame>
    );
  }

  if (!readyExamples) {
    return (
      <Frame>
        <View style={styles.top}>
          <Pressable accessibilityRole="button" onPress={exit} hitSlop={12}>
            <Text style={styles.back}>关闭</Text>
          </Pressable>
          <Text style={styles.progress}>
            {KIND[current.kind]} · {position}/{total}
          </Text>
        </View>
        <Text style={styles.plain}>正在准备例句。</Text>
      </Frame>
    );
  }

  const word = getWord(current.id);
  if (!word) {
    return (
      <Frame>
        <Text style={styles.plain}>这个词没有载入。回到首页再试一次。</Text>
        <QuietButton label="回首页" onPress={() => router.replace("/")} />
      </Frame>
    );
  }

  const examples = readyExamples ? examplesFor(word.id) : [];
  const teach = examples[0];
  const check = examples[1] ?? examples[0];
  const isNew = current.kind === "new";

  const speak = async (text: string) => {
    if (!state.speechOn) return;
    const ok = await speakEnglish(text);
    setSpeechNote(ok ? "" : "这台设备暂时不能朗读。");
  };

  const grade = (value: Grade) => {
    if (lock.current) return;
    lock.current = true;
    app.grade(word.id, current.kind, value);
  };

  const footer = (() => {
    if (phase === "front" && isNew && teach) {
      return <PrimaryButton label="去做句意确认" onPress={() => setPhase("back")} />;
    }
    if (phase === "front" && !isNew) {
      return <PrimaryButton label="查看释义" onPress={() => setPhase("back")} />;
    }
    if (phase === "front" && isNew && !teach) {
      return <GradeBar onGrade={grade} />;
    }
    return <GradeBar onGrade={grade} />;
  })();

  return (
    <Frame scroll footer={footer}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" onPress={exit} hitSlop={12}>
          <Text style={styles.back}>{phase === "back" ? "返回" : "关闭"}</Text>
        </Pressable>
        <Text style={styles.progress}>
          {KIND[current.kind]} · {position}/{total}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${total ? (plan.done.length / total) * 100 : 0}%` }]} />
      </View>

      {phase === "front" && isNew ? (
        <View style={styles.block}>
          <View style={styles.wordRow}>
            <Text style={styles.word}>{word.word}</Text>
            {state.speechOn ? <SpeakChip onPress={() => void speak(word.word)} /> : null}
          </View>
          {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}
          {word.pos ? <Text style={styles.pos}>{word.pos}</Text> : null}
          <Text style={styles.gloss}>{word.gloss || "暂无中文释义"}</Text>
          {teach ? (
            <>
              <SentenceText text={teach.en} form={teach.form} style={styles.sentence} />
              <Text style={styles.translation}>{teach.zh}</Text>
              {teach.src === "tatoeba" ? <Text style={styles.source}>例句：Tatoeba · CC BY</Text> : null}
            </>
          ) : (
            <Text style={styles.lead}>{readyExamples ? "这个词暂时没有例句，先记住词义。" : "例句准备中。"}</Text>
          )}
        </View>
      ) : null}

      {phase === "front" && !isNew ? (
        <View style={styles.block}>
          <Text style={styles.recall}>先读句子，回忆这个词的意思。</Text>
          <Text style={styles.lemma}>{word.word}</Text>
          {teach ? (
            <SentenceText text={teach.en} form={teach.form} style={styles.sentence} />
          ) : (
            <Text style={styles.lead}>{readyExamples ? "这个词暂时没有例句。" : "例句准备中。"}</Text>
          )}
        </View>
      ) : null}

      {phase === "back" && isNew ? (
        <View style={styles.block}>
          <Text style={styles.kicker}>句意确认</Text>
          {check ? (
            <>
              <SentenceText text={check.en} form={check.form} style={styles.sentence} />
              {showZh ? (
                <Text style={styles.translation}>{check.zh}</Text>
              ) : (
                <QuietButton label="看译文" onPress={() => setShowZh(true)} />
              )}
            </>
          ) : (
            <Text style={styles.gloss}>{word.gloss || "暂无中文释义"}</Text>
          )}
          <Text style={styles.prompt}>这句话你对上了吗？</Text>
        </View>
      ) : null}

      {phase === "back" && !isNew ? (
        <View style={styles.block}>
          <View style={styles.wordRow}>
            <Text style={styles.wordSmall}>{word.word}</Text>
            {state.speechOn ? <SpeakChip onPress={() => void speak(word.word)} /> : null}
          </View>
          {word.ipa ? <Text style={styles.ipa}>/{word.ipa}/</Text> : null}
          {word.pos ? <Text style={styles.pos}>{word.pos}</Text> : null}
          <Text style={styles.gloss}>{word.gloss || "暂无中文释义"}</Text>
          {teach ? (
            <>
              <SentenceText text={teach.en} form={teach.form} style={styles.sentence} />
              <Text style={styles.translation}>{teach.zh}</Text>
              {teach.src === "tatoeba" ? <Text style={styles.source}>例句：Tatoeba · CC BY</Text> : null}
            </>
          ) : null}
          <Text style={styles.prompt}>这句话你对上了吗？</Text>
        </View>
      ) : null}
      {speechNote ? <Text style={styles.note}>{speechNote}</Text> : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  back: { fontFamily: uiFont, fontSize: 16, color: theme.pineText, fontWeight: "700" },
  progress: { fontFamily: uiFont, fontSize: 14, color: theme.muted },
  track: { height: 4, backgroundColor: "#E7E1D6", borderRadius: 99, marginTop: 14, marginBottom: 22 },
  fill: { height: "100%", backgroundColor: theme.pine, borderRadius: 99 },
  block: { gap: 10 },
  wordRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  word: { flex: 1, fontFamily: wordFont, fontSize: 44, lineHeight: 52, color: theme.ink },
  wordSmall: { flex: 1, fontFamily: wordFont, fontSize: 36, lineHeight: 44, color: theme.ink },
  lemma: { fontFamily: wordFont, fontSize: 28, color: theme.pineText },
  ipa: { fontFamily: uiFont, fontSize: 18, color: theme.muted },
  pos: { fontFamily: uiFont, fontSize: 14, color: theme.pineText, fontWeight: "700" },
  gloss: { fontFamily: uiFont, fontSize: 22, lineHeight: 32, color: theme.ink, fontWeight: "600" },
  sentence: { fontFamily: wordFont, fontSize: 24, lineHeight: 36, color: theme.ink, marginTop: 8 },
  translation: { fontFamily: uiFont, fontSize: 17, lineHeight: 26, color: theme.muted },
  recall: { fontFamily: uiFont, fontSize: 15, color: theme.muted },
  kicker: { fontFamily: uiFont, fontSize: 13, color: theme.pineText, fontWeight: "700" },
  prompt: { marginTop: 8, fontFamily: uiFont, fontSize: 16, color: theme.ink },
  lead: { fontFamily: uiFont, fontSize: 17, lineHeight: 26, color: theme.ink },
  note: { marginTop: 8, fontFamily: uiFont, fontSize: 13, color: theme.faint },
  source: { fontFamily: uiFont, fontSize: 11, color: theme.faint },
  plain: { marginTop: 24, fontFamily: uiFont, fontSize: 16, color: theme.ink },
  doneTitle: { fontFamily: uiFont, fontSize: 32, lineHeight: 40, fontWeight: "700", color: theme.ink, marginTop: 12 },
  stack: { gap: 4 },
});
