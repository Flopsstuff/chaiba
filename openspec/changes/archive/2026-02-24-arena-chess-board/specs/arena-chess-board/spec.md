## ADDED Requirements

### Requirement: Board displays 8×8 grid

The system SHALL render an 8×8 grid of squares as the chess board.

#### Scenario: Board renders with correct dimensions

- **WHEN** the board is displayed
- **THEN** exactly 64 squares are visible in 8 rows and 8 columns

#### Scenario: Alternating square colors

- **WHEN** the board is displayed
- **THEN** adjacent squares have visually distinct background colors (e.g. light and dark)

### Requirement: White pieces at bottom

The system SHALL orient the board so white pieces start on the bottom ranks (rows 1–2 from user perspective).

#### Scenario: White pieces visible at bottom

- **WHEN** the board shows the starting position
- **THEN** white pieces (king, queen, rooks, bishops, knights, pawns) occupy the two bottom rows

#### Scenario: Black pieces visible at top

- **WHEN** the board shows the starting position
- **THEN** black pieces occupy the two top rows

### Requirement: Standard starting position

The system SHALL display the standard chess starting position (rooks a1/h1, knights b1/g1, bishops c1/f1, queen d1, king e1 for white; mirrored for black).

#### Scenario: Starting position correct

- **WHEN** a new game or board reset is requested
- **THEN** pieces are placed according to standard chess initial setup
