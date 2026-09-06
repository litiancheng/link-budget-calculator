import assert from 'node:assert/strict'
import test from 'node:test'
import { createPageScrollGuard, type PageScrollPosition } from '../src/ui/pageScrollGuard.ts'

test('restores the page position after table-cell focus changes it', () => {
  const cellEvent = {} as Event
  const otherEvent = {} as Event
  let position: PageScrollPosition = { left: 12, top: 914 }
  const restored: PageScrollPosition[] = []
  const guard = createPageScrollGuard(
    (event) => event === cellEvent,
    () => position,
    (nextPosition) => {
      restored.push(nextPosition)
      position = nextPosition
    },
  )

  guard.capture(cellEvent)
  position = { left: 12, top: 1020.6666870117188 }
  guard.restore(cellEvent)

  assert.deepEqual(restored, [{ left: 12, top: 914 }])
  assert.deepEqual(position, { left: 12, top: 914 })

  guard.capture(otherEvent)
  position = { left: 12, top: 800 }
  guard.restore(otherEvent)
  assert.deepEqual(restored, [{ left: 12, top: 914 }])
})

test('does not write a scroll position when focus did not move the page', () => {
  const cellEvent = {} as Event
  const position = { left: 0, top: 240 }
  const restored: PageScrollPosition[] = []
  const guard = createPageScrollGuard(
    () => true,
    () => position,
    (nextPosition) => restored.push(nextPosition),
  )

  guard.capture(cellEvent)
  guard.restore(cellEvent)

  assert.deepEqual(restored, [])
})

test('keeps the first position across a rapid double-click sequence', () => {
  const cellEvent = {} as Event
  let position: PageScrollPosition = { left: 0, top: 914 }
  const restored: PageScrollPosition[] = []
  const guard = createPageScrollGuard(
    () => true,
    () => position,
    (nextPosition) => {
      restored.push(nextPosition)
      position = nextPosition
    },
  )

  guard.capture(cellEvent)
  position = { left: 0, top: 1130 }
  guard.capture(cellEvent)
  guard.restore(cellEvent)

  assert.deepEqual(restored, [{ left: 0, top: 914 }])
})

test('keeps the captured position available while an editor is opening', () => {
  const cellEvent = {} as Event
  let position: PageScrollPosition = { left: 0, top: 350 }
  const guard = createPageScrollGuard(
    () => true,
    () => position,
    (nextPosition) => {
      position = nextPosition
    },
  )

  guard.capture(cellEvent)
  position = { left: 0, top: 636 }

  assert.deepEqual(guard.getPendingPosition(), { left: 0, top: 350 })
  guard.restorePending()
  assert.deepEqual(position, { left: 0, top: 350 })
})
