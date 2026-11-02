import { createApp } from 'vue'
import { paintSheet } from 'orkami/css'
import { plugin } from 'orkami/vue'
import 'orkami/orkami.css'
import './playground.css'
import App from './App.vue'

// The page's paper is the example sheet in the page's own tokens; a scheme change repaints it
paintSheet()
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => paintSheet())

createApp(App).use(plugin).mount('#app')
