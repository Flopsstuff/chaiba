## ADDED Requirements

### Requirement: Pieces are draggable

The system SHALL allow the user to initiate a drag operation on any piece on the board.

#### Scenario: Drag starts on piece

- **WHEN** the user presses and drags on a piece
- **THEN** the piece visually follows the pointer during the drag

#### Scenario: Drop on square

- **WHEN** the user releases the piece over a square
- **THEN** the piece state SHALL update to the new square; the board reflects the move

### Requirement: Board state updates on drop

The system SHALL update the internal board state when a piece is dropped on a valid destination.

#### Scenario: Piece moves to empty square

- **WHEN** a piece is dropped on an empty square (valid or invalid per rules)
- **THEN** the piece is removed from its origin square and placed on the destination square

#### Scenario: Piece captures

- **WHEN** a piece is dropped on a square occupied by an opponent piece
- **THEN** the opponent piece is removed and the moved piece occupies the square
