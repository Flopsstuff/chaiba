## Why

Текущая шахматная логика (`src/chess/rules.ts`, `src/chess/types.ts`) — набор stateless-функций без управления состоянием игры. Нет единого объекта, который хранит позицию, историю ходов, валидирует UCI-ввод и генерирует FEN/SAN. Агентам (AI-игрокам) нужен единый интерфейс для взаимодействия с доской через компонент Arena.

## What Changes

- Новый класс `ChessEngine` в `src/chess/` — инкапсулирует состояние доски, очередь хода, историю
- `reset(fisher?: boolean)` — сброс в начальную позицию (стандартную или Chess960/Fischer Random)
- `getFEN(): string` — текущая позиция в формате Forsyth–Edwards Notation
- `setFEN(fen: string): void` — установка позиции из FEN-строки
- `moveUCI(uci: string): { success: true } | { success: false, error: string }` — выполнение хода в UCI-формате с валидацией через существующую логику `getLegalMoves`
- Внутренний массив истории легальных ходов
- `getSAN(): string[]` — история ходов в Standard Algebraic Notation
- Расширение `getLegalMoves` в `rules.ts` до полных шахматных правил: проверка шаха, рокировка, взятие на проходе, превращение пешки
- Определение состояний партии: шах, мат, пат

## Capabilities

### New Capabilities
- `chess-engine`: Stateful шахматный движок — управление позицией (FEN), выполнение ходов (UCI) с валидацией, история ходов (SAN), поддержка Chess960
- `chess-rules`: Полная реализация шахматных правил — шах, рокировка, взятие на проходе, превращение, мат, пат

### Modified Capabilities
_(нет изменений в существующих спецификациях)_

## Impact

- **Новый файл**: `src/chess/engine.ts` — класс `ChessEngine`
- **Изменённый файл**: `src/chess/types.ts` — новый интерфейс `GameState` (board + activeColor + castlingRights + enPassantSquare + halfmoveClock + fullmoveNumber)
- **Изменённый файл**: `src/chess/rules.ts` — `getLegalMoves(state: GameState, fromIndex)` вместо `(board, fromIndex)`, полные правила (шах, рокировка, en passant, promotion). **BREAKING** — потребуется адаптация `ChessBoard.tsx`
- **Зависимости**: использует `Board`, `Piece`, `GameState`, `getStartingPosition` из `src/chess/types.ts` и `getLegalMoves` из `src/chess/rules.ts`
- **Интеграция**: будет подключаться к компоненту `Arena` (`src/components/panels/Arena.tsx`) и использоваться агентами (`src/agents/`)
- **Без внешних зависимостей**: реализация без сторонних шахматных библиотек
