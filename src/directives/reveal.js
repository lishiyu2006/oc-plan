// v-reveal:元素进入视口时一次性淡入上移(IntersectionObserver)
const reveal = {
  mounted(el, binding) {
    el.classList.add('reveal-init')
    if (typeof binding.value === 'number') {
      el.style.transitionDelay = `${binding.value}ms`
    }
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('reveal-done')
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.classList.add('reveal-done')
            io.disconnect()
          }
        }
      },
      { threshold: 0.12 },
    )
    io.observe(el)
    el._revealIo = io
  },
  unmounted(el) {
    el._revealIo?.disconnect()
  },
}

export default reveal
