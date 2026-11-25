import './style.css'
import { UI } from './ui/UI.js'
import { Game } from './game/Game.js'

const ui = new UI()

function hasWebGL()
{
    try
    {
        const canvas = document.createElement('canvas')
        return !!(window.WebGLRenderingContext && (canvas.getContext('webgl2') || canvas.getContext('webgl')))
    }
    catch
    {
        return false
    }
}

async function boot()
{
    if(!hasWebGL())
    {
        ui.showError('Your browser cannot display the 3D city. You can still read everything as a résumé.')
        return
    }

    const game = new Game(ui)
    try
    {
        await game.init()
        window.game = import.meta.env.DEV ? game : undefined
    }
    catch(error)
    {
        console.error(error)
        ui.showError('Something went wrong while building the city. You can still read everything as a résumé.')
    }
}

boot()
