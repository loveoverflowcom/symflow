use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, State,
    },
    response::IntoResponse,
};
use futures_util::{Sink, SinkExt, StreamExt};
use serde_json::Value;
use symflow_core::events::RunEvent;
use uuid::Uuid;

use crate::{app::AppState, auth::extractor::AuthUser, error::ApiError};

pub async fn run_logs_ws(
    _auth: AuthUser,
    ws: WebSocketUpgrade,
    Path(run_id): Path<Uuid>,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_ws(socket, state, run_id))
}

async fn handle_ws(mut socket: WebSocket, state: AppState, run_id: Uuid) {
    let (mut sender, mut receiver) = socket.split();

    if let Ok(steps) = state.store.list_steps(run_id).await {
        for step in steps {
            if let Some(Value::Array(entries)) = step.agent_logs {
                for entry in entries {
                    if let Some(event) = RunEvent::from_log_entry(run_id, &step.step_id, &entry) {
                        if send_json(&mut sender, &event).await.is_err() {
                            return;
                        }
                    }
                }
            }
        }
    }

    let mut rx = state.bus.subscribe();
    loop {
        tokio::select! {
            next_event = rx.recv() => {
                match next_event {
                    Ok(event) if event.run_id == run_id => {
                        if send_json(&mut sender, &event).await.is_err() {
                            break;
                        }
                    }
                    Ok(_) => {}
                    Err(tokio::sync::broadcast::error::RecvError::Lagged(_)) => {}
                    Err(tokio::sync::broadcast::error::RecvError::Closed) => break,
                }
            }
            inbound = receiver.next() => {
                match inbound {
                    Some(Ok(Message::Close(_))) | None => break,
                    Some(Ok(_)) => {}
                    Some(Err(_)) => break,
                }
            }
        }
    }
}

async fn send_json<S>(socket: &mut S, event: &RunEvent) -> Result<(), ApiError>
where
    S: Sink<Message> + Unpin,
    <S as Sink<Message>>::Error: std::fmt::Display,
{
    let payload =
        serde_json::to_string(event).map_err(|err| ApiError::internal(err.to_string()))?;
    socket
        .send(Message::Text(payload.into()))
        .await
        .map_err(|err| ApiError::internal(err.to_string()))
}
