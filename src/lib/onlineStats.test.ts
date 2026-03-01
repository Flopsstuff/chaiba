import { OnlineStats, StatsResult, OnlineStatsSnapshot } from './onlineStats';

/**
 * Вычисляет точный перцентиль для массива значений (для сравнения с P²)
 */
function exactPercentile(values: number[], p: number): number {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const index = p * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) {
    return sorted[lower];
  }
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

describe('OnlineStats', () => {
  let stats: OnlineStats;

  beforeEach(() => {
    stats = new OnlineStats();
  });

  describe('empty state', () => {
    it('should return null values when no data added', () => {
      const result = stats.getStats();

      expect(result.count).toBe(0);
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
      expect(result.median).toBeNull();
    });

    it('should return "no data" in toString()', () => {
      expect(stats.toString()).toBe('OnlineStats: no data');
    });
  });

  describe('min/max tracking', () => {
    it('should track exact min and max values', () => {
      const values = [50, 20, 80, 10, 90, 30, 70];
      values.forEach((v) => stats.add(v));

      expect(stats.getMin()).toBe(10);
      expect(stats.getMax()).toBe(90);
    });

    it('should handle single value', () => {
      stats.add(42);

      expect(stats.getMin()).toBe(42);
      expect(stats.getMax()).toBe(42);
    });

    it('should handle identical values', () => {
      for (let i = 0; i < 10; i++) {
        stats.add(100);
      }

      expect(stats.getMin()).toBe(100);
      expect(stats.getMax()).toBe(100);
    });

    it('should handle negative values', () => {
      stats.addBatch([-50, -20, 0, 30, -100]);

      expect(stats.getMin()).toBe(-100);
      expect(stats.getMax()).toBe(30);
    });
  });

  describe('percentile estimation with small datasets', () => {
    it('should handle less than 5 values', () => {
      stats.add(10);
      stats.add(20);
      stats.add(30);

      const result = stats.getStats();
      expect(result.count).toBe(3);
      expect(result.min).toBe(10);
      expect(result.max).toBe(30);
      // С малым количеством данных перцентили возвращают приближённые значения
      expect(result.median).not.toBeNull();
    });

    it('should work with exactly 5 values', () => {
      const values = [10, 30, 50, 70, 90];
      stats.addBatch(values);

      const result = stats.getStats();
      expect(result.count).toBe(5);
      expect(result.min).toBe(10);
      expect(result.max).toBe(90);
      expect(result.median).toBe(50);
    });
  });

  describe('percentile estimation with larger datasets', () => {
    it('should estimate median within reasonable accuracy', () => {
      // Создаём равномерное распределение
      const values: number[] = [];
      for (let i = 1; i <= 100; i++) {
        values.push(i);
      }

      // Перемешиваем для реалистичности
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }

      stats.addBatch(values);

      const median = stats.getMedian();
      const exactMedian = exactPercentile(values, 0.5);

      // P² даёт приближённое значение, допускаем погрешность 10%
      expect(median).not.toBeNull();
      expect(Math.abs(median! - exactMedian)).toBeLessThan(exactMedian * 0.1);
    });

    it('should estimate all percentiles for normal-like distribution', () => {
      // Генерируем псевдо-нормальное распределение (сумма равномерных)
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        // Box-Muller approximation
        const sum =
          Math.random() +
          Math.random() +
          Math.random() +
          Math.random() +
          Math.random() +
          Math.random();
        const normal = (sum - 3) * 50 + 100; // mean=100, approx std=50
        values.push(normal);
      }

      stats.addBatch(values);

      const result = stats.getStats();

      // Проверяем, что перцентили упорядочены
      expect(result.p10!).toBeLessThanOrEqual(result.p25!);
      expect(result.p25!).toBeLessThanOrEqual(result.median!);
      expect(result.median!).toBeLessThanOrEqual(result.p75!);
      expect(result.p75!).toBeLessThanOrEqual(result.p90!);

      // Проверяем границы
      expect(result.min!).toBeLessThanOrEqual(result.p10!);
      expect(result.p90!).toBeLessThanOrEqual(result.max!);
    });

    it('should handle real-world API response times scenario', () => {
      // Симуляция времени ответа API: большинство быстрые, некоторые медленные
      const values: number[] = [];

      // 80% быстрых ответов (50-200ms)
      for (let i = 0; i < 800; i++) {
        values.push(50 + Math.random() * 150);
      }

      // 15% средних ответов (200-500ms)
      for (let i = 0; i < 150; i++) {
        values.push(200 + Math.random() * 300);
      }

      // 5% медленных ответов (500-2000ms)
      for (let i = 0; i < 50; i++) {
        values.push(500 + Math.random() * 1500);
      }

      // Перемешиваем
      for (let i = values.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [values[i], values[j]] = [values[j], values[i]];
      }

      stats.addBatch(values);

      const result = stats.getStats();

      // Медиана должна быть в районе быстрых ответов
      expect(result.median!).toBeGreaterThan(50);
      expect(result.median!).toBeLessThan(300);

      // P90 должен отражать медленные ответы
      expect(result.p90!).toBeGreaterThan(result.median!);
    });
  });

  describe('IQR calculation', () => {
    it('should calculate interquartile range', () => {
      // Простое распределение 1-100
      for (let i = 1; i <= 100; i++) {
        stats.add(i);
      }

      const iqr = stats.getIQR();
      expect(iqr).not.toBeNull();

      // IQR для равномерного распределения 1-100 примерно 50
      expect(iqr!).toBeGreaterThan(30);
      expect(iqr!).toBeLessThan(70);
    });

    it('should return zero IQR when single value', () => {
      stats.add(10);
      // С одним значением все перцентили равны этому значению, IQR = 0
      expect(stats.getIQR()).toBe(0);
    });

    it('should return null IQR when no data', () => {
      expect(stats.getIQR()).toBeNull();
    });
  });

  describe('getPercentile method', () => {
    beforeEach(() => {
      for (let i = 1; i <= 100; i++) {
        stats.add(i);
      }
    });

    it('should return specific percentiles', () => {
      expect(stats.getPercentile(10)).not.toBeNull();
      expect(stats.getPercentile(25)).not.toBeNull();
      expect(stats.getPercentile(50)).not.toBeNull();
      expect(stats.getPercentile(75)).not.toBeNull();
      expect(stats.getPercentile(90)).not.toBeNull();
    });

    it('should return same value as median for p50', () => {
      expect(stats.getPercentile(50)).toBe(stats.getMedian());
    });
  });

  describe('reset functionality', () => {
    it('should reset all metrics', () => {
      stats.addBatch([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

      expect(stats.getCount()).toBe(10);
      expect(stats.getMin()).toBe(10);

      stats.reset();

      expect(stats.getCount()).toBe(0);
      expect(stats.getMin()).toBeNull();
      expect(stats.getMax()).toBeNull();
      expect(stats.getMedian()).toBeNull();
    });

    it('should work correctly after reset', () => {
      stats.addBatch([100, 200, 300]);
      stats.reset();
      stats.addBatch([1, 2, 3, 4, 5]);

      expect(stats.getMin()).toBe(1);
      expect(stats.getMax()).toBe(5);
      expect(stats.getCount()).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should throw on non-finite values', () => {
      expect(() => stats.add(NaN)).toThrow('Value must be a finite number');
      expect(() => stats.add(Infinity)).toThrow('Value must be a finite number');
      expect(() => stats.add(-Infinity)).toThrow(
        'Value must be a finite number'
      );
    });
  });

  describe('toString formatting', () => {
    it('should format stats as readable string', () => {
      stats.addBatch([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

      const str = stats.toString();

      expect(str).toContain('OnlineStats (n=10)');
      expect(str).toContain('Min:');
      expect(str).toContain('Max:');
      expect(str).toContain('Median:');
      expect(str).toContain('P10:');
      expect(str).toContain('P90:');
    });
  });

  describe('accuracy benchmark', () => {
    it('should achieve < 5% relative error for large datasets', () => {
      const values: number[] = [];
      for (let i = 0; i < 10000; i++) {
        values.push(Math.random() * 1000);
      }

      stats.addBatch(values);

      const result = stats.getStats();
      const percentiles = [
        { p: 0.1, estimated: result.p10!, name: 'P10' },
        { p: 0.25, estimated: result.p25!, name: 'P25' },
        { p: 0.5, estimated: result.median!, name: 'Median' },
        { p: 0.75, estimated: result.p75!, name: 'P75' },
        { p: 0.9, estimated: result.p90!, name: 'P90' },
      ];

      for (const { p, estimated, name } of percentiles) {
        const exact = exactPercentile(values, p);
        const relativeError = Math.abs(estimated - exact) / exact;

        // P² алгоритм должен давать < 5% погрешности на больших данных
        expect(relativeError).toBeLessThan(0.05);
      }
    });
  });

  describe('serialization and restoration', () => {
    it('should serialize to a valid snapshot', () => {
      stats.addBatch([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

      const snapshot = stats.serialize();

      expect(snapshot.version).toBe(1);
      expect(snapshot.count).toBe(10);
      expect(snapshot.min).toBe(10);
      expect(snapshot.max).toBe(100);
      expect(snapshot.p10).toBeDefined();
      expect(snapshot.p25).toBeDefined();
      expect(snapshot.p50).toBeDefined();
      expect(snapshot.p75).toBeDefined();
      expect(snapshot.p90).toBeDefined();
    });

    it('should restore from snapshot with identical stats', () => {
      stats.addBatch([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);

      const snapshot = stats.serialize();
      const restored = OnlineStats.fromSnapshot(snapshot);

      const originalStats = stats.getStats();
      const restoredStats = restored.getStats();

      expect(restoredStats.count).toBe(originalStats.count);
      expect(restoredStats.min).toBe(originalStats.min);
      expect(restoredStats.max).toBe(originalStats.max);
      expect(restoredStats.p10).toBe(originalStats.p10);
      expect(restoredStats.p25).toBe(originalStats.p25);
      expect(restoredStats.median).toBe(originalStats.median);
      expect(restoredStats.p75).toBe(originalStats.p75);
      expect(restoredStats.p90).toBe(originalStats.p90);
    });

    it('should continue adding values after restoration', () => {
      stats.addBatch([10, 20, 30, 40, 50]);

      const snapshot = stats.serialize();
      const restored = OnlineStats.fromSnapshot(snapshot);

      // Добавляем новые значения
      restored.addBatch([60, 70, 80, 90, 100]);

      expect(restored.getCount()).toBe(10);
      expect(restored.getMin()).toBe(10);
      expect(restored.getMax()).toBe(100);
    });

    it('should be JSON-serializable', () => {
      stats.addBatch([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000]);

      const snapshot = stats.serialize();
      const json = JSON.stringify(snapshot);
      const parsed = JSON.parse(json) as OnlineStatsSnapshot;
      const restored = OnlineStats.fromSnapshot(parsed);

      expect(restored.getCount()).toBe(stats.getCount());
      expect(restored.getMin()).toBe(stats.getMin());
      expect(restored.getMax()).toBe(stats.getMax());
      expect(restored.getMedian()).toBe(stats.getMedian());
    });

    it('should restore empty stats', () => {
      const snapshot = stats.serialize();
      const restored = OnlineStats.fromSnapshot(snapshot);

      expect(restored.getCount()).toBe(0);
      expect(restored.getMin()).toBeNull();
      expect(restored.getMax()).toBeNull();
    });

    it('should throw on unsupported snapshot version', () => {
      const invalidSnapshot = {
        version: 99,
        count: 0,
        min: null,
        max: null,
        p10: { p: 0.1, count: 0, n: [], q: [], nPrime: [] },
        p25: { p: 0.25, count: 0, n: [], q: [], nPrime: [] },
        p50: { p: 0.5, count: 0, n: [], q: [], nPrime: [] },
        p75: { p: 0.75, count: 0, n: [], q: [], nPrime: [] },
        p90: { p: 0.9, count: 0, n: [], q: [], nPrime: [] },
      } as unknown as OnlineStatsSnapshot;

      expect(() => OnlineStats.fromSnapshot(invalidSnapshot)).toThrow(
        'Unsupported snapshot version: 99'
      );
    });

    it('should maintain accuracy after serialization with large dataset', () => {
      const values: number[] = [];
      for (let i = 0; i < 1000; i++) {
        values.push(Math.random() * 1000);
      }

      stats.addBatch(values);
      const snapshot = stats.serialize();
      const restored = OnlineStats.fromSnapshot(snapshot);

      // Добавляем ещё данные
      const moreValues: number[] = [];
      for (let i = 0; i < 1000; i++) {
        moreValues.push(Math.random() * 1000);
      }

      stats.addBatch(moreValues);
      restored.addBatch(moreValues);

      // Оба экземпляра должны давать одинаковые результаты
      expect(restored.getCount()).toBe(stats.getCount());
      expect(restored.getMin()).toBe(stats.getMin());
      expect(restored.getMax()).toBe(stats.getMax());
      expect(restored.getMedian()).toBe(stats.getMedian());
    });

    it('should work with constructor parameter', () => {
      stats.addBatch([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
      const snapshot = stats.serialize();

      // Можно использовать как через конструктор, так и через fromSnapshot
      const restored1 = new OnlineStats(snapshot);
      const restored2 = OnlineStats.fromSnapshot(snapshot);

      expect(restored1.getStats()).toEqual(restored2.getStats());
    });
  });
});
