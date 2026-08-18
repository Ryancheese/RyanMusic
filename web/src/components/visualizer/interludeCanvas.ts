/** Canvas 间奏正圆点：避免字体把 "." 渲成方块/椭圆/菱形 */
export const drawCanvasInterludeDots = (
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  options: {
    count?: number;
    radius: number;
    gap?: number;
    color: string;
    activeIndex?: number;
    activeColor?: string;
  },
) => {
  const count = options.count ?? 6;
  const gap = options.gap ?? options.radius * 2.4;
  const radius = Math.max(1, options.radius);
  const totalWidth = count * radius * 2 + (count - 1) * gap;
  let x = centerX - totalWidth / 2 + radius;

  for (let index = 0; index < count; index += 1) {
    const lit = typeof options.activeIndex === 'number' ? index <= options.activeIndex : true;
    const dim = typeof options.activeIndex === 'number';
    context.beginPath();
    context.arc(x, centerY, radius, 0, Math.PI * 2);
    context.closePath();
    context.fillStyle = lit && options.activeColor ? options.activeColor : options.color;
    context.globalAlpha = dim ? (lit ? 1 : 0.28) : 1;
    context.fill();
    x += radius * 2 + gap;
  }
  context.globalAlpha = 1;
};
