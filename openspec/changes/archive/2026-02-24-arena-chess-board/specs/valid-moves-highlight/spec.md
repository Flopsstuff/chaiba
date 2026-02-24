## ADDED Requirements

### Requirement: Valid squares highlighted on selection

The system SHALL highlight cells that are valid move destinations when a piece is selected (clicked) or when dragging begins.

#### Scenario: Highlight on piece selection

- **WHEN** the user clicks (or otherwise selects) a piece
- **THEN** all valid destination squares for that piece SHALL be visually highlighted

#### Scenario: Highlight during drag

- **WHEN** the user is dragging a piece
- **THEN** valid destination squares SHALL remain highlighted for the duration of the drag

### Requirement: Highlight clears when selection ends

The system SHALL remove highlights when no piece is selected or being dragged.

#### Scenario: Highlight clears on drop

- **WHEN** the user drops a piece (or cancels the drag)
- **THEN** all highlight styling SHALL be removed from squares

#### Scenario: Highlight clears on click away

- **WHEN** the user clicks a non-piece square or outside the board
- **THEN** highlights SHALL be cleared

### Requirement: Valid destinations from rules

The highlighted squares SHALL be exactly those returned by the chess rules validator for the selected piece.

#### Scenario: Highlight matches legal moves

- **WHEN** a piece is selected
- **THEN** the set of highlighted squares SHALL equal the set returned by getLegalMoves for that piece and current board state
