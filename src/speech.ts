export async function speakEnglish(text: string): Promise<boolean> {
  const trimmed = text.trim();
  if (!trimmed) return false;
  try {
    const Speech = await import("expo-speech");
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) await Speech.stop();
    Speech.speak(trimmed, { language: "en-US", rate: 0.92 });
    return true;
  } catch {
    return false;
  }
}
