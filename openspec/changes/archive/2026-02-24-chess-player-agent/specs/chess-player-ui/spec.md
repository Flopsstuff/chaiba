## ADDED Requirements

### Requirement: useChessPlayer hook
The system SHALL provide a `useChessPlayer` React hook that creates and manages a single ChessPlayer instance. The hook SHALL accept a player configuration and return: messages array, player status, `generate()` function, and `reset()` function.

#### Scenario: Hook initializes player
- **WHEN** `useChessPlayer({ name, color, model, systemPrompt })` is called in a component
- **THEN** the hook returns `{ messages: [], status: "idle", generate, reset }` on initial render

#### Scenario: Generate updates React state
- **WHEN** `generate(prompt)` is called from the hook
- **THEN** status reactively updates to `thinking`, then to `idle` after completion, and messages array re-renders with the new prompt and response

#### Scenario: Error state exposed
- **WHEN** the API call fails during `generate()`
- **THEN** status updates to `error` and an `error` field is populated with the error message

### Requirement: WhitePanel displays white player
WhitePanel SHALL mount a `useChessPlayer` hook configured for the white player. The panel SHALL display the player's chat history and current status.

#### Scenario: Panel shows chat messages
- **WHEN** the white player has messages in its history
- **THEN** WhitePanel renders each message with sender indicator and content

#### Scenario: Panel shows thinking indicator
- **WHEN** the white player status is `thinking`
- **THEN** WhitePanel displays a loading/thinking indicator

#### Scenario: Panel shows error state
- **WHEN** the white player status is `error`
- **THEN** WhitePanel displays the error message

### Requirement: BlackPanel displays black player
BlackPanel SHALL mount a `useChessPlayer` hook configured for the black player. The panel SHALL display the player's chat history and current status. Behavior mirrors WhitePanel requirements.

#### Scenario: Panel shows chat messages
- **WHEN** the black player has messages in its history
- **THEN** BlackPanel renders each message with sender indicator and content

#### Scenario: Panel shows thinking indicator
- **WHEN** the black player status is `thinking`
- **THEN** BlackPanel displays a loading/thinking indicator

### Requirement: Player chat isolation
Each panel SHALL display only its own player's messages. Players SHALL NOT see each other's chat history.

#### Scenario: White cannot see black messages
- **WHEN** both players have generated messages
- **THEN** WhitePanel shows only white player messages and BlackPanel shows only black player messages

#### Scenario: System messages appear in both panels
- **WHEN** a system message is pushed to both players
- **THEN** the message appears in both WhitePanel and BlackPanel
