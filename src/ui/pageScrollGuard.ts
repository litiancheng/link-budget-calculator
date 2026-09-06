export type PageScrollPosition = Readonly<{
  left: number
  top: number
}>

type EventTargetMatcher = (event: Event) => boolean
type ScrollPositionReader = () => PageScrollPosition
type ScrollPositionWriter = (position: PageScrollPosition) => void

const CLICK_SEQUENCE_WINDOW_MS = 500

export function createPageScrollGuard(
  matchesTarget: EventTargetMatcher,
  readPosition: ScrollPositionReader,
  writePosition: ScrollPositionWriter,
) {
  let pendingPosition: PageScrollPosition | null = null
  let lastCapturedAt = Number.NEGATIVE_INFINITY

  return {
    capture(event: Event) {
      if (matchesTarget(event)) {
        const now = Date.now()
        if (now - lastCapturedAt > CLICK_SEQUENCE_WINDOW_MS) {
          pendingPosition = readPosition()
        }
        lastCapturedAt = now
      }
    },

    restore(event: Event) {
      if (!matchesTarget(event)) return

      const position = pendingPosition
      if (!position) return

      const currentPosition = readPosition()
      if (currentPosition.left !== position.left || currentPosition.top !== position.top) {
        writePosition(position)
      }
    },

    restorePending() {
      const position = pendingPosition
      if (!position) return

      const currentPosition = readPosition()
      if (currentPosition.left !== position.left || currentPosition.top !== position.top) {
        writePosition(position)
      }
    },

    reset() {
      pendingPosition = null
      lastCapturedAt = Number.NEGATIVE_INFINITY
    },
  }
}
