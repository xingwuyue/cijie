import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Frame, PrimaryButton } from "../components/ui";
import { theme, uiFont } from "../theme";

export default function NotFound() {
  return (
    <Frame>
      <View style={styles.block}>
        <Text style={styles.title}>这个页面不存在</Text>
        <Text style={styles.body}>回到首页，继续今天的词。</Text>
        <PrimaryButton label="回首页" onPress={() => router.replace("/")} />
      </View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  block: { paddingTop: 48, gap: 12 },
  title: { fontFamily: uiFont, fontSize: 28, fontWeight: "700", color: theme.ink },
  body: { fontFamily: uiFont, fontSize: 16, color: theme.muted, marginBottom: 8 },
});
