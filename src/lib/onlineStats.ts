/**
 * OnlineStats - модуль для онлайн-вычисления статистических метрик
 *
 * Использует алгоритм P² (Piecewise-Parabolic Percentile) для приближённого
 * вычисления перцентилей без хранения всех данных.
 *
 * Ссылка на оригинальную статью:
 * Jain, R., & Chlamtac, I. (1985). The P² algorithm for dynamic calculation
 * of quantiles and histograms without storing observations.
 * Communications of the ACM, 28(10), 1076-1085.
 */

/**
 * Сериализованное состояние P2Percentile
 */
interface P2PercentileSnapshot {
  p: number;
  count: number;
  n: number[];
  q: number[];
  nPrime: number[];
}

/**
 * Класс для онлайн-вычисления одного перцентиля по алгоритму P².
 * Использует 5 маркеров для аппроксимации распределения.
 */
class P2Percentile {
  private readonly p: number; // целевой перцентиль (0-1)
  private count: number = 0;

  // Позиции маркеров (n) и их значения (q)
  private n: number[] = [0, 0, 0, 0, 0];
  private q: number[] = [0, 0, 0, 0, 0];

  // Желаемые позиции маркеров (n')
  private nPrime: number[] = [0, 0, 0, 0, 0];

  // Приращения желаемых позиций (dn')
  private dnPrime: number[] = [0, 0, 0, 0, 0];

  constructor(percentile: number, snapshot?: P2PercentileSnapshot) {
    if (percentile < 0 || percentile > 1) {
      throw new Error('Percentile must be between 0 and 1');
    }
    this.p = percentile;

    // Инициализация приращений желаемых позиций
    this.dnPrime = [0, this.p / 2, this.p, (1 + this.p) / 2, 1];

    // Восстановление из snapshot
    if (snapshot) {
      this.count = snapshot.count;
      this.n = [...snapshot.n];
      this.q = [...snapshot.q];
      this.nPrime = [...snapshot.nPrime];
    }
  }

  /**
   * Сериализует состояние для сохранения
   */
  serialize(): P2PercentileSnapshot {
    return {
      p: this.p,
      count: this.count,
      n: [...this.n],
      q: [...this.q],
      nPrime: [...this.nPrime],
    };
  }

  /**
   * Добавляет новое значение и обновляет оценку перцентиля
   */
  add(x: number): void {
    this.count++;

    if (this.count <= 5) {
      // Фаза инициализации: собираем первые 5 значений
      this.q[this.count - 1] = x;

      if (this.count === 5) {
        // Сортируем и инициализируем маркеры
        this.q.sort((a, b) => a - b);
        for (let i = 0; i < 5; i++) {
          this.n[i] = i;
          this.nPrime[i] = i;
        }
      }
      return;
    }

    // Основная фаза алгоритма P²
    let k = -1;

    // Находим ячейку k, в которую попадает новое значение
    if (x < this.q[0]) {
      this.q[0] = x;
      k = 0;
    } else if (x >= this.q[4]) {
      this.q[4] = x;
      k = 3;
    } else {
      for (let i = 1; i < 5; i++) {
        if (x < this.q[i]) {
          k = i - 1;
          break;
        }
      }
    }

    // Увеличиваем позиции маркеров правее k
    for (let i = k + 1; i < 5; i++) {
      this.n[i]++;
    }

    // Обновляем желаемые позиции
    for (let i = 0; i < 5; i++) {
      this.nPrime[i] += this.dnPrime[i];
    }

    // Корректируем средние маркеры (1, 2, 3)
    for (let i = 1; i < 4; i++) {
      const d = this.nPrime[i] - this.n[i];

      if (
        (d >= 1 && this.n[i + 1] - this.n[i] > 1) ||
        (d <= -1 && this.n[i - 1] - this.n[i] < -1)
      ) {
        const dSign = d >= 0 ? 1 : -1;
        const qNew = this.parabolic(i, dSign);

        if (this.q[i - 1] < qNew && qNew < this.q[i + 1]) {
          this.q[i] = qNew;
        } else {
          // Линейная интерполяция
          this.q[i] = this.linear(i, dSign);
        }
        this.n[i] += dSign;
      }
    }
  }

  /**
   * Параболическая интерполяция (P²)
   */
  private parabolic(i: number, d: number): number {
    const qi = this.q[i];
    const qim1 = this.q[i - 1];
    const qip1 = this.q[i + 1];
    const ni = this.n[i];
    const nim1 = this.n[i - 1];
    const nip1 = this.n[i + 1];

    const term1 = d / (nip1 - nim1);
    const term2 =
      ((ni - nim1 + d) * (qip1 - qi)) / (nip1 - ni) +
      ((nip1 - ni - d) * (qi - qim1)) / (ni - nim1);

    return qi + term1 * term2;
  }

  /**
   * Линейная интерполяция (запасной вариант)
   */
  private linear(i: number, d: number): number {
    const j = i + d;
    return (
      this.q[i] +
      (d * (this.q[j] - this.q[i])) / (this.n[j] - this.n[i])
    );
  }

  /**
   * Возвращает текущую оценку перцентиля
   */
  getValue(): number | null {
    if (this.count < 5) {
      // Недостаточно данных для оценки
      if (this.count === 0) return null;

      // Возвращаем точное значение из отсортированных данных
      const sorted = this.q.slice(0, this.count).sort((a, b) => a - b);
      const index = Math.floor(this.p * (this.count - 1));
      return sorted[index];
    }
    return this.q[2]; // Центральный маркер содержит оценку перцентиля
  }

  /**
   * Возвращает количество обработанных значений
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Сбрасывает состояние
   */
  reset(): void {
    this.count = 0;
    this.n = [0, 0, 0, 0, 0];
    this.q = [0, 0, 0, 0, 0];
    this.nPrime = [0, 0, 0, 0, 0];
  }
}

/**
 * Сериализованное состояние OnlineStats для сохранения и восстановления
 */
export interface OnlineStatsSnapshot {
  version: 1;
  count: number;
  min: number | null;
  max: number | null;
  p10: P2PercentileSnapshot;
  p25: P2PercentileSnapshot;
  p50: P2PercentileSnapshot;
  p75: P2PercentileSnapshot;
  p90: P2PercentileSnapshot;
}

/**
 * Результат вычисления метрик
 */
export interface StatsResult {
  /** Количество обработанных значений */
  count: number;
  /** Абсолютный минимум */
  min: number | null;
  /** Абсолютный максимум */
  max: number | null;
  /** 10-й перцентиль */
  p10: number | null;
  /** 25-й перцентиль (нижний квартиль) */
  p25: number | null;
  /** 50-й перцентиль (медиана) */
  median: number | null;
  /** 75-й перцентиль (верхний квартиль) */
  p75: number | null;
  /** 90-й перцентиль */
  p90: number | null;
}

/**
 * Класс для онлайн-вычисления набора статистических метрик.
 *
 * Вычисляет:
 * - Абсолютный минимум и максимум (точные значения)
 * - 10-й, 25-й, 50-й, 75-й, 90-й перцентили (приближённые, алгоритм P²)
 *
 * @example
 * ```typescript
 * const stats = new OnlineStats();
 *
 * // Добавляем значения времени ответа API
 * stats.add(120);
 * stats.add(150);
 * stats.add(200);
 * stats.add(180);
 * stats.add(95);
 *
 * // Получаем текущие метрики
 * const metrics = stats.getStats();
 * console.log(`Медиана: ${metrics.median}ms`);
 * console.log(`90-й перцентиль: ${metrics.p90}ms`);
 *
 * // Сохранение состояния
 * const snapshot = stats.serialize();
 * localStorage.setItem('apiStats', JSON.stringify(snapshot));
 *
 * // Восстановление состояния
 * const saved = JSON.parse(localStorage.getItem('apiStats')!);
 * const restoredStats = OnlineStats.fromSnapshot(saved);
 * ```
 */
export class OnlineStats {
  private count: number = 0;
  private min: number | null = null;
  private max: number | null = null;

  // P² экземпляры для каждого перцентиля
  private readonly p10: P2Percentile;
  private readonly p25: P2Percentile;
  private readonly p50: P2Percentile;
  private readonly p75: P2Percentile;
  private readonly p90: P2Percentile;

  constructor(snapshot?: OnlineStatsSnapshot) {
    if (snapshot) {
      // Восстановление из сохранённого состояния
      this.count = snapshot.count;
      this.min = snapshot.min;
      this.max = snapshot.max;
      this.p10 = new P2Percentile(0.1, snapshot.p10);
      this.p25 = new P2Percentile(0.25, snapshot.p25);
      this.p50 = new P2Percentile(0.5, snapshot.p50);
      this.p75 = new P2Percentile(0.75, snapshot.p75);
      this.p90 = new P2Percentile(0.9, snapshot.p90);
    } else {
      this.p10 = new P2Percentile(0.1);
      this.p25 = new P2Percentile(0.25);
      this.p50 = new P2Percentile(0.5);
      this.p75 = new P2Percentile(0.75);
      this.p90 = new P2Percentile(0.9);
    }
  }

  /**
   * Создаёт экземпляр OnlineStats из сохранённого состояния.
   *
   * @param snapshot - сериализованное состояние
   * @returns восстановленный экземпляр OnlineStats
   *
   * @example
   * ```typescript
   * const saved = JSON.parse(localStorage.getItem('stats')!);
   * const stats = OnlineStats.fromSnapshot(saved);
   * ```
   */
  static fromSnapshot(snapshot: OnlineStatsSnapshot): OnlineStats {
    if (snapshot.version !== 1) {
      throw new Error(`Unsupported snapshot version: ${snapshot.version}`);
    }
    return new OnlineStats(snapshot);
  }

  /**
   * Сериализует текущее состояние для сохранения.
   * Возвращает объект, который можно сохранить в localStorage или отправить на сервер.
   *
   * @returns сериализованное состояние
   *
   * @example
   * ```typescript
   * const snapshot = stats.serialize();
   * localStorage.setItem('apiStats', JSON.stringify(snapshot));
   * ```
   */
  serialize(): OnlineStatsSnapshot {
    return {
      version: 1,
      count: this.count,
      min: this.min,
      max: this.max,
      p10: this.p10.serialize(),
      p25: this.p25.serialize(),
      p50: this.p50.serialize(),
      p75: this.p75.serialize(),
      p90: this.p90.serialize(),
    };
  }

  /**
   * Добавляет новое значение и обновляет все метрики.
   * Временная сложность: O(1)
   *
   * @param value - новое значение (например, время ответа в мс)
   */
  add(value: number): void {
    if (!Number.isFinite(value)) {
      throw new Error('Value must be a finite number');
    }

    this.count++;

    // Обновляем min/max (точные значения)
    if (this.min === null || value < this.min) {
      this.min = value;
    }
    if (this.max === null || value > this.max) {
      this.max = value;
    }

    // Обновляем перцентили (приближённые)
    this.p10.add(value);
    this.p25.add(value);
    this.p50.add(value);
    this.p75.add(value);
    this.p90.add(value);
  }

  /**
   * Добавляет массив значений.
   *
   * @param values - массив значений
   */
  addBatch(values: number[]): void {
    for (const value of values) {
      this.add(value);
    }
  }

  /**
   * Возвращает текущие значения всех метрик.
   *
   * @returns объект со всеми метриками
   */
  getStats(): StatsResult {
    return {
      count: this.count,
      min: this.min,
      max: this.max,
      p10: this.p10.getValue(),
      p25: this.p25.getValue(),
      median: this.p50.getValue(),
      p75: this.p75.getValue(),
      p90: this.p90.getValue(),
    };
  }

  /**
   * Возвращает количество обработанных значений.
   */
  getCount(): number {
    return this.count;
  }

  /**
   * Возвращает абсолютный минимум.
   */
  getMin(): number | null {
    return this.min;
  }

  /**
   * Возвращает абсолютный максимум.
   */
  getMax(): number | null {
    return this.max;
  }

  /**
   * Возвращает указанный перцентиль.
   *
   * @param percentile - перцентиль (10, 25, 50, 75 или 90)
   * @returns значение перцентиля или null
   */
  getPercentile(percentile: 10 | 25 | 50 | 75 | 90): number | null {
    switch (percentile) {
      case 10:
        return this.p10.getValue();
      case 25:
        return this.p25.getValue();
      case 50:
        return this.p50.getValue();
      case 75:
        return this.p75.getValue();
      case 90:
        return this.p90.getValue();
    }
  }

  /**
   * Возвращает медиану (50-й перцентиль).
   */
  getMedian(): number | null {
    return this.p50.getValue();
  }

  /**
   * Возвращает межквартильный размах (IQR = Q3 - Q1).
   */
  getIQR(): number | null {
    const q1 = this.p25.getValue();
    const q3 = this.p75.getValue();
    if (q1 === null || q3 === null) return null;
    return q3 - q1;
  }

  /**
   * Сбрасывает все метрики в начальное состояние.
   */
  reset(): void {
    this.count = 0;
    this.min = null;
    this.max = null;
    this.p10.reset();
    this.p25.reset();
    this.p50.reset();
    this.p75.reset();
    this.p90.reset();
  }

  /**
   * Возвращает строковое представление текущих метрик.
   */
  toString(): string {
    const stats = this.getStats();
    if (stats.count === 0) {
      return 'OnlineStats: no data';
    }

    const format = (v: number | null): string =>
      v !== null ? v.toFixed(2) : 'N/A';

    return [
      `OnlineStats (n=${stats.count}):`,
      `  Min: ${format(stats.min)}`,
      `  P10: ${format(stats.p10)}`,
      `  Q1 (P25): ${format(stats.p25)}`,
      `  Median: ${format(stats.median)}`,
      `  Q3 (P75): ${format(stats.p75)}`,
      `  P90: ${format(stats.p90)}`,
      `  Max: ${format(stats.max)}`,
    ].join('\n');
  }
}

export default OnlineStats;
