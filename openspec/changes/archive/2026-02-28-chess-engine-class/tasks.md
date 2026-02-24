## 1. Types — расширение GameState

- [x] 1.1 Добавить интерфейс `GameState` в `src/chess/types.ts` (board, activeColor, castlingRights, enPassantSquare, halfmoveClock, fullmoveNumber)
- [x] 1.2 Добавить хелпер `getStartingGameState(): GameState` — возвращает стандартную начальную позицию со всеми полями FEN

## 2. Rules — расширение getLegalMoves до полных правил

- [x] 2.1 Изменить сигнатуру `getLegalMoves(state: GameState, fromIndex: number)` и обновить внутренние вызовы
- [x] 2.2 Добавить en passant в `getPawnMoves` — использовать `state.enPassantSquare`
- [x] 2.3 Добавить промоушен в `getPawnMoves` — при достижении последнего ранга возвращать ход как promotion-кандидат
- [x] 2.4 Добавить рокировку в `getKingMoves` — kingside и queenside, используя `state.castlingRights`
- [x] 2.5 Реализовать `isSquareAttacked(board: Board, squareIndex: number, byColor: PieceColor): boolean` — проверка атаки на клетку
- [x] 2.6 Реализовать фильтрацию шахов — для каждого pseudo-legal хода проверить, не остаётся ли свой король под шахом, отфильтровать невалидные
- [x] 2.7 Реализовать `isInCheck(state: GameState, color: PieceColor): boolean`
- [x] 2.8 Реализовать `isCheckmate(state: GameState, color: PieceColor): boolean`
- [x] 2.9 Реализовать `isStalemate(state: GameState, color: PieceColor): boolean`

## 3. Rules — адаптация существующих вызовов

- [x] 3.1 Обновить `ChessBoard.tsx` — передавать `GameState` вместо `Board` в `getLegalMoves`

## 4. Engine — класс ChessEngine

- [x] 4.1 Создать файл `src/chess/engine.ts` со скелетом класса `ChessEngine` (конструктор, внутренний `GameState`, массив `MoveRecord[]`)
- [x] 4.2 Реализовать `reset(fisher?: boolean)` — стандартный reset и Chess960 (рандомизация back rank: король между ладьями, слоны на разноцветных полях)
- [x] 4.3 Реализовать `getFEN(): string` — конвертация внутреннего `GameState` в FEN-строку (все 6 полей)
- [x] 4.4 Реализовать `setFEN(fen: string): void` — парсинг FEN в `GameState`, валидация формата, сброс истории
- [x] 4.5 Реализовать `moveUCI(uci: string)` — парсинг UCI (4-5 символов), проверка activeColor, вызов `getLegalMoves`, обновление GameState (castling rights, en passant, halfmove clock, fullmove number), запись в историю, возврат Result
- [x] 4.6 Реализовать `getSAN(): string[]` — конвертация массива `MoveRecord[]` в SAN (piece letters, disambiguация, captures x, castling O-O/O-O-O, promotion =Q, check +, checkmate #)

## 5. Тесты

- [x] 5.1 Тесты для `GameState` и `getStartingGameState`
- [x] 5.2 Тесты для расширенного `getLegalMoves` — en passant, рокировка, промоушен, фильтрация шахов, пины
- [x] 5.3 Тесты для `isInCheck`, `isCheckmate`, `isStalemate` — известные позиции
- [x] 5.4 Тесты для `ChessEngine` — reset (стандартный + Chess960), getFEN/setFEN round-trip, moveUCI (легальные, нелегальные, castling, promotion), getSAN конвертация
