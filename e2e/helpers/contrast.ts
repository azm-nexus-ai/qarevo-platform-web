import { expect, type Locator } from '@playwright/test'

/** WCAG text contrast against the composited surface of an enabled control. */
export async function expectEnabledControlContrast(control: Locator, minimum = 4.5) {
  await expect(control).toBeEnabled()
  const ratio = await control.evaluate(element => {
    const color = (css: string): number[] => {
      const channels = css.match(/[\d.]+/g)?.map(Number)
      if (!/^rgba?\(/.test(css) || !channels || channels.length < 3) throw new Error(`Unsupported computed color: ${css}`)
      return [...channels.slice(0, 3), channels[3] ?? 1]
    }
    const over = (foreground: number[], background: number[]) => foreground.slice(0, 3).map((value, index) => value * foreground[3] + background[index] * (1 - foreground[3]))
    const ancestors: Element[] = []
    for (let node: Element | null = element; node; node = node.parentElement) ancestors.unshift(node)
    let background = [255, 255, 255]
    for (const node of ancestors) background = over(color(getComputedStyle(node).backgroundColor), background)
    const foreground = over(color(getComputedStyle(element).color), background)
    const luminance = (rgb: number[]) => {
      const channels = rgb.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4 })
      return .2126 * channels[0] + .7152 * channels[1] + .0722 * channels[2]
    }
    const a = luminance(foreground), b = luminance(background)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  })
  expect(ratio, `Enabled control text contrast must be at least ${minimum}:1`).toBeGreaterThanOrEqual(minimum)
}
