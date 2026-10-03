// Browser-generated tones: no audio files, network requests or game-rule state.
let audio: AudioContext | null = null

export function prepareResultAudio() {
  if (typeof AudioContext === 'undefined') return
  try {
    audio ??= new AudioContext()
    // Unlock audio during the user's start-game click, including when AI opens.
    void audio.resume().catch(() => {})
  } catch {
    // Unavailable audio must not prevent playing the game.
  }
}

export function playResultSound(victory: boolean) {
  if (!audio || audio.state !== 'running') return
  const notes = victory ? [523.25, 659.25, 783.99, 1046.5] : [392, 329.63, 293.66, 196]
  const step = victory ? 0.18 : 0.24
  for (const [index, frequency] of notes.entries()) {
    const start = audio.currentTime + index * step
    const duration = index === notes.length - 1 ? 0.75 : step * 1.3
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = victory ? 'triangle' : 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.001, start)
    gain.gain.exponentialRampToValueAtTime(0.075, start + 0.025)
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration)
    oscillator.connect(gain)
    gain.connect(audio.destination)
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect() }
    oscillator.start(start)
    oscillator.stop(start + duration)
  }
}

export function stopResultAudio() {
  const previous = audio
  audio = null
  if (previous && previous.state !== 'closed') void previous.close().catch(() => {})
}
