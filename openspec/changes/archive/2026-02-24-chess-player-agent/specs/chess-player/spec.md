## ADDED Requirements

### Requirement: ChessPlayer configuration
The system SHALL create a ChessPlayer from a configuration object containing: player name, chess color (`white` | `black`), OpenRouter model identifier, and system prompt. The configuration SHALL be immutable after construction.

#### Scenario: Create a white player
- **WHEN** a ChessPlayer is constructed with `{ name: "Stockfish-GPT", color: "white", model: "openai/gpt-4o", systemPrompt: "..." }` and a valid API key
- **THEN** the player instance exposes `name`, `color`, `model`, and `systemPrompt` as read-only properties

#### Scenario: Create a player without API key
- **WHEN** a ChessPlayer is constructed but no OpenRouter API key is set in localStorage
- **THEN** construction SHALL throw an error indicating the API key is missing

### Requirement: Player status lifecycle
The system SHALL track player status as one of: `idle`, `thinking`, `error`. Status SHALL be `idle` on construction.

#### Scenario: Status transitions during generation
- **WHEN** `generate()` is called on an idle player
- **THEN** status transitions to `thinking` before the API call and back to `idle` after the response is received

#### Scenario: Status on API error
- **WHEN** `generate()` is called and the OpenRouter API returns an error
- **THEN** status transitions to `error` and the error message is accessible on the player

### Requirement: Move generation via tool call
The system SHALL define a `make-move` tool with a Zod schema accepting `{ move: string, reasoning?: string }`. The model SHALL use this tool to submit chess moves in algebraic notation.

#### Scenario: Model produces a move
- **WHEN** `generate()` is called with a board position prompt
- **THEN** the response contains a tool call to `make-move` with a `move` string and the tool call data is returned alongside any text response

#### Scenario: Model responds without calling make-move
- **WHEN** `generate()` is called and the model responds with only text (no tool call)
- **THEN** the text response is returned with an empty tool calls array

### Requirement: Per-player message history
Each ChessPlayer SHALL maintain its own ordered array of messages. Messages SHALL have a sender type (`system` | `player` | `user`), content string, and optional tool call data.

#### Scenario: Messages accumulate across generations
- **WHEN** `generate()` is called multiple times
- **THEN** each prompt and response is appended to the player's message history in chronological order

#### Scenario: System messages can be pushed externally
- **WHEN** a system message (e.g., board state update) is added via `addSystemMessage(content)`
- **THEN** the message appears in the player's history with sender type `system`

#### Scenario: Reset clears history
- **WHEN** `reset()` is called on a player
- **THEN** the message history is emptied and status returns to `idle`

### Requirement: System prompt composition
The system SHALL provide a `ChessPrompts` utility that composes a system prompt from: a base chess instruction, color-specific guidance (white/black), and optional custom instructions appended by the user.

#### Scenario: Default prompt for white
- **WHEN** `ChessPrompts.getSystemPrompt("white")` is called with no custom instructions
- **THEN** the returned prompt contains base chess rules and white-specific opening guidance

#### Scenario: Custom instructions appended
- **WHEN** `ChessPrompts.getSystemPrompt("black", "Play aggressively")` is called
- **THEN** the returned prompt contains base rules, black-specific guidance, and the custom text appended

#### Scenario: Prompts loadable from localStorage
- **WHEN** custom prompt templates exist in localStorage under `chess_prompts`
- **THEN** `ChessPrompts` uses the stored templates instead of defaults
