export function useSpeech() {
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'fr-FR';
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  };
  return { speak };
}
