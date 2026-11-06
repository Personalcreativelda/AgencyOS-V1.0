import { test } from 'node:test'
import assert from 'node:assert/strict'
import { installNavigationGuard, type NavigationGuardState } from '../src/components/content/navigationGuard.ts'

function fixture() {
  const state: NavigationGuardState = { dirty: true, skip: false, committed: { index: 2, pathname: '/app/content/creative' } }
  const listeners: { type: string; fn: (event: any) => void; capture: boolean }[] = []
  const moves: number[] = []
  const navigated: string[] = []
  const questions: ((answer: boolean) => void)[] = []
  let routerPops = 0
  const browser = {
    location: { href: 'http://localhost/app/content/creative', pathname: '/app/content/creative' },
    history: { state: { idx: 2 }, go: (delta: number) => moves.push(delta) },
    addEventListener(type: string, fn: any, capture = false) { listeners.push({ type, fn, capture }) },
    removeEventListener(type: string, fn: any) { const index = listeners.findIndex(item => item.type === type && item.fn === fn); if (index >= 0) listeners.splice(index, 1) },
  }
  const navigator = {
    createHref: (to: any) => typeof to === 'string' ? to : to.pathname,
    push: (to: any) => { navigated.push(`push:${to}`) },
    replace: (to: any) => { navigated.push(`replace:${to}`) },
    go: (delta: number) => { moves.push(delta) },
  }
  const originalPush = navigator.push
  browser.addEventListener('popstate', () => { routerPops++ })
  const cleanup = installNavigationGuard(navigator as any, browser as any, state, () => new Promise(resolve => questions.push(resolve)))
  const dispatch = (type: string) => {
    let stopped = false
    let prevented = false
    const event = { stopImmediatePropagation() { stopped = true }, preventDefault() { prevented = true }, returnValue: undefined }
    for (const listener of [...listeners].sort((a, b) => Number(b.capture) - Number(a.capture))) {
      if (listener.type === type && !stopped) listener.fn(event)
    }
    return { stopped, prevented, event }
  }
  const pop = (index: number, pathname: string) => {
    browser.history.state.idx = index
    browser.location.pathname = pathname
    return dispatch('popstate')
  }
  const answer = async (value: boolean) => { questions.at(-1)!(value); await Promise.resolve(); await Promise.resolve() }
  return { state, navigator, browser, navigated, moves, questions, pop, dispatch, answer, cleanup, originalPush, routerPops: () => routerPops }
}

test('internal links keep the draft on cancellation and navigate only after confirmation', async () => {
  const f = fixture()
  f.navigator.push('/app/clients')
  assert.equal(f.questions.length, 1)
  assert.deepEqual(f.navigated, [])
  await f.answer(false)
  assert.deepEqual(f.navigated, [])
  f.navigator.push('/app/clients')
  await f.answer(true)
  assert.deepEqual(f.navigated, ['push:/app/clients'])
  f.cleanup()
})

test('clean drafts, same-path navigation and successful deletion bypass confirmation', () => {
  const f = fixture()
  f.navigator.push('/app/content/creative?preview=1')
  f.state.dirty = false
  f.navigator.push('/app/clients')
  f.state.dirty = true
  f.state.skip = true
  f.navigator.replace('/app/content')
  assert.equal(f.questions.length, 0)
  assert.equal(f.navigated.length, 3)
  f.cleanup()
})

test('native back restores the editor before asking and retains it after cancellation', async () => {
  const f = fixture()
  assert.equal(f.pop(1, '/app/content').stopped, true)
  assert.deepEqual(f.moves, [1])
  assert.equal(f.questions.length, 0)
  assert.equal(f.pop(2, '/app/content/creative').stopped, true)
  assert.equal(f.questions.length, 1)
  await f.answer(false)
  assert.equal(f.routerPops(), 0)
  assert.deepEqual(f.moves, [1])
  f.cleanup()
})

test('confirmed history navigation reaches the original target exactly once', async () => {
  const f = fixture()
  f.pop(0, '/app/dashboard')
  f.pop(2, '/app/content/creative')
  await f.answer(true)
  assert.deepEqual(f.moves, [2, -2])
  assert.equal(f.pop(0, '/app/dashboard').stopped, false)
  assert.equal(f.routerPops(), 1)
  f.cleanup()
})

test('router go and repeated link attempts share one confirmation at a time', async () => {
  const f = fixture()
  f.navigator.go(-1)
  f.navigator.push('/app/clients')
  assert.equal(f.questions.length, 1)
  assert.deepEqual(f.moves, [])
  await f.answer(true)
  assert.deepEqual(f.moves, [-1])
  assert.deepEqual(f.navigated, [])
  f.cleanup()
})

test('reload warning is limited to dirty drafts, and unmount restores the navigator/listeners', () => {
  const f = fixture()
  assert.equal(f.dispatch('beforeunload').prevented, true)
  f.state.dirty = false
  assert.equal(f.dispatch('beforeunload').prevented, false)
  f.cleanup()
  assert.equal(f.navigator.push, f.originalPush)
  f.state.dirty = true
  assert.equal(f.dispatch('beforeunload').prevented, false)
  assert.equal(f.pop(1, '/app/content').stopped, false)
})
