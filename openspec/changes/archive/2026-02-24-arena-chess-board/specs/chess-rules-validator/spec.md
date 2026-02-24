## ADDED Requirements

### Requirement: Legal moves computation

The system SHALL provide a function (or module) that computes legal moves for a piece at a given square given the current board state.

#### Scenario: Pawn moves

- **WHEN** getLegalMoves is called for a white pawn at its starting rank (row 2)
- **THEN** it SHALL return one square forward and optionally two squares forward (if both empty)

#### Scenario: Knight moves

- **WHEN** getLegalMoves is called for a knight
- **THEN** it SHALL return up to 8 L-shaped destinations (subject to board bounds and blocking)

#### Scenario: Blocked pieces

- **WHEN** a piece's path is blocked by another piece
- **THEN** destinations beyond the blocker SHALL NOT be returned; capture of the blocker MAY be returned if it is an opponent piece

#### Scenario: Captures vs non-captures

- **WHEN** getLegalMoves is called
- **THEN** it SHALL return squares that are empty (move) or occupied by opponent (capture); it SHALL NOT return squares occupied by same-color pieces

### Requirement: Pure logic, no side effects

The rules validator SHALL be pure: given board state and square, it returns an array of destination squares. No React, DOM, or I/O.

#### Scenario: Deterministic output

- **WHEN** getLegalMoves(board, square) is called twice with the same arguments
- **THEN** it SHALL return the same result
