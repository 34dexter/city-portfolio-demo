import { clamp } from './utils.js'

/**
 * All sounds are synthesized with WebAudio, so there are no audio files to download.
 */
export class Audio
{
    constructor()
    {
        this.context = null
        this.muted = localStorage.getItem('muted') === '1'
    }

    init()
    {
        if(this.context)
            return
        const AudioContext = window.AudioContext || window.webkitAudioContext
        if(!AudioContext)
            return

        this.context = new AudioContext()
        this.master = this.context.createGain()
        this.master.gain.value = this.muted ? 0 : 0.6
        this.master.connect(this.context.destination)

        // Engine: two detuned oscillators through a low-pass filter
        this.engine = {}
        this.engine.filter = this.context.createBiquadFilter()
        this.engine.filter.type = 'lowpass'
        this.engine.filter.frequency.value = 400
        this.engine.gain = this.context.createGain()
        this.engine.gain.gain.value = 0
        this.engine.a = this.context.createOscillator()
        this.engine.a.type = 'sawtooth'
        this.engine.b = this.context.createOscillator()
        this.engine.b.type = 'square'
        this.engine.a.connect(this.engine.filter)
        this.engine.b.connect(this.engine.filter)
        this.engine.filter.connect(this.engine.gain)
        this.engine.gain.connect(this.master)
        this.engine.a.start()
        this.engine.b.start()

        // Rolling noise for tyres
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate)
        const data = buffer.getChannelData(0)
        for(let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
        this.noiseBuffer = buffer
        this.roll = {}
        this.roll.source = this.context.createBufferSource()
        this.roll.source.buffer = buffer
        this.roll.source.loop = true
        this.roll.filter = this.context.createBiquadFilter()
        this.roll.filter.type = 'bandpass'
        this.roll.filter.frequency.value = 600
        this.roll.gain = this.context.createGain()
        this.roll.gain.gain.value = 0
        this.roll.source.connect(this.roll.filter)
        this.roll.filter.connect(this.roll.gain)
        this.roll.gain.connect(this.master)
        this.roll.source.start()

        // Rain: filtered noise loop
        this.rainSound = {}
        this.rainSound.source = this.context.createBufferSource()
        this.rainSound.source.buffer = buffer
        this.rainSound.source.loop = true
        this.rainSound.filter = this.context.createBiquadFilter()
        this.rainSound.filter.type = 'highpass'
        this.rainSound.filter.frequency.value = 1200
        this.rainSound.gain = this.context.createGain()
        this.rainSound.gain.gain.value = 0
        this.rainSound.source.connect(this.rainSound.filter)
        this.rainSound.filter.connect(this.rainSound.gain)
        this.rainSound.gain.connect(this.master)
        this.rainSound.source.start()
    }

    // Low rumble after a lightning flash (delay = distance)
    thunder(delayMs = 800)
    {
        if(!this.context) return
        const t = this.context.currentTime + delayMs / 1000
        const source = this.context.createBufferSource()
        source.buffer = this.noiseBuffer
        const filter = this.context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 160
        const gain = this.context.createGain()
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.9, t + 0.08)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.6)
        source.connect(filter)
        filter.connect(gain)
        gain.connect(this.master)
        source.start(t, Math.random())
        source.stop(t + 2.8)
    }

    resume()
    {
        if(this.context && this.context.state === 'suspended')
            this.context.resume()
    }

    toggleMute()
    {
        this.muted = !this.muted
        localStorage.setItem('muted', this.muted ? '1' : '0')
        if(this.master)
            this.master.gain.setTargetAtTime(this.muted ? 0 : 0.6, this.context.currentTime, 0.05)
        return this.muted
    }

    honk()
    {
        if(!this.context) return
        const t = this.context.currentTime
        const gain = this.context.createGain()
        gain.gain.setValueAtTime(0, t)
        gain.gain.linearRampToValueAtTime(0.16, t + 0.02)
        gain.gain.setValueAtTime(0.16, t + 0.28)
        gain.gain.linearRampToValueAtTime(0, t + 0.36)
        const filter = this.context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 1800
        filter.connect(gain)
        gain.connect(this.master)
        for(const frequency of [ 370, 466 ])
        {
            const osc = this.context.createOscillator()
            osc.type = 'square'
            osc.frequency.value = frequency
            osc.connect(filter)
            osc.start(t)
            osc.stop(t + 0.4)
        }
    }

    blip(frequency = 660, duration = 0.12, volume = 0.12)
    {
        if(!this.context) return
        const t = this.context.currentTime
        const osc = this.context.createOscillator()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(frequency, t)
        osc.frequency.exponentialRampToValueAtTime(frequency * 1.5, t + duration)
        const gain = this.context.createGain()
        gain.gain.setValueAtTime(volume, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
        osc.connect(gain)
        gain.connect(this.master)
        osc.start(t)
        osc.stop(t + duration + 0.02)
    }

    chime()
    {
        this.blip(523, 0.15, 0.1)
        setTimeout(() => this.blip(784, 0.2, 0.1), 110)
    }

    thud(strength = 1)
    {
        if(!this.context) return
        const t = this.context.currentTime
        const source = this.context.createBufferSource()
        source.buffer = this.noiseBuffer
        const filter = this.context.createBiquadFilter()
        filter.type = 'lowpass'
        filter.frequency.value = 300
        const gain = this.context.createGain()
        gain.gain.setValueAtTime(clamp(strength, 0, 1) * 0.5, t)
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.25)
        source.connect(filter)
        filter.connect(gain)
        gain.connect(this.master)
        source.start(t, Math.random())
        source.stop(t + 0.3)
    }

    update(input, speed, inContact, weather = null)
    {
        if(!this.context) return
        const t = this.context.currentTime

        if(weather)
            this.rainSound.gain.gain.setTargetAtTime(weather.rain * 0.09, t, 0.3)
        const throttle = Math.abs(input.accelerating) * (1 + input.boosting)
        const base = 38 + Math.min(speed, 30) * 3.2 + throttle * 18
        this.engine.a.frequency.setTargetAtTime(base, t, 0.08)
        this.engine.b.frequency.setTargetAtTime(base * 0.502, t, 0.08)
        this.engine.filter.frequency.setTargetAtTime(300 + throttle * 500 + speed * 20, t, 0.1)
        this.engine.gain.gain.setTargetAtTime(0.035 + throttle * 0.05, t, 0.1)

        const rolling = inContact > 0 ? Math.min(1, speed / 20) : 0
        this.roll.gain.gain.setTargetAtTime(rolling * 0.05, t, 0.1)
        this.roll.filter.frequency.setTargetAtTime(400 + speed * 30, t, 0.1)
    }
}
