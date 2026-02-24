## ADDED Requirements

### Requirement: ChessEngine class
The system SHALL provide a `ChessEngine` class in `src/chess/engine.ts` that encapsulates game state, move history, and provides methods for game management. The class SHALL be plain TypeScript with no React dependencies.

#### Scenario: Create new engine instance
- **WHEN** `new ChessEngine()` is called
- **THEN** the engine SHALL initialize with the standard starting position and white to move

### Requirement: reset method
The system SHALL provide a `reset(fisher?: boolean)` method that resets the engine to an initial position. When `fisher` is falsy or omitted, it SHALL reset to the standard starting position. When `fisher` is true, it SHALL generate a valid Chess960 (Fischer Random) position.

#### Scenario: Reset to standard position
- **WHEN** `reset()` is called without arguments
- **THEN** the board SHALL be set to the standard starting position, white to move, all castling rights available, no en passant, clocks reset to 0/1

#### Scenario: Reset to Chess960 position
- **WHEN** `reset(true)` is called
- **THEN** the back rank SHALL be randomized following Chess960 rules: king between rooks, bishops on opposite-colored squares. Both sides SHALL have mirrored piece placement.

#### Scenario: Reset clears move history
- **WHEN** `reset()` is called after moves have been played
- **THEN** the internal move history SHALL be empty and `getSAN()` SHALL return an empty array

### Requirement: getFEN method
The system SHALL provide a `getFEN(): string` method that returns the current position in Forsyth–Edwards Notation. The FEN string SHALL contain all 6 fields: piece placement, active color, castling availability, en passant target, halfmove clock, fullmove number.

#### Scenario: Starting position FEN
- **WHEN** `getFEN()` is called on a freshly created or reset engine
- **THEN** it SHALL return `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`

#### Scenario: FEN after moves
- **WHEN** `getFEN()` is called after `moveUCI("e2e4")` from the starting position
- **THEN** it SHALL return a FEN reflecting the pawn on e4, black to move, en passant square e3

### Requirement: setFEN method
The system SHALL provide a `setFEN(fen: string): void` method that sets the full game state from a valid FEN string. It SHALL parse all 6 FEN fields and update the internal GameState accordingly. It SHALL clear the move history.

#### Scenario: Set valid FEN
- **WHEN** `setFEN("rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1")` is called
- **THEN** the board SHALL reflect a pawn on e4, active color black, en passant on e3

#### Scenario: Set FEN clears history
- **WHEN** `setFEN` is called after moves have been played
- **THEN** `getSAN()` SHALL return an empty array

#### Scenario: Invalid FEN
- **WHEN** `setFEN` is called with a malformed FEN string
- **THEN** it SHALL throw an error with a descriptive message

### Requirement: moveUCI method
The system SHALL provide a `moveUCI(uci: string)` method that accepts a UCI move string (4-5 characters: e.g. `e2e4`, `e7e8q`). It SHALL validate the move using `getLegalMoves` and return a result object: `{ success: true }` on a legal move, or `{ success: false, error: string }` with an explanation on an illegal move.

#### Scenario: Legal move succeeds
- **WHEN** `moveUCI("e2e4")` is called from the starting position
- **THEN** it SHALL return `{ success: true }`, update the board, switch active color to black, and record the move in history

#### Scenario: Illegal move fails with explanation
- **WHEN** `moveUCI("e2e5")` is called from the starting position (pawn cannot reach e5 in one move)
- **THEN** it SHALL return `{ success: false, error: "..." }` with a message explaining why the move is illegal

#### Scenario: Invalid UCI format
- **WHEN** `moveUCI("xyz")` is called with an unparseable string
- **THEN** it SHALL return `{ success: false, error: "..." }` explaining the invalid format

#### Scenario: Wrong color to move
- **WHEN** a white piece move is attempted when it is black's turn
- **THEN** it SHALL return `{ success: false, error: "..." }` indicating it is not that color's turn

#### Scenario: Castling via UCI
- **WHEN** `moveUCI("e1g1")` is called and kingside castling is legal for white
- **THEN** it SHALL move the king to g1 and the rook from h1 to f1, update castling rights, and return `{ success: true }`

#### Scenario: Promotion via UCI
- **WHEN** `moveUCI("e7e8q")` is called with a pawn on e7 and the move is legal
- **THEN** the pawn SHALL be replaced by a queen on e8 and the move SHALL be recorded with the promotion piece

#### Scenario: State updates after move
- **WHEN** a legal move is executed
- **THEN** the engine SHALL update: active color, castling rights (if king/rook moved), en passant square (if double pawn push), halfmove clock (reset on pawn move or capture, increment otherwise), fullmove number (increment after black's move)

### Requirement: Move history storage
The system SHALL maintain an internal array of all legal moves executed via `moveUCI`. Each record SHALL store sufficient data for SAN conversion: piece type, from square, to square, captured piece (if any), promotion piece (if any), and the game state before the move.

#### Scenario: History grows with moves
- **WHEN** three legal moves are executed via `moveUCI`
- **THEN** the internal history SHALL contain exactly 3 records

#### Scenario: History cleared on reset
- **WHEN** `reset()` is called
- **THEN** the history SHALL be empty

#### Scenario: History cleared on setFEN
- **WHEN** `setFEN` is called
- **THEN** the history SHALL be empty

### Requirement: getSAN method
The system SHALL provide a `getSAN(): string[]` method that returns the move history converted to Standard Algebraic Notation. Each entry SHALL follow SAN conventions: piece letter (K, Q, R, B, N; omitted for pawns), disambiguation (file/rank if needed), capture indicator (x), destination square, promotion (=Q/R/B/N), check (+), checkmate (#).

#### Scenario: SAN for pawn move
- **WHEN** a pawn moves from e2 to e4
- **THEN** `getSAN()` SHALL include `"e4"` for that move

#### Scenario: SAN for piece move
- **WHEN** a knight moves from g1 to f3
- **THEN** `getSAN()` SHALL include `"Nf3"` for that move

#### Scenario: SAN for capture
- **WHEN** a pawn on e4 captures on d5
- **THEN** `getSAN()` SHALL include `"exd5"` for that move

#### Scenario: SAN for castling
- **WHEN** kingside castling is executed
- **THEN** `getSAN()` SHALL include `"O-O"` for that move

#### Scenario: SAN for queenside castling
- **WHEN** queenside castling is executed
- **THEN** `getSAN()` SHALL include `"O-O-O"` for that move

#### Scenario: SAN for promotion
- **WHEN** a pawn promotes to a queen on e8
- **THEN** `getSAN()` SHALL include `"e8=Q"` for that move

#### Scenario: SAN with check indicator
- **WHEN** a move puts the opponent's king in check
- **THEN** the SAN entry SHALL end with `"+"`

#### Scenario: SAN with checkmate indicator
- **WHEN** a move delivers checkmate
- **THEN** the SAN entry SHALL end with `"#"`

#### Scenario: SAN disambiguation
- **WHEN** two knights can move to the same square
- **THEN** the SAN entry SHALL include the file (or rank, or both) of the moving piece to disambiguate
