import { getSectionHtml, getResumeHtml } from './content.js'

const $ = (selector) => document.querySelector(selector)

export class UI
{
    constructor()
    {
        this.game = null
        this.loader = $('.loader')
        this.progressBar = $('.loader-bar span')
        this.progressLabel = $('.loader-label')
        this.startButton = $('.loader-start')
        this.panel = $('.panel')
        this.panelContent = $('.panel-content')
        this.prompt = $('.prompt')
        this.menu = $('.menu')
        this.toasts = $('.toasts')
        this.fadeElement = $('.fade')
        this.help = $('.help')
        this.onPanelClose = null

        $('.panel-close').addEventListener('click', () => this.closePanel(true))
        this.panel.addEventListener('click', (event) => { if(event.target === this.panel) this.closePanel(true) })

        $('.loader-resume').addEventListener('click', () => this.openResume())
        $('.button-menu').addEventListener('click', () => this.toggleMenu())
        $('.menu-close').addEventListener('click', () => this.toggleMenu(false))
        $('.button-help').addEventListener('click', () => this.toggleHelp())
        $('.help-close').addEventListener('click', () => this.toggleHelp(false))
        $('.menu-resume').addEventListener('click', () => { this.toggleMenu(false); this.openResume() })
    }

    bind(game)
    {
        this.game = game

        this.startButton.addEventListener('click', () => this.start())
        this.prompt.querySelector('button').addEventListener('click', () =>
        {
            if(game.areas.active) game.openArea(game.areas.active)
        })
        $('.button-time').addEventListener('click', () => game.toggleTime())
        $('.button-weather').addEventListener('click', (event) =>
        {
            game.cycleWeather()
            event.currentTarget.blur()
        })
        this.setWeatherIcon(game.weather.mode, game.weather.auto)
        $('.button-view').addEventListener('click', (event) =>
        {
            game.toggleView()
            event.currentTarget.blur()
        })
        $('.button-sound').addEventListener('click', () => game.toggleMute())
        $('.menu-reset').addEventListener('click', () => { this.toggleMenu(false); game.resetWorld() })
        this.setMuteIcon(game.audio.muted)

        // Location list in the menu
        const list = $('.menu-locations')
        list.innerHTML = ''
        for(const area of game.areas.items)
        {
            const item = document.createElement('li')
            const button = document.createElement('button')
            button.type = 'button'
            button.innerHTML = `<span>${area.title}</span><small>Drive there</small>`
            button.addEventListener('click', () =>
            {
                this.toggleMenu(false)
                game.teleport(area, true)
            })
            item.append(button)
            list.append(item)
        }
    }

    setProgress(value, label)
    {
        this.progressBar.style.transform = `scaleX(${value})`
        if(label) this.progressLabel.textContent = label
        if(value >= 1)
        {
            this.loader.classList.add('is-ready')
            this.startButton.disabled = false
            this.startButton.focus({ preventScroll: true })
        }
    }

    startFromKeyboard()
    {
        if(!this.startButton.disabled) this.start()
    }

    start()
    {
        if(!this.game || this.game.state !== 'intro') return
        this.loader.classList.add('is-hidden')
        document.body.classList.add('is-started')
        this.startButton.blur()
        this.game.start()
        setTimeout(() => this.loader.remove(), 1200)
    }

    showError(message)
    {
        this.loader.classList.add('is-error')
        this.progressLabel.textContent = message
        this.startButton.hidden = true
    }

    showPrompt(area)
    {
        if(area)
        {
            this.prompt.querySelector('.prompt-title').textContent = area.title
            this.prompt.classList.add('is-visible')
        }
        else
        {
            this.prompt.classList.remove('is-visible')
        }
    }

    openPanel(key, onClose)
    {
        this.panelContent.innerHTML = getSectionHtml(key)
        this.panel.classList.remove('is-wide')
        this.showPanel(onClose)
    }

    openResume()
    {
        if(this.game && this.game.state === 'panel') this.game.closePanel()
        this.panelContent.innerHTML = getResumeHtml()
        this.panel.classList.add('is-wide')
        this.showPanel(null)
        if(this.game && this.game.controls) this.game.controls.enabled = false
    }

    showPanel(onClose)
    {
        this.onPanelClose = onClose
        this.panel.classList.add('is-open')
        this.panel.setAttribute('aria-hidden', 'false')
        this.panelContent.scrollTop = 0
        setTimeout(() => $('.panel-close').focus({ preventScroll: true, focusVisible: false }), 50)
    }

    closePanel(fromUser = false)
    {
        if(!this.panel.classList.contains('is-open')) return
        this.panel.classList.remove('is-open')
        this.panel.setAttribute('aria-hidden', 'true')
        if(document.activeElement) document.activeElement.blur()
        const callback = this.onPanelClose
        this.onPanelClose = null
        if(fromUser && callback) callback()
        if(this.game && this.game.controls && this.game.state !== 'intro') this.game.controls.enabled = true
    }

    isPanelOpen()
    {
        return this.panel.classList.contains('is-open')
    }

    isHelpOpen()
    {
        return this.help.classList.contains('is-open')
    }

    toggleMenu(force = null)
    {
        const open = force ?? !this.menu.classList.contains('is-open')
        this.menu.classList.toggle('is-open', open)
        this.menu.setAttribute('aria-hidden', open ? 'false' : 'true')
        if(this.game && this.game.controls && this.game.state === 'driving')
            this.game.controls.enabled = !open
        if(open) this.menu.querySelector('button').focus({ preventScroll: true })
        else if(document.activeElement) document.activeElement.blur()
    }

    toggleHelp(force = null)
    {
        const open = force ?? !this.help.classList.contains('is-open')
        this.help.classList.toggle('is-open', open)
        if(!open && document.activeElement) document.activeElement.blur()
    }

    toast(html)
    {
        const element = document.createElement('div')
        element.className = 'toast'
        element.innerHTML = html
        this.toasts.append(element)
        requestAnimationFrame(() => element.classList.add('is-visible'))
        setTimeout(() =>
        {
            element.classList.remove('is-visible')
            setTimeout(() => element.remove(), 400)
        }, 3200)
    }

    fade(callback)
    {
        this.fadeElement.classList.add('is-visible')
        setTimeout(() =>
        {
            callback()
            setTimeout(() => this.fadeElement.classList.remove('is-visible'), 120)
        }, 320)
    }

    setDiscovered(count, total)
    {
        $('.discovered').textContent = `${count}/${total} places`
    }

    setMuteIcon(muted)
    {
        const button = $('.button-sound')
        button.textContent = muted ? '🔇' : '🔊'
        button.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound')
    }

    setViewIcon(mode)
    {
        const button = $('.button-view')
        const firstPerson = mode === 'firstPerson'
        button.textContent = firstPerson ? '🗺️' : '👁️'
        button.setAttribute('aria-label', firstPerson ? 'Switch to top-down view' : 'Switch to first-person view')
        button.setAttribute('aria-pressed', firstPerson ? 'true' : 'false')
    }

    setWeatherIcon(mode, auto)
    {
        const button = $('.button-weather')
        const icons = { clear: '🌤️', rain: '🌧️', snow: '❄️' }
        const names = { clear: 'clear', rain: 'rain', snow: 'snow' }
        button.textContent = auto ? '🌦️' : icons[mode]
        button.classList.toggle('is-auto', auto)
        button.setAttribute('aria-label', auto ? `Weather: auto (currently ${names[mode]}). Click to change` : `Weather: ${names[mode]}. Click to change`)
    }

    setTimeIcon(isDay)
    {
        const button = $('.button-time')
        button.textContent = isDay ? '🌙' : '☀️'
        button.setAttribute('aria-label', isDay ? 'Switch to night' : 'Switch to day')
    }
}
