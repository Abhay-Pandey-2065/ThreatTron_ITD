## Activity Log Schema

Fields:
- user_id: string
- event_type: string
- timestamp: ISO 8601
- metadata: JSON (event-specific)

Event Types:
- file_access
- process_activity
- network_activity
- session_activity

# Its Changable, for now its temporary, will be done according to whatever data AI model uses