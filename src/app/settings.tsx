import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Frame, PrimaryButton, QuietButton, releaseWebFocus } from "../components/ui";
import {
  ACCURACY_DAYS,
  BANDS,
  LEFTOVER_PER_DAY,
  QUOTAS,
  UNLOCK_ACCURACY,
  UNLOCK_MIN_REVIEWS,
  UNLOCK_PERCENT,
  type Quota,
} from "../logic/types";
import { useApp } from "../state/AppState";
import { theme, uiFont } from "../theme";

export default function SettingsScreen() {
  const app = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const state = app.state;
  if (!state) {
    return (
      <Frame>
        <Text style={styles.body}>正在打开设置。</Text>
      </Frame>
    );
  }
  const startedToday = state.plan?.done.some((item) => item.kind === "new") ?? false;
  return (
    <Frame>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          releaseWebFocus();
          if (router.canGoBack()) router.back();
          else router.replace("/");
        }}
      >
        <Text style={styles.back}>返回</Text>
      </Pressable>
      <Text style={styles.title}>设置</Text>

      <Text style={styles.label}>每日新词</Text>
      <View style={styles.segment}>
        {QUOTAS.map((quota) => (
          <Pressable
            key={quota}
            accessibilityRole="button"
            onPress={() => app.changeQuota(quota as Quota)}
            style={[styles.segmentItem, state.quota === quota && styles.segmentOn]}
          >
            <Text style={[styles.segmentText, state.quota === quota && styles.segmentTextOn]}>{quota}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>
        {startedToday ? "今天的新词已经开始，新的数量从明天生效。" : "今天还没学新词，改完会立刻重排。"}
      </Text>

      <View style={styles.switchRow}>
        <View style={styles.switchCopy}>
          <Text style={styles.label}>朗读单词</Text>
          <Text style={styles.note}>用系统语音，不需要联网密钥。iPhone 开了静音开关时可能没有声音。</Text>
        </View>
        <Switch
          value={state.speechOn}
          onValueChange={app.setSpeech}
          trackColor={{ false: theme.line, true: theme.pine }}
          thumbColor={theme.white}
        />
      </View>

      <Text style={styles.section}>学习规则</Text>
      <Text style={styles.body}>
        每天从当前阶取新词，第二天先复习昨天新学的全部词，再安排少量更早的词。认识之后，间隔按 1、3、7、14、30、60 天拉开；模糊会缩短；不认识则明天再来。昨天的词永远排在间隔复习前面。
      </Text>
      <Text style={styles.body}>
        进入下一阶需要：当前阶学满 {UNLOCK_PERCENT}%，并且近 {ACCURACY_DAYS} 天的复习里，「认识」至少占 {Math.round(UNLOCK_ACCURACY * 100)}%，样本不少于 {UNLOCK_MIN_REVIEWS} 次。条件满足后从第二天换阶，不会在当天突然换一批词。换阶后，上一阶没学完的词每天最多再带 {LEFTOVER_PER_DAY} 个。
      </Text>
      <Text style={styles.body}>现在在{BANDS[state.currentBand].name}。日期按北京时间（Asia/Shanghai）计算。</Text>

      <Text style={styles.section}>添加到主屏幕</Text>
      <Text style={styles.body}>
        用 iPhone 的 Safari 打开网页版，点底部分享按钮，再点「添加到主屏幕」。不需要 Mac，也不需要 Apple 开发者账号。加好之后，词阶会以独立窗口打开。
      </Text>

      <Text style={styles.section}>词库</Text>
      <Text style={styles.body}>
        词频来自 wordfreq（Robyn Speer，CC BY-SA 4.0）。中文释义来自 ECDICT（MIT），没有使用牛津、柯林斯、有道或金山的正文。音标来自 CMU 发音词典经 ipa-dict 整理的美国英语。例句来自 Tatoeba（CC BY 2.0 FR），缺句处用词阶原创短句补上。冠词、代词和 be/do/have 这类纯功能词没有放进词阶。
      </Text>

      <Text style={styles.section}>进度</Text>
      {confirmReset ? (
        <View style={styles.resetBox}>
          <Text style={styles.body}>会清除这台设备上的学习记录。此操作不能撤销。</Text>
          <PrimaryButton
            label="确认重置"
            onPress={() => {
              app.reset();
              setConfirmReset(false);
              router.replace("/");
            }}
          />
          <QuietButton label="取消" onPress={() => setConfirmReset(false)} />
        </View>
      ) : (
        <QuietButton label="重置学习进度" onPress={() => setConfirmReset(true)} />
      )}

      {__DEV__ ? (
        <QuietButton label="开发：把学习日推后一天" onPress={app.shiftDay} />
      ) : null}
    </Frame>
  );
}

const styles = StyleSheet.create({
  back: { marginTop: 8, fontFamily: uiFont, fontSize: 16, color: theme.pineText, fontWeight: "700" },
  title: { marginTop: 8, marginBottom: 16, fontFamily: uiFont, fontSize: 32, fontWeight: "700", color: theme.ink },
  label: { fontFamily: uiFont, fontSize: 16, fontWeight: "700", color: theme.ink },
  section: { marginTop: 22, marginBottom: 6, fontFamily: uiFont, fontSize: 16, fontWeight: "700", color: theme.ink },
  body: { fontFamily: uiFont, fontSize: 15, lineHeight: 24, color: theme.ink, marginBottom: 8 },
  note: { marginTop: 8, fontFamily: uiFont, fontSize: 13, lineHeight: 20, color: theme.muted },
  segment: { flexDirection: "row", gap: 8, marginTop: 10 },
  segmentItem: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.card,
  },
  segmentOn: { backgroundColor: theme.pine, borderColor: theme.pine },
  segmentText: { fontFamily: uiFont, fontSize: 17, fontWeight: "700", color: theme.ink },
  segmentTextOn: { color: theme.white },
  switchRow: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12 },
  switchCopy: { flex: 1 },
  resetBox: { marginTop: 8, gap: 4 },
});
