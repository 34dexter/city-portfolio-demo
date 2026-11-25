export class Emitter
{
    constructor() { this.listeners = {} }
    on(name, callback) { (this.listeners[name] ??= []).push(callback); return this }
    emit(name, ...args) { for(const callback of this.listeners[name] ?? []) callback(...args) }
}

const KEYMAP = {
    forward: [ 'KeyW', 'ArrowUp', 'KeyZ' ],
    backward: [ 'KeyS', 'ArrowDown' ],
    left: [ 'KeyA', 'ArrowLeft', 'KeyQ' ],
    right: [ 'KeyD', 'ArrowRight' ],
    boost: [ 'ShiftLeft', 'ShiftRight' ],
    brake: [ 'KeyB', 'ControlLeft' ],
    jump: [ 'Space' ],
}

const KEY_EVENTS = {
    Enter: 'interact',
    KeyE: 'interact',
    KeyF: 'interact',
    KeyH: 'honk',
    KeyR: 'respawn',
    KeyN: 'toggleTime',
    KeyC: 'toggleView',
    KeyT: 'weather',
    KeyV: 'toggleView',
    KeyL: 'mute',
    Escape: 'escape',
}

export class Controls extends Emitter
{
    constructor()
    {
        super()
        this.enabled = false
        this.pressed = new Set()
        this.touch = { active: false, x: 0, y: 0, boost: false, jump: false }
        this.state = { accelerating: 0, steering: 0, boosting: 0, braking: 0, jumping: false }

        window.addEventListener('keydown', (event) => this.onKeyDown(event))
        window.addEventListener('keyup', (event) => this.pressed.delete(event.code))
        window.addEventListener('blur', () => this.pressed.clear())

        this.isTouch = window.matchMedia('(pointer: coarse)').matches
        this.setTouch()
    }

    onKeyDown(event)
    {
        const target = event.target
        if(target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'))
            return

        // Let focused buttons and links handle Enter themselves
        const onInteractive = target && (target.tagName === 'BUTTON' || target.tagName === 'A')
        if(KEY_EVENTS[event.code] && !event.repeat && !(onInteractive && event.code === 'Enter'))
        {
            // Stop the same keypress from activating whatever gets focus next (e.g. the panel close button)
            if(event.code === 'Enter') event.preventDefault()
            this.emit(KEY_EVENTS[event.code])
        }

        if(!this.enabled)
            return

        const isDrivingKey = Object.values(KEYMAP).some((codes) => codes.includes(event.code))
        if(isDrivingKey)
        {
            this.pressed.add(event.code)
            event.preventDefault()
            this.emit('drive')
        }
    }

    isDown(action)
    {
        return KEYMAP[action].some((code) => this.pressed.has(code))
    }

    setTouch()
    {
        const root = document.querySelector('.touch')
        if(!root)
            return

        if(this.isTouch)
            root.classList.add('is-visible')

        const stick = root.querySelector('.touch-stick')
        const knob = root.querySelector('.touch-knob')
        let pointerId = null

        const move = (event) =>
        {
            const rect = stick.getBoundingClientRect()
            const radius = rect.width / 2
            let dx = (event.clientX - (rect.left + radius)) / radius
            let dy = (event.clientY - (rect.top + radius)) / radius
            const length = Math.hypot(dx, dy)
            if(length > 1) { dx /= length; dy /= length }
            this.touch.x = dx
            this.touch.y = dy
            knob.style.transform = `translate(${dx * radius * 0.6}px, ${dy * radius * 0.6}px)`
        }

        stick.addEventListener('pointerdown', (event) =>
        {
            pointerId = event.pointerId
            stick.setPointerCapture(pointerId)
            this.touch.active = true
            move(event)
            this.emit('drive')
        })
        stick.addEventListener('pointermove', (event) => { if(event.pointerId === pointerId) move(event) })
        const end = (event) =>
        {
            if(event.pointerId !== pointerId) return
            pointerId = null
            this.touch.active = false
            this.touch.x = this.touch.y = 0
            knob.style.transform = ''
        }
        stick.addEventListener('pointerup', end)
        stick.addEventListener('pointercancel', end)

        const hold = (selector, key) =>
        {
            const element = root.querySelector(selector)
            element.addEventListener('pointerdown', (event) => { event.preventDefault(); this.touch[key] = true; this.emit('drive') })
            const release = () => { this.touch[key] = false }
            element.addEventListener('pointerup', release)
            element.addEventListener('pointercancel', release)
            element.addEventListener('pointerleave', release)
        }
        hold('.touch-boost', 'boost')
        hold('.touch-jump', 'jump')
        root.querySelector('.touch-honk').addEventListener('pointerdown', (event) => { event.preventDefault(); this.emit('honk') })
    }

    update()
    {
        const s = this.state
        s.accelerating = 0
        s.steering = 0
        s.boosting = 0
        s.braking = 0
        s.jumping = false

        if(!this.enabled)
            return

        if(this.isDown('forward')) s.accelerating += 1
        if(this.isDown('backward')) s.accelerating -= 1
        if(this.isDown('left')) s.steering += 1
        if(this.isDown('right')) s.steering -= 1
        if(this.isDown('boost')) s.boosting = 1
        if(this.isDown('brake')) { s.braking = 1; s.accelerating = 0 }
        if(this.isDown('jump')) s.jumping = true

        if(this.touch.active)
        {
            const forward = -this.touch.y
            s.accelerating = Math.abs(forward) > 0.15 ? Math.sign(forward) * Math.min(1, Math.abs(forward) * 1.3) : 0
            s.steering = Math.abs(this.touch.x) > 0.12 ? -this.touch.x : 0
        }
        if(this.touch.boost) s.boosting = 1
        if(this.touch.jump) s.jumping = true
    }
}
