## ADDED Requirements

### Requirement: GameState type
The system SHALL provide a `GameState` interface in `src/chess/types.ts` containing all fields from FEN notation: `board` (Board), `activeColor` (PieceColor), `castlingRights` ({ K, Q, k, q: boolean }), `enPassantSquare` (number | null), `halfmoveClock` (number), `fullmoveNumber` (number).

#### Scenario: GameState contains all FEN fields
- **WHEN** a GameState object is created
- **THEN** it SHALL contain board, activeColor, castlingRights, enPassantSquare, halfmoveClock, and fullmoveNumber fields

### Requirement: getLegalMoves accepts GameState
The system SHALL change the signature of `getLegalMoves` from `(board: Board, fromIndex: number)` to `(state: GameState, fromIndex: number)`. The function SHALL return an array of legal target square indices for the piece at `fromIndex`.

#### Scenario: getLegalMoves uses GameState
- **WHEN** `getLegalMoves` is called with a GameState and a square index
- **THEN** it SHALL return legal moves considering the full game state (castling rights, en passant square, active color)

### Requirement: Pawn moves
The system SHALL generate legal pawn moves including: one square forward, two squares forward from starting rank, diagonal captures, en passant captures, and promotion moves.

#### Scenario: Pawn moves one square forward
- **WHEN** a pawn has an empty square ahead
- **THEN** getLegalMoves SHALL include that square

#### Scenario: Pawn moves two squares from starting rank
- **WHEN** a white pawn is on rank 1 (or black on rank 6) and both squares ahead are empty
- **THEN** getLegalMoves SHALL include the two-square advance

#### Scenario: Pawn captures diagonally
- **WHEN** an opponent piece is on a diagonal square ahead of the pawn
- **THEN** getLegalMoves SHALL include that capture square

#### Scenario: En passant capture
- **WHEN** the GameState `enPassantSquare` is set and the pawn can reach that square diagonally
- **THEN** getLegalMoves SHALL include the en passant capture square

#### Scenario: Pawn promotion
- **WHEN** a pawn reaches the last rank (rank 7 for white, rank 0 for black)
- **THEN** the move SHALL be treated as a promotion (the UCI string includes a promotion piece suffix: q, r, b, n)

### Requirement: Knight moves
The system SHALL generate legal knight moves in an L-shape pattern (2+1 squares). A knight SHALL move to any of up to 8 squares not occupied by a friendly piece.

#### Scenario: Knight move to empty square
- **WHEN** a knight has an empty L-shaped target square
- **THEN** getLegalMoves SHALL include that square

#### Scenario: Knight captures opponent piece
- **WHEN** an opponent piece occupies an L-shaped target square
- **THEN** getLegalMoves SHALL include that capture square

#### Scenario: Knight blocked by friendly piece
- **WHEN** a friendly piece occupies an L-shaped target square
- **THEN** getLegalMoves SHALL NOT include that square

### Requirement: Bishop moves
The system SHALL generate legal bishop moves along diagonals. A bishop SHALL slide any number of squares diagonally until blocked by a piece or the board edge.

#### Scenario: Bishop slides on empty diagonal
- **WHEN** a diagonal is clear of pieces
- **THEN** getLegalMoves SHALL include all squares along that diagonal to the board edge

#### Scenario: Bishop captures opponent on diagonal
- **WHEN** an opponent piece is on the diagonal
- **THEN** getLegalMoves SHALL include that square but no squares beyond it

#### Scenario: Bishop blocked by friendly piece
- **WHEN** a friendly piece is on the diagonal
- **THEN** getLegalMoves SHALL NOT include that square or any beyond it

### Requirement: Rook moves
The system SHALL generate legal rook moves along files and ranks. A rook SHALL slide any number of squares horizontally or vertically until blocked.

#### Scenario: Rook slides on empty file
- **WHEN** a file is clear of pieces
- **THEN** getLegalMoves SHALL include all squares along that file to the board edge

#### Scenario: Rook captures opponent on rank
- **WHEN** an opponent piece is on the same rank
- **THEN** getLegalMoves SHALL include that square but no squares beyond it

### Requirement: Queen moves
The system SHALL generate legal queen moves as a combination of rook moves (files/ranks) and bishop moves (diagonals).

#### Scenario: Queen moves like rook and bishop
- **WHEN** getLegalMoves is called for a queen
- **THEN** it SHALL return the union of rook-style and bishop-style moves from that square

### Requirement: King moves
The system SHALL generate legal king moves to any adjacent square (1 square in any direction) not occupied by a friendly piece, and castling moves when conditions are met.

#### Scenario: King moves one square
- **WHEN** an adjacent square is empty or occupied by an opponent piece
- **THEN** getLegalMoves SHALL include that square (if it does not leave the king in check)

#### Scenario: Kingside castling
- **WHEN** the king and kingside rook have not moved (castling rights K/k), squares between them are empty, the king is not in check, and the king does not pass through or land on an attacked square
- **THEN** getLegalMoves SHALL include the kingside castling destination (g1 for white, g8 for black)

#### Scenario: Queenside castling
- **WHEN** the king and queenside rook have not moved (castling rights Q/q), squares between them are empty, the king is not in check, and the king does not pass through or land on an attacked square
- **THEN** getLegalMoves SHALL include the queenside castling destination (c1 for white, c8 for black)

#### Scenario: Castling blocked by check
- **WHEN** the king is currently in check
- **THEN** getLegalMoves SHALL NOT include any castling moves

### Requirement: Check filtering
The system SHALL filter all pseudo-legal moves so that only moves that do not leave the active player's king in check are returned. A move that leaves or places the own king in check SHALL be excluded.

#### Scenario: Move exposes king to check
- **WHEN** moving a piece would leave the own king attacked by an opponent piece
- **THEN** getLegalMoves SHALL NOT include that move

#### Scenario: King cannot move into check
- **WHEN** a king move target is attacked by an opponent piece
- **THEN** getLegalMoves SHALL NOT include that square

#### Scenario: Pinned piece restricted
- **WHEN** a piece is pinned (removing it exposes the king to attack)
- **THEN** getLegalMoves SHALL only include moves along the pin line (if any)

### Requirement: Check detection
The system SHALL provide a function `isInCheck(state: GameState, color: PieceColor): boolean` that returns true if the given color's king is under attack.

#### Scenario: King is attacked
- **WHEN** an opponent piece can capture the king on the current board
- **THEN** `isInCheck` SHALL return true

#### Scenario: King is safe
- **WHEN** no opponent piece attacks the king's square
- **THEN** `isInCheck` SHALL return false

### Requirement: Checkmate detection
The system SHALL provide a function `isCheckmate(state: GameState, color: PieceColor): boolean` that returns true if the color is in check and has no legal moves.

#### Scenario: King in check with no escape
- **WHEN** a player's king is in check and no legal move can remove the check
- **THEN** `isCheckmate` SHALL return true

#### Scenario: King in check but can escape
- **WHEN** a player's king is in check but at least one legal move exists
- **THEN** `isCheckmate` SHALL return false

### Requirement: Stalemate detection
The system SHALL provide a function `isStalemate(state: GameState, color: PieceColor): boolean` that returns true if the color is NOT in check but has no legal moves.

#### Scenario: No legal moves but not in check
- **WHEN** a player has no legal moves and is not in check
- **THEN** `isStalemate` SHALL return true

#### Scenario: Has legal moves
- **WHEN** a player has at least one legal move
- **THEN** `isStalemate` SHALL return false
