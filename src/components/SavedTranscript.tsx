import type { SavedTranscriptTurn } from "@/lib/user-stats";

function turnTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(date);
}

export default function SavedTranscript({
  turns,
  opponentName,
}: {
  turns: SavedTranscriptTurn[];
  opponentName: string;
}) {
  return (
    <section className="saved-transcript neon-panel" aria-labelledby="saved-transcript-title">
      <header>
        <div><span className="admin-eyebrow">СТЕНОГРАММА</span><h2 id="saved-transcript-title">Диалог поединка</h2></div>
        <p>{turns.length} реплик</p>
      </header>
      {turns.length ? (
        <ol>
          {turns.map((turn) => (
            <li key={turn.id} className={`saved-transcript-turn ${turn.speaker}`}>
              <div>
                <strong>{turn.speaker === "user" ? "Вы" : turn.speaker === "opponent" ? opponentName : "Система"}</strong>
                {turnTime(turn.spokenAt) && <time>{turnTime(turn.spokenAt)}</time>}
              </div>
              <p>{turn.text}</p>
            </li>
          ))}
        </ol>
      ) : <div className="dashboard-empty">Стенограмма этого поединка пуста.</div>}
    </section>
  );
}
