import { Platform } from "react-native";

export const theme = {
  bg: "#F3F0E8",
  card: "#FBFAF6",
  ink: "#1B2421",
  muted: "#5E6B66",
  faint: "#8A938E",
  line: "#E4DDD2",
  pine: "#1C4F42",
  pineDeep: "#163F35",
  pineSoft: "#E5F2EC",
  pineText: "#145445",
  highlight: "#D7EBE2",
  fuzzy: "#8A5A16",
  fuzzySoft: "#F6EBD7",
  unknown: "#8C3D36",
  unknownSoft: "#F6E4E1",
  white: "#FFFcf8",
};

export const uiFont = Platform.select({
  ios: "PingFang SC",
  android: "sans-serif",
  default:
    '"PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif',
}) as string;

export const wordFont = Platform.select({
  ios: "Georgia",
  android: "serif",
  default: 'Georgia, "Iowan Old Style", Palatino, "Times New Roman", serif',
}) as string;
