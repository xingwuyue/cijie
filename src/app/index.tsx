import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Frame, PrimaryButton, QuietButton, releaseWebFocus } from "../components/ui";
import { WORDS } from "../data/lexicon";
import { formatChineseDate, formatMonthDay } from "../logic/dates";
import {
  bandCoverage,
  countExtraDue,
  displayStreak,
  remainingCounts,
  reviewAccuracy,
} from "../logic/plan";
import {
  ACCURACY_DAYS,
  BANDS,
  UNLOCK_ACCURACY,
  UNLOCK_MIN_REVIEWS,
  UNLOCK_PERCENT,
} from "../logic/types";
import { useApp } from "../state/AppState";
import { theme, uiFont } from "../theme";

export default function HomeScreen() {
  const app = useApp();
  const showIosHint = useIosInstallHint(app.state?.pwaDismissed ?? false);
  if (app.error && !app.state) return <Message title="读不出来" body={app.error} action="重试" onPress={app.retry} />;
  if (!app.state || !app.state.plan) return <Message title="词阶" body="正在准备今天的词。" />;

  const { state, today } = app;
  const plan = state.plan!;
  const counts = remainingCounts(plan);
  const extraDue = countExtraDue(state, today, WORDS);
  const requiredTotal = counts.yesterdayTotal + counts.freshTotal;
  const requiredLeft = counts.yesterday + counts.fresh;
  const goalComplete = requiredTotal > 0 && requiredLeft === 0;
  const started = plan.done.length > 0;
  const streak = displayStreak(state, today);
  const coverage = bandCoverage(state, WORDS, state.currentBand);
  const accuracy = reviewAccuracy(state, today);
  const band = BANDS[state.currentBand];
  const learned = Object.keys(state.words).length;
  const pct = coverage.total ? Math.min(100, Math.round((coverage.introduced / coverage.total) * 100)) : 0;

  const goStudy = () => router.push("/study");
  const nothingToDo =
    counts.freshTotal + counts.yesterdayTotal + counts.dueTotal === 0 && extraDue === 0;

  return (
    <Frame>
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>词阶</Text>
          <Text style={styles.date}>{formatChineseDate(today)}</Text>
        </View>
        <Text style={styles.streak}>{streak > 0 ? `连续 ${streak} 天` : "从今天开始"}</Text>
      </View>

      {showIosHint ? (
        <View style={styles.hint}>
          <Text style={styles.hintTitle}>放到主屏幕</Text>
          <Text style={styles.hintBody}>
            用 Safari 点底部分享按钮，选「添加到主屏幕」。下次会像一个 App 一样打开。
          </Text>
          <QuietButton label="知道了" onPress={app.dismissPwa} />
        </View>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.kicker}>今天</Text>
        {goalComplete ? (
          <>
            <Text style={styles.hero}>今天的目标完成了</Text>
            <Text style={styles.body}>
              新词 {counts.freshTotal} 个，昨日复习 {counts.yesterdayTotal} 个，都已经过完。进度记在这台设备上。
            </Text>
          </>
        ) : nothingToDo ? (
          <>
            <Text style={styles.hero}>今天没有待学的词</Text>
            <Text style={styles.body}>本阶新词已经学完。继续把复习正确率稳住，达到条件后才会进入下一阶。</Text>
          </>
        ) : (
          <>
            <Row label="新词" left={counts.fresh} total={counts.freshTotal} empty="今天没有新词" />
            <Row
              label="昨日复习"
              left={counts.yesterday}
              total={counts.yesterdayTotal}
              empty="昨天没有新词"
            />
            <Row label="间隔复习" left={counts.due} total={counts.dueTotal} empty="没有到期的旧词" />
            <Text style={styles.note}>顺序是昨日复习、间隔复习，然后是新词。</Text>
            <PrimaryButton label={started ? "继续学习" : "开始今天的学习"} onPress={goStudy} />
          </>
        )}
        {goalComplete && (counts.due > 0 || extraDue > 0) ? (
          <View style={styles.gap}>
            <PrimaryButton
              label={counts.due > 0 ? "继续间隔复习" : `再复习 ${Math.min(12, extraDue)} 个到期词`}
              onPress={() => {
                if (counts.due === 0) app.moreDue();
                goStudy();
              }}
            />
          </View>
        ) : null}
        {goalComplete && counts.due === 0 && extraDue === 0 ? (
          <Text style={styles.note}>明天会有新词，也会复习今天新学的。</Text>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text style={styles.kicker}>{band.name}</Text>
        <Text style={styles.bandTitle}>{band.detail}</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
          <View style={styles.mark} />
        </View>
        <Text style={styles.body}>
          已学 {coverage.introduced} / {coverage.total}
          {coverage.total ? ` · ${pct}%` : ""}
        </Text>
        <Text style={styles.rule}>{unlockCopy(state, coverage, accuracy)}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          releaseWebFocus();
          router.push("/words");
        }}
        style={styles.linkRow}
      >
        <Text style={styles.linkLabel}>学过的词</Text>
        <Text style={styles.linkValue}>{learned}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          releaseWebFocus();
          router.push("/settings");
        }}
        style={styles.linkRow}
      >
        <Text style={styles.linkLabel}>设置</Text>
        <Text style={styles.linkValue}>每日 {state.quota} 个新词</Text>
      </Pressable>
      <Text style={styles.foot}>不需要注册。进度只保存在这台设备上。</Text>
    </Frame>
  );
}

function unlockCopy(
  state: NonNullable<ReturnType<typeof useApp>["state"]>,
  coverage: { introduced: number; total: number; target: number },
  accuracy: { correct: number; sample: number; rate: number },
): string {
  const next = state.currentBand < 5 ? BANDS[(state.currentBand + 1) as 2 | 3 | 4 | 5] : null;
  if (!next) return "这是最后一阶。";
  if (state.pendingBand && state.advanceOn) {
    return `下一阶已解锁。从${formatMonthDay(state.advanceOn)}起，新词主要来自${next.name}。上一阶没学完的词，每天还会带上最多 3 个。`;
  }
  const need = Math.max(0, coverage.target - coverage.introduced);
  const acc =
    accuracy.sample < UNLOCK_MIN_REVIEWS
      ? `近 ${ACCURACY_DAYS} 天复习 ${accuracy.sample}/${UNLOCK_MIN_REVIEWS} 次，样本还不够`
      : `近 ${ACCURACY_DAYS} 天正确率 ${Math.round(accuracy.rate * 100)}%（${accuracy.correct}/${accuracy.sample}）`;
  if (need === 0) {
    return `词量已经够了。${acc}。达到 ${Math.round(UNLOCK_ACCURACY * 100)}% 后，从第二天进入${next.name}。`;
  }
  return `解锁${next.name}：学满 ${UNLOCK_PERCENT}%（还差 ${need} 词），并且近 ${ACCURACY_DAYS} 天至少 ${UNLOCK_MIN_REVIEWS} 次复习里有 ${Math.round(UNLOCK_ACCURACY * 100)}% 选了「认识」。${acc}。`;
}

function Row({
  label,
  left,
  total,
  empty,
}: {
  label: string;
  left: number;
  total: number;
  empty: string;
}) {
  const value = total === 0 ? empty : left === 0 ? "完成" : `还剩 ${left}`;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Message({
  title,
  body,
  action,
  onPress,
}: {
  title: string;
  body: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <Frame>
      <View style={styles.message}>
        <Text style={styles.brand}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
        {action && onPress ? <PrimaryButton label={action} onPress={onPress} /> : null}
      </View>
    </Frame>
  );
}

function useIosInstallHint(dismissed: boolean): boolean {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (dismissed || Platform.OS !== "web" || typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const ios =
      /iPhone|iPad|iPod/i.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const nav = navigator as Navigator & { standalone?: boolean };
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
    setShow(ios && !standalone);
  }, [dismissed]);
  return show && !dismissed;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 18,
    marginTop: 8,
  },
  brand: { fontFamily: uiFont, fontSize: 34, fontWeight: "700", color: theme.ink, letterSpacing: 1 },
  date: { marginTop: 4, fontFamily: uiFont, fontSize: 15, color: theme.muted },
  streak: { fontFamily: uiFont, fontSize: 15, color: theme.pineText, fontWeight: "700" },
  card: {
    backgroundColor: theme.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.line,
    padding: 18,
    marginBottom: 14,
    gap: 8,
  },
  kicker: { fontFamily: uiFont, fontSize: 13, color: theme.pineText, fontWeight: "700" },
  hero: { fontFamily: uiFont, fontSize: 26, lineHeight: 34, fontWeight: "700", color: theme.ink },
  bandTitle: { fontFamily: uiFont, fontSize: 20, fontWeight: "700", color: theme.ink },
  body: { fontFamily: uiFont, fontSize: 16, lineHeight: 24, color: theme.ink },
  note: { fontFamily: uiFont, fontSize: 13, lineHeight: 20, color: theme.muted },
  rule: { fontFamily: uiFont, fontSize: 14, lineHeight: 22, color: theme.muted },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  rowLabel: { fontFamily: uiFont, fontSize: 16, color: theme.ink },
  rowValue: { fontFamily: uiFont, fontSize: 16, color: theme.pineText, fontWeight: "700" },
  track: {
    height: 8,
    borderRadius: 99,
    backgroundColor: "#E7E1D6",
    overflow: "hidden",
    marginTop: 6,
    position: "relative",
  },
  fill: { height: "100%", backgroundColor: theme.pine, borderRadius: 99 },
  mark: {
    position: "absolute",
    left: "80%",
    top: -3,
    width: 2,
    height: 14,
    backgroundColor: theme.ink,
  },
  linkRow: {
    minHeight: 56,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.line,
  },
  linkLabel: { fontFamily: uiFont, fontSize: 17, color: theme.ink },
  linkValue: { fontFamily: uiFont, fontSize: 15, color: theme.muted },
  foot: { marginTop: 18, fontFamily: uiFont, fontSize: 13, color: theme.faint, lineHeight: 20 },
  hint: {
    backgroundColor: theme.pineSoft,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  hintTitle: { fontFamily: uiFont, fontSize: 16, fontWeight: "700", color: theme.pineText },
  hintBody: { marginTop: 6, fontFamily: uiFont, fontSize: 14, lineHeight: 22, color: theme.ink },
  gap: { marginTop: 8 },
  message: { paddingTop: 80, gap: 12 },
});
