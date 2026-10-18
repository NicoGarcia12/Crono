import { shouldRelock } from '@/app/_layout';

describe('shouldRelock', () => {
  it('no re-bloquea si nunca pasó a segundo plano', () => {
    expect(shouldRelock(null, Date.now())).toBe(false);
  });

  it('no re-bloquea si volvió dentro del período de gracia', () => {
    const backgroundedAt = 1_000;
    expect(shouldRelock(backgroundedAt, backgroundedAt + 119_000)).toBe(false);
  });

  it('re-bloquea si volvió después de superar el período de gracia', () => {
    const backgroundedAt = 1_000;
    expect(shouldRelock(backgroundedAt, backgroundedAt + 120_001)).toBe(true);
  });
});
